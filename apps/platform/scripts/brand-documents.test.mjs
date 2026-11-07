import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// Exercise the real API authorization and document policies without .env or DB access.
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
  const localRequire = (specifier) => {
    if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
    if (specifier.startsWith("."))
      return compile(
        resolve(dirname(filename), `${specifier}.ts`),
        overrides,
        cache,
      );
    return require(specifier);
  };
  runInThisContext(`(function(exports,require,module){${source}\n})`, {
    filename,
  })(module.exports, localRequire, module);
  return module.exports;
}
const mapping = compile("lib/brand-document-mapping.ts");
const shared = {
  id: "attachment-1",
  requestId: "request-1",
  fileName: "공유 계약.pdf",
  contentType: "application/pdf",
  size: 1234,
  discardedAt: null,
  pathname: "private-storage-key",
  uploaderId: "private-user",
  request: {
    organizationId: "brand-own",
    title: "계약 자료 공유",
    campaignId: "campaign-own",
    campaign: { title: "우리 캠페인", brandOrganizationId: "brand-own" },
  },
  message: {
    requestId: "request-1",
    internal: false,
    createdAt: new Date("2026-10-30T12:00:00Z"),
  },
};
const proposal = {
  id: "proposal-1",
  campaignId: "campaign-own",
  campaignTitle: "우리 캠페인",
  title: "공식 제안",
  publishedAt: "2026-10-29T12:00:00Z",
  version: 1,
  status: "SUPERSEDED",
  isLatest: false,
  summary: "공개 요약",
  items: [],
  decisions: [],
};
const invoice = {
  id: "invoice-1",
  campaignId: "campaign-own",
  campaignTitle: "우리 캠페인",
  title: "청구",
  issuedAt: "2026-10-31T12:00:00Z",
  revision: 9,
  status: "PAID",
  note: "공개 안내",
  documentUrl: "https://files.example.com/invoice.pdf",
  lines: [],
};
const report = {
  campaignId: "campaign-own",
  campaignTitle: "우리 캠페인",
  creatorName: "공개 크리에이터",
  platform: "youtube",
  submission: {
    id: "report-1",
    title: "성과 보고",
    version: 2,
    isLatest: true,
    releasedAt: "2026-10-28T12:00:00Z",
    publishedAt: "2026-10-20T12:00:00Z",
    postUrl: "https://example.com/video",
    note: "공개 보고",
    evidenceUrl: null,
    metrics: { views: 0, clicks: null },
  },
};

test("published attachments exclude internal, unsent, discarded, mismatched and foreign records", () => {
  const cases = [
    { ...shared, message: null },
    { ...shared, discardedAt: new Date() },
    { ...shared, message: { ...shared.message, internal: true } },
    {
      ...shared,
      message: { ...shared.message, requestId: "different-request" },
    },
    {
      ...shared,
      request: { ...shared.request, organizationId: "brand-other" },
    },
    {
      ...shared,
      request: {
        ...shared.request,
        campaign: {
          ...shared.request.campaign,
          brandOrganizationId: "brand-other",
        },
      },
    },
    { ...shared, request: { ...shared.request, campaign: null } },
  ];
  for (const row of cases)
    assert.equal(mapping.attachmentDocument(row, "brand-own"), null);
  assert.equal(
    mapping.attachmentDocument(shared, "brand-own", "campaign-other"),
    null,
  );
  const doc = mapping.attachmentDocument(shared, "brand-own", "campaign-own");
  assert.equal(
    doc.file.url,
    "/api/workspace/requests/request-1/attachments/attachment-1",
  );
  assert.equal(doc.publishedAt, shared.message.createdAt.toISOString());
  assert.equal(doc.version, null);
  assert.ok(!JSON.stringify(doc).includes("private-"));
  const general = {
    ...shared,
    request: { ...shared.request, campaignId: null, campaign: null },
  };
  assert.equal(
    mapping.attachmentDocument(general, "brand-own").campaignId,
    null,
  );
});

test("unpublished artifacts are excluded while historical published versions remain readable", () => {
  assert.equal(
    mapping.proposalDocument({ ...proposal, publishedAt: null }),
    null,
  );
  assert.equal(
    mapping.proposalDocument({ ...proposal, status: "DRAFT" }),
    null,
  );
  assert.equal(mapping.proposalDocument(proposal).isLatest, false);
  assert.equal(mapping.invoiceDocument({ ...invoice, status: "DRAFT" }), null);
  assert.equal(mapping.invoiceDocument({ ...invoice, issuedAt: null }), null);
  assert.equal(mapping.invoiceDocument(invoice).version, 1);
  assert.equal(
    mapping.reportDocument({
      ...report,
      submission: { ...report.submission, releasedAt: null },
    }),
    null,
  );
  assert.equal(
    mapping.reportDocument(report).report.submission.metrics.views,
    0,
  );
  assert.equal(
    mapping.reportDocument(report).report.submission.metrics.clicks,
    null,
  );
});

test("file actions reject executable, credential and relative URLs", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "file:///etc/passwd",
    "//other.example/file",
    "https://user:password@example.com/file",
    "/api/admin/private",
    "invalid",
  ])
    assert.equal(mapping.documentFileUrl(value), null);
  assert.equal(
    mapping.documentFileUrl(" https://files.example.com/report.pdf "),
    "https://files.example.com/report.pdf",
  );
  assert.equal(
    mapping.invoiceDocument({ ...invoice, documentUrl: "javascript:alert(1)" })
      .file,
    null,
  );
});

test("library bounds each kind independently and retains older types with a truncation indicator", () => {
  const p = mapping.proposalDocument(proposal),
    i = mapping.invoiceDocument(invoice),
    a = mapping.attachmentDocument(shared, "brand-own");
  const result = mapping.documentLibrary(
    [[p, { ...p, id: "proposal:2" }, { ...p, id: "proposal:3" }], [i], [a]],
    2,
  );
  assert.equal(result.hasMore, true);
  assert.equal(result.documents.length, 4);
  assert.equal(result.documents[0].kind, "invoice");
  assert.equal(
    result.documents.filter((doc) => doc.kind === "attachment").length,
    1,
  );
  assert.equal(mapping.documentLibrary([[p], [i]], 2).hasMore, false);
});

function fixture(options = {}) {
  const calls = { reads: [], attachments: [], transactions: 0, auth: 0 };
  const db = {
    organizationMember: {
      findFirst: async ({ where }) => {
        assert.equal(where.userId, "user-current");
        assert.equal(where.organization.type, "BRAND");
        return options.noMember
          ? null
          : {
              role: options.role ?? "MEMBER",
              organizationId: "brand-own",
              organization: {
                status: options.status ?? "ACTIVE",
                metadata: options.unapproved
                  ? {}
                  : { testWorkspaceAccess: true },
              },
            };
      },
    },
    session: {
      findFirst: async ({ where }) => {
        assert.equal(where.id, "session-current");
        assert.equal(where.userId, "user-current");
        assert.ok(where.expiresAt.gt instanceof Date);
        return options.revoked ? null : { id: "session-current" };
      },
    },
    campaign: {
      findFirst: async ({ where }) => {
        assert.equal(where.brandOrganizationId, "brand-own");
        return where.id === "campaign-own" ? { id: where.id } : null;
      },
    },
    requestAttachment: {
      findMany: async (query) => {
        calls.attachments.push(query);
        assert.equal(query.where.request.organizationId, "brand-own");
        assert.equal(query.where.message.is.internal, false);
        assert.equal(
          query.where.message.is.request.organizationId,
          "brand-own",
        );
        assert.deepEqual(query.where.messageId, { not: null });
        assert.equal(query.where.discardedAt, null);
        assert.equal(query.take, 101);
        assert.equal(query.select.pathname, undefined);
        assert.equal(query.select.uploader, undefined);
        return [shared];
      },
    },
    $queryRaw: async () => [{ count: options.rateLimited ? 121 : 1 }],
    $transaction: async (run, config) => {
      calls.transactions++;
      assert.equal(config.isolationLevel, "RepeatableRead");
      return run(db);
    },
  };
  const read = (kind, result) => async (tx, organization, campaign, limit) => {
    assert.equal(tx, db);
    assert.equal(
      typeof organization === "string"
        ? organization
        : organization.organizationId,
      "brand-own",
    );
    assert.equal(limit, 101);
    calls.reads.push({ kind, campaign });
    return result;
  };
  const overrides = {
    "server-only": {},
    "@futures-medialab/database": {
      getDatabase: () => db,
      Prisma: {
        TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" },
        PrismaClientKnownRequestError: class extends Error {},
      },
    },
    "./auth": {
      getAuth: () => ({
        api: {
          getSession: async () => {
            calls.auth++;
            return options.anonymous
              ? null
              : {
                  user: { id: "user-current" },
                  session: { id: "session-current" },
                };
          },
        },
      }),
    },
    "@futures-medialab/database/proposals": {
      listBrandDocumentProposals: read("proposal", [proposal]),
    },
    "@futures-medialab/database/reporting": {
      listBrandDocumentReports: read("report", [report]),
    },
    "@futures-medialab/database/settlement": {
      listBrandInvoices: read("invoice", [invoice]),
    },
  };
  return {
    handler: compile("lib/brand-documents.ts", overrides).brandDocuments,
    calls,
  };
}
const request = (suffix = "", method = "GET") =>
  new globalThis.Request(
    `https://futures.example.com/api/brand/documents${suffix}`,
    {
      method,
    },
  );

test("document API uses live approved tenant, read permission, no-store and all published source types", async () => {
  const { handler, calls } = fixture();
  const response = await handler(
    request("?campaign=campaign-own&organizationId=foreign&userId=foreign"),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const body = await response.json();
  assert.equal(body.documents.length, 4);
  assert.equal(body.hasMore, false);
  assert.deepEqual(
    calls.reads.map((item) => item.campaign),
    ["campaign-own", "campaign-own", "campaign-own"],
  );
  assert.ok(!JSON.stringify(body).includes("private-"));
});

test("missing, foreign and malformed campaign URLs return 404 before reading materials", async () => {
  for (const value of ["campaign-other", "missing", "%3Cscript%3E", ""]) {
    const { handler, calls } = fixture();
    assert.equal((await handler(request(`?campaign=${value}`))).status, 404);
    assert.equal(calls.reads.length, 0);
    assert.equal(calls.attachments.length, 0);
  }
});

test("anonymous, revoked, unapproved and suspended memberships cannot query documents", async () => {
  for (const [options, status] of [
    [{ anonymous: true }, 401],
    [{ revoked: true }, 401],
    [{ noMember: true }, 403],
    [{ unapproved: true }, 403],
    [{ status: "PENDING" }, 403],
    [{ status: "SUSPENDED" }, 403],
    [{ rateLimited: true }, 429],
  ]) {
    const { handler, calls } = fixture(options);
    assert.equal((await handler(request())).status, status);
    assert.equal(calls.reads.length, 0);
    assert.equal(calls.attachments.length, 0);
  }
  const { handler, calls } = fixture();
  assert.equal((await handler(request("", "POST"))).status, 405);
  assert.equal(calls.auth, 0);
});

test("reissued invoice versions retain distinct files and do not duplicate current receivables", () => {
  const v = (n) => ({
    version: n,
    title: "청구서 " + n,
    note: "",
    issuedAt: `2026-11-0${n}T00:00:00Z`,
    dueAt: null,
    documentUrl: `https://example.com/${n}.pdf`,
    currency: "KRW",
    amount: "100.00",
    lines: [],
    reason: n === 2 ? "안내 정정" : null,
  });
  const docs = mapping.invoiceDocuments({
    ...invoice,
    documentVersion: 2,
    versions: [v(2), v(1)],
  });
  assert.deepEqual(
    docs.map((d) => [d.version, d.isLatest, d.file.url]),
    [
      [2, true, "https://example.com/2.pdf"],
      [1, false, "https://example.com/1.pdf"],
    ],
  );
  assert.equal(docs[1].status, "SUPERSEDED");
  assert.equal(docs[0].correctionReason, "안내 정정");
  assert.equal(new Set(docs.map((d) => d.id)).size, 2);
});
