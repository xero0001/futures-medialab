export function supplierOfferCap(requirements: unknown): string | null {
  if (
    !requirements ||
    typeof requirements !== "object" ||
    Array.isArray(requirements)
  )
    return null;
  const offer = (requirements as Record<string, unknown>).supplierOffer;
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) return null;
  const cap = (offer as Record<string, unknown>).unitCap;
  return typeof cap === "string" &&
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(cap) &&
    Number(cap) > 0
    ? cap
    : null;
}
