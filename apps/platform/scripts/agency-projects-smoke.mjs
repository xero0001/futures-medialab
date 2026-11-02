import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

// Existing isolated QA only: business endpoints are GET-only. Genuine sign-in
// is the sole allowed POST. There is no database client, seed, or cleanup path.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const { values } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://127.0.0.1:3100" },
    "fixture-file": { type: "string", default: "tmp/settlement-qa.json" },
    "output-file": { type: "string" },
  },
});
const target = new URL(values["base-url"]);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]", "futures-medialab.vercel.app"].includes(
    target.hostname,
  ),
  "UNEXPECTED_TARGET_HOST",
);
assert.ok(
  ["http:", "https:"].includes(target.protocol) &&
    target.pathname === "/" &&
    !target.search &&
    !target.hash &&
    !target.username &&
    !target.password,
  "ORIGIN_REQUIRED",
);
if (target.hostname.endsWith(".vercel.app"))
  assert.equal(
    target.origin,
    "https://futures-medialab.vercel.app",
    "CANONICAL_PRODUCTION_ONLY",
  );
const fixtureFile = resolve(root, values["fixture-file"]);
assert.equal(
  (await stat(fixtureFile)).mode & 0o077,
  0,
  "FIXTURE_FILE_MUST_BE_PRIVATE",
);
const fixture = JSON.parse(await readFile(fixtureFile, "utf8"));
assert.match(fixture.prefix, /^settlement-live-qa-\d+-[a-f0-9]{12}$/);
assert.ok(
  typeof fixture.password === "string" && fixture.password.length >= 24,
  "QA_PASSWORD_REQUIRED",
);
for (const name of [
  "agency",
  "agency-member",
  "other-agency",
  "owner",
  "outsider",
  "admin",
]) {
  const account = fixture.accounts[name];
  assert.equal(
    account?.email,
    `${fixture.prefix}-${name}@example.invalid`,
    "ISOLATED_QA_ACCOUNT_REQUIRED",
  );
  assert.equal(
    account.userId,
    `${fixture.prefix}-${name}`,
    "ISOLATED_QA_USER_REQUIRED",
  );
  assert.ok(
    account.orgId.startsWith(`${fixture.prefix}-`),
    "ISOLATED_QA_ORGANIZATION_REQUIRED",
  );
}
const campaignIds = [
  fixture.campaignId,
  fixture.guardCampaignId,
  fixture.browserCampaignId,
  fixture.readyCampaignId,
];
assert.ok(
  campaignIds.every(
    (id) =>
      typeof id === "string" && id.startsWith(`${fixture.prefix}-campaign-`),
  ),
  "ISOLATED_QA_CAMPAIGNS_REQUIRED",
);
const outputFile = resolve(
  root,
  values["output-file"] ??
    `output/agency-projects-review/${target.hostname.endsWith(".vercel.app") ? "production" : "local"}-verification.json`,
);
const report = {
  checkedAt: new Date().toISOString(),
  origin: target.origin,
  qaPrefix: fixture.prefix,
  mode: "business GET only; genuine sign-in only",
  checks: [],
  overall: "pending",
};
try {
  const previous = JSON.parse(await readFile(outputFile, "utf8"));
  assert.equal(
    previous.origin,
    target.origin,
    "PREVIOUS_REPORT_ORIGIN_MISMATCH",
  );
  assert.equal(
    previous.qaPrefix,
    fixture.prefix,
    "PREVIOUS_REPORT_NAMESPACE_MISMATCH",
  );
  report.previousAttempts = [
    ...(previous.previousAttempts ?? []),
    {
      checkedAt: previous.checkedAt,
      completedAt: previous.completedAt,
      overall: previous.overall,
      checks: previous.checks,
    },
  ];
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const sessions = new Map();
const safeError = (error) =>
  /^[A-Z0-9_]+$/.test(error?.message?.split("\n", 1)[0] ?? "")
    ? error.message.split("\n", 1)[0]
    : (error?.name ?? "ERROR");
async function persist() {
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
}
async function call(path, { cookie, credentials } = {}) {
  assert.ok(
    /^\/api\/(?:auth\/sign-in\/email|agency\/(?:projects|production|reporting|settlement|operations))(?:\?|$)/.test(
      path,
    ),
    "UNEXPECTED_API_PATH",
  );
  assert.ok(
    !credentials || path === "/api/auth/sign-in/email",
    "BUSINESS_WRITES_FORBIDDEN",
  );
  const response = await globalThis.fetch(new URL(path, target), {
    method: credentials ? "POST" : "GET",
    redirect: "manual",
    signal: globalThis.AbortSignal.timeout(45000),
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(credentials
        ? {
            Origin: target.origin,
            "Sec-Fetch-Site": "same-origin",
            "Content-Type": "application/json",
          }
        : {}),
    },
    ...(credentials ? { body: JSON.stringify(credentials) } : {}),
  });
  const body = await response.text(),
    contentType = response.headers.get("content-type") ?? "";
  let json = null;
  if (contentType.includes("application/json")) {
    try {
      json = JSON.parse(body);
    } catch {
      /* Never log response bodies or credentials. */
    }
  }
  if (
    !json &&
    [401, 403, 302, 307, 308].includes(response.status) &&
    (/text\/html/.test(contentType) ||
      /vercel|sso/i.test(response.headers.get("location") ?? ""))
  )
    throw new Error("EXISTING_DEPLOYMENT_PROTECTION_BLOCKED");
  return { response, json, body };
}
function status(result, expected) {
  if (result.response.status !== expected) {
    const resource = new URL(result.response.url).pathname
      .split("/")
      .filter(Boolean)
      .at(-1)
      .toUpperCase()
      .replaceAll("-", "_");
    throw new Error(
      `HTTP_${result.response.status}_EXPECTED_${expected}_${resource}`,
    );
  }
  assert.ok(result.json, "JSON_RESPONSE_REQUIRED");
}
function privateHeaders(result) {
  const cache = result.response.headers.get("cache-control") ?? "";
  assert.ok(
    cache.includes("private") && cache.includes("no-store"),
    "PRIVATE_CACHE_REQUIRED",
  );
  assert.equal(
    result.response.headers.get("x-content-type-options"),
    "nosniff",
    "NOSNIFF_REQUIRED",
  );
}
async function login(name) {
  if (sessions.has(name)) return sessions.get(name);
  const credentials = {
    email: fixture.accounts[name].email,
    password: fixture.password,
  };
  let result = await call("/api/auth/sign-in/email", { credentials });
  if (result.response.status === 429) {
    const retry = result.response.headers.get("retry-after"),
      seconds = Number(retry);
    const requested =
      retry && Number.isFinite(seconds)
        ? seconds * 1000
        : retry
          ? Date.parse(retry) - Date.now()
          : 61000;
    let remaining = Math.max(
      61000,
      Number.isFinite(requested) ? requested + 1000 : 61000,
    );
    assert.ok(remaining <= 180000, "AUTH_COOLDOWN_EXCEEDS_BOUNDED_RETRY");
    console.log("WAIT normal sign-in cooldown; no rate-limit bypass");
    while (remaining > 0) {
      const chunk = Math.min(remaining, 30000);
      await delay(chunk);
      remaining -= chunk;
    }
    result = await call("/api/auth/sign-in/email", { credentials });
  }
  status(result, 200);
  const cookies = result.response.headers.getSetCookie();
  assert.ok(
    cookies.some((value) => value.split("=", 1)[0].endsWith("session_token")),
    "SESSION_COOKIE_REQUIRED",
  );
  const cookie = cookies.map((value) => value.split(";", 1)[0]).join("; ");
  sessions.set(name, cookie);
  return cookie;
}
async function read(path, label = "agency") {
  const result = await call(path, { cookie: await login(label) });
  status(result, 200);
  privateHeaders(result);
  return result;
}
function forbidKeys(value, keys) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!keys.has(key), "PRIVATE_FIELD_EXPOSED");
    forbidKeys(child, keys);
  }
}
function projectPrivacy(result, viewer) {
  privateHeaders(result);
  forbidKeys(
    result.json,
    new Set([
      "budgetAmount",
      "brandTotalAmount",
      "totalSupplierAmount",
      "unitAmount",
      "lineAmount",
      "supplierCost",
      "supplierOrganizationId",
      "supplierName",
      "creatorId",
      "internalNote",
      "internalNotes",
      "externalPaymentReference",
      "invoices",
      "invoice",
      "lineSnapshot",
      "payloadHash",
      "sourceTitle",
      "sourceNote",
      "sourceMetrics",
      "sourcePostUrl",
      "sourceEvidenceUrl",
      "sourceUrl",
      "brandOrganizationId",
      "proposedAmount",
    ]),
  );
  const other =
    viewer === "other-agency"
      ? fixture.accounts.agency
      : fixture.accounts["other-agency"];
  for (const value of [
    `${fixture.prefix}-PRIVATE-ADMIN-NOTE`,
    `${fixture.prefix}-PRIVATE-AGENCY-SOURCE`,
    other.orgId,
    other.email,
    "27021597764222.93",
    "9007199254740.91",
  ])
    assert.ok(!result.body.includes(value), "PRIVATE_VALUE_EXPOSED");
}
async function check(name, run) {
  try {
    const metadata = await run();
    report.checks.push({ name, status: "passed", ...metadata });
    console.log(`PASS ${name}`);
  } catch (error) {
    const code = safeError(error);
    report.checks.push({
      name,
      status:
        code === "EXISTING_DEPLOYMENT_PROTECTION_BLOCKED"
          ? "blocked"
          : "failed",
      code,
    });
    await persist();
    throw error;
  }
  await persist();
}

const expectedIds = [...campaignIds].sort();
const projects = new Map();
function validateProjects(result, viewer) {
  projectPrivacy(result, viewer);
  assert.ok(Array.isArray(result.json.projects), "PROJECT_ARRAY_REQUIRED");
  assert.deepEqual(
    result.json.projects.map((project) => project.campaignId).sort(),
    expectedIds,
    "EXACT_ASSIGNED_MANAGED_CAMPAIGNS_REQUIRED",
  );
  assert.equal(result.json.hasMore, false, "UNEXPECTED_TRUNCATION");
  assert.equal(
    result.json.limits.projects,
    100,
    "BOUNDED_PROJECT_LIMIT_REQUIRED",
  );
  for (const project of result.json.projects) {
    assert.equal(project.campaignType, "MANAGED", "MANAGED_PROJECT_MISSING");
    assert.equal(
      project.assignment.production,
      true,
      "OWN_PRODUCTION_ASSIGNMENT_REQUIRED",
    );
    assert.equal(
      project.assignment.officialProposalItems,
      1,
      "FINAL_PRODUCTION_SUPPLIER_MUST_OVERRIDE_ORIGINAL_PROPOSAL_SUPPLIER",
    );
    assert.equal(
      project.assignment.acceptedApplication,
      viewer !== "other-agency" && project.campaignId === fixture.campaignId,
      "ACCEPTED_APPLICATION_TENANT_SCOPE_MISMATCH",
    );
    assert.deepEqual(
      project.production,
      {
        total: 1,
        current: 1,
        awaitingSubmission: 0,
        underReview: 0,
        changesRequested: 0,
        approved: 1,
      },
      "OWN_PRODUCTION_COUNTS_REQUIRED",
    );
    assert.deepEqual(
      project.reporting,
      {
        total: 1,
        current: 1,
        awaitingSubmission: 0,
        underReview: 0,
        changesRequested: 0,
        published: 1,
        publicReports: 1,
      },
      "OWN_REPORTING_COUNTS_REQUIRED",
    );
    assert.ok(
      project.availableStages.includes("production") &&
        project.availableStages.includes("reporting"),
      "HISTORICAL_READ_DESTINATIONS_REQUIRED",
    );
    assert.ok(
      project.availableStages.every((stage) =>
        ["production", "reporting", "settlement", "records"].includes(stage),
      ),
      "UNKNOWN_PROJECT_STAGE",
    );
    assert.equal(
      project.isClosed,
      ["COMPLETED", "CANCELED"].includes(project.campaignStatus),
      "CLOSED_STATE_MISMATCH",
    );
  }
  const main = result.json.projects.find(
    (project) => project.campaignId === fixture.campaignId,
  );
  assert.equal(main.campaignStatus, "COMPLETED", "COMPLETED_PROJECT_MISSING");
  assert.deepEqual(
    main.settlement,
    { issued: 0, paid: 1 },
    "OWN_PAID_PAYOUT_REQUIRED",
  );
  assert.ok(
    main.availableStages.includes("settlement"),
    "PAID_STATEMENT_DESTINATION_REQUIRED",
  );
  const draft = result.json.projects.find(
    (project) => project.campaignId === fixture.browserCampaignId,
  );
  assert.equal(
    draft.campaignStatus,
    "COMPLETED",
    "COMPLETED_DRAFT_PROJECT_MISSING",
  );
  assert.deepEqual(
    draft.settlement,
    { issued: 0, paid: 0 },
    "DRAFT_PAYOUT_COUNT_EXPOSED",
  );
  assert.ok(
    !draft.availableStages.includes("settlement"),
    "DRAFT_PAYOUT_STAGE_EXPOSED",
  );
}
function ownTaskPrivacy(result) {
  privateHeaders(result);
  forbidKeys(
    result.json,
    new Set([
      "internalNote",
      "internalNotes",
      "supplierCost",
      "supplierOrganizationId",
      "supplierName",
      "brandTotalAmount",
      "unitAmount",
      "lineAmount",
      "budgetAmount",
    ]),
  );
  assert.ok(
    !result.body.includes(`${fixture.prefix}-PRIVATE-ADMIN-NOTE`),
    "INTERNAL_NOTE_EXPOSED",
  );
}
try {
  await check(
    "anonymous project directory requires authentication",
    async () => {
      const result = await call("/api/agency/projects");
      status(result, 401);
      privateHeaders(result);
      return { httpStatus: 401 };
    },
  );
  for (const label of ["agency", "other-agency"]) {
    await check(
      `${label} sees exactly its four assigned managed QA projects`,
      async () => {
        const result = await read("/api/agency/projects", label);
        validateProjects(result, label);
        assert.equal(
          result.json.organization.role,
          "OWNER",
          "OWNER_ROLE_REQUIRED",
        );
        projects.set(label, result);
        return {
          httpStatus: 200,
          projectCount: result.json.projects.length,
          productionItems: result.json.projects.reduce(
            (sum, project) => sum + project.production.total,
            0,
          ),
          draftDocumentsExposed: 0,
        };
      },
    );
  }
  await check(
    "project summaries omit the other agency identity and all brand prices",
    async () => {
      const primary = projects.get("agency"),
        other = projects.get("other-agency");
      assert.ok(
        !primary.body.includes(other.json.organization.name),
        "OTHER_AGENCY_NAME_EXPOSED",
      );
      assert.ok(
        !other.body.includes(primary.json.organization.name),
        "OTHER_AGENCY_NAME_EXPOSED",
      );
      forbidKeys(
        primary.json,
        new Set(["creatorName", "creators", "items", "channels", "creatorId"]),
      );
      forbidKeys(
        other.json,
        new Set(["creatorName", "creators", "items", "channels", "creatorId"]),
      );
      return { brandPricesExposed: false, otherAgencyIdentityExposed: false };
    },
  );
  await check(
    "agency MEMBER reads the same own projects without widening scope",
    async () => {
      const result = await read("/api/agency/projects", "agency-member");
      validateProjects(result, "agency");
      assert.equal(
        result.json.organization.role,
        "MEMBER",
        "MEMBER_ROLE_REQUIRED",
      );
      assert.deepEqual(
        result.json.projects,
        projects.get("agency").json.projects,
        "MEMBER_PROJECT_SCOPE_MISMATCH",
      );
      return {
        httpStatus: 200,
        role: "MEMBER",
        projectCount: result.json.projects.length,
      };
    },
  );
  for (const label of ["agency", "other-agency"]) {
    await check(
      `${label} project counts match campaign-scoped production, reporting and issued payouts`,
      async () => {
        const cookie = await login(label),
          globalProduction = await call("/api/agency/production", { cookie }),
          globalReporting = await call("/api/agency/reporting", { cookie });
        status(globalProduction, 200);
        status(globalReporting, 200);
        ownTaskPrivacy(globalProduction);
        ownTaskPrivacy(globalReporting);
        assert.equal(
          globalProduction.json.items.length,
          4,
          "GLOBAL_PRODUCTION_SCOPE_MISMATCH",
        );
        assert.equal(
          globalReporting.json.items.length,
          4,
          "GLOBAL_REPORTING_SCOPE_MISMATCH",
        );
        const index = label === "agency" ? 0 : 1;
        for (const project of projects.get(label).json.projects) {
          const id = encodeURIComponent(project.campaignId),
            suffix = project.campaignId.slice(
              `${fixture.prefix}-campaign-`.length,
            );
          const outcomes = await Promise.allSettled([
            call(`/api/agency/projects?campaignId=${id}`, { cookie }),
            call(`/api/agency/production?campaignId=${id}`, { cookie }),
            call(`/api/agency/reporting?campaignId=${id}`, { cookie }),
            call(`/api/agency/settlement?campaignId=${id}`, { cookie }),
          ]);
          for (const outcome of outcomes)
            assert.equal(outcome.status, "fulfilled", "SCOPED_GET_FAILED");
          const [single, production, reporting, settlement] = outcomes.map(
            (outcome) => outcome.value,
          );
          for (const result of [single, production, reporting, settlement]) {
            status(result, 200);
            privateHeaders(result);
          }
          projectPrivacy(single, label);
          ownTaskPrivacy(production);
          ownTaskPrivacy(reporting);
          assert.deepEqual(
            single.json.projects,
            [project],
            "PROJECT_QUERY_MUST_NARROW",
          );
          assert.deepEqual(
            production.json.items.map((item) => item.id),
            [`${fixture.prefix}-production-${suffix}-${index}`],
            "PRODUCTION_QUERY_OR_TENANT_SCOPE_MISMATCH",
          );
          assert.deepEqual(
            reporting.json.items.map((item) => item.id),
            [`${fixture.prefix}-reporting-${suffix}-${index}`],
            "REPORTING_QUERY_OR_TENANT_SCOPE_MISMATCH",
          );
          assert.ok(
            production.json.items.every(
              (item) => item.campaignId === project.campaignId,
            ),
            "PRODUCTION_CAMPAIGN_FILTER_IGNORED",
          );
          assert.ok(
            reporting.json.items.every(
              (item) => item.campaignId === project.campaignId,
            ),
            "REPORTING_CAMPAIGN_FILTER_IGNORED",
          );
          assert.equal(
            production.json.items.length,
            project.production.total,
            "PRODUCTION_SUMMARY_MISMATCH",
          );
          assert.equal(
            reporting.json.items.length,
            project.reporting.total,
            "REPORTING_SUMMARY_MISMATCH",
          );
          assert.ok(
            settlement.json.payouts.every(
              (document) =>
                ["ISSUED", "PAID"].includes(document.status) &&
                document.campaignId === project.campaignId,
            ),
            "DRAFT_OR_FOREIGN_STATEMENT_EXPOSED",
          );
          const counts = {
            issued: settlement.json.payouts.filter(
              (document) => document.status === "ISSUED",
            ).length,
            paid: settlement.json.payouts.filter(
              (document) => document.status === "PAID",
            ).length,
          };
          assert.deepEqual(
            project.settlement,
            counts,
            "OWN_PUBLIC_PAYOUT_SUMMARY_MISMATCH",
          );
          assert.equal(
            project.availableStages.includes("settlement"),
            counts.issued + counts.paid > 0,
            "SETTLEMENT_STAGE_MUST_REQUIRE_ISSUED_DOCUMENT",
          );
          if (project.campaignId === fixture.browserCampaignId)
            assert.deepEqual(
              settlement.json.payouts,
              [],
              "PRIVATE_DRAFT_EXPOSED",
            );
        }
        return {
          campaignsChecked: 4,
          ownProductionItems: 4,
          ownReportingItems: 4,
          scopedRequests: 16,
        };
      },
    );
  }
  await check(
    "a client-supplied organization ID cannot switch the agency tenant",
    async () => {
      const result = await read(
        `/api/agency/projects?organizationId=${encodeURIComponent(fixture.accounts["other-agency"].orgId)}`,
      );
      projectPrivacy(result, "agency");
      assert.deepEqual(
        result.json,
        projects.get("agency").json,
        "CLIENT_TENANT_OVERRIDE_ALLOWED",
      );
      return { httpStatus: 200, tenantScopeUnchanged: true };
    },
  );
  await check(
    "foreign campaign and malformed query parameters never return another tenant",
    async () => {
      const cookie = await login("agency");
      for (const resource of ["projects", "production", "reporting"]) {
        const foreign = await call(
          `/api/agency/${resource}?campaignId=fm-demo-nte-production-v1-campaign-approved`,
          { cookie },
        );
        status(foreign, 404);
        privateHeaders(foreign);
        const invalid = await call(
          `/api/agency/${resource}?campaignId=../invalid`,
          { cookie },
        );
        status(invalid, 400);
        privateHeaders(invalid);
      }
      return { foreignStatus: 404, invalidStatus: 400, endpointsChecked: 3 };
    },
  );
  await check(
    "legacy operations narrows accepted records without including another agency's assignment",
    async () => {
      const cookie = await login("agency"),
        campaign = encodeURIComponent(fixture.campaignId);
      const own = await call(`/api/agency/operations?campaignId=${campaign}`, {
        cookie,
      });
      status(own, 200);
      privateHeaders(own);
      assert.equal(
        own.json.projects.length,
        1,
        "ONE_OWN_ACCEPTED_RECORD_REQUIRED",
      );
      assert.equal(
        own.json.projects[0].campaignId,
        fixture.campaignId,
        "LEGACY_OPERATIONS_FILTER_IGNORED",
      );
      assert.equal(
        own.json.projects[0].officialProduction,
        true,
        "OFFICIAL_CAMPAIGN_REQUIRED",
      );
      const other = await call(
        `/api/agency/operations?campaignId=${campaign}`,
        { cookie: await login("other-agency") },
      );
      status(other, 404);
      privateHeaders(other);
      const foreign = await call(
        "/api/agency/operations?campaignId=fm-demo-nte-production-v1-campaign-approved",
        { cookie },
      );
      status(foreign, 404);
      privateHeaders(foreign);
      for (const query of [
        "campaignId=",
        `campaignId=${campaign}&campaignId=${campaign}`,
      ]) {
        const invalid = await call(`/api/agency/operations?${query}`, {
          cookie,
        });
        status(invalid, 400);
        privateHeaders(invalid);
      }
      return {
        acceptedProjectCount: 1,
        otherAgencyStatus: 404,
        foreignStatus: 404,
        invalidStatus: 400,
      };
    },
  );
  for (const label of ["owner", "outsider", "admin"]) {
    await check(
      `${label} non-agency role cannot read the agency project directory`,
      async () => {
        const result = await call("/api/agency/projects", {
          cookie: await login(label),
        });
        status(result, 403);
        privateHeaders(result);
        return { httpStatus: 403 };
      },
    );
  }
  report.overall = "passed";
} catch (error) {
  report.overall =
    safeError(error) === "EXISTING_DEPLOYMENT_PROTECTION_BLOCKED"
      ? "blocked"
      : "failed";
  console.error(
    `${report.overall.toUpperCase()} agency projects verification: ${safeError(error)}`,
  );
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await persist();
}
console.log(
  `${report.overall.toUpperCase()} ${report.checks.filter((check) => check.status === "passed").length}/${report.checks.length} agency project checks; existing QA retained, no business writes`,
);
