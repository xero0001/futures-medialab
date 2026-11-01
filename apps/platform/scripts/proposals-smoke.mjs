import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "better-auth/crypto";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";

// This integration check creates its own isolated tenants and signs in through
// the real auth endpoints. It never reads or modifies named product accounts.
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
const { values } = parseArgs({ options: {
  "base-url": { type: "string", default: "http://127.0.0.1:3100" },
  "admin-url": { type: "string", default: "http://127.0.0.1:3101" },
  "env-file": { type: "string", default: "apps/platform/.env.local" },
  "admin-env-file": { type: "string" },
  "browser-fixture-file": { type: "string" },
  "cleanup-fixture-file": { type: "string" },
} });
const base = new URL(values["base-url"]), adminBase = new URL(values["admin-url"]);
for (const url of [base, adminBase]) assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
  ["http:", "https:"].includes(url.protocol) && url.pathname === "/" &&
  !url.search && !url.hash && !url.username && !url.password,
  "QA only supports trusted local server origins",
);
const dotenv = require("dotenv");
const loaded = dotenv.config({ path: resolve(repositoryRoot, values["env-file"]), quiet: true, override: false });
assert.ok(!loaded.error && process.env.DATABASE_URL && process.env.BETTER_AUTH_URL, "Server environment is required");
assert.equal(new URL(process.env.BETTER_AUTH_URL).origin, base.origin, "Platform environment origin mismatch");
// Dev servers may receive their origins and DB URL through their launch process.
// An optional file can verify that configuration; real sign-in also proves both
// HTTP servers see the isolated accounts created in this run's database.
if (values["admin-env-file"]) {
  const adminEnvironment = dotenv.parse(await readFile(resolve(repositoryRoot, values["admin-env-file"]), "utf8"));
  assert.equal(new URL(adminEnvironment.BETTER_AUTH_URL).origin, adminBase.origin, "Admin environment origin mismatch");
  assert.ok(adminEnvironment.DATABASE_URL === process.env.DATABASE_URL, "Both servers must use the same QA database");
}
const db = createDatabaseClient();

async function cleanup({ prefix, userIds, orgIds }) {
  assert.match(prefix, /^proposal-live-qa-\d+-[a-f0-9]{12}$/);
  assert.ok(Array.isArray(userIds) && userIds.length > 0 && userIds.length < 10);
  assert.ok(Array.isArray(orgIds) && orgIds.length > 0 && orgIds.length < 10);
  assert.ok([...userIds, ...orgIds].every(id => typeof id === "string" && id.startsWith(`${prefix}-`) && /^[a-zA-Z0-9-]+$/.test(id)));
  await db.$transaction([
    db.workspaceToolRequest.deleteMany({ where: { organizationId: { in: orgIds }, userId: { in: userIds } } }),
    db.campaign.deleteMany({ where: { brandOrganizationId: { in: orgIds }, createdById: { in: userIds } } }),
    db.auditLog.deleteMany({ where: { actorId: { in: userIds } } }),
    db.organization.deleteMany({ where: { id: { in: orgIds } } }),
    db.user.deleteMany({ where: { id: { in: userIds } } }),
    db.rateLimit.deleteMany({ where: { OR: userIds.flatMap(id => [
      { key: { startsWith: "workspace:", endsWith: `:${id}` } },
      { key: { startsWith: "admin:", endsWith: `:${id}` } },
    ]) } }),
  ]);
}

if (values["cleanup-fixture-file"]) {
  try {
    const file = resolve(repositoryRoot, values["cleanup-fixture-file"]);
    await cleanup(JSON.parse(await readFile(file, "utf8")));
    await unlink(file);
    console.log("CLEANUP removed only the retained proposal QA namespace and credential file");
  } finally { await db.$disconnect(); }
} else {
  const prefix = `proposal-live-qa-${Date.now()}-${randomBytes(6).toString("hex")}`;
  const password = `Qa-${randomBytes(24).toString("base64url")}!`;
  const userIds = [], orgIds = [];
  const accounts = {};
  const privateMarker = `${prefix}-PRIVATE-SUPPLIER-NOTES`;
  let step = "preflight", checks = 0, retain = false;
  let owner, member, outsider, agency, admin;
  let campaignId, replacementCampaignId, expiredCampaignId, canceledCampaignId;
  let readyCampaignId, readyProposalId, privateCampaignId, privateProposalId;
  let creatorId, hiddenCreatorId;
  const dateAfter = days => new Date(Date.now() + days * 86400000).toISOString();

  async function call(path, { body, cookie, admin: adminRequest = false, origin } = {}) {
    const target = adminRequest ? adminBase : base;
    const requestOrigin = origin === undefined ? target.origin : origin;
    const response = await globalThis.fetch(new URL(path, target), {
      method: body === undefined ? "GET" : "POST", redirect: "manual",
      signal: globalThis.AbortSignal.timeout(60000),
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(requestOrigin ? { Origin: requestOrigin, "Sec-Fetch-Site": requestOrigin === target.origin ? "same-origin" : "cross-site" } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { response, text, json: response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : null };
  }
  function expect(result, status) {
    if (result.response.status !== status) throw new Error(`HTTP ${result.response.status}; expected ${status}; code ${result.json?.code ?? "page"}`);
  }
  async function check(name, work) {
    step = name; await work(); checks++; console.log(`PASS ${name}`);
  }
  function privateHeaders(result) {
    assert.match(result.response.headers.get("cache-control") ?? "", /private/);
    assert.match(result.response.headers.get("cache-control") ?? "", /no-store/);
  }
  function assertPublic(result) {
    privateHeaders(result);
    for (const key of ["creatorId", "supplierOrganizationId", "supplierCost", "internalNotes", "payloadHash"])
      assert.ok(!result.text.includes(`"${key}"`), `Public payload contains forbidden key ${key}`);
    for (const value of [privateMarker, creatorId, hiddenCreatorId, agency.orgId].filter(Boolean))
      assert.ok(!result.text.includes(value), "Public payload contains private fixture information");
  }
  async function login(account, adminRequest = false) {
    let result = await call("/api/auth/sign-in/email", { body: { email: account.email, password }, admin: adminRequest });
    if (result.response.status === 429) {
      console.log("WAIT normal sign-in cooldown; no rate limit bypass");
      await delay(30500); await delay(30500);
      result = await call("/api/auth/sign-in/email", { body: { email: account.email, password }, admin: adminRequest });
    }
    expect(result, 200);
    const cookies = result.response.headers.getSetCookie();
    assert.ok(cookies.some(value => value.split("=", 1)[0].endsWith("session_token")));
    return cookies.map(value => value.split(";", 1)[0]).join("; ");
  }
  async function fixture(label, { organizationId, type = "BRAND", role = "OWNER", admin: adminRequest = false } = {}) {
    const id = `${prefix}-${label}`, email = `${id}@example.invalid`, orgId = organizationId ?? `${id}-org`;
    userIds.push(id); if (!organizationId) orgIds.push(orgId);
    const hashed = await hashPassword(password);
    await db.$transaction(async tx => {
      if (!organizationId) await tx.organization.create({ data: { id: orgId, name: `공식 제안 QA · ${label}`, slug: orgId, type, status: "ACTIVE", countryCode: "KR", metadata: { industry: "gaming", companySize: "15–49", contactName: "QA 담당자", profileCompletedAt: new Date().toISOString() } } });
      await tx.user.create({ data: { id, email, name: "공식 제안 QA", locale: "KO", emailVerified: false, accounts: { create: { providerId: "credential", accountId: id, password: hashed } }, memberships: { create: { organizationId: orgId, role } } } });
    });
    const account = { userId: id, orgId, email };
    account.cookie = await login(account, adminRequest);
    accounts[label] = { email, userId: id, orgId };
    return account;
  }
  async function saveFixture() {
    if (!values["browser-fixture-file"]) return;
    const file = resolve(repositoryRoot, values["browser-fixture-file"]);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ prefix, userIds, orgIds, baseUrl: base.origin, adminUrl: adminBase.origin, password, accounts, campaignId, replacementCampaignId, readyCampaignId, readyProposalId, privateCampaignId, privateProposalId }, null, 2), { mode: 0o600 });
    await chmod(file, 0o600); retain = true;
    console.log("READY restricted QA credential file saved; credentials are not logged");
  }
  async function createCampaign(title) {
    const created = await call("/api/brand/campaigns", { cookie: owner.cookie, body: { title, genre: "RPG", goal: "실제 API와 공식 제안 승인 흐름 검수", contentFormat: "라이브와 VOD", creatorCount: 2, desiredDate: dateAfter(30).slice(0, 10), note: "격리 QA 캠페인 · 실제 집행하지 마세요.", compositionPreference: "balanced", budgetAmount: "5000.00", currency: "USD", platforms: ["youtube"], regions: ["KR"], route: "managed", clientRequestId: randomUUID() } });
    expect(created, 200); return created.json.id;
  }
  const item = (label, overrides = {}) => ({ creatorId: null, creatorName: `QA 가상 크리에이터 ${label}`, platform: "youtube", channelLabel: `QA 채널 ${label}`, channelUrl: `https://www.youtube.com/@${prefix}-public-${label.toLowerCase()}`, followers: 12345, averageViews: 6789, deliverables: `라이브 1회 및 VOD ${label}`, quantity: 1, unitAmount: "1234.56", scheduledAt: dateAfter(20), rights: "QA 전용 제안 조건 · 실제 집행 없음", supplierCost: "321.09", internalNotes: privateMarker, ...overrides });
  const draftData = (changes = {}) => ({ title: "QA 공식 제안", summary: "격리된 API 검수용 공개 스냅샷입니다.", changeSummary: "", terms: "모든 구성과 견적을 승인한 뒤 진행합니다. QA 전용 자료이며 실제 계약이나 집행이 아닙니다.", expiresAt: dateAfter(5), items: [item("A"), item("B", { quantity: 2, unitAmount: "234.56" })], ...changes });
  async function adminMutation(body, options = {}) {
    return call("/api/admin/proposals", { admin: true, cookie: admin.cookie, body, ...options });
  }
  async function createDraft(id, sourceProposalId) {
    const result = await adminMutation({ action: "createDraft", campaignId: id, clientRequestId: randomUUID(), ...(sourceProposalId ? { sourceProposalId } : {}) });
    expect(result, 200); return result.json.proposal;
  }
  async function saveDraft(id, proposal, data = draftData()) {
    const result = await adminMutation({ action: "saveDraft", campaignId: id, proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID(), data });
    expect(result, 200); return result.json.proposal;
  }
  async function publish(id, proposal) {
    const result = await adminMutation({ action: "publish", campaignId: id, proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID() });
    expect(result, 200); return result.json.proposal;
  }
  async function brandDetail(id, cookie = owner.cookie) {
    const result = await call(`/api/brand/campaigns/${id}`, { cookie }); expect(result, 200); return result;
  }
  const decision = (proposal, changes = {}) => ({ action: "decide", proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID(), decision: "APPROVE", itemIds: proposal.items.filter(value => value.status === "PENDING").map(value => value.id), message: "", ...changes });
  async function decide(body, options = {}) { return call("/api/brand/proposals", { cookie: owner.cookie, body, ...options }); }

  try {
    await check("anonymous proposal reads and writes are denied", async () => {
      expect(await call("/api/admin/proposals?campaignId=missing", { admin: true }), 401);
      expect(await call("/api/brand/proposals", { body: { action: "decide" } }), 401);
    });
    await check("five isolated QA roles authenticate through real sign-in", async () => {
      owner = await fixture("owner");
      member = await fixture("member", { organizationId: owner.orgId, role: "MEMBER" });
      outsider = await fixture("outsider");
      agency = await fixture("agency", { type: "AGENCY" });
      admin = await fixture("admin", { type: "PLATFORM", role: "ADMIN", admin: true });
      agency.adminCookie = await login(agency, true);
      await saveFixture();
    });
    await check("campaign-scoped creator choices exclude unrelated profiles", async () => {
      campaignId = await createCampaign("공식 제안 QA · 승인 흐름");
      replacementCampaignId = await createCampaign("공식 제안 QA · 수정 및 버전 교체");
      creatorId = `${prefix}-private-creator`; hiddenCreatorId = `${prefix}-unrelated-creator`;
      await db.creatorProfile.createMany({ data: [
        { id: creatorId, agencyOrganizationId: agency.orgId, displayName: "QA 후보 A", channels: [{ platform: "youtube", name: "QA 후보 채널", url: item("A").channelUrl, followers: 12345 }], internalNotes: privateMarker },
        { id: hiddenCreatorId, agencyOrganizationId: agency.orgId, displayName: "QA 비선정 후보", internalNotes: privateMarker },
      ] });
      await db.campaignApplication.create({ data: { campaignId, agencyOrganizationId: agency.orgId, submittedById: agency.userId, status: "SHORTLISTED", proposal: privateMarker, proposedAmount: "999.99", currency: "USD", creators: { create: { creatorId } } } });
      const result = await call(`/api/admin/proposals?campaignId=${campaignId}`, { admin: true, cookie: admin.cookie });
      expect(result, 200); privateHeaders(result);
      assert.ok(result.json.creators.some(value => value.id === creatorId));
      assert.ok(!result.json.creators.some(value => value.id === hiddenCreatorId));
      expect(await call(`/api/admin/proposals?campaignId=${campaignId}`, { admin: true, cookie: agency.adminCookie }), 403);
    });
    let proposal;
    await check("draft create/save are idempotent and reject stale edits", async () => {
      const create = { action: "createDraft", campaignId, clientRequestId: randomUUID() };
      const created = await adminMutation(create); expect(created, 200); proposal = created.json.proposal;
      const repeated = await adminMutation(create); expect(repeated, 200); assert.equal(repeated.json.proposal.id, proposal.id);
      expect(await adminMutation({ ...create, campaignId: replacementCampaignId }), 409);
      const save = { action: "saveDraft", campaignId, proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID(), data: draftData({ items: [item("A", { creatorId }), item("B", { quantity: 2, unitAmount: "234.56" })] }) };
      const saved = await adminMutation(save); expect(saved, 200); proposal = saved.json.proposal;
      const retried = await adminMutation(save); expect(retried, 200); assert.equal(retried.json.proposal.revision, proposal.revision);
      expect(await adminMutation({ ...save, clientRequestId: randomUUID() }), 409);
      assert.equal(proposal.totalAmount, "1703.68");
      const foreignCandidate = await adminMutation({ ...save, expectedRevision: proposal.revision, clientRequestId: randomUUID(), data: draftData({ items: [item("HIDDEN", { creatorId: hiddenCreatorId })] }) });
      assert.ok([400, 403, 404, 409].includes(foreignCandidate.response.status), "Unrelated creator must not be accepted");
    });
    await check("brand cannot see or decide unpublished creator snapshots", async () => {
      const detail = await brandDetail(campaignId); assert.deepEqual(detail.json.proposals, []); assert.equal(detail.json.campaign.latestProposal, null);
      assert.ok(!detail.text.includes("QA 가상 크리에이터")); assertPublic(detail);
      expect(await decide(decision(proposal)), 404);
      expect(await decide(decision(proposal), { origin: "https://untrusted.example" }), 403);
    });
    await check("publication exposes curated fields without supplier internals", async () => {
      proposal = await publish(campaignId, proposal);
      const detail = await brandDetail(campaignId); assert.equal(detail.json.proposals.length, 1); assertPublic(detail);
      const visible = detail.json.proposals[0];
      assert.equal(visible.items[0].creatorName, "QA 가상 크리에이터 A");
      assert.equal(visible.totalAmount, "1703.68"); assert.equal(visible.canRespond, true);
      assert.equal(detail.json.campaign.proposalDueAt, null);
      const workspace = await call("/api/brand/workspace", { cookie: owner.cookie }); expect(workspace, 200); assertPublic(workspace);
      assert.equal(workspace.json.counts.pendingProposals, 1);
      assert.equal(workspace.json.pendingProposals[0].id, proposal.id);
      expect(await adminMutation({ action: "saveDraft", campaignId, proposalId: proposal.id, expectedRevision: proposal.revision, clientRequestId: randomUUID(), data: draftData() }), 409);
    });
    await check("tenant, member, agency and origin decision boundaries hold", async () => {
      expect(await call(`/api/brand/campaigns/${campaignId}`, { cookie: outsider.cookie }), 404);
      expect(await decide(decision(proposal), { cookie: outsider.cookie }), 404);
      expect(await decide(decision(proposal), { cookie: member.cookie }), 403);
      expect(await decide(decision(proposal), { cookie: agency.cookie }), 403);
      const readOnly = await brandDetail(campaignId, member.cookie); assert.equal(readOnly.json.proposals[0].canRespond, false); assertPublic(readOnly);
      expect(await adminMutation({ action: "createDraft", campaignId, clientRequestId: randomUUID() }, { origin: "https://untrusted.example" }), 403);
      for (const path of ["/api/directory/preview", `/api/workspace/campaign-applications?campaignId=${campaignId}`]) expect(await call(path, { cookie: owner.cookie }), 404);
    });
    await check("partial approval is durable, retry-safe and revision guarded", async () => {
      const first = decision(proposal, { itemIds: [proposal.items[0].id] });
      const approved = await decide(first); expect(approved, 200); assertPublic(approved);
      const retried = await decide(first); expect(retried, 200);
      assert.equal(await db.proposalDecision.count({ where: { proposalId: proposal.id } }), 1);
      assert.equal(approved.json.proposal.items.filter(value => value.status === "APPROVED").length, 1);
      assert.equal((await db.campaign.findUniqueOrThrow({ where: { id: campaignId } })).status, "REVIEW");
      expect(await decide(decision(proposal, { itemIds: [proposal.items[1].id] })), 409);
      proposal = approved.json.proposal;
      const completed = await decide(decision(proposal)); expect(completed, 200);
      assert.equal(completed.json.proposal.status, "APPROVED");
      assert.equal((await db.campaign.findUniqueOrThrow({ where: { id: campaignId } })).status, "IN_PROGRESS");
      expect(await decide(decision(completed.json.proposal, { itemIds: [proposal.items[0].id] })), 409);
    });
    let replacement;
    await check("change requests preserve other pending items and remain visible", async () => {
      replacement = await createDraft(replacementCampaignId);
      replacement = await saveDraft(replacementCampaignId, replacement);
      replacement = await publish(replacementCampaignId, replacement);
      expect(await decide(decision(replacement, { decision: "REQUEST_CHANGES", itemIds: [replacement.items[0].id], message: "" })), 400);
      const requested = await decide(decision(replacement, { decision: "REQUEST_CHANGES", itemIds: [replacement.items[0].id], message: "첫 구성의 일정 조정 요청" }));
      expect(requested, 200); replacement = requested.json.proposal;
      assert.equal(replacement.status, "CHANGES_REQUESTED");
      assert.equal(replacement.items[0].status, "CHANGES_REQUESTED");
      assert.equal(replacement.items[1].status, "PENDING");
      assert.equal(replacement.canRespond, true);
      const thread = await db.workspaceToolRequest.findFirstOrThrow({ where: { campaignId: replacementCampaignId }, include: { messages: true } });
      assert.ok(thread.messages.some(value => !value.internal && value.body.includes("첫 구성의 일정 조정 요청")));
    });
    await check("replacement drafts stay private and published old versions cannot approve", async () => {
      let next = await createDraft(replacementCampaignId, replacement.id);
      next = await saveDraft(replacementCampaignId, next, draftData({ title: "QA 두 번째 공식 제안", changeSummary: "첫 구성의 게시 일정 조정", items: [item("VERSION-PRIVATE"), item("B")] }));
      const before = await brandDetail(replacementCampaignId); assert.equal(before.json.proposals.length, 1); assert.ok(!before.text.includes("VERSION-PRIVATE"));
      expect(await decide(decision(next)), 404);
      next = await publish(replacementCampaignId, next);
      const after = await brandDetail(replacementCampaignId); assertPublic(after); assert.equal(after.json.proposals.length, 2);
      assert.equal(after.json.proposals.find(value => value.id === replacement.id).canRespond, false);
      assert.equal(after.json.proposals.find(value => value.id === next.id).isLatest, true);
      expect(await decide(decision(replacement, { itemIds: [replacement.items[1].id] })), 409);
    });
    await check("expired and canceled campaigns reject decisions even with valid sessions", async () => {
      expiredCampaignId = await createCampaign("공식 제안 QA · 만료 가드");
      let expired = await createDraft(expiredCampaignId); expired = await saveDraft(expiredCampaignId, expired); expired = await publish(expiredCampaignId, expired);
      // Controlled clock/state fixtures affect only this run's QA proposals.
      await db.campaignProposal.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 60000) } });
      assert.equal((await brandDetail(expiredCampaignId)).json.proposals[0].canRespond, false);
      expect(await decide(decision(expired)), 409);
      canceledCampaignId = await createCampaign("공식 제안 QA · 취소 가드");
      let canceled = await createDraft(canceledCampaignId); canceled = await saveDraft(canceledCampaignId, canceled); canceled = await publish(canceledCampaignId, canceled);
      await db.campaign.update({ where: { id: canceledCampaignId, brandOrganizationId: owner.orgId }, data: { status: "CANCELED" } });
      assert.equal((await brandDetail(canceledCampaignId)).json.proposals[0].canRespond, false);
      expect(await decide(decision(canceled)), 409);
      const workspace = await call("/api/brand/workspace", { cookie: owner.cookie }); expect(workspace, 200);
      assert.equal(workspace.json.counts.pendingProposals, 1);
    });
    if (values["browser-fixture-file"]) await check("browser fixtures retain one private draft and one ready proposal", async () => {
      readyCampaignId = await createCampaign("공식 제안 QA · 브라우저 승인 확인");
      let ready = await createDraft(readyCampaignId); ready = await saveDraft(readyCampaignId, ready); ready = await publish(readyCampaignId, ready); readyProposalId = ready.id;
      privateCampaignId = await createCampaign("공식 제안 QA · 발행 전 비공개 확인");
      let privateDraft = await createDraft(privateCampaignId); privateDraft = await saveDraft(privateCampaignId, privateDraft); privateProposalId = privateDraft.id;
      await saveFixture();
    });
    console.log(`PASS ${checks} real HTTP/database proposal checks`);
  } catch (error) {
    process.exitCode = 1;
    const detail = error instanceof assert.AssertionError ? "assertion failed (private values omitted)" : /^HTTP \d+; expected \d+; code [A-Z_]+$/.test(error?.message ?? "") ? error.message : error?.name ?? "Error";
    console.error(`FAIL ${step}: ${detail}`);
    if (values["browser-fixture-file"] && owner && admin) await saveFixture();
  } finally {
    try {
      if (!retain && userIds.length) { await cleanup({ prefix, userIds, orgIds }); console.log("CLEANUP removed this run's isolated QA namespace"); }
    } catch { process.exitCode = 1; console.error(`CLEANUP FAILED for isolated prefix ${prefix}`); }
    await db.$disconnect();
  }
}
