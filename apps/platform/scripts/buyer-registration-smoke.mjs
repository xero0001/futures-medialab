import assert from "node:assert/strict";
import console from "node:console";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";

const require = createRequire(
  new URL("../../../packages/database/package.json", import.meta.url),
);
require("dotenv").config({
  path: fileURLToPath(new URL("../.env.local", import.meta.url)),
  quiet: true,
  override: false,
});
const base = new URL(process.env.BETTER_AUTH_URL);
assert.ok(
  ["localhost", "127.0.0.1"].includes(base.hostname),
  "Run only against a local app",
);
const db = createDatabaseClient();
const run = `${Date.now()}-${randomBytes(6).toString("hex")}`;
const email = `buyer-qa-${run}@example.invalid`;
const name = `Buyer QA ${run}`;
const password = randomBytes(24).toString("hex");
const input = {
  role: "client-agency",
  organizationName: name,
  companySize: "15–49",
  email,
  password,
  locale: "ko",
};
async function call(path, { body, cookie } = {}) {
  const response = await globalThis.fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    redirect: "manual",
    signal: globalThis.AbortSignal.timeout(30_000),
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body
        ? {
            "Content-Type": "application/json",
            Origin: base.origin,
            "Sec-Fetch-Site": "same-origin",
          }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML */
  }
  return { response, json, text };
}
function redirected(result, path) {
  assert.ok([303, 307, 308].includes(result.response.status));
  assert.equal(
    new URL(result.response.headers.get("location"), base).pathname,
    path,
  );
}
try {
  const tampered = await call("/api/auth/sign-up/organization", {
    body: {
      ...input,
      metadata: { testWorkspaceAccess: true },
      status: "ACTIVE",
    },
  });
  assert.equal(tampered.response.status, 400);
  assert.equal(await db.user.count({ where: { email } }), 0);
  const signup = await call("/api/auth/sign-up/organization", { body: input });
  assert.equal(signup.response.status, 200);
  const user = await db.user.findUniqueOrThrow({
    where: { email },
    include: { memberships: { include: { organization: true } } },
  });
  assert.equal(user.memberships.length, 1);
  const org = user.memberships[0].organization;
  assert.equal(org.type, "BRAND");
  assert.equal(org.status, "PENDING");
  assert.equal(org.metadata.organizationType, "client_agency");
  const signedIn = await call("/api/auth/sign-in/email", {
    body: { email, password },
  });
  assert.equal(signedIn.response.status, 200);
  const cookie = signedIn.response.headers
    .getSetCookie()
    .map((v) => v.split(";", 1)[0])
    .join("; ");
  redirected(
    await call("/auth/continue?lang=ko", { cookie }),
    "/onboarding/brand",
  );
  assert.equal(
    (await call("/api/agency/operations", { cookie })).response.status,
    403,
  );
  const profile = await call("/api/account/brand-profile", {
    cookie,
    body: {
      organizationName: name,
      industry: "gaming",
      countryCode: "KR",
      companySize: "15–49",
      contactName: "QA",
      interests: ["campaign-management"],
      note: "Disposable QA fixture",
    },
  });
  assert.equal(profile.response.status, 200);
  const saved = await db.organization.findUniqueOrThrow({
    where: { id: org.id },
  });
  assert.equal(saved.metadata.organizationType, "client_agency");
  assert.equal(saved.status, "PENDING");
  redirected(await call("/auth/continue?lang=ko", { cookie }), "/account");
  redirected(await call("/storage/search?lang=ko", { cookie }), "/account");
  redirected(await call("/onboarding/brand?lang=ko", { cookie }), "/account");
  const denied = await call("/api/workspace/bootstrap", { cookie });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.json.code, "APPROVAL_REQUIRED");
  console.log(
    "PASS buying-agency registration, database persistence, profile, pending approval and supplier isolation",
  );
  await db.organization.update({
    where: { id: org.id },
    data: { status: "ACTIVE" },
  });
  redirected(
    await call("/auth/continue?lang=ko", { cookie }),
    "/storage/search",
  );
  assert.equal(
    (await call("/api/workspace/bootstrap", { cookie })).response.status,
    200,
  );
  assert.equal(
    (await call("/api/agency/operations", { cookie })).response.status,
    403,
  );
  await db.organization.update({
    where: { id: org.id },
    data: { status: "SUSPENDED" },
  });
  redirected(await call("/auth/continue?lang=ko", { cookie }), "/account");
  assert.equal(
    (await call("/api/workspace/bootstrap", { cookie })).response.status,
    403,
  );
  console.log("PASS approved buyer access and suspended-account rejection");
} finally {
  const fixture = await db.user.findUnique({
    where: { email },
    include: { memberships: true },
  });
  if (fixture) {
    assert.equal(fixture.name, name);
    await db.$transaction(async (tx) => {
      for (const membership of fixture.memberships)
        await tx.organization.delete({
          where: { id: membership.organizationId, name },
        });
      await tx.user.delete({ where: { id: fixture.id, email } });
    });
  }
  assert.equal(await db.user.count({ where: { email } }), 0);
  await db.$disconnect();
  console.log("CLEANUP disposable buyer fixture removed");
}
