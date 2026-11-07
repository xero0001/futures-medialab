import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAdminLocation,
  adminLocationHref,
} from "../lib/admin-navigation.ts";
test("campaign section and list scope survive a shared URL and reload", () => {
  const input = {
    tab: "campaigns",
    selected: "campaign_1",
    section: "documents",
    request: "",
    scope: "MANAGED",
    status: "RECRUITING",
    accountType: "all",
  };
  assert.deepEqual(
    parseAdminLocation(adminLocationHref(input).split("?")[1]),
    input,
  );
});
test("request links retain exact request and discard unrelated campaign fields", () => {
  const location = parseAdminLocation(
    "?tab=requests&request=request_1&campaign=other",
  );
  assert.equal(location.request, "request_1");
  assert.equal(location.selected, "");
  assert.equal(adminLocationHref(location), "/?tab=requests&request=request_1");
});
test("unrecognized and unsafe locations cannot select an external target", () => {
  const location = parseAdminLocation(
    "?tab=external&campaign=https://evil.example&section=private&scope=PLATFORM&status=anything",
  );
  assert.equal(location.tab, "overview");
  assert.equal(location.selected, "");
  assert.equal(location.section, "overview");
  assert.equal(adminLocationHref(location), "/");
  assert.equal(
    parseAdminLocation("?tab=campaigns&campaign=../private").selected,
    "",
  );
});

test("status filters are valid for the selected workspace", () => {
  assert.equal(
    parseAdminLocation("?tab=campaigns&status=ACTIVE").status,
    "all",
  );
  assert.equal(
    parseAdminLocation("?tab=organizations&status=IN_PROGRESS").status,
    "all",
  );
});

test("game catalog URLs preserve selected games and new entries", () => {
  for (const game of ["game_nte", "new"]) {
    const location = parseAdminLocation(`?tab=games&game=${game}`);
    assert.equal(location.tab, "games");
    assert.equal(location.selected, game);
    assert.equal(adminLocationHref(location), `/?tab=games&game=${game}`);
  }
});

test("account and review type tabs survive reloads and shared detail links", () => {
  for (const tab of ["users", "organizations"]) {
    for (const accountType of ["all", "BRAND", "AGENCY"]) {
      const location = {
        ...parseAdminLocation(""),
        tab,
        accountType,
        selected: "partner_1",
      };
      assert.deepEqual(
        parseAdminLocation(adminLocationHref(location).split("?")[1]),
        location,
      );
    }
  }
});

test("account status filters do not bring approved or suspended organizations into review", () => {
  assert.equal(
    parseAdminLocation("?tab=users&status=SUSPENDED").status,
    "SUSPENDED",
  );
  assert.equal(
    parseAdminLocation("?tab=organizations&status=ACTIVE").status,
    "all",
  );
  assert.equal(
    parseAdminLocation("?tab=users&accountType=PLATFORM").accountType,
    "all",
  );
  assert.equal(
    parseAdminLocation("?tab=campaigns&accountType=BRAND").accountType,
    "all",
  );
  assert.equal(
    parseAdminLocation("?tab=users&organization=../private").selected,
    "",
  );
});
