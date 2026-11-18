/// <reference lib="es2023.intl" />

function isStoredAmount(value: string): value is `${number}` {
  return /^-?\d+(?:\.\d{1,2})?$/.test(value);
}

/** Pass decimal strings directly to Intl so large invoice amounts retain their cents. */
export function campaignMoney(value: string, currency: string, locale: string) {
  if (!isStoredAmount(value)) return "—";
  if (currency === "KRW" && new Intl.Locale(locale).language === "ko") {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}원`;
  }
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

/** Format the stored decimal exactly without converting financial values to Number. */
export function settlementMoney(value: string, currency: string, locale: string) {
  if (!isStoredAmount(value)) return "—";
  const negative = value.startsWith("-"), unsigned = value.replace(/^-/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
  return `${currency} ${negative ? "−" : ""}${BigInt(whole!).toLocaleString(locale)}${decimal}${fraction.padEnd(2, "0")}`;
}
export function settlementMinorUnits(value: string): bigint | null {
  if (!isStoredAmount(value)) return null;
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  return (BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"))) * (value.startsWith("-") ? -1n : 1n);
}
export function settlementAmountFromMinor(value: bigint) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
