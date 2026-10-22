import { z } from "zod";
import { BRAND_COUNTRY_CODES } from "./brand-profile";

const field = (max: number) => z.string().trim().max(max);
export const agencyProfileSchema = z.strictObject({
  organizationName: field(120),
  agencyType: z.enum(["agency", "studio"]),
  address: field(500),
  countryCode: field(2),
  establishedOn: field(10),
  contactName: field(100),
  contactMethod: z.enum(["email", "phone", "wechat"]),
  contactValue: field(254),
  businessLicenseId: field(100),
  scopeOfBusiness: field(2000),
  platformContact: field(254),
  businessDocumentId: field(120),
  contractDocumentId: field(120),
});
export type AgencyProfileValues = z.infer<typeof agencyProfileSchema>;

export function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function getAgencyProfileValues(name: string, value: unknown): AgencyProfileValues {
  const metadata = metadataRecord(value);
  const saved = metadataRecord(metadata.agencyProfileDraft ?? metadata.agencyProfile);
  const defaults: AgencyProfileValues = {
    organizationName: name, agencyType: metadata.agencyType === "studio" ? "studio" : "agency",
    address: "", countryCode: "", establishedOn: "", contactName: "",
    contactMethod: "email", contactValue: "", businessLicenseId: "", scopeOfBusiness: "",
    platformContact: "", businessDocumentId: "", contractDocumentId: "",
  };
  const parsed = agencyProfileSchema.safeParse({ ...defaults, ...saved });
  return parsed.success ? parsed.data : defaults;
}

export function validateAgencyProfile(value: AgencyProfileValues, mode: "saveDraft" | "submit"): string[] {
  const parsed = agencyProfileSchema.safeParse(value);
  if (!parsed.success) return [...new Set(parsed.error.issues.map(issue => String(issue.path[0] ?? "organizationName")))];
  const v = parsed.data;
  const invalid = new Set<string>();
  if (mode === "submit") {
    for (const key of ["organizationName", "address", "countryCode", "establishedOn", "contactValue", "scopeOfBusiness", "platformContact", "businessDocumentId"] as const)
      if (!v[key]) invalid.add(key);
    if (v.agencyType === "agency" && !v.businessLicenseId) invalid.add("businessLicenseId");
  }
  if (v.countryCode && !BRAND_COUNTRY_CODES.some(code => code === v.countryCode)) invalid.add("countryCode");
  if (v.establishedOn) {
    const date = new Date(`${v.establishedOn}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.establishedOn) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== v.establishedOn || v.establishedOn > new Date().toISOString().slice(0, 10) || v.establishedOn < "1800-01-01") invalid.add("establishedOn");
  }
  if (v.contactValue) {
    if (v.contactMethod === "email" && !z.email().safeParse(v.contactValue).success) invalid.add("contactValue");
    if (v.contactMethod === "phone" && (!/^\+?[0-9 ()-]{6,30}$/.test(v.contactValue) || v.contactValue.replace(/\D/g, "").length < 6 || v.contactValue.replace(/\D/g, "").length > 20)) invalid.add("contactValue");
    if (v.contactMethod === "wechat" && (v.contactValue.length > 100 || /[\r\n]/.test(v.contactValue))) invalid.add("contactValue");
  }
  for (const key of ["businessDocumentId", "contractDocumentId"] as const)
    if (v[key] && !/^[a-zA-Z0-9_-]+$/.test(v[key])) invalid.add(key);
  if (v.businessDocumentId && v.businessDocumentId === v.contractDocumentId) invalid.add("contractDocumentId");
  return [...invalid];
}

export function hasSubmittedAgencyProfile(value: unknown): boolean {
  const metadata = metadataRecord(value);
  const profile = agencyProfileSchema.safeParse(metadata.agencyProfile);
  return typeof metadata.agencyProfileSubmittedAt === "string" &&
    !Number.isNaN(Date.parse(metadata.agencyProfileSubmittedAt)) &&
    profile.success && validateAgencyProfile(profile.data, "submit").length === 0;
}
