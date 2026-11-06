import test from "node:test";
import assert from "node:assert/strict";
import {
  getBrandActions,
  getBrandScheduleItems,
  getBrandCampaignProgress,
  isPastBrandDeadline,
} from "../lib/brand-progress.ts";
const now = Date.parse("2026-11-05T10:00:00Z");
const past = "2026-11-04T10:00:00Z";
const future = "2026-11-06T10:00:00Z";
function campaign(overrides = {}) {
  return {
    id: "c1",
    title: "캠페인",
    type: "MANAGED",
    status: "REVIEW",
    submittedAt: past,
    proposalDueAt: future,
    contentDeadline: null,
    applicationDeadline: null,
    latestProposal: null,
    intakeStatus: "IN_PROGRESS",
    intakeAssigneeName: "담당자",
    intakeDueAt: future,
    requestId: "r1",
    productionSummary: {
      total: 0,
      awaitingSubmission: 0,
      underReview: 0,
      awaitingBrand: 0,
      changesRequested: 0,
      approved: 0,
    },
    reportingSummary: {
      total: 0,
      published: 0,
      pending: 0,
      allMetricsPending: 0,
    },
    invoiceSummary: { issued: 0, paid: 0 },
    updatedAt: past,
    ...overrides,
  };
}
function proposal(overrides = {}) {
  return {
    id: "p1",
    campaignId: "c1",
    campaignTitle: "캠페인",
    title: "공식제안",
    status: "PUBLISHED",
    pendingItemCount: 1,
    publishedAt: past,
    expiresAt: future,
    canRespond: false,
    ...overrides,
  };
}
function workspace(c, extras = {}) {
  return {
    campaigns: [c],
    requests: [],
    pendingProposals: c.latestProposal ? [c.latestProposal] : [],
    invoices: [],
    ...extras,
  };
}
function detail(c, extras = {}) {
  return {
    campaign: c,
    requests: [],
    proposals: [],
    deliverables: [],
    performance: { items: [] },
    invoices: [],
    ...extras,
  };
}

test("expired, replaced and canceled proposals never become new approval tasks", () => {
  const expired = campaign({ latestProposal: proposal({ expiresAt: past }) });
  assert.deepEqual(getBrandActions(workspace(expired), now), []);
  assert.equal(
    getBrandCampaignProgress(detail(expired), now).state,
    "proposal-expired",
  );
  assert.equal(
    getBrandScheduleItems([expired], now)[0].kind,
    "proposal-validity",
  );
  const replaced = campaign({ latestProposal: proposal({ id: "p2" }) });
  assert.deepEqual(
    getBrandActions(
      workspace(replaced, { pendingProposals: [proposal()] }),
      now,
    ),
    [],
  );
  const canceled = campaign({
    status: "CANCELED",
    latestProposal: proposal(),
    productionSummary: { total: 1, approved: 0, awaitingBrand: 1 },
  });
  assert.deepEqual(getBrandActions(workspace(canceled), now), []);
  assert.equal(
    getBrandCampaignProgress(detail(canceled), now).state,
    "canceled",
  );
});

test("read-only organization members can still discover an actionable shared proposal", () => {
  const c = campaign({ latestProposal: proposal({ canRespond: false }) });
  assert.equal(getBrandActions(workspace(c), now)[0].kind, "proposal");
  assert.equal(
    getBrandCampaignProgress(detail(c), now).state,
    "proposal-review",
  );
});

test("completed campaign keeps unpaid invoice visible without reopening production", () => {
  const c = campaign({
    status: "COMPLETED",
    productionSummary: { total: 1, approved: 0, awaitingBrand: 1 },
  });
  const invoice = {
    id: "invoice",
    status: "ISSUED",
    campaignId: "c1",
    campaignTitle: "캠페인",
    title: "청구",
    dueAt: past,
    issuedAt: past,
  };
  const tasks = getBrandActions(workspace(c, { invoices: [invoice] }), now);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].kind, "invoice");
  const progress = getBrandCampaignProgress(
    detail(c, { invoices: [invoice] }),
    now,
  );
  assert.equal(progress.stage, "completion");
  assert.equal(progress.state, "invoice");
  assert.equal(progress.owner, "brand");
});

test("task ordering includes overdue work first and keeps missing deadlines last", () => {
  const c = campaign({ latestProposal: proposal() });
  const requests = [
    {
      id: "none",
      title: "기한없음",
      status: "WAITING_BRAND",
      campaignId: null,
      campaignTitle: null,
      dueAt: null,
      updatedAt: past,
    },
    {
      id: "past",
      title: "지난요청",
      status: "WAITING_BRAND",
      campaignId: "c1",
      campaignTitle: "캠페인",
      dueAt: past,
      updatedAt: past,
    },
  ];
  assert.deepEqual(
    getBrandActions(workspace(c, { requests }), now).map((x) => x.id),
    ["request:past", "proposal:p1", "request:none"],
  );
  assert.equal(isPastBrandDeadline(past, now), true);
  assert.equal(isPastBrandDeadline(null, now), false);
});

test("Futures schedules retain overdue work and omit fulfilled or canceled intake", () => {
  const pastDue = campaign({ proposalDueAt: past });
  const futureDue = campaign({ id: "c2", proposalDueAt: future });
  assert.deepEqual(
    getBrandScheduleItems([futureDue, pastDue], now).map((x) => x.campaignId),
    ["c1", "c2"],
  );
  assert.deepEqual(
    getBrandScheduleItems(
      [
        campaign({ latestProposal: proposal(), proposalDueAt: past }),
        campaign({ status: "CANCELED", proposalDueAt: past }),
        campaign({ intakeStatus: "CLOSED", proposalDueAt: past }),
      ],
      now,
    ),
    [],
  );
});

test("requested brief updates take the brand directly to the real intake thread", () => {
  const c = campaign({ intakeStatus: "WAITING_BRAND", intakeDueAt: past });
  const progress = getBrandCampaignProgress(detail(c), now);
  assert.equal(progress.state, "reply");
  assert.equal(progress.owner, "brand");
  assert.equal(progress.href, "/advertiser/requests?request=r1");
  assert.deepEqual(getBrandScheduleItems([c], now), []);
});

test("unfinished production remains the current stage even when older results exist", () => {
  const c = campaign({
    status: "IN_PROGRESS",
    latestProposal: proposal({ status: "APPROVED", pendingItemCount: 0 }),
    productionSummary: {
      total: 2,
      approved: 1,
      awaitingBrand: 1,
      awaitingSubmission: 0,
      underReview: 0,
      changesRequested: 0,
    },
    reportingSummary: {
      total: 1,
      published: 1,
      pending: 0,
      allMetricsPending: 0,
    },
  });
  const progress = getBrandCampaignProgress(detail(c), now);
  assert.equal(progress.stage, "production");
  assert.equal(progress.state, "content-review");
});

test("report awaiting operator review identifies Futures as the responsible party", () => {
  const c = campaign({
    status: "VERIFYING",
    reportingSummary: {
      total: 1,
      published: 0,
      pending: 1,
      allMetricsPending: 0,
    },
  });
  const progress = getBrandCampaignProgress(
    detail(c, {
      performance: { items: [{ isCurrent: true, status: "ADMIN_REVIEW" }] },
    }),
    now,
  );
  assert.equal(progress.stage, "reporting");
  assert.equal(progress.owner, "futures");
});

test("published intake is one proposal task and an expired proposal returns responsibility to Futures", () => {
  const current = proposal();
  const c = campaign({
    latestProposal: current,
    intakeStatus: "WAITING_BRAND",
    intakeWaitingFor: "proposal-decision",
  });
  const request = {
    id: "r1",
    campaignId: "c1",
    title: "의뢰",
    status: "WAITING_BRAND",
    waitingFor: "proposal-decision",
    dueAt: null,
  };
  assert.deepEqual(
    getBrandActions(workspace(c, { requests: [request] }), now).map(
      (item) => item.kind,
    ),
    ["proposal"],
  );
  assert.equal(
    getBrandCampaignProgress(detail(c), now).state,
    "proposal-review",
  );
  current.expiresAt = past;
  assert.deepEqual(
    getBrandActions(workspace(c, { requests: [request] }), now),
    [],
  );
  assert.equal(
    getBrandCampaignProgress(detail(c), now).state,
    "proposal-expired",
  );
});
test("legacy intake is deduplicated while an explicit real reply remains actionable", () => {
  const c = campaign({
    latestProposal: proposal(),
    intakeStatus: "WAITING_BRAND",
  });
  const request = {
    id: "r1",
    campaignId: "c1",
    status: "WAITING_BRAND",
    dueAt: null,
  };
  assert.deepEqual(
    getBrandActions(workspace(c, { requests: [request] }), now).map(
      (item) => item.kind,
    ),
    ["proposal"],
  );
  assert.equal(
    getBrandCampaignProgress(detail(c), now).state,
    "proposal-review",
  );
  request.waitingFor = "reply";
  c.intakeWaitingFor = "reply";
  assert.equal(
    getBrandActions(workspace(c, { requests: [request] }), now).length,
    2,
  );
  assert.equal(getBrandCampaignProgress(detail(c), now).state, "reply");
});

test("returned brief tasks lead to editing the existing draft rather than creating a second campaign", () => {
  const c = campaign({ status: "DRAFT", requestId: null });
  const request = {
    id: "r1",
    campaignId: "c1",
    status: "WAITING_BRAND",
    waitingFor: "brief",
    dueAt: null,
  };
  assert.equal(
    getBrandActions(workspace(c, { requests: [request] }), now)[0].href,
    "/advertiser/campaign/new?draft=c1",
  );
});
