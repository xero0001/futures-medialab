import assert from "node:assert/strict";
import console from "node:console";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";

// Explicit maintenance command. Preparing assets is local; only --apply writes
// to Blob/DB. It never replaces fictional fixtures or private agency profiles.
const { fetch, AbortSignal } = globalThis;
const root = fileURLToPath(new URL("../../../", import.meta.url));
const platformRequire = createRequire(
  new URL("../package.json", import.meta.url),
);
const databaseRequire = createRequire(
  new URL("../../../packages/database/package.json", import.meta.url),
);
const sourcePath = resolve(
  root,
  "apps/platform/scripts/fixtures/korean-creators.sources.json",
);
const retiredPath = resolve(
  root,
  "apps/platform/scripts/fixtures/korean-creators.retired.json",
);
const manifestPath = resolve(
  root,
  "apps/platform/lib/creator-demo-images.json",
);
const assetDirectory = resolve(root, "output/creator-demo-assets");
const { values } = parseArgs({
  options: {
    "env-file": { type: "string", default: "apps/platform/.env.local" },
    prepare: { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
  },
});
assert.ok(
  !(values.prepare && values.apply),
  "Prepare and review assets before applying them",
);

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const localAsset = (asset) =>
  resolve(assetDirectory, `${asset.id}-${asset.sha256}.webp`);
const sourceHosts = new Set(["yt3.googleusercontent.com", "yt3.ggpht.com"]);
function approvedSource(value) {
  const url = new URL(value);
  assert.ok(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      sourceHosts.has(url.hostname),
    "Use an official YouTube avatar CDN URL",
  );
  return url;
}
async function readBounded(stream, maximum) {
  assert.ok(stream, "Missing image body");
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new Error("Image exceeds the byte limit");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    reader.releaseLock();
  }
}
async function download(source) {
  let url = approvedSource(source);
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      url = approvedSource(new URL(response.headers.get("location"), url).href);
      continue;
    }
    assert.ok(response.ok, "Official avatar download failed");
    assert.match(
      response.headers.get("content-type") ?? "",
      /^image\/(?:jpeg|png|webp)(?:;|$)/i,
    );
    return readBounded(response.body, 8 * 1024 * 1024);
  }
  throw new Error("Too many avatar redirects");
}
function validateSources(sources) {
  assert.ok(
    Array.isArray(sources) && sources.length >= 1 && sources.length <= 30,
  );
  assert.equal(
    new Set(sources.map((source) => source.id)).size,
    sources.length,
  );
  for (const source of sources) {
    assert.match(source.id, /^demo-youtube-kr-[a-z0-9-]+$/);
    assert.equal(source.platform, "youtube");
    assert.ok(
      source.name && source.handle?.startsWith("@") && source.tags?.length,
    );
    const profile = new URL(source.profileUrl);
    assert.equal(profile.protocol, "https:");
    assert.equal(profile.hostname, "www.youtube.com");
    assert.ok(
      !profile.username &&
        !profile.password &&
        /^\/(?:@[^/]+|channel\/UC[\w-]+)\/?$/.test(profile.pathname),
    );
    assert.equal(new URL(source.sourcePageUrl).origin, profile.origin);
    approvedSource(source.imageSourceUrl);
    assert.ok(
      ["lineage", "maplestory", "lostark"].includes(source.primaryGame),
    );
    assert.ok(source.tags.includes(source.primaryGame));
    assert.ok(
      source.relevanceEvidence?.length >= 2,
      "Require game-specific video evidence for every channel",
    );
    for (const evidence of source.relevanceEvidence) {
      const video = new URL(evidence.url);
      assert.equal(video.origin, "https://www.youtube.com");
      assert.equal(video.pathname, "/watch");
      assert.match(video.searchParams.get("v") ?? "", /^[a-zA-Z0-9_-]{11}$/);
      assert.ok(
        evidence.title?.trim() && evidence.title.length <= 300 && evidence.game,
      );
    }
  }
  for (const game of ["lineage", "maplestory", "lostark"])
    assert.ok(
      sources.some((source) => source.primaryGame === game),
      `Missing game coverage: ${game}`,
    );
}
function payload(source, avatar, index) {
  // Deliberately synthetic metrics, not scraped/current audience measurements.
  const followers = [
    420_000, 180_000, 95_000, 680_000, 330_000, 140_000, 260_000, 175_000,
    210_000,
  ][index % 9];
  return {
    id: source.id,
    name: source.name,
    handle: source.handle,
    profileUrl: source.profileUrl,
    platform: "youtube",
    country: "KR",
    language: "ko",
    followers,
    views10: 28_000 + index * 5_500,
    views30: 24_000 + index * 4_300,
    volatility: Number((0.18 + (index % 5) * 0.13).toFixed(2)),
    engagement: Number((2.8 + (index % 6) * 0.65).toFixed(2)),
    tags: source.tags,
    bio: source.bio,
    // These titles were checked on the channel's actual game videos. No endorsements.
    content: source.relevanceEvidence.map((evidence) => evidence.title),
    brands: [],
    videoTypes: ["video", "shorts"],
    daysSincePosted: [1, 3, 6, 2, 5, 4, 8, 7, 2, 9][index % 10],
    audienceCountry: "KR",
    audienceAge: "25-34",
    audienceGender: "mixed",
    accent: "#0066FF",
    identityKind: "public_channel",
    avatar,
  };
}

try {
  const sources = JSON.parse(await readFile(sourcePath, "utf8"));
  validateSources(sources);
  const retiredIds = JSON.parse(await readFile(retiredPath, "utf8"));
  assert.ok(Array.isArray(retiredIds) && retiredIds.length <= 30);
  assert.equal(new Set(retiredIds).size, retiredIds.length);
  for (const id of retiredIds) {
    assert.match(id, /^demo-youtube-kr-[a-z0-9-]+$/);
    assert.ok(
      !sources.some((source) => source.id === id),
      "Active and retired IDs must not overlap",
    );
  }
  if (values.prepare) {
    const nextRequire = createRequire(
      platformRequire.resolve("next/package.json"),
    );
    const sharp = nextRequire("sharp");
    await mkdir(assetDirectory, { recursive: true });
    const assets = [];
    for (const source of sources) {
      const input = await download(source.imageSourceUrl);
      assert.equal(
        sha256(input),
        source.verification.imageSha256,
        "Review changed source images before preparing",
      );
      const output = await sharp(input, {
        limitInputPixels: 16_000_000,
        animated: false,
      })
        .rotate()
        .resize(512, 512, { fit: "cover" })
        .webp({ quality: 88 })
        .toBuffer();
      assert.ok(output.byteLength <= 2 * 1024 * 1024);
      const hash = sha256(output);
      const asset = {
        id: source.id,
        sha256: hash,
        pathname: `creator-directory/public-demo/${source.id}/${hash}.webp`,
        contentType: "image/webp",
        sourceUrl: source.imageSourceUrl,
        sourcePageUrl: source.sourcePageUrl,
      };
      await writeFile(localAsset(asset), output);
      assets.push(asset);
      console.log(`PREPARED ${source.name}: ${output.byteLength} bytes`);
    }
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(assets, null, 2)}\n`);
    console.log(
      `Prepared ${assets.length} local avatars and the explicit public-image manifest. No DB/Blob writes.`,
    );
  } else if (!values.apply) {
    console.log(
      `DRY RUN: ${sources.length} verified public YouTube identities; metrics will be synthetic. No DB/Blob access.`,
    );
    console.log(sources.map((source) => source.name).join(", "));
    console.log(
      `Retire ${retiredIds.length} explicitly listed earlier demo channels by unpublishing only.`,
    );
  } else {
    const assets = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.equal(
      assets.length,
      sources.length,
      "Prepare and review every source image first",
    );
    assert.equal(new Set(assets.map((asset) => asset.id)).size, assets.length);
    const prepared = [];
    for (const source of sources) {
      const asset = assets.find((candidate) => candidate.id === source.id);
      assert.ok(
        asset &&
          asset.sourceUrl === source.imageSourceUrl &&
          asset.sourcePageUrl === source.sourcePageUrl,
      );
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
      assert.equal(
        asset.pathname,
        `creator-directory/public-demo/${source.id}/${asset.sha256}.webp`,
      );
      assert.equal(asset.contentType, "image/webp");
      const bytes = await readFile(localAsset(asset));
      assert.equal(sha256(bytes), asset.sha256);
      assert.ok(
        bytes.byteLength <= 2 * 1024 * 1024 &&
          bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP",
      );
      prepared.push({ source, asset, bytes });
    }
    const loaded = databaseRequire("dotenv").config({
      path: resolve(root, values["env-file"]),
      quiet: true,
      override: false,
    });
    assert.ok(
      !loaded.error &&
        process.env.DATABASE_URL &&
        process.env.BLOB_READ_WRITE_TOKEN,
      "Configure the selected DB and private Blob environment",
    );
    const { createDatabaseClient } =
      await import("../../../packages/database/src/client-factory.mjs");
    const { put, get, BlobNotFoundError } = platformRequire("@vercel/blob");
    const db = createDatabaseClient();
    try {
      const ids = sources.map((source) => source.id);
      assert.equal(
        await db.creatorDirectoryEntry.count({
          where: { id: { in: ids }, isDemo: false },
        }),
        0,
        "Never overwrite non-demo entries",
      );
      for (const { source, asset, bytes } of prepared) {
        let existing;
        try {
          existing = await get(asset.pathname, {
            access: "private",
            useCache: false,
            abortSignal: AbortSignal.timeout(20_000),
          });
        } catch (error) {
          if (!(error instanceof BlobNotFoundError)) throw error;
        }
        if (existing) {
          assert.equal(existing.statusCode, 200);
          assert.equal(
            sha256(await readBounded(existing.stream, 2 * 1024 * 1024)),
            asset.sha256,
            "Existing content-addressed image differs",
          );
        } else {
          await put(asset.pathname, bytes, {
            access: "private",
            addRandomSuffix: false,
            allowOverwrite: false,
            contentType: asset.contentType,
            cacheControlMaxAge: 31_536_000,
            abortSignal: AbortSignal.timeout(30_000),
          });
        }
        console.log(`BLOB READY ${source.name}`);
      }
      await db.$transaction(
        async (tx) => {
          for (const [index, { source, asset }] of prepared.entries()) {
            const avatar = { ...asset };
            delete avatar.id;
            const data = {
              platform: "youtube",
              isDemo: true,
              isPublished: true,
              payload: payload(source, avatar, index),
            };
            await tx.creatorDirectoryEntry.upsert({
              where: { id: source.id, isDemo: true },
              create: { id: source.id, ...data },
              update: data,
            });
          }
          await tx.creatorDirectoryEntry.updateMany({
            where: {
              id: { in: retiredIds },
              platform: "youtube",
              isDemo: true,
            },
            data: { isPublished: false },
          });
        },
        { maxWait: 10_000, timeout: 60_000 },
      );
      console.log(
        `SEEDED ${sources.length} game-focused public channel demos with Blob avatars. Unpublished ${retiredIds.length} explicitly retired demo IDs; no records deleted.`,
      );
    } finally {
      await db.$disconnect();
    }
  }
} catch (error) {
  // Avoid logging SDK/DB errors that could contain credentials or signed URLs.
  console.error(
    `Korean creator seed failed (${error?.code ?? error?.name ?? "unknown"}). No environment values logged.`,
  );
  if (error instanceof assert.AssertionError) console.error(error.message);
  process.exitCode = 1;
}
