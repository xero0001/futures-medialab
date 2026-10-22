import assert from "node:assert/strict";
import test from "node:test";
import { publicationProblems, submittedProfile } from "../lib/verification.ts";

const campaign = {
  status: "REVIEW",
  brandStatus: "ACTIVE",
  summary: "A documented campaign",
  platforms: ["youtube"],
  budgetAmount: "1000.00",
  applicationDeadline: new Date("2099-01-01T00:00:00Z"),
};
test("only reviewed, complete campaigns from approved brands can be published", () => {
  assert.deepEqual(
    publicationProblems(campaign, Date.parse("2026-10-22T00:00:00Z")),
    [],
  );
  for (const patch of [
    { status: "DRAFT" },
    { status: "RECRUITING" },
    { brandStatus: "PENDING" },
    { brandStatus: "SUSPENDED" },
    { summary: "  " },
    { platforms: [] },
    { budgetAmount: "0.00" },
    { budgetAmount: "-1" },
    { budgetAmount: "NaN" },
    { applicationDeadline: null },
    { applicationDeadline: new Date("2020-01-01") },
    { applicationDeadline: new Date("invalid") },
  ])
    assert.ok(publicationProblems({ ...campaign, ...patch }).length > 0);
});
test("organization approval readiness does not fabricate or rely on email verification", () => {
  assert.equal(
    submittedProfile("BRAND", { profileCompletedAt: "2026-10-22T00:00:00Z" }),
    true,
  );
  assert.equal(submittedProfile("BRAND", { emailVerified: true }), false);
  assert.equal(
    submittedProfile("BRAND", { profileCompletedAt: "invalid" }),
    false,
  );
  assert.equal(
    submittedProfile("PLATFORM", {
      profileCompletedAt: "2026-10-22T00:00:00Z",
    }),
    false,
  );
});
test("agency requires submitted company data and license ID; studio license ID is optional", () => {
  const profile = {
    organizationName: "Test",
    agencyType: "agency",
    address: "Address",
    countryCode: "KR",
    establishedOn: "2020-01-01",
    contactValue: "test@example.com",
    scopeOfBusiness: "Content",
    platformContact: "Operations",
    businessDocumentId: "doc_1",
    businessLicenseId: "123",
  };
  const metadata = {
    agencyProfileSubmittedAt: "2026-10-22T00:00:00Z",
    agencyProfile: profile,
  };
  assert.equal(submittedProfile("AGENCY", metadata), true);
  assert.equal(
    submittedProfile("AGENCY", { ...metadata, agencyProfileSubmittedAt: null }),
    false,
  );
  assert.equal(
    submittedProfile("AGENCY", {
      ...metadata,
      agencyProfile: { ...profile, businessDocumentId: "" },
    }),
    false,
  );
  assert.equal(
    submittedProfile("AGENCY", {
      ...metadata,
      agencyProfile: { ...profile, businessLicenseId: "" },
    }),
    false,
  );
  assert.equal(
    submittedProfile("AGENCY", {
      ...metadata,
      agencyProfile: {
        ...profile,
        agencyType: "studio",
        businessLicenseId: "",
      },
    }),
    true,
  );
});
