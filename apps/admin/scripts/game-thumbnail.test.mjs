import { Buffer } from "node:buffer";
import process from "node:process";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";
import sharp from "sharp";
import {
  normalizeGameImage,
  InvalidGameImage,
} from "../lib/game-thumbnail-image.ts";
import * as shared from "../../../packages/database/src/game-thumbnail-shared.ts";
const require = createRequire(import.meta.url);
function load(path, overrides) {
  const module = { exports: {} };
  const source = ts.transpileModule(
    readFileSync(new globalThis.URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  runInThisContext(`(function(exports,require,module){${source}\n})`)(
    module.exports,
    (key) => (Object.hasOwn(overrides, key) ? overrides[key] : require(key)),
    module,
  );
  return module.exports;
}
class Failure extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const png = await sharp({
  create: { width: 48, height: 32, channels: 3, background: "#4285ff" },
})
  .png()
  .toBuffer();
function setup(options = {}) {
  const blobs = new Map(),
    audits = [];
  let reads = 0,
    checks = 0,
    lookups = 0;
  class MissingBlob extends Error {}
  const storage = load(
    "../../../packages/database/src/game-thumbnail-storage.ts",
    {
      "@futures-medialab/database/game-thumbnail-shared": shared,
      "@vercel/blob": {
        BlobNotFoundError: MissingBlob,
        put: async (path, bytes, opts) => {
          assert.equal(opts.access, "private");
          assert.equal(opts.contentType, "image/webp");
          if (options.storeFailure) throw Error("unavailable");
          blobs.set(path, Buffer.from(bytes));
          return { pathname: path };
        },
        head: async (path) => {
          if (!blobs.has(path)) throw new MissingBlob();
          return {
            pathname: path,
            contentType: "image/webp",
            size: blobs.get(path).length,
          };
        },
        get: async (path) => {
          reads++;
          if (!blobs.has(path)) return null;
          const bytes = options.tamper
            ? Buffer.from("RIFFxxxxWEBPtampered")
            : blobs.get(path);
          return {
            statusCode: 200,
            blob: {
              pathname: path,
              contentType: "image/webp",
              size: bytes.length,
            },
            stream: new globalThis.ReadableStream({
              start(c) {
                c.enqueue(bytes);
                c.close();
              },
            }),
          };
        },
      },
    },
  );
  const db = {
    auditLog: { create: async ({ data }) => audits.push(data) },
    $transaction: async (work) => work(db),
  };
  const access = {
    verifyOrigin: (req) => {
      if (req.headers.get("origin") !== "https://admin.example.com")
        throw new Failure(403, "origin");
    },
    requireAdmin: async () => {
      if (options.nonAdmin) throw new Failure(403, "forbidden");
      return { userId: "admin", sessionId: "s1" };
    },
    recheckAdmin: async () => {
      checks++;
      if (options.revoked) throw new Failure(401, "revoked");
    },
    rateLimit: async () => {},
    fail: (status, code, message) => {
      throw new Failure(status, message || code);
    },
    json: (value) => globalThis.Response.json(value),
    boundary: async (work) => {
      try {
        return await work();
      } catch (e) {
        return globalThis.Response.json(
          { message: e.message },
          { status: e.status ?? 503 },
        );
      }
    },
  };
  const api = load("../lib/game-thumbnail-api.ts", {
    "server-only": {},
    "@futures-medialab/database": { getDatabase: () => db },
    "@futures-medialab/database/game-thumbnail-shared": shared,
    "@futures-medialab/database/game-thumbnail-storage": storage,
    "./access": access,
    "./game-thumbnail-image": { normalizeGameImage, InvalidGameImage },
  });
  const platform = load("../../platform/lib/game-thumbnail-api.ts", {
    "server-only": {},
    "@futures-medialab/database/game-thumbnail-shared": shared,
    "@futures-medialab/database/game-thumbnail-storage": storage,
    "./auth": {
      getAuth: () => ({
        api: {
          getSession: async () =>
            options.noSession ? null : { user: { id: "brand-user" } },
        },
      }),
    },
    "./workspace-api": {
      workspaceBoundary: access.boundary,
      fail: access.fail,
    },
    "@futures-medialab/database": {
      getDatabase: () => ({
        organizationMember: {
          findMany: async () =>
            options.noMembership ? [] : [{ organizationId: "brand_1" }],
        },
        gameCatalog: {
          findFirst: async ({ where }) => {
            lookups++;
            assert.ok(where.thumbnailUrl.startsWith("/api/games/thumbnails/"));
            assert.deepEqual(where.OR[1], {
              organizationId: { in: ["brand_1"] },
            });
            return options.hiddenGame ? null : { id: "game_1" };
          },
        },
      }),
    },
  });
  return {
    blobs,
    audits,
    storage,
    get reads() {
      return reads;
    },
    get checks() {
      return checks;
    },
    get lookups() {
      return lookups;
    },
    upload: (
      bytes = png,
      type = "image/png",
      origin = "https://admin.example.com",
    ) =>
      api.uploadGameThumbnail(
        new globalThis.Request(
          "https://admin.example.com/api/admin/games/thumbnail",
          {
            method: "POST",
            headers: { origin, "content-type": type },
            body: bytes,
          },
        ),
      ),
    adminGet: (hash) =>
      api.adminGameThumbnail(
        new globalThis.Request(
          "https://admin.example.com/api/games/thumbnails/" + hash,
        ),
        hash,
      ),
    brandGet: (hash) =>
      platform.platformGameThumbnail(
        new globalThis.Request(
          "https://brand.example.com/api/games/thumbnails/" + hash,
        ),
        hash,
      ),
  };
}
const oldToken = process.env.BLOB_READ_WRITE_TOKEN;
process.env.BLOB_READ_WRITE_TOKEN = "test-storage-token";
test.after(() => {
  if (oldToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = oldToken;
});

test("real image decoding bounds dimensions, removes EXIF and rejects fake, mismatched and animated files", async () => {
  const input = await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "red" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const image = await normalizeGameImage(input, "image/jpeg"),
    metadata = await sharp(image).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 768);
  assert.equal(metadata.height, 1024);
  assert.equal(metadata.exif, undefined);
  await assert.rejects(
    () => normalizeGameImage(Buffer.from("<svg><script/></svg>"), "image/png"),
    InvalidGameImage,
  );
  await assert.rejects(
    () => normalizeGameImage(png, "image/jpeg"),
    InvalidGameImage,
  );
  await assert.rejects(
    () => normalizeGameImage(png, "image/svg+xml"),
    InvalidGameImage,
  );
  await assert.rejects(
    () =>
      normalizeGameImage(
        Buffer.alloc(shared.GAME_THUMBNAIL_MAX_BYTES + 1),
        "image/png",
      ),
    InvalidGameImage,
  );
  const animated = await sharp({
    create: {
      width: 20,
      height: 40,
      channels: 3,
      background: "blue",
      pageHeight: 20,
    },
  })
    .gif()
    .toBuffer();
  await assert.rejects(
    () => normalizeGameImage(animated, "image/webp"),
    InvalidGameImage,
  );
});
test("upload stores only normalized private bytes and authenticated reads survive a later request", async () => {
  const f = setup();
  const response = await f.upload();
  assert.equal(response.status, 200);
  const { thumbnailUrl } = await response.json(),
    hash = shared.gameThumbnailHash(thumbnailUrl);
  assert.ok(hash);
  assert.equal(f.audits[0].action, "admin.game.thumbnail_upload");
  assert.equal(await f.storage.storedGameThumbnailExists(thumbnailUrl), true);
  const admin = await f.adminGet(hash),
    brand = await f.brandGet(hash);
  assert.equal(admin.status, 200);
  assert.equal(brand.status, 200);
  assert.equal(brand.headers.get("cache-control"), "private, no-store");
  assert.equal(brand.headers.get("content-type"), "image/webp");
  const bytes = Buffer.from(await brand.arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
  assert.equal(f.lookups, 2);
  await f.upload();
  assert.equal(f.blobs.size, 1);
});
test("invalid, oversized and foreign-origin uploads never reach storage", async () => {
  for (const [bytes, type, origin, status] of [
    [png, "image/png", "https://evil.example.com", 403],
    [Buffer.from("fake"), "image/png", "https://admin.example.com", 400],
    [png, "image/svg+xml", "https://admin.example.com", 400],
    [
      Buffer.alloc(shared.GAME_THUMBNAIL_MAX_BYTES + 1),
      "image/png",
      "https://admin.example.com",
      413,
    ],
  ]) {
    const f = setup();
    assert.equal((await f.upload(bytes, type, origin)).status, status);
    assert.equal(f.blobs.size, 0);
  }
  for (const options of [{ nonAdmin: true }, { revoked: true }]) {
    const f = setup(options);
    assert.ok([401, 403].includes((await f.upload()).status));
    assert.equal(f.blobs.size, 0);
  }
});
test("storage failure is retryable and does not create a completion audit", async () => {
  const f = setup({ storeFailure: true });
  assert.equal((await f.upload()).status, 503);
  assert.equal(f.audits.length, 0);
});
test("brand image reads enforce session, membership, game visibility and integrity", async () => {
  for (const [options, status] of [
    [{ noSession: true }, 401],
    [{ noMembership: true }, 403],
    [{ hiddenGame: true }, 404],
    [{ tamper: true }, 404],
  ]) {
    const f = setup(options);
    const { thumbnailUrl } = await (await f.upload()).json();
    const hash = shared.gameThumbnailHash(thumbnailUrl);
    assert.equal((await f.brandGet(hash)).status, status);
    if (!options.tamper) assert.equal(f.reads, 0);
  }
  const f = setup();
  assert.equal((await f.brandGet("../private")).status, 404);
  assert.equal(f.reads, 0);
  assert.equal(
    await f.storage.storedGameThumbnailExists(
      "/api/games/thumbnails/" + "0".repeat(64),
    ),
    false,
  );
});
