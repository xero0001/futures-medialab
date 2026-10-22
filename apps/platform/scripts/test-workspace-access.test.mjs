import assert from "node:assert/strict";
import test from "node:test";
import { hasApprovedTestWorkspaceAccess } from "../lib/test-workspace-access.ts";

test("only an ACTIVE organization with an explicit boolean test flag is exempt", () => {
  assert.equal(
    hasApprovedTestWorkspaceAccess({
      status: "ACTIVE",
      metadata: { testWorkspaceAccess: true },
    }),
    true,
  );
  assert.equal(
    hasApprovedTestWorkspaceAccess({
      status: "ACTIVE",
      metadata: Object.assign(Object.create(null), { testWorkspaceAccess: true }),
    }),
    true,
  );
});

test("pending, suspended, missing and differently cased status never qualify", () => {
  for (const status of ["PENDING", "SUSPENDED", "", "active", "APPROVED"]) {
    assert.equal(
      hasApprovedTestWorkspaceAccess({ status, metadata: { testWorkspaceAccess: true } }),
      false,
      status,
    );
  }
});

test("a missing, false or merely truthy flag is not an exemption", () => {
  for (const value of [undefined, null, false, "true", 1, {}, []]) {
    assert.equal(
      hasApprovedTestWorkspaceAccess({ status: "ACTIVE", metadata: { testWorkspaceAccess: value } }),
      false,
    );
  }
  assert.equal(hasApprovedTestWorkspaceAccess({ status: "ACTIVE", metadata: {} }), false);
});

test("malformed metadata and non-plain objects fail closed", () => {
  const date = new Date();
  date.testWorkspaceAccess = true;
  const array = [];
  array.testWorkspaceAccess = true;
  const inherited = Object.create({ testWorkspaceAccess: true });
  class CustomMetadata {
    testWorkspaceAccess = true;
  }
  for (const metadata of [undefined, null, true, 1, "true", [], array, date, inherited, new CustomMetadata()]) {
    assert.equal(hasApprovedTestWorkspaceAccess({ status: "ACTIVE", metadata }), false);
  }
});

test("the exemption does not depend on an email or manufacture profile data", () => {
  const metadata = { testWorkspaceAccess: true, agencyType: "agency" };
  const organization = { status: "ACTIVE", metadata };
  const before = JSON.stringify(organization);
  assert.equal(hasApprovedTestWorkspaceAccess(organization), true);
  assert.equal(JSON.stringify(organization), before);
  assert.equal(Object.hasOwn(metadata, "agencyProfileSubmittedAt"), false);
  assert.equal(Object.hasOwn(metadata, "profileCompletedAt"), false);
});
