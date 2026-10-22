import { z } from "zod";

export const BRAND_INDUSTRIES = [
  "gaming",
  "electronics",
  "fmcg",
  "food-beverage",
  "clothing",
  "medical",
  "business-services",
  "life-services",
  "education",
  "travel",
  "public-services",
  "retail",
  "transportation",
  "automotive",
  "agriculture",
  "energy",
  "media",
  "logistics",
  "communications",
  "finance",
  "food-services",
  "software",
  "investment",
  "other",
] as const;

export const BRAND_COMPANY_SIZES = [
  "1–14",
  "15–49",
  "50–99",
  "100–499",
  "500–1,999",
  "2,000+",
] as const;

export const BRAND_INTERESTS = [
  "creator-discovery",
  "performance-tracking",
  "market-analysis",
  "campaign-management",
  "creative-strategy",
  "managed-marketing",
] as const;

export const BRAND_COUNTRY_GROUPS = [
  {
    id: "asia-pacific",
    codes: [
      "KR",
      "CN",
      "JP",
      "TW",
      "HK",
      "MO",
      "SG",
      "MY",
      "TH",
      "VN",
      "ID",
      "PH",
      "IN",
      "AU",
      "NZ",
    ],
  },
  {
    id: "europe",
    codes: [
      "GB",
      "DE",
      "FR",
      "IT",
      "ES",
      "NL",
      "SE",
      "NO",
      "FI",
      "DK",
      "PL",
      "CH",
      "IE",
    ],
  },
  { id: "americas", codes: ["US", "CA", "MX", "BR", "AR", "CL", "CO"] },
  {
    id: "middle-east-africa",
    codes: ["AE", "SA", "IL", "TR", "ZA", "EG", "NG"],
  },
] as const;

export const BRAND_COUNTRY_CODES = BRAND_COUNTRY_GROUPS.flatMap((group) => [
  ...group.codes,
]);

export const BRAND_PHONE_DIAL_CODES = [
  "+1",
  "+20",
  "+27",
  "+31",
  "+33",
  "+34",
  "+39",
  "+41",
  "+44",
  "+45",
  "+46",
  "+47",
  "+48",
  "+49",
  "+52",
  "+54",
  "+55",
  "+56",
  "+57",
  "+60",
  "+61",
  "+62",
  "+63",
  "+64",
  "+65",
  "+66",
  "+81",
  "+82",
  "+84",
  "+86",
  "+90",
  "+91",
  "+234",
  "+353",
  "+358",
  "+852",
  "+853",
  "+886",
  "+966",
  "+971",
  "+972",
] as const;

export const brandProfileSchema = z
  .strictObject({
    organizationName: z.string().trim().min(1).max(120),
    industry: z.enum(BRAND_INDUSTRIES),
    countryCode: z.enum(BRAND_COUNTRY_CODES),
    companySize: z.enum(BRAND_COMPANY_SIZES),
    contactName: z.string().trim().min(1).max(100),
    phoneDialCode: z
      .union([z.enum(BRAND_PHONE_DIAL_CODES), z.literal("")])
      .optional(),
    phoneNumber: z.string().trim().max(24).optional(),
    interests: z
      .array(z.enum(BRAND_INTERESTS))
      .min(1)
      .max(BRAND_INTERESTS.length)
      .refine((values) => new Set(values).size === values.length),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((input, context) => {
    const code = input.phoneDialCode ?? "";
    const number = input.phoneNumber ?? "";
    if (Boolean(code) !== Boolean(number)) {
      context.addIssue({
        code: "custom",
        path: [code ? "phoneNumber" : "phoneDialCode"],
        message:
          "Enter both a country calling code and phone number, or neither.",
      });
    }
    if (number) {
      const digits = number.replace(/[ ()-]/g, "");
      if (
        !/^[0-9 ()-]+$/.test(number) ||
        !/^\d{4,15}$/.test(digits) ||
        code.replace("+", "").length + digits.length > 15
      ) {
        context.addIssue({
          code: "custom",
          path: ["phoneNumber"],
          message: "Enter a valid phone number.",
        });
      }
    }
  });

export type BrandProfileInput = z.input<typeof brandProfileSchema>;

export function hasCompletedBrandProfile(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const completedAt = (metadata as Record<string, unknown>).profileCompletedAt;
  return (
    typeof completedAt === "string" &&
    completedAt.length > 0 &&
    Number.isFinite(Date.parse(completedAt))
  );
}
