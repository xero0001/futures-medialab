import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
const { URL, Response, Request, URLSearchParams } = globalThis;
const base = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
function compile(relative, overrides = {}, cache = new Map()) {
  const filename = resolve(base, relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const localRequire = (specifier) =>
    Object.hasOwn(overrides, specifier)
      ? overrides[specifier]
      : specifier.startsWith(".")
        ? compile(
            resolve(dirname(filename), specifier + ".ts"),
            overrides,
            cache,
          )
        : require(specifier);
  runInThisContext(`(function(exports,require,module){${source}\n})`, {
    filename,
  })(module.exports, localRequire, module);
  return module.exports;
}
const rules = compile("lib/operations-query.ts");
const sql = (strings, ...values) => ({ strings: [...strings], values });
const prisma = {
  sql,
  join: (values, separator) => ({ values, separator }),
  empty: { strings: [], values: [] },
  TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" },
};
function setup(tx = {}, options = {}) {
  const calls = [];
  const fail = (status, code, message) => {
    throw Object.assign(new Error(message), { status, code });
  };
  const access = {
    boundary: async (fn) => {
      try {
        return await fn();
      } catch (e) {
        if (e.status)
          return Response.json(
            { code: e.code, message: e.message },
            { status: e.status },
          );
        throw e;
      }
    },
    fail,
    json: (data, status = 200) =>
      Response.json(data, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
    rateLimit: async () => {},
    requireAdmin: async () => {
      calls.push("auth");
      if (options.unauthorized) fail(401, "UNAUTHORIZED", "로그인 필요");
      return { userId: "operator", sessionId: "session", name: "운영자" };
    },
    recheckAdmin: async () => {
      calls.push("recheck");
      if (options.expired) fail(401, "UNAUTHORIZED", "세션 만료");
    },
  };
  const db = {
    $transaction: async (fn, config) => {
      calls.push("transaction");
      assert.equal(config.isolationLevel, "RepeatableRead");
      return fn(tx);
    },
  };
  const overrides = {
    "server-only": {},
    "@futures-medialab/database": { getDatabase: () => db, Prisma: prisma },
    "./access": access,
  };
  return {
    operations: compile("lib/operations-api.ts", overrides).adminOperationsApi,
    documents: compile("lib/operations-documents.ts", overrides)
      .adminCampaignDocumentsApi,
    calls,
  };
}
const request = (path = "/api/admin/operations") =>
  new Request("https://admin.test" + path);
test("invalid search filters and hostile campaign ids are rejected", () => {
  for (const query of [
    "kind=unsafe",
    "assignee=someone",
    "deadline=tomorrow",
    "page=0",
    "page=1.5",
    "page=100001",
    "campaignId=../other",
  ])
    assert.throws(
      () => rules.operationsFilter(new URLSearchParams(query)),
      /INVALID_FILTER/,
    );
  assert.equal(
    rules.operationsFilter(
      new URLSearchParams("kind=invoice&assignee=mine&q=hello%25&page=2"),
    ).q,
    "hello%",
  );
});
test("document original URLs exclude executable and credential-bearing URLs", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///private",
    "https://user:password@example.com/a",
    "https://example.invalid/demo",
  ])
    assert.equal(rules.safeDocumentUrl(value), null);
  assert.equal(
    rules.safeDocumentUrl("https://files.example.com/original.pdf"),
    "https://files.example.com/original.pdf",
  );
});
test("operations and documents require admin authentication before reading", async () => {
  for (const target of ["operations", "documents"]) {
    const service = setup({}, { unauthorized: true });
    assert.equal(
      (
        await service[target](
          request(
            target === "documents"
              ? "/api/admin/campaign-documents?campaignId=c1"
              : undefined,
          ),
        )
      ).status,
      401,
    );
    assert.deepEqual(service.calls, ["auth"]);
  }
});
test("read APIs reject mutation methods", async () => {
  const service = setup();
  for (const target of ["operations", "documents"])
    assert.equal(
      (
        await service[target](
          new Request("https://admin.test/api", { method: "POST" }),
        )
      ).status,
      405,
    );
  assert.deepEqual(service.calls, []);
});
test("live authorization is rechecked inside the read snapshot", async () => {
  const service = setup({}, { expired: true });
  assert.equal((await service.operations(request())).status, 401);
  assert.deepEqual(service.calls, ["auth", "transaction", "recheck"]);
});
test("operations preserves exact totals and clamps a stale page without truncating counts", async () => {
  let n = 0;
  const service = setup({
    $queryRaw: async (query) => {
      assert.ok(query.strings);
      n++;
      if (n === 1)
        return [
          {
            kind: "invoice",
            total: 61n,
            mine: 3n,
            unassigned: 58n,
            overdue: 5n,
            soon: 1n,
          },
        ];
      if (n === 2) return [{ count: 61n }];
      return [
        {
          id: "invoice:1",
          kind: "invoice",
          title: "미입금 청구",
          description: "입금 확인",
          campaignId: "completed",
          campaignTitle: "완료 캠페인",
          brandName: "브랜드",
          requestId: null,
          section: "settlement",
          assigneeId: null,
          assigneeName: null,
          dueAt: null,
          updatedAt: new Date("2026-11-01T00:00:00Z"),
        },
      ];
    },
  });
  const response = await service.operations(
    request("/api/admin/operations?kind=invoice&page=999"),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const result = await response.json();
  assert.equal(result.total, 61);
  assert.equal(result.page, 3);
  assert.equal(result.counts.byKind.invoice, 61);
  assert.equal(result.counts.mine, 3);
  assert.equal(result.items[0].campaignId, "completed");
  assert.equal(result.items[0].dueAt, null);
  assert.equal(result.hasMore, false);
});
test("invalid filter does not begin a data transaction", async () => {
  const service = setup();
  assert.equal(
    (await service.operations(request("/api/admin/operations?kind=unknown")))
      .status,
    400,
  );
  assert.deepEqual(service.calls, ["auth"]);
});
test("unknown campaign documents return 404 before any content query", async () => {
  const service = setup({ campaign: { findUnique: async () => null } });
  assert.equal(
    (
      await service.documents(
        request("/api/admin/campaign-documents?campaignId=missing"),
      )
    ).status,
    404,
  );
});
const stamp = new Date("2026-11-01T00:00:00Z");
function docsTx(overrides = {}) {
  return {
    campaign: {
      findUnique: async () => ({
        id: "c1",
        title: "캠페인",
        brandOrganizationId: "b1",
        brandOrganization: { name: "브랜드" },
      }),
    },
    campaignProposal: {
      findFirst: async () => ({ id: "p1" }),
      findMany: async () => [],
    },
    reportingSubmission: { findMany: async () => [] },
    brandInvoice: { findMany: async () => [] },
    agencyPayout: { findMany: async () => [] },
    requestAttachment: { findMany: async () => [] },
    ...overrides,
  };
}
test("documents keep public reporting snapshots separate from private source data", async () => {
  const row = {
    id: "r1",
    reportingItemId: "ri1",
    version: 1,
    status: "PUBLISHED",
    submittedAt: stamp,
    updatedAt: stamp,
    releasedAt: stamp,
    sourceTitle: "private title",
    sourcePostUrl: "private url",
    sourceNote: "private note",
    sourceMetrics: { views: 999 },
    sourceEvidenceUrl: "https://private.example.com/evidence",
    releasedTitle: "공개 보고",
    releasedPostUrl: "https://youtube.com/video",
    releasedNote: "공개 설명",
    releasedMetrics: { views: 0 },
    releasedEvidenceUrl: "https://files.example.com/public.pdf",
    internalNote: "secret admin",
    reportingItem: {
      productionItem: {
        proposalItem: {
          creatorName: "공개 인물",
          proposal: { id: "p1", version: 1 },
        },
      },
    },
  };
  const service = setup(
    docsTx({ reportingSubmission: { findMany: async () => [row] } }),
  );
  const body = await (
    await service.documents(
      request("/api/admin/campaign-documents?campaignId=c1"),
    )
  ).json();
  assert.equal(body.documents[0].scope, "brand");
  assert.equal(
    body.documents[0].file.url,
    "https://files.example.com/public.pdf",
  );
  assert.doesNotMatch(
    JSON.stringify(body),
    /private title|private url|private note|secret admin|private.example/,
  );
  assert.match(JSON.stringify(body), /조회 0/);
});
test("attachment boundary excludes unshared/discarded rows and never emits storage paths", async () => {
  let where;
  const service = setup(
    docsTx({
      requestAttachment: {
        findMany: async (input) => {
          where = input.where;
          return [
            {
              id: "a1",
              requestId: "q1",
              fileName: "내부.pdf",
              contentType: "application/pdf",
              size: 1024,
              pathname: "private-storage-key",
              uploaderId: "u-private",
              message: { requestId: "q1", internal: true, createdAt: stamp },
              request: { title: "자료 공유" },
            },
            {
              id: "a-bad",
              requestId: "q1",
              fileName: "wrong.pdf",
              size: 10,
              contentType: "application/pdf",
              message: {
                requestId: "q-other",
                internal: false,
                createdAt: stamp,
              },
              request: { title: "자료 공유" },
            },
          ];
        },
      },
    }),
  );
  const body = await (
    await service.documents(
      request("/api/admin/campaign-documents?campaignId=c1"),
    )
  ).json();
  assert.equal(where.discardedAt, null);
  assert.deepEqual(where.messageId, { not: null });
  assert.equal(where.request.organizationId, "b1");
  assert.equal(body.documents.length, 1);
  assert.equal(body.documents[0].scope, "internal");
  assert.equal(
    body.documents[0].file.url,
    "/api/admin/requests/q1/attachments/a1",
  );
  assert.doesNotMatch(
    JSON.stringify(body),
    /private-storage-key|u-private|wrong.pdf/,
  );
});
test("unpublished invoice remains internal and paid partner document remains partner-only", async () => {
  const row = {
    id: "invoice",
    title: "청구 초안",
    status: "DRAFT",
    issuedAt: null,
    updatedAt: stamp,
    documentUrl: null,
    currency: "USD",
    amount: { toFixed: () => "100.00" },
    note: "청구 안내",
    dueAt: null,
    paidAt: null,
  };
  const service = setup(
    docsTx({
      brandInvoice: { findMany: async () => [row] },
      agencyPayout: {
        findMany: async () => [
          {
            ...row,
            id: "payout",
            status: "PAID",
            issuedAt: stamp,
            paidAt: stamp,
            supplierOrganization: { name: "파트너" },
          },
        ],
      },
    }),
  );
  const body = await (
    await service.documents(
      request("/api/admin/campaign-documents?campaignId=c1"),
    )
  ).json();
  assert.equal(
    body.documents.find((x) => x.kind === "invoice").scope,
    "internal",
  );
  assert.equal(
    body.documents.find((x) => x.kind === "payout").scope,
    "partner",
  );
  assert.equal(
    body.documents.find((x) => x.kind === "payout").recipient,
    "파트너",
  );
});

test("latest public report is per reporting item even when its proposal is superseded", async () => {
  const row = {
    id: "old-report-v1",
    reportingItemId: "old-item",
    version: 1,
    status: "PUBLISHED",
    submittedAt: stamp,
    updatedAt: stamp,
    releasedAt: stamp,
    sourceTitle: "원문",
    sourcePostUrl: "https://youtube.com/source",
    sourceNote: "",
    sourceMetrics: { views: 1 },
    sourceEvidenceUrl: null,
    releasedTitle: "이전 제안의 최신 공개 보고",
    releasedPostUrl: "https://youtube.com/public",
    releasedNote: "",
    releasedMetrics: { views: 1 },
    releasedEvidenceUrl: null,
    reportingItem: {
      productionItem: {
        proposalItem: {
          creatorName: "기존 수행 인물",
          proposal: { id: "old-proposal", version: 1 },
        },
      },
    },
  };
  const service = setup(
    docsTx({
      reportingSubmission: {
        findMany: async () => [
          row,
          {
            ...row,
            id: "old-report-v2",
            version: 2,
            releasedAt: null,
            status: "ADMIN_REVIEW",
          },
        ],
      },
    }),
  );
  const body = await (
    await service.documents(
      request("/api/admin/campaign-documents?campaignId=c1"),
    )
  ).json();
  assert.equal(
    body.documents.find((x) => x.id === "report:old-report-v1").isLatest,
    true,
  );
  assert.equal(
    body.documents.find((x) => x.id === "report:old-report-v2").scope,
    "internal",
  );
  assert.match(
    body.documents.find((x) => x.id === "report:old-report-v1").details[0]
      .value,
    /공식 제안 v1/,
  );
});
