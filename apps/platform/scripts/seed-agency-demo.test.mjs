import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_CAMPAIGN_BRAND_ID } from "../lib/campaign-demo.ts";
import { seedAgencyDemo } from "./seed-agency-demo.mjs";

// A deliberately narrow in-memory database. Missing methods (update/delete,
// account/session/settlement creation) fail if a seed ever attempts to use them.
function fixtureDatabase() {
  let state = {
    users: [],
    organizations: [],
    campaigns: [],
    applications: [],
    audits: [],
    agency: {
      id: "test-agency-user",
      memberships: [
        {
          organizationId: "test-agency-org",
          organization: {
            status: "ACTIVE",
            metadata: { testWorkspaceAccess: true },
          },
        },
      ],
    },
  };
  const writes = [];
  function table(rows, name) {
    return {
      create: async ({ data }) => {
        assert.ok(
          !data.id || !rows.some((row) => row.id === data.id),
          "Duplicate fixture ID",
        );
        const row = globalThis.structuredClone(data);
        rows.push(row);
        writes.push(name);
        return row;
      },
    };
  }
  const client = {
    $queryRaw: async () => [{ value: 1 }],
    $disconnect: async () => {},
    $transaction: async (callback, options) => {
      assert.equal(options.isolationLevel, "Serializable");
      const next = globalThis.structuredClone(state);
      const result = await callback({
        user: {
          ...table(next.users, "user"),
          findUnique: async ({ where }) => {
            if (where.email === "agency@agency.com") return next.agency;
            const user = next.users.find((row) =>
              where.id ? row.id === where.id : row.email === where.email,
            );
            return user
              ? {
                  ...user,
                  _count: user._count ?? {
                    accounts: 0,
                    sessions: 0,
                    memberships: 0,
                  },
                }
              : null;
          },
        },
        organization: {
          ...table(next.organizations, "organization"),
          findUnique: async ({ where }) =>
            next.organizations.find((row) =>
              where.id ? row.id === where.id : row.slug === where.slug,
            ) ?? null,
        },
        campaign: {
          ...table(next.campaigns, "campaign"),
          findMany: async ({ where }) =>
            next.campaigns.filter((row) => where.id.in.includes(row.id)),
        },
        campaignApplication: {
          ...table(next.applications, "application"),
          findMany: async ({ where }) =>
            next.applications.filter((row) =>
              where.OR.some((filter) =>
                filter.id
                  ? filter.id.in.includes(row.id)
                  : filter.campaignId.in.includes(row.campaignId) &&
                    row.agencyOrganizationId === filter.agencyOrganizationId,
              ),
            ),
        },
        auditLog: table(next.audits, "audit"),
      });
      state = next;
      return result;
    },
  };
  return {
    factory: () => client,
    get state() {
      return state;
    },
    writes,
  };
}

test("default dry run is read-only and identifies exactly eight campaigns/four applications", async () => {
  const db = fixtureDatabase();
  const result = await seedAgencyDemo({ databaseClientFactory: db.factory });
  assert.equal(result.mode, "dry-run");
  assert.equal(result.campaignsToAdd, 8);
  assert.equal(result.applicationsToAdd, 4);
  assert.deepEqual(db.writes, []);
  assert.equal(db.state.campaigns.length, 0);
});

test("apply creates only isolated fixture rows, and reapply preserves user-edited application states", async () => {
  const db = fixtureDatabase();
  await seedAgencyDemo({ apply: true, databaseClientFactory: db.factory });
  assert.equal(db.state.users.length, 1);
  assert.match(db.state.users[0].email, /\.invalid$/);
  assert.equal(db.state.users[0].emailVerified, false);
  assert.equal("password" in db.state.users[0], false);
  assert.equal(db.state.organizations.length, 1);
  assert.equal(db.state.campaigns.length, 8);
  assert.equal(db.state.applications.length, 4);
  for (const campaign of db.state.campaigns) {
    assert.equal(campaign.brandOrganizationId, DEMO_CAMPAIGN_BRAND_ID);
    assert.equal(campaign.requirements.demo, true);
    assert.match(campaign.title, /^\[Demo\]/);
    assert.ok(campaign.applicationDeadline.getTime() > Date.now());
  }
  for (const application of db.state.applications) {
    assert.equal(application.agencyOrganizationId, "test-agency-org");
    assert.equal(application.submittedById, "test-agency-user");
    assert.deepEqual(application.rosterSnapshot, []);
  }
  db.state.applications[0].status = "WITHDRAWN";
  db.state.campaigns[0].status = "IN_PROGRESS";
  const writeCount = db.writes.length;
  const result = await seedAgencyDemo({
    apply: true,
    databaseClientFactory: db.factory,
  });
  assert.equal(result.campaignsToAdd, 0);
  assert.equal(result.applicationsToAdd, 0);
  assert.equal(db.writes.length, writeCount);
  assert.equal(db.state.applications[0].status, "WITHDRAWN");
  assert.equal(db.state.campaigns[0].status, "IN_PROGRESS");
});

test("seed rejects a normal agency and reserved ID collisions before any writes", async () => {
  const mutations = [
    (state) => {
      state.agency.memberships[0].organization.metadata = {};
    },
    (state) => {
      state.agency.memberships[0].organization.status = "SUSPENDED";
    },
    (state) => {
      state.organizations.push({
        id: DEMO_CAMPAIGN_BRAND_ID,
        type: "BRAND",
        slug: "real-brand",
        status: "ACTIVE",
        metadata: {},
      });
    },
    (state) => {
      state.campaigns.push({
        id: "fm-demo-campaign-starlight-odyssey",
        brandOrganizationId: "real-brand",
        requirements: {},
      });
    },
    (state) => {
      state.applications.push({
        id: "fm-demo-application-starlight-odyssey",
        campaignId: "unrelated",
        agencyOrganizationId: "another-agency",
      });
    },
  ];
  for (const mutate of mutations) {
    const db = fixtureDatabase();
    mutate(db.state);
    await assert.rejects(
      seedAgencyDemo({ apply: true, databaseClientFactory: db.factory }),
      assert.AssertionError,
    );
    assert.deepEqual(db.writes, []);
  }
});

test("a synthetic actor that acquired login access is never silently reused", async () => {
  const db = fixtureDatabase();
  await seedAgencyDemo({ apply: true, databaseClientFactory: db.factory });
  db.state.users[0]._count = { accounts: 1, sessions: 0, memberships: 0 };
  const writeCount = db.writes.length;
  await assert.rejects(
    seedAgencyDemo({ apply: true, databaseClientFactory: db.factory }),
    /unexpected login access/,
  );
  assert.equal(db.writes.length, writeCount);
});
