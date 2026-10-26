import assert from "node:assert/strict";
import process from "node:process";
import console from "node:console";
import { Buffer, File } from "node:buffer";
import { URL } from "node:url";
import { randomUUID, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "better-auth/crypto";
import { del } from "@vercel/blob";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";

const { fetch, FormData, AbortSignal } = globalThis;

assert.equal(
  process.env.RUN_DB_SMOKE,
  "1",
  "Opt in to disposable fixtures with RUN_DB_SMOKE=1",
);
const base = process.env.BASE_URL || "http://localhost:3000";
const adminBase = process.env.ADMIN_BASE_URL || "http://localhost:3001";
for (const url of [base, adminBase])
  assert.ok(
    ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
    "Run this smoke test against local servers only",
  );
const db = createDatabaseClient();
const prefix = `request-smoke-${randomUUID()}`;
const password = randomBytes(30).toString("base64url");
const fixtures = {};
let passed = 0;
let phase = "setup";
const ok = (text) => console.log(`PASS ${++passed}: ${text}`);
async function call(
  path,
  { cookie, target = base, body, form, origin = target, method } = {},
) {
  const response = await fetch(`${target}${path}`, {
    method: method || (body || form ? "POST" : "GET"),
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body || form || method === "DELETE"
        ? {
            Origin: origin,
            "Sec-Fetch-Site": origin === target ? "same-origin" : "cross-site",
          }
        : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : form ? { body: form } : {}),
  });
  const bytes = await response.arrayBuffer();
  let data;
  try {
    data = JSON.parse(Buffer.from(bytes).toString());
  } catch {
    /* attachment */
  }
  return { status: response.status, response, data, bytes };
}
function expect(result, status) {
  assert.equal(
    result.status,
    status,
    `${phase}: expected HTTP ${status}, received ${result.status} (${result.data?.code || "no code"})`,
  );
  return result.data;
}
async function signIn(fixture, target) {
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    result = await call("/api/auth/sign-in/email", {
      target,
      body: { email: fixture.email, password },
    });
    if (result.status !== 429) break;
    console.log("Waiting for the existing auth rate limit window.");
    await delay(31_000);
    await delay(31_000);
  }
  expect(result, 200);
  return result.response.headers
    .getSetCookie()
    .map((c) => c.split(";", 1)[0])
    .join("; ");
}
try {
  expect(await call("/api/workspace/requests"), 401);
  expect(await call("/api/admin/requests", { target: adminBase }), 401);
  ok("anonymous requests are denied");
  const encoded = await hashPassword(password);
  for (const [label, type] of [
    ["brand", "BRAND"],
    ["other", "BRAND"],
    ["admin", "PLATFORM"],
  ]) {
    const userId = `${prefix}-${label}`,
      organizationId = `${prefix}-org-${label}`;
    fixtures[label] = {
      userId,
      organizationId,
      email: `${userId}@example.invalid`,
    };
    await db.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email: fixtures[label].email,
          name: `Disposable ${label}`,
        },
      });
      await tx.account.create({
        data: {
          userId,
          accountId: userId,
          providerId: "credential",
          password: encoded,
        },
      });
      await tx.organization.create({
        data: {
          id: organizationId,
          slug: organizationId,
          name: organizationId,
          type,
          status: "ACTIVE",
          metadata: { profileCompletedAt: new Date().toISOString() },
        },
      });
      await tx.organizationMember.create({
        data: { userId, organizationId, role: "OWNER" },
      });
    });
    fixtures[label].cookie = await signIn(
      fixtures[label],
      label === "admin" ? adminBase : base,
    );
  }
  const brand = { cookie: fixtures.brand.cookie },
    other = { cookie: fixtures.other.cookie },
    admin = { cookie: fixtures.admin.cookie, target: adminBase };
  const campaign = await db.campaign.create({
    data: {
      id: `${prefix}-campaign`,
      brandOrganizationId: fixtures.brand.organizationId,
      createdById: fixtures.brand.userId,
      type: "OPEN_BIDDING",
      title: `${prefix} campaign`,
      status: "DRAFT",
    },
  });
  phase = "create/access";
  const newBody = {
    title: `${prefix} support request`,
    tool: "campaign",
    campaignId: campaign.id,
    body: "Synthetic request; no external communication or commercial activity.",
  };
  expect(
    await call("/api/workspace/requests", { ...other, body: newBody }),
    400,
  );
  expect(
    await call("/api/workspace/requests", {
      ...brand,
      body: newBody,
      origin: "https://example.invalid",
    }),
    403,
  );
  const created = expect(
    await call("/api/workspace/requests", { ...brand, body: newBody }),
    201,
  );
  const p = `/api/workspace/requests/${created.id}`,
    a = `/api/admin/requests/${created.id}`;
  expect(await call(p, other), 404);
  expect(await call(a, { ...brand, target: adminBase }), 401);
  expect(await call(p, brand), 200);
  const listing = expect(
    await call(
      `/api/admin/requests?query=${encodeURIComponent(prefix)}&page=1`,
      admin,
    ),
    200,
  );
  assert.ok(listing.items.some((row) => row.id === created.id));
  ok(
    "create, campaign ownership, CSRF, cross-organization and separate admin-session boundaries",
  );
  const legacy = await db.workspaceToolRequest.create({
    data: {
      organizationId: fixtures.brand.organizationId,
      userId: fixtures.brand.userId,
      tool: "comments",
      title: `${prefix} legacy analysis`,
      inputJson: { input: "Legacy analysis input" },
    },
  });
  assert.ok(
    expect(
      await call(
        `/api/workspace/requests?query=${encodeURIComponent(prefix)}`,
        brand,
      ),
      200,
    ).items.some((row) => row.id === legacy.id),
  );
  ok("previous analysis requests appear without backfill");
  phase = "state/concurrency";
  const update = {
    action: "update",
    version: 0,
    status: "IN_PROGRESS",
    priority: "HIGH",
    assignedToId: fixtures.admin.userId,
    dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    reason: "Synthetic assignment and due date",
  };
  expect(await call(a, { ...admin, body: update }), 200);
  expect(await call(a, { ...admin, body: update }), 409);
  expect(await call(p, { ...brand, body: { ...update, version: 1 } }), 403);
  expect(
    await call(a, {
      ...admin,
      body: { ...update, version: 1, assignedToId: fixtures.brand.userId },
    }),
    400,
  );
  ok(
    "assignee validation, optimistic concurrency and administrator-only management",
  );
  phase = "private attachments";
  let attachment;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const invalid = new FormData();
    invalid.set(
      "file",
      new File(["<script>bad</script>"], "fake.png", { type: "image/png" }),
    );
    expect(await call(`${a}/attachments`, { ...admin, form: invalid }), 400);
    const data = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=",
      "base64",
    );
    const form = new FormData();
    form.set("file", new File([data], "smoke.png", { type: "image/png" }));
    attachment = expect(
      await call(`${a}/attachments`, { ...admin, form }),
      201,
    ).attachment;
    expect(await call(`${p}/attachments/${attachment.id}`, brand), 404);
    expect(await call(`${a}/attachments/${attachment.id}`, admin), 200);
    expect(await call(`${p}/attachments/${attachment.id}`, other), 404);
    const restored = expect(await call(a, admin), 200).request
      .pendingAttachments;
    assert.ok(restored.some((file) => file.id === attachment.id));
    expect(
      await call(`${p}/attachments/${attachment.id}`, {
        ...brand,
        method: "DELETE",
      }),
      404,
    );
    expect(
      await call(`${a}/attachments/${attachment.id}`, {
        ...admin,
        method: "DELETE",
        origin: "https://example.invalid",
      }),
      403,
    );
    expect(
      await call(`${a}/attachments/${attachment.id}`, {
        ...admin,
        method: "DELETE",
      }),
      200,
    );
    expect(await call(`${a}/attachments/${attachment.id}`, admin), 404);
    expect(
      await call(`${a}/attachments/${attachment.id}`, {
        ...admin,
        method: "DELETE",
      }),
      200,
    );
    assert.ok(
      !expect(await call(a, admin), 200).request.pendingAttachments.some(
        (file) => file.id === attachment.id,
      ),
    );
    expect(
      await call(a, {
        ...admin,
        body: {
          action: "message",
          body: "Cannot attach a discarded file",
          internal: true,
          attachmentIds: [attachment.id],
        },
      }),
      400,
    );
    attachment = expect(
      await call(`${a}/attachments`, { ...admin, form }),
      201,
    ).attachment;
    ok(
      "pending attachment restore, CSRF/owner-only cancellation, idempotent cleanup and discarded-file exclusion",
    );
    ok(
      "real private Blob upload/download, byte validation and orphan visibility",
    );
  }
  phase = "public/internal conversations";
  expect(
    await call(a, {
      ...admin,
      body: {
        action: "message",
        body: "INTERNAL-ONLY-SENTINEL",
        internal: true,
        attachmentIds: attachment ? [attachment.id] : [],
      },
    }),
    200,
  );
  expect(
    await call(p, {
      ...brand,
      body: {
        action: "message",
        body: "Cannot forge a private note",
        internal: true,
        attachmentIds: [],
      },
    }),
    403,
  );
  expect(
    await call(a, {
      ...admin,
      body: {
        action: "message",
        body: "Public operations reply",
        internal: false,
        attachmentIds: [],
      },
    }),
    200,
  );
  let detail = expect(await call(p, brand), 200).request;
  assert.ok(!JSON.stringify(detail).includes("INTERNAL-ONLY-SENTINEL"));
  assert.ok(
    detail.messages.some(
      (message) => message.body === "Public operations reply",
    ),
  );
  assert.ok(detail.messages.every((message) => !message.internal));
  if (attachment)
    expect(await call(`${p}/attachments/${attachment.id}`, brand), 404);
  expect(
    await call(a, {
      ...admin,
      body: { ...update, version: detail.version, status: "WAITING_BRAND" },
    }),
    200,
  );
  expect(
    await call(p, {
      ...brand,
      body: { action: "message", body: "Brand follow-up", attachmentIds: [] },
    }),
    200,
  );
  detail = expect(await call(p, brand), 200).request;
  assert.equal(detail.status, "IN_PROGRESS");
  assert.equal(detail.assigneeId, fixtures.admin.userId);
  assert.ok(detail.events.length);
  ok(
    "internal notes/files stay private; public replies persist and brand reply resumes processing",
  );
  phase = "resolve/reopen/close";
  expect(
    await call(a, {
      ...admin,
      body: { ...update, version: detail.version, status: "RESOLVED" },
    }),
    200,
  );
  detail = expect(await call(p, brand), 200).request;
  expect(
    await call(p, {
      ...brand,
      body: { action: "message", body: "Must reopen first", attachmentIds: [] },
    }),
    409,
  );
  expect(
    await call(p, {
      ...brand,
      body: {
        action: "reopen",
        version: detail.version,
        reason: "Synthetic follow-up question",
      },
    }),
    200,
  );
  detail = expect(await call(p, brand), 200).request;
  expect(
    await call(a, {
      ...admin,
      body: { ...update, version: detail.version, status: "CLOSED" },
    }),
    200,
  );
  detail = expect(await call(p, brand), 200).request;
  expect(
    await call(p, {
      ...brand,
      body: {
        action: "reopen",
        version: detail.version,
        reason: "Closed is terminal",
      },
    }),
    409,
  );
  expect(
    await call(a, {
      ...admin,
      body: {
        action: "message",
        body: "Closed is read-only",
        attachmentIds: [],
      },
    }),
    409,
  );
  ok(
    "resolved requests require reopening; closed conversations cannot be reopened or replied to",
  );
  phase = "revoked access";
  await db.organization.update({
    where: { id: fixtures.brand.organizationId },
    data: { status: "SUSPENDED" },
  });
  expect(await call(p, brand), 403);
  await db.session.deleteMany({ where: { userId: fixtures.admin.userId } });
  expect(await call(a, admin), 401);
  ok("suspension and session revocation take effect immediately");
  console.log(`Request smoke test passed (${passed} groups).`);
} catch (error) {
  console.error(
    `FAIL ${phase}: ${error instanceof Error ? error.message : "unknown"}`,
  );
  process.exitCode = 1;
} finally {
  const userIds = Object.values(fixtures).map((f) => f.userId),
    orgIds = Object.values(fixtures).map((f) => f.organizationId);
  // Exact fixture IDs only: never delete application or customer data by broad patterns.
  const requests = await db.workspaceToolRequest.findMany({
    where: { organizationId: { in: orgIds } },
    select: { id: true },
  });
  const requestIds = requests.map((r) => r.id);
  const attachments = await db.requestAttachment.findMany({
    where: { requestId: { in: requestIds } },
    select: { id: true, pathname: true },
  });
  for (const attachment of attachments) await del(attachment.pathname);
  await db.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: userIds } },
          {
            entityId: { in: [...requestIds, ...attachments.map((a) => a.id)] },
          },
        ],
      },
    });
    await tx.requestAttachment.deleteMany({
      where: { requestId: { in: requestIds } },
    });
    await tx.requestMessage.deleteMany({
      where: { requestId: { in: requestIds } },
    });
    await tx.workspaceToolRequest.deleteMany({
      where: { id: { in: requestIds } },
    });
    await tx.campaign.deleteMany({ where: { id: `${prefix}-campaign` } });
    await tx.organization.deleteMany({ where: { id: { in: orgIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
  await db.$disconnect();
  console.log("Disposable fixtures and their uploaded test objects removed.");
}
