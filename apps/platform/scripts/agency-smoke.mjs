import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import console from "node:console";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";
import { upload } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";

const require = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
const loaded = require("dotenv").config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)), quiet: true, override: false });
assert.ok(!loaded.error && process.env.DATABASE_URL && process.env.BLOB_READ_WRITE_TOKEN && process.env.BETTER_AUTH_URL, "Use the server's ignored database/auth/private Blob environment");
const baseUrl = new URL(process.env.AGENCY_TEST_ORIGIN || "http://localhost:3002");
assert.ok(["http:", "https:"].includes(baseUrl.protocol) && !baseUrl.username && !baseUrl.password && baseUrl.pathname === "/" && !baseUrl.search && !baseUrl.hash, "AGENCY_TEST_ORIGIN must be an HTTP(S) origin");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname), "Synthetic upload suite is local-only");
const base = baseUrl.origin;
assert.equal(new URL(process.env.BETTER_AUTH_URL).origin, base, "BETTER_AUTH_URL must match the local test server");
const db = createDatabaseClient();
const run = `${Date.now()}-${randomBytes(5).toString("hex")}`;
const names = [], emails = [], paths = [], orgIds = new Set();
let step = "preflight", signups = 0;
async function cooldown(milliseconds) {
  for (let remaining = milliseconds; remaining > 0; remaining -= Math.min(remaining, 30_000)) {
    await delay(Math.min(remaining, 30_000));
  }
}
async function call(path, { cookie, body, origin = base, method } = {}) {
  const response = await globalThis.fetch(`${base}${path}`, {
    method: method || (body === undefined ? "GET" : "POST"), redirect: "manual",
    signal: globalThis.AbortSignal.timeout(60_000),
    headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: origin, "Sec-Fetch-Site": origin === base ? "same-origin" : "cross-site" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let json; try { json = JSON.parse(text); } catch { /* HTML route */ }
  return { response, text, json };
}
function expect(result, status) { assert.equal(result.response.status, status, `${step}: unexpected status (${result.json?.code || "page"})`); }
function destination(result, path) { assert.ok([303,307,308].includes(result.response.status)); assert.equal(new URL(result.response.headers.get("location"), base).pathname, path); }
async function account(kind) {
  assert.ok(signups < 2, "This suite must create at most two accounts per execution");
  signups += 1;
  const email = `agency-qa-${run}-${kind}@example.invalid`, name = `Agency QA ${run} ${kind}`, password = `Qa-${randomBytes(18).toString("hex")}!`;
  names.push(name); emails.push(email);
  const result = await call("/api/auth/sign-up/organization", { body: { role: "agency", organizationName: name, agencyType: kind, email, password, locale: "en" } });
  expect(result, 200);
  const user = await db.user.findUniqueOrThrow({ where: { email }, include: { memberships: true } });
  assert.equal(user.memberships.length, 1, "A synthetic signup must have exactly one organization");
  orgIds.add(user.memberships[0].organizationId);
  const login = await call("/api/auth/sign-in/email", { body: { email, password } }); expect(login, 200);
  const cookie = login.response.headers.getSetCookie().map(value => value.split(";", 1)[0]).join("; ");
  return { cookie, userId: user.id, organizationId: user.memberships[0].organizationId, name, email };
}
const profile = (a, kind = "agency") => ({ organizationName: a.name, agencyType: kind, address: "Synthetic QA address, Seoul", countryCode: "KR", establishedOn: "2020-01-01", contactName: "QA Contact", contactMethod: "email", contactValue: a.email, businessLicenseId: kind === "agency" ? "QA-TEST-ONLY" : "", scopeOfBusiness: "Synthetic QA verification only", platformContact: "QA platform contact", businessDocumentId: "", contractDocumentId: "" });
async function allocate(a, bytes, fileName = "qa-proof.pdf", kind = "BUSINESS_REGISTRATION") {
  const intent = await call("/api/account/agency-documents", { cookie: a.cookie, body: { kind, fileName, contentType: "application/pdf", size: bytes.length } }); expect(intent, 201);
  assert.ok(intent.json.pathname.startsWith(`agency-documents/${a.organizationId}/`), "The server must allocate a path under the current synthetic organization");
  paths.push(intent.json.pathname);
  return intent.json;
}
const tokenBody = (document, overrides = {}) => ({ type: "blob.generate-client-token", payload: {
  pathname: document.pathname, multipart: false, clientPayload: JSON.stringify({ documentId: document.id }), ...overrides,
} });
async function documentState(id, state) {
  assert.equal((await db.agencyDocument.findUniqueOrThrow({ where: { id } })).state, state);
}
async function document(a, bytes, fileName = "qa-proof.pdf", kind = "BUSINESS_REGISTRATION") {
  const intent = await allocate(a, bytes, fileName, kind);
  const uploaded = await upload(intent.pathname, bytes, { access: "private", contentType: "application/pdf", handleUploadUrl: `${base}/api/account/agency-documents/upload`, clientPayload: JSON.stringify({ documentId: intent.id }), headers: { Cookie: a.cookie, Origin: base } });
  const publicRead = await globalThis.fetch(uploaded.url, { signal: globalThis.AbortSignal.timeout(30_000) }); assert.ok([401,403,404].includes(publicRead.status), "Raw private Blob must not be publicly readable"); await publicRead.body?.cancel();
  await documentState(intent.id, "PENDING");
  return intent;
}
try {
  // Respect the shared auth limiter's inactivity window. Never reset its IP
  // counters or spoof forwarding headers to make repeated runs pass.
  const previousWindow = await db.rateLimit.findFirst({
    where: { OR: [{ key: { endsWith: "|/sign-up/organization" } }, { key: { endsWith: "|/sign-in/email" } }] },
    orderBy: { lastRequest: "desc" }, select: { lastRequest: true },
  });
  const remaining = previousWindow ? Math.max(0, 60_500 - (Date.now() - Number(previousWindow.lastRequest))) : 0;
  if (remaining) { console.log("WAIT previous auth endpoint cooldown (no limiter bypass)"); await cooldown(remaining); }
  step = "registration";
  const a = await account("agency"), b = await account("studio");
  step = "routing";
  destination(await call("/auth/continue?lang=en&registered=1", { cookie: a.cookie }), "/onboarding/agency");
  assert.match((await call("/auth/continue?lang=en&registered=1", { cookie: a.cookie })).response.headers.get("location"), /welcome=1/);
  destination(await call("/agency", { cookie: a.cookie }), "/onboarding/agency");
  destination(await call("/agency"), "/login");
  console.log("PASS agency/studio registration, role routing, anonymous protection");
  const p = profile(a), studio = profile(b, "studio");
  step = "draft and input authorization";
  expect(await call("/api/account/agency-profile", { body: { action: "saveDraft", profile: p } }), 401);
  expect(await call("/api/account/agency-profile", { cookie: a.cookie, origin: "https://not-our-site.invalid", body: { action: "saveDraft", profile: p } }), 403);
  expect(await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "saveDraft", profile: p, organizationId: b.organizationId } }), 400);
  expect(await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "saveDraft", profile: p } }), 200);
  const draft = await call("/api/account/agency-profile", { cookie: a.cookie }); expect(draft, 200); assert.deepEqual(draft.json.profile, p); assert.equal(draft.json.status, "DRAFT");
  expect(await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "submit", profile: p } }), 400);
  const impossibleDate = await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "saveDraft", profile: { ...p, establishedOn: "2026-02-30" } } }); expect(impossibleDate, 400);
  console.log("PASS persisted drafts, CSRF, strict schema, invalid dates, document-required submission");
  step = "document constraints";
  expect(await call("/api/account/agency-documents", { cookie: a.cookie, body: { kind: "BUSINESS_REGISTRATION", fileName: "bad.html", contentType: "text/html", size: 5 } }), 400);
  expect(await call("/api/account/agency-documents", { cookie: a.cookie, body: { kind: "BUSINESS_REGISTRATION", fileName: "large.pdf", contentType: "application/pdf", size: 21 * 1024 * 1024 } }), 400);
  expect(await call("/api/account/agency-documents", { cookie: a.cookie, body: { kind: "BUSINESS_REGISTRATION", fileName: "../escape.pdf", contentType: "application/pdf", size: 100 } }), 400);
  const pdf = Buffer.from("%PDF-1.4\n% Synthetic test only, not a real company document\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  const pending = await allocate(a, pdf, "not-uploaded.pdf");
  const incomplete = await call(`/api/account/agency-documents/${pending.id}/complete`, { cookie: a.cookie, body: {} }); expect(incomplete, 409); assert.equal(incomplete.json.code, "UPLOAD_NOT_READY");
  await documentState(pending.id, "PENDING");
  expect(await call(`/api/account/agency-documents/${pending.id}/download`, { cookie: a.cookie }), 404);
  expect(await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "submit", profile: { ...p, businessDocumentId: pending.id } } }), 400);
  expect(await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "submit", profile: { ...p, businessDocumentId: `forged-${run}` } } }), 400);
  step = "client token authorization";
  expect(await call("/api/account/agency-documents/upload", { body: tokenBody(pending) }), 401);
  expect(await call("/api/account/agency-documents/upload", { cookie: a.cookie, origin: "https://not-our-site.invalid", body: tokenBody(pending) }), 403);
  const foreignToken = await call("/api/account/agency-documents/upload", { cookie: b.cookie, body: tokenBody(pending) }); assert.ok([403,404].includes(foreignToken.response.status));
  expect(await call("/api/account/agency-documents/upload", { cookie: a.cookie, body: tokenBody(pending, { pathname: `agency-documents/${b.organizationId}/forged.pdf` }) }), 403);
  expect(await call("/api/account/agency-documents/upload", { cookie: a.cookie, body: tokenBody(pending, { clientPayload: JSON.stringify({ documentId: `forged-${run}` }) }) }), 404);
  expect(await call("/api/account/agency-documents/upload", { cookie: a.cookie, body: tokenBody(pending, { clientPayload: JSON.stringify({ documentId: pending.id, organizationId: b.organizationId }) }) }), 400);
  expect(await call("/api/account/agency-documents/upload", { body: {
    type: "blob.upload-completed", payload: { blob: {
      url: "https://example.invalid/untrusted.pdf", downloadUrl: "https://example.invalid/untrusted.pdf?download=1",
      pathname: pending.pathname, contentType: "application/pdf", contentDisposition: "attachment", etag: "synthetic",
    }, tokenPayload: JSON.stringify({ documentId: pending.id }) },
  } }), 403);
  await documentState(pending.id, "PENDING");
  console.log("PASS unuploaded/forged documents cannot complete or submit; upload tokens require an owner, same origin and exact allocated path");
  step = "actual file signature validation";
  const fake = await document(a, Buffer.from("<html>This is not a PDF, despite its extension and MIME.</html>"), "fake-proof.pdf");
  const rejected = await call(`/api/account/agency-documents/${fake.id}/complete`, { cookie: a.cookie, body: {} }); expect(rejected, 400); assert.equal(rejected.json.code, "FILE_REJECTED");
  await documentState(fake.id, "REJECTED");
  expect(await call(`/api/account/agency-documents/${fake.id}/download`, { cookie: a.cookie }), 404);
  expect(await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "submit", profile: { ...p, businessDocumentId: fake.id } } }), 400);
  console.log("PASS forged PDF contents are rejected after private upload and cannot be downloaded or used for submission");
  const doc = await document(a, pdf);
  step = "private document completion";
  const outsider = await call(`/api/account/agency-documents/${doc.id}/complete`, { cookie: b.cookie, body: {} }); assert.ok([403,404].includes(outsider.response.status));
  expect(await call(`/api/account/agency-documents/${doc.id}/complete`, { cookie: a.cookie, body: {} }), 200);
  await documentState(doc.id, "UPLOADED");
  const repeatedComplete = await call(`/api/account/agency-documents/${doc.id}/complete`, { cookie: a.cookie, body: {} }); expect(repeatedComplete, 200); assert.equal(repeatedComplete.json.id, doc.id); assert.equal(repeatedComplete.json.status, "UPLOADED");
  const privateDownload = await call(`/api/account/agency-documents/${doc.id}/download`, { cookie: a.cookie }); expect(privateDownload, 200); assert.equal(privateDownload.text, pdf.toString()); assert.match(privateDownload.response.headers.get("content-disposition"), /attachment/);
  assert.match(privateDownload.response.headers.get("cache-control"), /no-store/);
  assert.equal(privateDownload.response.headers.get("x-content-type-options"), "nosniff");
  const denied = await call(`/api/account/agency-documents/${doc.id}/download`, { cookie: b.cookie }); assert.ok([403,404].includes(denied.response.status));
  expect(await call(`/api/account/agency-documents/${doc.id}/download`), 401);
  const listing = await call("/api/account/agency-documents", { cookie: a.cookie }); expect(listing, 200); assert.ok(!listing.text.includes("private.blob") && !listing.text.includes("pathname"));
  expect(await call("/api/account/agency-profile", { cookie: b.cookie, body: { action: "submit", profile: { ...studio, businessDocumentId: doc.id } } }), 400);
  console.log("PASS real private Blob upload, server confirmation, authenticated download, cross-tenant denial");
  step = "document-kind binding";
  const contract = await document(a, pdf, "contract.pdf", "CONTRACT");
  expect(await call(`/api/account/agency-documents/${contract.id}/complete`, { cookie: a.cookie, body: {} }), 200);
  const contractAsBusiness = await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "submit", profile: { ...p, businessDocumentId: contract.id } } }); expect(contractAsBusiness, 400); assert.ok(contractAsBusiness.json.fields.includes("businessDocumentId"));
  const businessAsContract = await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "submit", profile: { ...p, businessDocumentId: doc.id, contractDocumentId: doc.id } } }); expect(businessAsContract, 400); assert.ok(businessAsContract.json.fields.includes("contractDocumentId"));
  const forgedContract = await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "saveDraft", profile: { ...p, contractDocumentId: `forged-contract-${run}` } } }); expect(forgedContract, 400); assert.ok(forgedContract.json.fields.includes("contractDocumentId"));
  console.log("PASS business proof and optional contract are bound to their verified document kind and organization");
  step = "role-dependent submission";
  const missingLicense = await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "submit", profile: { ...p, businessDocumentId: doc.id, businessLicenseId: "" } } }); expect(missingLicense, 400); assert.ok(missingLicense.json.fields.includes("businessLicenseId"));
  expect(await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "submit", profile: { ...p, businessDocumentId: doc.id, contractDocumentId: contract.id } } }), 200);
  const docB = await document(b, pdf, "studio-proof.pdf");
  expect(await call(`/api/account/agency-documents/${docB.id}/complete`, { cookie: b.cookie, body: {} }), 200);
  expect(await call("/api/account/agency-profile", { cookie: b.cookie, body: { action: "submit", profile: { ...studio, businessDocumentId: docB.id } } }), 200);
  const org = await db.organization.findUniqueOrThrow({ where: { id: a.organizationId } }); assert.equal(org.status, "PENDING"); assert.ok(org.metadata.agencyProfileSubmittedAt);
  assert.equal(org.metadata.agencyProfile.businessDocumentId, doc.id); assert.equal(org.metadata.agencyProfile.contractDocumentId, contract.id);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: a.userId } })).emailVerified, false);
  destination(await call("/auth/continue?lang=en", { cookie: a.cookie }), "/onboarding/agency");
  expect(await call("/agency?lang=en", { cookie: a.cookie }), 200);
  expect(await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "saveDraft", profile: p } }), 409);
  console.log("PASS Agency license required / Studio optional; both require proof; review pending never grants approval/email verification");
  step = "permission changes";
  await db.organizationMember.update({ where: { userId_organizationId: { organizationId: a.organizationId, userId: a.userId } }, data: { role: "MEMBER" } });
  expect(await call("/api/account/agency-profile", { cookie: a.cookie }), 403);
  expect(await call("/api/account/agency-profile", { cookie: a.cookie, body: { action: "saveDraft", profile: p } }), 403);
  expect(await call("/api/account/agency-documents", { cookie: a.cookie }), 403);
  expect(await call("/api/account/agency-documents/upload", { cookie: a.cookie, body: tokenBody(pending) }), 403);
  expect(await call(`/api/account/agency-documents/${pending.id}/complete`, { cookie: a.cookie, body: {} }), 403);
  expect(await call(`/api/account/agency-documents/${doc.id}/download`, { cookie: a.cookie }), 403);
  await db.organizationMember.update({ where: { userId_organizationId: { organizationId: a.organizationId, userId: a.userId } }, data: { role: "ADMIN" } });
  expect(await call("/api/account/agency-documents", { cookie: a.cookie }), 403);
  await db.organization.update({ where: { id: b.organizationId }, data: { status: "SUSPENDED" } });
  destination(await call("/agency", { cookie: b.cookie }), "/account");
  expect(await call("/api/account/agency-profile", { cookie: b.cookie }), 403);
  expect(await call("/api/account/agency-profile", { cookie: b.cookie, body: { action: "saveDraft", profile: studio } }), 403);
  expect(await call("/api/account/agency-documents", { cookie: b.cookie }), 403);
  expect(await call("/api/account/agency-documents", { cookie: b.cookie, body: { kind: "BUSINESS_REGISTRATION", fileName: "blocked.pdf", contentType: "application/pdf", size: pdf.length } }), 403);
  expect(await call("/api/account/agency-documents/upload", { cookie: b.cookie, body: tokenBody(docB) }), 403);
  expect(await call(`/api/account/agency-documents/${docB.id}/complete`, { cookie: b.cookie, body: {} }), 403);
  expect(await call(`/api/account/agency-documents/${docB.id}/download`, { cookie: b.cookie }), 403);
  assert.equal((await db.organization.findUniqueOrThrow({ where: { id: b.organizationId } })).status, "SUSPENDED");
  await db.session.deleteMany({ where: { userId: a.userId } });
  expect(await call("/api/account/agency-profile", { cookie: a.cookie }), 401);
  expect(await call("/api/account/agency-documents", { cookie: a.cookie }), 401);
  expect(await call(`/api/account/agency-documents/${doc.id}/download`, { cookie: a.cookie }), 401);
  console.log("PASS changed memberships, suspended organizations, revoked sessions");
} finally {
  // Only identifiers created by this execution are eligible for cleanup.
  for (const pathname of paths) await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => { process.exitCode = 1; console.error("Synthetic Blob cleanup failed; inspect exact test pathname"); });
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, memberships: { select: { organization: { select: { id: true, name: true } } } } } });
  for (const user of users) for (const { organization } of user.memberships) if (names.includes(organization.name)) orgIds.add(organization.id);
  const ids = users.map(u => u.id);
  await db.rateLimit.deleteMany({ where: { OR: ids.flatMap(id => [{ key: `agency-profile:${id}` }, { key: { startsWith: "agency-document:", endsWith: `:${id}` } }]) } });
  await db.organization.deleteMany({ where: { id: { in: [...orgIds] } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
  console.log("CLEANUP synthetic agency fixtures and private test documents");
}
