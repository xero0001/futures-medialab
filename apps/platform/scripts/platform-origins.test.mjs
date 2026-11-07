import assert from "node:assert/strict";
import test from "node:test";
import {
  allowsPlatformWrite,
  trustedPlatformOrigins,
} from "../lib/platform-origins.ts";
const primary = "https://www.futuresmedia.app",
  alias = "https://futures-medialab.vercel.app";
const headers = (origin, site = "same-origin") =>
  new globalThis.Headers({
    ...(origin ? { origin } : {}),
    ...(site ? { "sec-fetch-site": site } : {}),
  });
test("both production addresses allow login and same-origin application writes", () => {
  for (const base of [alias, primary])
    for (const origin of [primary, alias]) {
      assert.ok(trustedPlatformOrigins(base).includes(origin));
      assert.ok(allowsPlatformWrite(headers(origin), base));
    }
});
test("local and preview deployments keep independent origin boundaries", () => {
  for (const base of ["http://127.0.0.1:3135", "https://feature.example"]) {
    assert.deepEqual(trustedPlatformOrigins(base), [base]);
    assert.ok(allowsPlatformWrite(headers(base), base));
    assert.equal(allowsPlatformWrite(headers(primary), base), false);
  }
});
test("missing, lookalike and cross-site origins cannot authorize a write", () => {
  for (const origin of [
    null,
    "null",
    "https://www.futuresmedia.app.attacker.test",
    "https://unrelated.vercel.app",
    "http://www.futuresmedia.app",
    "https://www.futuresmedia.app:9000",
  ]) {
    assert.equal(allowsPlatformWrite(headers(origin), alias), false);
  }
  for (const site of ["same-site", "cross-site"])
    assert.equal(allowsPlatformWrite(headers(primary, site), alias), false);
  const forged = headers("https://evil.example");
  forged.set("x-forwarded-host", "www.futuresmedia.app");
  assert.equal(allowsPlatformWrite(forged, alias), false);
});

test("without Fetch Metadata a trusted alias must match the destination host", () => {
  const h = headers(primary, null);
  h.set("host", "futures-medialab.vercel.app");
  assert.equal(allowsPlatformWrite(h, alias), false);
  h.set("host", "www.futuresmedia.app:443");
  assert.ok(allowsPlatformWrite(h, alias));
});
