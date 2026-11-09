import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import {
  originalProposalDeadline,
  requestWaitingFor,
} from "../../../packages/database/src/request-workflow.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
function compile(name, overrides, cache = new Map()) {
  const filename = resolve(root, name);
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
            resolve(dirname(filename), `${specifier}.ts`),
            overrides,
            cache,
          )
        : require(specifier);
  runInThisContext(`(function(exports,require,module){${source}\n})`, {
    filename,
  })(module.exports, localRequire, module);
  return module.exports;
}
const stamp = new Date("2026-11-06T00:00:00Z");
const future = new Date(Date.now() + 86400000).toISOString();
const actor = { kind: "admin", userId: "admin", sessionId: "session" };
function fixture(patch = {}) {
  let row = {
    id: "request",
    campaignId: "campaign",
    organizationId: "brand",
    title: "의뢰",
    tool: "campaign",
    status: "IN_PROGRESS",
    version: 2,
    dueAt: stamp,
    inputJson: {
      kind: "campaign-intake",
      route: "managed",
      submittedAt: stamp.toISOString(),
      originalProposalDueAt: "2026-11-08T00:00:00.000Z",
      privateValue: "keep",
    },
    campaign: { title: "캠페인", proposals: [] },
    ...patch,
  };
  let messages = [],
    audits = [];
  const queries = [];
  const tx = {
    session: { findFirst: async () => ({ id: "session" }) },
    organizationMember: {
      findFirst: async () => ({ organizationId: "brand" }),
    },
    workspaceToolRequest: {
      findFirst: async (query) => {
        queries.push(query);
        if (
          query.where.organizationId &&
          query.where.organizationId !== row.organizationId
        )
          return null;
        return row;
      },
      updateMany: async ({ where, data }) => {
        if (row.version !== where.version) return { count: 0 };
        row = { ...row, ...data, version: row.version + 1 };
        return { count: 1 };
      },
    },
    requestAttachment: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    requestMessage: {
      create: async ({ data }) => {
        const message = { id: String(messages.length), ...data };
        messages.push(message);
        return message;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        audits.push(data);
        return data;
      },
    },
  };
  const db = {
    $transaction: async (run) => {
      const before = globalThis.structuredClone({ row, messages, audits });
      try {
        return await run(tx);
      } catch (error) {
        ({ row, messages, audits } = before);
        throw error;
      }
    },
  };
  const service = compile("packages/database/src/requests.ts", {
    "./client": {
      getDatabase: () => db,
      Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
    },
  });
  const fail = (status, code, message) => {
    throw Object.assign(new Error(message), { status, code });
  };
  const { syncCampaignIntake } = compile("apps/admin/lib/campaign-intake.ts", {
    "./access": { fail },
    "@futures-medialab/database/request-workflow": {
      originalProposalDeadline,
      requestWaitingFor,
    },
  });
  return {
    tx,
    service,
    get row() {
      return row;
    },
    get messages() {
      return messages;
    },
    get audits() {
      return audits;
    },
    queries,
    run: (input, caller = actor) =>
      service.mutateRequest(
        caller,
        "request",
        service.requestMutationSchema.parse(input),
      ),
    sync: (action) =>
      syncCampaignIntake(
        tx,
        "admin",
        {
          id: "campaign",
          brandOrganizationId: "brand",
          requirements: {
            brandIntake: { requestId: "request" },
            extra: "keep",
          },
        },
        action,
        "검토 사유",
        stamp,
      ),
  };
}
const message = (changes = {}) => ({
  action: "message",
  body: "브리프 자료를 보내 주세요.",
  internal: false,
  intent: "reply",
  version: 2,
  dueAt: future,
  attachmentIds: [],
  ...changes,
});

test("public reply request atomically records message, waiting reason and a separate reply deadline", async () => {
  const f = fixture();
  await f.run(message());
  assert.equal(f.row.status, "WAITING_BRAND");
  assert.equal(f.row.inputJson.waitingFor, "reply");
  assert.equal(f.row.dueAt.toISOString(), future);
  assert.equal(
    f.row.inputJson.originalProposalDueAt,
    "2026-11-08T00:00:00.000Z",
  );
  assert.equal(f.row.inputJson.privateValue, "keep");
  assert.equal(f.messages[0].internal, false);
  assert.equal(f.audits[0].action, "request.reply_requested");
});
test("stale, private and unauthorized reply instructions never write messages or state", async () => {
  for (const [input, caller, status] of [
    [message({ version: 1 }), actor, 409],
    [message({ internal: true }), actor, 400],
    [
      message({ dueAt: new Date(Date.now() - 3600000).toISOString() }),
      actor,
      400,
    ],
    [message(), { ...actor, kind: "brand", organizationId: "brand" }, 403],
  ]) {
    const f = fixture();
    await assert.rejects(
      () => f.run(input, caller),
      (error) => error.status === status,
    );
    assert.equal(f.messages.length, 0);
    assert.equal(f.row.version, 2);
  }
});
test("an informational message preserves the current operator status and deadline", async () => {
  const f = fixture();
  await f.run(message({ intent: "notice", dueAt: undefined }));
  assert.equal(f.row.status, "IN_PROGRESS");
  assert.equal(f.row.dueAt.toISOString(), stamp.toISOString());
});
test("brand replies close real reply tasks but cannot clear an outstanding proposal decision", async () => {
  for (const waitingFor of ["brief", "reply", "proposal-decision"]) {
    const f = fixture({ status: "WAITING_BRAND", inputJson: { waitingFor } });
    await f.run(
      { action: "message", body: "추가 자료입니다.", attachmentIds: [] },
      { ...actor, kind: "brand", organizationId: "brand" },
    );
    assert.equal(
      f.row.status,
      waitingFor === "proposal-decision" ? "WAITING_BRAND" : "IN_PROGRESS",
    );
    assert.equal(
      f.row.inputJson.waitingFor,
      waitingFor === "proposal-decision" ? "proposal-decision" : null,
    );
    if (waitingFor !== "proposal-decision") assert.equal(f.row.dueAt, null);
  }
});
test("legacy published-proposal intake also stays waiting for its explicit proposal decision", async () => {
  const f = fixture({
    status: "WAITING_BRAND",
    campaign: { proposals: [{ id: "proposal" }] },
  });
  await f.run(
    { action: "message", body: "제안 관련 문의입니다.", attachmentIds: [] },
    { ...actor, kind: "brand", organizationId: "brand" },
  );
  assert.equal(f.row.status, "WAITING_BRAND");
});
test("generic state editor cannot create a reply task without a public explanation", async () => {
  const f = fixture();
  await assert.rejects(
    () =>
      f.run({
        action: "update",
        version: 2,
        status: "WAITING_BRAND",
        priority: "NORMAL",
        assignedToId: null,
        dueAt: null,
        reason: "답변 필요",
      }),
    (error) => error.code === "PUBLIC_REPLY_REQUIRED",
  );
  assert.equal(f.row.status, "IN_PROGRESS");
});
test("campaign return pauses the current deadline, preserves the first promise and sends the brief instruction", async () => {
  const f = fixture();
  const result = await f.sync("returnCampaign");
  assert.equal(f.row.status, "WAITING_BRAND");
  assert.equal(f.row.inputJson.waitingFor, "brief");
  assert.equal(f.row.dueAt, null);
  assert.equal(
    result.brandIntake.originalProposalDueAt,
    "2026-11-08T00:00:00.000Z",
  );
  assert.equal(result.extra, "keep");
  assert.deepEqual(f.queries[0].where, {
    id: "request",
    campaignId: "campaign",
    organizationId: "brand",
  });
  assert.match(f.messages[0].body, /다시 제출/);
  assert.equal(f.audits[0].payload.public, true);
});
test("sourcing start synchronizes intake but does not overwrite a pending brand decision", async () => {
  const f = fixture({ status: "REQUESTED" });
  await f.sync("publishCampaign");
  assert.equal(f.row.status, "IN_PROGRESS");
  const pending = fixture({
    status: "WAITING_BRAND",
    inputJson: { waitingFor: "proposal-decision" },
  });
  await pending.sync("closeCampaign");
  assert.equal(pending.row.inputJson.waitingFor, "proposal-decision");
  assert.equal(pending.row.status, "WAITING_BRAND");
});
test("first SLA is recoverable for existing managed intake and is independent of a revised current due date", () => {
  assert.equal(
    originalProposalDeadline({
      kind: "campaign-intake",
      route: "managed",
      firstSubmittedAt: "2026-11-01T00:00:00Z",
      submittedAt: "2026-11-06T00:00:00Z",
    }),
    "2026-11-03T00:00:00.000Z",
  );
  assert.equal(
    originalProposalDeadline({
      kind: "campaign-intake",
      route: "open",
      submittedAt: stamp.toISOString(),
    }),
    null,
  );
});

test("a question on a returned draft does not clear the required brief resubmission", async () => {
  const f = fixture({
    status: "WAITING_BRAND",
    inputJson: { kind: "campaign-intake", waitingFor: "brief" },
    campaign: { status: "DRAFT", proposals: [] },
  });
  await f.run(
    {
      action: "message",
      body: "보완 항목에 대한 질문입니다.",
      attachmentIds: [],
    },
    { ...actor, kind: "brand", organizationId: "brand" },
  );
  assert.equal(f.row.status, "WAITING_BRAND");
  assert.equal(f.row.inputJson.waitingFor, "brief");
  assert.equal(f.row.inputJson.operatorReplyPending, true);
});
test("operator public reply clears its reply queue while private notes preserve it", async () => {
  for (const internal of [true, false]) {
    const f = fixture({
      inputJson: {
        operatorReplyPending: true,
        waitingFor: "proposal-decision",
      },
    });
    await f.run(message({ intent: "notice", dueAt: undefined, internal }));
    assert.equal(f.row.inputJson.operatorReplyPending, internal);
  }
});

test("reopening a completed intake creates operator work without reusing an old reply deadline", async () => {
  const f = fixture({
    status: "RESOLVED",
    inputJson: { kind: "campaign-intake", operatorReplyPending: false },
  });
  await f.run(
    { action: "reopen", version: 2, reason: "추가 검토 요청" },
    { ...actor, kind: "brand", organizationId: "brand" },
  );
  assert.equal(f.row.status, "IN_PROGRESS");
  assert.equal(f.row.inputJson.operatorReplyPending, true);
  assert.equal(f.row.dueAt, null);
});

test("partner invitation responses persist and cannot cross tenants or overwrite newer replies", async () => {
  const f = fixture({
    tool: "invitation",
    organizationId: "agency",
    inputJson: { input: "제작 조건" },
  });
  const partner = {
    kind: "agency",
    userId: "partner",
    sessionId: "session",
    organizationId: "agency",
    write: true,
  };
  const input = {
    action: "respondInvitation",
    version: 2,
    response: "negotiating",
    body: "다음 주부터 제작 가능합니다.",
  };
  await assert.rejects(
    () => f.run(input, { ...partner, organizationId: "other" }),
    (e) => e.status === 404,
  );
  await f.run(input, partner);
  assert.equal(f.row.inputJson.invitationResponse, "negotiating");
  assert.equal(f.row.inputJson.operatorReplyPending, true);
  assert.equal(f.messages[0].authorRole, "AGENCY");
  assert.ok(f.messages[0].body.includes("다음 주"));
  await assert.rejects(
    () => f.run(input, partner),
    (e) => e.code === "CONFLICT",
  );
  assert.equal(f.messages.length, 1);
  await assert.rejects(
    () =>
      f.run(
        {
          action: "message",
          body: "private",
          internal: true,
          attachmentIds: [],
        },
        partner,
      ),
    (e) => e.status === 403,
  );
});

test("partner replies unblock the operator and closed invitations cannot accept a response", async () => {
  const partner = {
    kind: "agency",
    userId: "partner",
    sessionId: "session",
    organizationId: "agency",
  };
  const f = fixture({
    organizationId: "agency",
    status: "WAITING_BRAND",
    inputJson: { waitingFor: "reply" },
  });
  await f.run(
    { action: "message", body: "확인했습니다", attachmentIds: [] },
    partner,
  );
  assert.equal(f.row.status, "IN_PROGRESS");
  assert.equal(f.messages[0].authorRole, "AGENCY");
  const closed = fixture({
    organizationId: "agency",
    tool: "invitation",
    status: "CLOSED",
  });
  await assert.rejects(
    () =>
      closed.run(
        {
          action: "respondInvitation",
          version: 2,
          response: "accepted",
          body: "",
        },
        partner,
      ),
    (e) => e.code === "REQUEST_CLOSED",
  );
});

test("operator cancellation closes the linked intake and communicates the reason", async () => {
  const f = fixture();
  await f.sync("cancelCampaign");
  assert.equal(f.row.status, "CLOSED");
  assert.equal(f.row.dueAt, null);
  assert.ok(f.messages[0].body.includes("캠페인을 취소"));
});

test("agency inbox and attachment links stay tenant scoped and exclude operator-only notes and events", async () => {
  const f = fixture({
    organizationId: "agency",
    organization: { name: "Partner" },
    assignedTo: null,
    priority: "NORMAL",
    createdAt: stamp,
    updatedAt: stamp,
  });
  const partner = {
    kind: "agency",
    userId: "partner",
    sessionId: "session",
    organizationId: "agency",
  };
  f.tx.organizationMember.findFirst = async ({ where }) => {
    assert.equal(where.organizationId, "agency");
    assert.equal(where.organization.type, "AGENCY");
    assert.equal(where.organization.status, "ACTIVE");
    return { organizationId: "agency" };
  };
  f.tx.requestMessage.findMany = async ({ where }) => {
    assert.equal(where.internal, false);
    return [
      {
        id: "public",
        body: "Reply",
        internal: false,
        author: { name: "Ops" },
        authorRole: "ADMIN",
        createdAt: stamp,
        attachments: [
          {
            id: "attachment",
            fileName: "brief.pdf",
            contentType: "application/pdf",
            size: 10,
          },
        ],
      },
    ];
  };
  f.tx.auditLog.findMany = async ({ where }) => {
    assert.deepEqual(where.payload, { path: ["public"], equals: true });
    return [];
  };
  f.tx.requestAttachment.findMany = async ({ where }) => {
    assert.equal(where.uploaderId, "partner");
    assert.equal(where.messageId, null);
    return [];
  };
  const detail = await f.service.requestDetail(partner, "request", true);
  assert.equal(f.queries.at(-1).where.organizationId, "agency");
  assert.equal(
    detail.request.messages[0].attachments[0].downloadUrl,
    "/api/agency/requests/request/attachments/attachment",
  );
  f.tx.workspaceToolRequest.findMany = async ({ where }) => {
    assert.equal(where.organizationId, "agency");
    return [f.row];
  };
  f.tx.workspaceToolRequest.count = async ({ where }) => {
    assert.equal(where.organizationId, "agency");
    return 1;
  };
  f.tx.campaign = {
    findMany: async ({ where }) => {
      assert.equal(
        where.OR[0].applications.some.agencyOrganizationId,
        "agency",
      );
      return [];
    },
  };
  const list = await f.service.listRequests(
    partner,
    f.service.listRequestsSchema.parse({}),
  );
  assert.equal(list.items.length, 1);
  assert.equal(list.assignees, undefined);
  assert.equal(list.recipients, undefined);
});
