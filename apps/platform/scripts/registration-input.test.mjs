import assert from "node:assert/strict";
import test from "node:test";
import {
  registrationSchema,
  registrationOrganization,
} from "../lib/registration-input.ts";

const buyer = {
  role: "client-agency",
  organizationName: "Buyer agency",
  companySize: "15–49",
  email: "buyer@example.invalid",
  password: "Synthetic-password-only",
  locale: "ko",
};

test("buying agencies use pending Buyer Core organizations, never supplier permissions", () => {
  const registration = registrationSchema.parse(buyer);
  assert.deepEqual(registrationOrganization(registration), {
    type: "BRAND",
    status: "PENDING",
    metadata: { organizationType: "client_agency", companySize: "15–49" },
  });
});
test("brand and supplier registrations retain their distinct organization types", () => {
  const brand = registrationOrganization(
    registrationSchema.parse({ ...buyer, role: "brand" }),
  );
  assert.equal(brand.type, "BRAND");
  assert.equal(brand.metadata.organizationType, "brand");
  const fields = { ...buyer };
  delete fields.companySize;
  for (const agencyType of ["agency", "studio"]) {
    const supplier = registrationOrganization(
      registrationSchema.parse({ ...fields, role: "agency", agencyType }),
    );
    assert.equal(supplier.type, "AGENCY");
    assert.equal(supplier.status, "PENDING");
    assert.equal(supplier.metadata.agencyType, agencyType);
  }
});
test("public registration cannot choose approval, permissions or internal metadata", () => {
  for (const patch of [
    { role: "admin" },
    { role: "creator" },
    { role: "buyer" },
    { status: "ACTIVE" },
    { type: "PLATFORM" },
    { metadata: { testWorkspaceAccess: true } },
    { agencyType: "agency" },
    { companySize: "" },
    { organizationName: " " },
  ])
    assert.equal(
      registrationSchema.safeParse({ ...buyer, ...patch }).success,
      false,
    );
});
