import assert from "node:assert/strict";
import test from "node:test";
import { campaignMoney, settlementAmountFromMinor, settlementMinorUnits, settlementMoney } from "../lib/settlement-display.ts";

test("stored settlement decimals preserve precision beyond Number.MAX_SAFE_INTEGER", () => {
  const value = "9999999999999999.99";
  assert.equal(settlementMoney(value, "KRW", "ko"), "KRW 9,999,999,999,999,999.99");
  assert.equal(settlementMinorUnits(value), 999999999999999999n);
  assert.equal(settlementAmountFromMinor(settlementMinorUnits(value)), value);
  assert.equal(settlementAmountFromMinor(settlementMinorUnits(value) + 1n), "10000000000000000.00");
});
test("exact zero and decimal cents are retained; malformed values do not become zero", () => {
  assert.equal(settlementMoney("0", "USD", "en"), "USD 0.00");
  assert.equal(settlementMoney("0.1", "CNY", "zh"), "CNY 0.10");
  assert.equal(settlementAmountFromMinor(-1n), "-0.01");
  assert.equal(settlementMoney("-0.01", "USD", "en"), "USD −0.01");
  for (const value of ["", "1e4", "1.001", "NaN", "1,000.00"]) {
    assert.equal(settlementMinorUnits(value), null);
    assert.equal(settlementMoney(value, "KRW", "ko"), "—");
  }
});

test("campaign amounts show won naturally in Korean without losing stored decimals", () => {
  assert.equal(campaignMoney("1100000.00", "KRW", "ko"), "1,100,000원");
  assert.equal(campaignMoney("0", "KRW", "ko"), "0원");
  assert.equal(campaignMoney("1100000.50", "KRW", "ko"), "1,100,000.5원");
  assert.equal(campaignMoney("9999999999999999.99", "KRW", "ko"), "9,999,999,999,999,999.99원");
});

test("campaign amounts respect the chosen locale and currency and reject invalid amounts", () => {
  for (const [currency, locale, value] of [
    ["USD", "en", "0"],
    ["USD", "ko", "23.4"],
    ["KRW", "en", "1100000.00"],
    ["CNY", "zh", "-2.01"],
    ["USD", "en", "9999999999999999.99"],
  ]) {
    const expected = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
    assert.equal(campaignMoney(value, currency, locale), expected);
  }
  for (const value of ["", "1e4", "1.001", "NaN", "1,000.00"]) {
    assert.equal(campaignMoney(value, "KRW", "ko"), "—");
  }
});
