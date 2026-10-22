import type { Locale } from "../app/_components/landing-copy";

const isLocale = (value?: string): value is Locale =>
  value === "en" || value === "ko" || value === "zh";

export function resolveLocale(
  requested: string | undefined,
  saved: string | undefined,
  accepted: string | null,
): Locale {
  if (isLocale(requested)) return requested;
  if (isLocale(saved)) return saved;
  const preferred = (accepted ?? "en")
    .split(",")
    .map((entry) => {
      const [language = "en", weight] = entry.trim().split(";");
      return {
        locale: language.toLowerCase().split("-")[0],
        weight: weight?.trim().startsWith("q=")
          ? Number(weight.trim().slice(2))
          : 1,
      };
    })
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .find((entry) => isLocale(entry.locale))?.locale;
  return isLocale(preferred) ? preferred : "en";
}
