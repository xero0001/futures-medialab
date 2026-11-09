import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fixture, agency } from "./fixtures/production.mjs";
import {
  applyAdminReportingMutation,
  applyAgencyReportingMutation,
  ensureCampaignReportingItems,
  listAdminReporting,
  listAgencyReporting,
  listBrandReportingItems,
} from "../src/reporting.ts";
import {
  reportingSnapshotSchema,
  agencyReportingMutationSchema,
} from "../src/reporting-validation.ts";
import { readReportingBody } from "../src/reporting-http.ts";

const fail = (status, code) => (error) =>
  error.status === status && (!code || error.code === code);
const emptyMetrics = () => ({
  views: null,
  impressions: null,
  reach: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  clicks: null,
});
const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
const source = (changes) => ({
  title: "PRIVATE_SOURCE_TITLE",
  postUrl: "https://www.youtube.com/watch?v=private-agency-post",
  publishedAt: ago(3),
  metricsAsOf: null,
  metrics: emptyMetrics(),
  evidenceUrl: "https://drive.google.com/file/d/PRIVATE_EVIDENCE",
  note: "PRIVATE_SOURCE_NOTE",
  ...changes,
});
const publicData = (changes) => ({
  title: "브랜드 공개 게시물",
  postUrl: "https://www.youtube.com/watch?v=curated-public-post",
  publishedAt: ago(3),
  metricsAsOf: ago(1),
  metrics: { ...emptyMetrics(), views: 1200, clicks: 0 },
  evidenceUrl: null,
  note: "확인된 수치만 제공한 보고서",
  ...changes,
});
async function prepared() {
  const f = fixture();
  let production = await f.prepare();
  production = (await f.submit(f.submission(production))).item;
  await f.admin(f.release(production));
  production = (await f.read())[0];
  await f.decide(f.decision(production));
  const initial = (await listAgencyReporting(f.tx, agency)).items[0];
  const read = () => listBrandReportingItems(f.tx, "brand-own", "campaign-own");
  const admin = (input) => applyAdminReportingMutation(f.tx, "admin", input);
  const submit = (input) => applyAgencyReportingMutation(f.tx, agency, input);
  const submission = (item, data = source()) => ({
    action: "submit",
    reportingItemId: item.id,
    expectedRevision: item.revision,
    clientRequestId: randomUUID(),
    data,
  });
  const release = (item, data = publicData()) => ({
    action: "releaseToBrand",
    campaignId: "campaign-own",
    reportingItemId: item.id,
    submissionId: item.latestSubmission.id,
    expectedRevision: item.revision,
    clientRequestId: randomUUID(),
    data,
    internalNote: "PRIVATE_INTERNAL_NOTE",
  });
  const requestChanges = (item) => ({
    action: "requestChanges",
    campaignId: "campaign-own",
    reportingItemId: item.id,
    submissionId: item.latestSubmission.id,
    expectedRevision: item.revision,
    clientRequestId: randomUUID(),
    agencyFeedback: "집계 기준 화면을 다시 확인해 주세요.",
    internalNote: "PRIVATE_INTERNAL_REASON",
  });
  return {
    ...f,
    initial,
    read,
    admin,
    submit,
    submission,
    release,
    requestChanges,
  };
}

test("content approval prepares reporting once; pending production and replaced proposal are never eligible", async () => {
  const f = fixture();
  await f.prepare();
  assert.equal(
    await ensureCampaignReportingItems(f.tx, "campaign-own", "admin"),
    0,
  );
  assert.equal(
    (await listAdminReporting(f.tx, "admin", "campaign-own"))
      .eligibleApprovedItemCount,
    0,
  );
  const ready = await prepared();
  assert.equal(ready.store.reportItems.length, 1);
  assert.equal(
    await ensureCampaignReportingItems(ready.tx, "campaign-own", "admin"),
    0,
  );
  const list = await listAdminReporting(ready.tx, "admin", "campaign-own");
  assert.equal(list.eligibleApprovedItemCount, 1);
  assert.equal(list.unpreparedApprovedItemCount, 0);
  ready.store.proposals[0].supersededAt = new Date();
  assert.equal(
    (await listAdminReporting(ready.tx, "admin", "campaign-own"))
      .eligibleApprovedItemCount,
    0,
  );
});

test("unreviewed posted links, evidence and counters remain invisible; curated release explicitly whitelists public fields", async () => {
  const f = await prepared();
  let item = (
    await f.submit(
      f.submission(
        f.initial,
        source({
          metricsAsOf: ago(1),
          metrics: { ...emptyMetrics(), views: 7654321 },
        }),
      ),
    )
  ).item;
  const pending = (await f.read())[0];
  assert.equal(pending.status, "ADMIN_REVIEW");
  assert.equal(pending.latestSubmission, null);
  assert.deepEqual(pending.submissions, []);
  assert.ok(!JSON.stringify(pending).includes(item.latestSubmission.id));
  const admin = (await listAdminReporting(f.tx, "admin", "campaign-own"))
    .items[0];
  assert.equal(admin.latestSubmission.metrics.views, 7654321);
  item = (await f.admin(f.release(item))).items[0];
  const publicItem = (await f.read())[0];
  assert.equal(publicItem.latestSubmission.metrics.views, 1200);
  assert.equal(publicItem.latestSubmission.metrics.clicks, 0);
  assert.equal(publicItem.latestSubmission.metrics.reach, null);
  assert.equal(publicItem.latestSubmission.evidenceUrl, null);
  assert.equal(publicItem.latestSubmission.title, "브랜드 공개 게시물");
  for (const needle of [
    "PRIVATE_",
    "7654321",
    "private-agency-post",
    "supplierOrganizationId",
    "supplierName",
    "sourceMetrics",
    "sourcePostUrl",
    "internalNote",
    "agencyFeedback",
    "submittedById",
    "creatorId",
  ])
    assert.ok(!JSON.stringify(publicItem).includes(needle), needle);
  const own = (await listAgencyReporting(f.tx, agency)).items[0];
  assert.equal(own.latestSubmission.metrics.views, 7654321);
  assert.equal(own.latestSubmission.releasedSnapshot.metrics.views, 1200);
  assert.ok(!JSON.stringify(own).includes("PRIVATE_INTERNAL"));
  assert.ok(!JSON.stringify(f.store.audits).includes("PRIVATE_SOURCE"));
  const frozen = { ...f.store.reportSubmissions[0] };
  await assert.rejects(() => f.admin(f.release(item)), fail(409));
  assert.deepEqual(f.store.reportSubmissions[0], frozen);
});

test("all-null collecting snapshot and known zero are distinct; source and released snapshots remain separate", async () => {
  const f = await prepared();
  let item = (await f.submit(f.submission(f.initial))).item;
  item = (
    await f.admin(
      f.release(
        item,
        publicData({ metrics: emptyMetrics(), metricsAsOf: null }),
      ),
    )
  ).items[0];
  let visible = (await f.read())[0];
  assert.deepEqual(visible.latestSubmission.metrics, emptyMetrics());
  assert.equal(visible.latestSubmission.metricsAsOf, null);
  item = (
    await f.submit(
      f.submission(
        item,
        source({
          metricsAsOf: ago(1),
          metrics: { ...emptyMetrics(), views: 0 },
        }),
      ),
    )
  ).item;
  await f.admin(
    f.release(item, publicData({ metrics: { ...emptyMetrics(), views: 0 } })),
  );
  visible = (await f.read())[0];
  assert.equal(visible.latestSubmission.metrics.views, 0);
  assert.equal(visible.latestSubmission.metrics.likes, null);
  assert.deepEqual(visible.submissions[1].metrics, emptyMetrics());
});

test("public v1 remains latest during private v2 review and correction; only fresh release promotes a new snapshot", async () => {
  const f = await prepared();
  let item = (await f.submit(f.submission(f.initial))).item;
  item = (await f.admin(f.release(item))).items[0];
  const v1 = (await f.read())[0].latestSubmission;
  item = (
    await f.submit(
      f.submission(
        item,
        source({
          title: "PRIVATE_V2",
          metricsAsOf: ago(0.5),
          metrics: { ...emptyMetrics(), views: 555555 },
        }),
      ),
    )
  ).item;
  let visible = (await f.read())[0];
  assert.equal(visible.latestSubmission.id, v1.id);
  assert.equal(visible.latestSubmission.isLatest, true);
  assert.equal(visible.submissions.length, 1);
  assert.ok(!JSON.stringify(visible).includes("555555"));
  item = (await f.admin(f.requestChanges(item))).items[0];
  assert.equal(item.status, "AGENCY_REVISION");
  assert.equal((await f.read())[0].latestSubmission.id, v1.id);
  item = (
    await f.submit(
      f.submission(
        item,
        source({
          title: "PRIVATE_V3",
          metricsAsOf: ago(0.2),
          metrics: { ...emptyMetrics(), views: 1600 },
        }),
      ),
    )
  ).item;
  await f.admin(
    f.release(
      item,
      publicData({
        title: "최신 집계 결과",
        metrics: { ...emptyMetrics(), views: 1500 },
        metricsAsOf: ago(0.2),
      }),
    ),
  );
  visible = (await f.read())[0];
  assert.equal(visible.submissions.length, 2);
  assert.equal(visible.latestSubmission.version, 3);
  assert.equal(visible.latestSubmission.metrics.views, 1500);
  assert.equal(visible.submissions[1].id, v1.id);
  assert.equal(visible.submissions[1].metrics.views, 1200);
  assert.equal(visible.submissions[1].isLatest, false);
  assert.equal(f.store.reportSubmissions[1].sourceTitle, "PRIVATE_V2");
  assert.equal(f.store.reportSubmissions[1].releasedAt, null);
});

test("organization scope, MEMBER write denial and live approval/profile checks guard all mutations", async () => {
  const f = await prepared();
  const input = f.submission(f.initial);
  const readonly = await listAgencyReporting(f.tx, {
    ...agency,
    userId: "agency-member",
  });
  assert.equal(readonly.canSubmit, false);
  assert.equal(readonly.items[0].canSubmit, false);
  await assert.rejects(
    () =>
      applyAgencyReportingMutation(
        f.tx,
        { ...agency, userId: "agency-member" },
        input,
      ),
    fail(403),
  );
  await assert.rejects(
    () =>
      applyAgencyReportingMutation(
        f.tx,
        { userId: "other-agency", organizationId: "agency-other" },
        input,
      ),
    fail(404),
  );
  assert.deepEqual(
    (
      await listAgencyReporting(f.tx, {
        userId: "other-agency",
        organizationId: "agency-other",
      })
    ).items,
    [],
  );
  await assert.rejects(
    () => listBrandReportingItems(f.tx, "brand-other", "campaign-own"),
    fail(404),
  );
  await assert.rejects(
    () =>
      applyAdminReportingMutation(f.tx, "agency-owner", {
        action: "prepare",
        campaignId: "campaign-own",
        clientRequestId: randomUUID(),
      }),
    fail(403),
  );
  f.store.orgs.find((o) => o.id === "agency-own").metadata = {};
  await assert.rejects(() => f.submit(input), fail(403));
  f.store.orgs.find((o) => o.id === "agency-own").metadata = {
    testWorkspaceAccess: true,
  };
  f.store.orgs.find((o) => o.id === "agency-own").status = "PENDING";
  await assert.rejects(() => listAgencyReporting(f.tx, agency), fail(403));
});

test("idempotent submits/releases do not duplicate; altered payload and stale latest submission conflict", async () => {
  const f = await prepared();
  const body = f.submission(f.initial);
  let item = (await f.submit(body)).item;
  await f.submit(body);
  assert.equal(f.store.reportSubmissions.length, 1);
  await assert.rejects(
    () => f.submit({ ...body, data: source({ title: "changed" }) }),
    fail(409, "IDEMPOTENCY_CONFLICT"),
  );
  await assert.rejects(
    () => f.submit({ ...body, clientRequestId: randomUUID() }),
    fail(409, "STALE_REPORTING"),
  );
  const release = f.release(item);
  await f.admin(release);
  await f.admin(release);
  assert.equal(f.store.reportItems[0].revision, 2);
  await assert.rejects(
    () => f.admin({ ...release, data: publicData({ title: "changed" }) }),
    fail(409, "IDEMPOTENCY_CONFLICT"),
  );
  item = (await listAgencyReporting(f.tx, agency)).items[0];
  item = (await f.submit(f.submission(item))).item;
  await assert.rejects(
    () => f.admin({ ...f.release(item), submissionId: release.submissionId }),
    fail(409, "REPORTING_NOT_ACTIONABLE"),
  );
  assert.equal(
    f.store.audits.filter((a) => a.action === "admin.reporting.releaseToBrand")
      .length,
    1,
  );
});

test("closed, no-longer-approved and replaced conditions deny changes while retaining visible public history", async () => {
  for (const change of [
    (f) => (f.store.campaign.status = "CANCELED"),
    (f) => (f.store.campaign.status = "COMPLETED"),
    (f) => (f.store.items[0].status = "BRAND_REVISION"),
    (f) => (f.store.proposals[0].status = "SUPERSEDED"),
    (f) =>
      f.store.proposals.push({
        ...f.store.proposals[0],
        id: "new-proposal",
        version: 2,
        status: "PUBLISHED",
      }),
  ]) {
    const f = await prepared();
    let item = (await f.submit(f.submission(f.initial))).item;
    item = (await f.admin(f.release(item))).items[0];
    change(f);
    const history = (await f.read())[0];
    assert.equal(history.submissions.length, 1);
    assert.equal(
      history.isCurrent,
      ["CANCELED", "COMPLETED"].includes(f.store.campaign.status),
    );
    await assert.rejects(
      () => f.submit(f.submission(item)),
      fail(409, "REPORTING_NOT_ACTIONABLE"),
    );
  }
  const f = await prepared();
  f.store.proposals[0].expiresAt = new Date(0);
  assert.equal(
    (await f.submit(f.submission(f.initial))).item.status,
    "ADMIN_REVIEW",
  );
});

test("snapshot validation rejects future/before-publication timestamps, missing asOf, unsafe URLs and non-integer metrics", () => {
  assert.equal(reportingSnapshotSchema.safeParse(source()).success, true);
  assert.equal(reportingSnapshotSchema.safeParse(publicData()).success, true);
  const invalid = [
    source({ publishedAt: new Date(Date.now() + 86400000).toISOString() }),
    publicData({ metricsAsOf: ago(4) }),
    publicData({ metricsAsOf: new Date(Date.now() + 86400000).toISOString() }),
    publicData({ metricsAsOf: null, metrics: { ...emptyMetrics(), views: 0 } }),
    publicData({ metrics: { ...emptyMetrics(), views: -1 } }),
    publicData({ metrics: { ...emptyMetrics(), views: 0.5 } }),
    publicData({
      metrics: { ...emptyMetrics(), views: Number.MAX_SAFE_INTEGER + 1 },
    }),
    publicData({ metrics: { ...emptyMetrics(), views: Infinity } }),
    publicData({ metrics: { ...emptyMetrics(), privateCost: 10 } }),
    source({ postUrl: "https://127.0.0.1/private" }),
    source({ evidenceUrl: "javascript:alert(1)" }),
    source({ evidenceUrl: "https://user:pass@youtube.com/" }),
  ];
  for (const value of invalid)
    assert.equal(
      reportingSnapshotSchema.safeParse(value).success,
      false,
      JSON.stringify(value),
    );
});

test("bounded JSON input rejects huge requests and required reporting validation remains specific", async () => {
  await assert.rejects(
    () =>
      readReportingBody(
        new globalThis.Request("https://app.example/api", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "x".repeat(33000),
        }),
        agencyReportingMutationSchema,
      ),
    fail(413),
  );
  await assert.rejects(
    () =>
      readReportingBody(
        new globalThis.Request("https://app.example/api", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
        agencyReportingMutationSchema,
      ),
    fail(400),
  );
});

test("operator reports stay private until release and preserve published history during updates", async () => {
  const f = await prepared();
  const input = { ...f.submission(f.initial), campaignId: "campaign-own" };
  let item = (await f.admin(input)).items[0];
  await f.admin(input);
  assert.equal(f.store.reportSubmissions.length, 1);
  assert.equal((await f.read())[0].latestSubmission, null);
  assert.equal(
    (await f.read())[0].productionVideoUrl,
    "https://www.youtube.com/watch?v=public-preview",
  );
  item = (await f.admin(f.release(item))).items[0];
  const published = (await f.read())[0].latestSubmission;
  item = (
    await f.admin({
      ...input,
      expectedRevision: item.revision,
      clientRequestId: randomUUID(),
      data: source({ title: "관리자 새 성과" }),
    })
  ).items[0];
  assert.equal(item.latestSubmission.version, 2);
  assert.deepEqual((await f.read())[0].latestSubmission, published);
  f.store.campaign.type = "OPEN_BIDDING";
  assert.equal(
    (
      await f.admin({
        ...input,
        expectedRevision: item.revision,
        clientRequestId: randomUUID(),
      })
    ).items[0].latestSubmission.version,
    3,
  );
});
