import test from "node:test";
import assert from "node:assert/strict";
import { filterAccounts, filterReviews } from "../lib/account-management.ts";

const users = [
  {
    id: "brand",
    name: "브랜드 담당자",
    email: "brand@example.com",
    organizations: [{ name: "Future Games", type: "BRAND", status: "ACTIVE" }],
  },
  {
    id: "agency",
    name: "에이전시 담당자",
    email: "agency@example.com",
    organizations: [{ name: "Studio", type: "AGENCY", status: "PENDING" }],
  },
  {
    id: "both",
    name: "다중 소속",
    email: "both@example.com",
    organizations: [
      { name: "Brand", type: "BRAND", status: "SUSPENDED" },
      { name: "Agency", type: "AGENCY", status: "ACTIVE" },
    ],
  },
  { id: "new", name: null, email: "new@example.com", organizations: [] },
  {
    id: "admin",
    name: "운영자",
    email: "admin@example.com",
    organizations: [{ name: "Platform", type: "PLATFORM", status: "ACTIVE" }],
  },
];
const ids = (rows) => rows.map((row) => row.id);

test("all accounts include unassigned accounts; type tabs use actual memberships without duplicates", () => {
  assert.equal(filterAccounts(users, "all", "all", "").length, 5);
  assert.deepEqual(ids(filterAccounts(users, "BRAND", "all", "")), [
    "brand",
    "both",
  ]);
  assert.deepEqual(ids(filterAccounts(users, "AGENCY", "all", "")), [
    "agency",
    "both",
  ]);
});

test("type and status must match the same membership", () => {
  assert.deepEqual(ids(filterAccounts(users, "BRAND", "ACTIVE", "")), [
    "brand",
  ]);
  assert.deepEqual(ids(filterAccounts(users, "AGENCY", "ACTIVE", "")), [
    "both",
  ]);
});

test("account search supports names, email and matching company names", () => {
  assert.deepEqual(
    ids(filterAccounts(users, "all", "all", "  FUTURE GAMES ")),
    ["brand"],
  );
  assert.deepEqual(ids(filterAccounts(users, "AGENCY", "all", "agency@")), [
    "agency",
  ]);
  assert.deepEqual(ids(filterAccounts(users, "all", "all", "다중")), ["both"]);
  assert.deepEqual(ids(filterAccounts(users, "BRAND", "all", "Agency")), []);
});

test("review lists contain only pending brands and agencies, including submissions awaiting completion", () => {
  const organizations = [
    {
      id: "brand",
      name: "Brand",
      type: "BRAND",
      status: "PENDING",
      submitted: true,
    },
    {
      id: "agency",
      name: "Studio",
      type: "AGENCY",
      status: "PENDING",
      submitted: false,
    },
    { id: "approved", name: "Approved", type: "BRAND", status: "ACTIVE" },
    { id: "suspended", name: "Suspended", type: "AGENCY", status: "SUSPENDED" },
    { id: "platform", name: "Platform", type: "PLATFORM", status: "PENDING" },
  ];
  assert.deepEqual(ids(filterReviews(organizations, "all", "")), [
    "brand",
    "agency",
  ]);
  assert.deepEqual(ids(filterReviews(organizations, "BRAND", "")), ["brand"]);
  assert.deepEqual(ids(filterReviews(organizations, "AGENCY", " studio ")), [
    "agency",
  ]);
  organizations[0].status = "ACTIVE";
  assert.deepEqual(ids(filterReviews(organizations, "all", "")), ["agency"]);
});
