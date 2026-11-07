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
