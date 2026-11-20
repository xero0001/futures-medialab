import assert from "node:assert/strict";
import test from "node:test";
import { reportMetricsPending, reportSnapshotTitle, reportingInputMetrics, reportingIsoDate, reportingLocalDate, reportingMetricKeys, summarizePublishedReports } from "../lib/reporting-display.ts";
import { nteReportingSnapshot } from "./fixtures/nte-reporting.mjs";

const metrics = (values = {}) => ({ views: null, impressions: null, reach: null, likes: null, comments: null, shares: null, saves: null, clicks: null, ...values });
test("the version comes from the published record, including existing demo titles", () => {
  const scene = { key: "published", title: "도시 하이라이트", concept: "테스트" };
  const { title } = nteReportingSnapshot(scene, 2, new Date("2026-10-12T00:00:00Z"));
  assert.equal(title, "[시연] 도시 하이라이트 · 성과 보고");
  assert.equal(reportSnapshotTitle(`${title} v2`), title);
  for (const authored of ["캠페인 · 성과 보고 v2", "[시연] V2 영상의 결과", title]) {
    assert.equal(reportSnapshotTitle(authored), authored);
  }
});
test("empty initial reports are pending while omissions in measured reports are unavailable", () => {
  const missing = { metrics: metrics(), metricsAsOf: null };
  assert.equal(reportMetricsPending(missing), true);
  assert.equal(reportMetricsPending({ ...missing, metricsAsOf: "2026-10-12T00:00:00Z" }), false);
  assert.equal(reportMetricsPending({ ...missing, metrics: metrics({ clicks: 0 }) }), false);
});
test("the summary only shows a measurement time shared by all current reports", () => {
  const asOf = "2026-10-12T00:00:00Z";
  const item = (id, metricsAsOf) => ({ productionItemId: id, isCurrent: true, latestSubmission: { metricsAsOf, metrics: metrics() } });
  assert.equal(summarizePublishedReports([item("one", asOf), item("two", asOf)]).commonMetricsAsOf, asOf);
  assert.equal(summarizePublishedReports([item("one", asOf), item("two", null)]).commonMetricsAsOf, null);
  assert.equal(summarizePublishedReports([item("one", null)]).allPending, true);
});
test("KST inputs roundtrip across UTC day and year boundaries without device timezone guesses", () => {
  assert.equal(reportingIsoDate("2027-01-01T00:10"), "2026-12-31T15:10:00.000Z");
  assert.equal(reportingLocalDate("2026-12-31T15:10:30.000Z"), "2027-01-01T00:10");
  assert.equal(reportingIsoDate("2026-02-30T12:00"), null);
  assert.equal(reportingIsoDate("2026-03-01"), null);
});
test("unknown figures remain null while explicit zero is measured; unsafe integer inputs are rejected", () => {
  const blank = Object.fromEntries(reportingMetricKeys.map(key => [key, ""]));
  assert.deepEqual(reportingInputMetrics(blank), metrics());
  assert.deepEqual(reportingInputMetrics({ ...blank, views: "0", clicks: "42" }), metrics({ views: 0, clicks: 42 }));
  for (const value of ["-1", "1.5", "9e3", "9007199254740992"]) assert.equal(reportingInputMetrics({ ...blank, views: value }), null);
});
test("totals use one latest released snapshot per current production item, keep zero, and never aggregate reach", () => {
  const latest = { metrics: metrics({ views: Number.MAX_SAFE_INTEGER, likes: 0, reach: 100 }) };
  const item = { id: "report-one", productionItemId: "production-one", isCurrent: true, latestSubmission: latest, submissions: [{ metrics: metrics({ views: 999 }) }, latest] };
  const result = summarizePublishedReports([
    item, item,
    { productionItemId: "production-two", isCurrent: true, latestSubmission: { metrics: metrics({ views: Number.MAX_SAFE_INTEGER, reach: 100 }) } },
    { productionItemId: "private-update", isCurrent: true, latestSubmission: null, submissions: [{ metrics: metrics({ views: 800000 }) }] },
    { productionItemId: "old-proposal", isCurrent: false, latestSubmission: { metrics: metrics({ views: 700000 }) } },
  ]);
  assert.equal(result.count, 2);
  assert.deepEqual(result.totals.views, { known: 2, value: 18014398509481982n });
  assert.deepEqual(result.totals.likes, { known: 1, value: 0n });
  assert.deepEqual(result.totals.clicks, { known: 0, value: null });
  assert.equal("reach" in result.totals, false);
});
