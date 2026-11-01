import assert from "node:assert/strict";
import test from "node:test";
import { settlementAmountFromMinor, settlementMinorUnits, settlementMoney } from "../lib/settlement-display.ts";

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
