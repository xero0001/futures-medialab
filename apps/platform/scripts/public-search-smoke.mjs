import assert from "node:assert/strict";
import console from "node:console";
import { URL } from "node:url";
import { parseArgs } from "node:util";

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
  const json = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? JSON.parse(raw)
    : null;
  return { response, raw, json };
}

for (const path of [
  "/storage/search",
  "/storage/search/montage",
  "/storage/search/montage2",
  "/storage/search/seed",
  "/storage/search/beizier",
  "/storage/search/tds",
  "/storage/similar-search",
  "/storage/similar-brands",
  "/storage/collect",
]) {
  const result = await request(`${path}?lang=ko`);
  assert.ok(
    [303, 307, 308].includes(result.response.status),
    `${path} must redirect`,
  );
  const destination = new URL(result.response.headers.get("location"), baseUrl);
  assert.equal(destination.pathname, "/login");
  assert.equal(destination.searchParams.get("lang"), "ko");
  console.log(`PASS retired page ${path}`);
}
for (const [path, body] of [
  ["/api/directory/preview"],
  ["/api/workspace/search", { mode: "similar" }],
  ["/api/workspace/collections", { action: "create", name: "Not saved" }],
  ["/api/creator-images/known-id/v1"],
]) {
  const result = await request(path, body);
  assert.equal(result.response.status, 404);
  assert.match(result.response.headers.get("cache-control"), /no-store/);
  assert.equal(result.json.code, "NOT_FOUND");
  console.log(`PASS retired endpoint ${path}`);
}
const bootstrap = await request("/api/workspace/bootstrap");
assert.equal(bootstrap.response.status, 401);
assert.equal(bootstrap.json.code, "UNAUTHORIZED");
console.log("PASS private workspace still requires login");
