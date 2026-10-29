import assert from "node:assert/strict";
import console from "node:console";
import { URL } from "node:url";
import { parseArgs } from "node:util";
import { defaultFilters, filterCreators } from "../lib/creator-directory.ts";

// Run against a local server with the same configured origin. No session,
// synthetic account, database fixture, or environment-file access is needed.
const { values } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://localhost:3002" },
  },
});
const baseUrl = new URL(values["base-url"]);
assert.ok(
  ["http:", "https:"].includes(baseUrl.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname) &&
    !baseUrl.username &&
    !baseUrl.password &&
    baseUrl.pathname === "/" &&
    !baseUrl.search &&
    !baseUrl.hash,
  "--base-url must be a local HTTP(S) origin",
);

async function request(path, body) {
  const response = await globalThis.fetch(new URL(path, baseUrl), {
    method: body === undefined ? "GET" : "POST",
    redirect: "manual",
    signal: globalThis.AbortSignal.timeout(60_000),
    headers: {
      Origin: baseUrl.origin,
      "Sec-Fetch-Site": "same-origin",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  const json = response.headers.get("content-type")?.includes("application/json")
    ? JSON.parse(raw)
    : null;
  return { response, raw, json };
}

for (const variant of ["montage", "montage2", "seed"]) {
  const path = `/storage/search/${variant}?lang=ko`;
  const result = await request(path);
  assert.equal(result.response.status, 200, `${path} must load without a session`);
  assert.equal(result.response.headers.get("location"), null);
  assert.doesNotMatch(result.raw, /NEXT_REDIRECT/);
  assert.match(result.raw, /크리에이터/);
  console.log(`PASS anonymous page ${variant}`);
}

const preview = await request("/api/directory/preview");
assert.equal(preview.response.status, 200, "Public creator data must load");
assert.deepEqual(Object.keys(preview.json).sort(), [
  "collections",
  "creators",
  "recentSearches",
]);
assert.deepEqual(preview.json.collections, []);
assert.deepEqual(preview.json.recentSearches, []);
assert.ok(preview.json.creators.length > 0, "Seed published demo creators first");
for (const creator of preview.json.creators) {
  assert.ok(creator.id && creator.name && creator.platform);
  assert.equal(new URL(creator.profileUrl).protocol, "https:");
  assert.equal(creator.payload, undefined, "Never expose raw database payloads");
  assert.equal(creator.avatar, undefined, "Never expose private image metadata");
  if (creator.avatarUrl) assert.match(creator.avatarUrl, /^\/api\/creator-images\//);
}
const first = preview.json.creators[0];
const filtered = filterCreators(
  { ...defaultFilters(first.platform), query: first.handle },
  preview.json.creators,
);
assert.ok(filtered.some((creator) => creator.id === first.id));
assert.ok(filtered.every((creator) => creator.platform === first.platform));
console.log("PASS public data and guest filtering without workspace history");

const privatePage = await request("/storage/search?lang=ko");
assert.ok([303, 307, 308].includes(privatePage.response.status));
const destination = new URL(privatePage.response.headers.get("location"), baseUrl);
assert.equal(destination.pathname, "/login");
assert.equal(destination.searchParams.get("lang"), "ko");
console.log("PASS normal workspace still requires login");

const bootstrap = await request("/api/workspace/bootstrap");
assert.equal(bootstrap.response.status, 401);
assert.equal(bootstrap.json.code, "UNAUTHORIZED");
const collection = await request("/api/workspace/collections", {
  action: "create",
  name: "Anonymous access must be rejected",
});
assert.equal(collection.response.status, 401);
assert.equal(collection.json.code, "UNAUTHORIZED");
console.log("PASS private workspace reads and writes still require login");
