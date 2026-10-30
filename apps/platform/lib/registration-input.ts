import { z } from "zod";

const sharedFields = {
  organizationName: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email())
    .transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
  locale: z.enum(["en", "ko", "zh"]),
};

export const registrationSchema = z.discriminatedUnion("role", [
  z.strictObject({
    ...sharedFields,
    role: z.literal("agency"),
    agencyType: z.enum(["agency", "studio"]),
    companySize: z.literal("").optional(),
  }),
  z.strictObject({
    ...sharedFields,
    role: z.enum(["brand", "client-agency"]),
    agencyType: z.literal("").optional(),
    companySize: z.enum([
      "1–14",
      "15–49",
      "50–99",
      "100–499",
      "500–1,999",
      "2,000+",
    ]),
  }),
]);

// Buying agencies share Buyer Core permissions; never register as supplier AGENCY.
export function registrationOrganization(
  input: z.infer<typeof registrationSchema>,
) {
  return {
    type: input.role === "agency" ? ("AGENCY" as const) : ("BRAND" as const),
    status: "PENDING" as const,
    metadata:
      input.role === "agency"
        ? { organizationType: "creator_partner", agencyType: input.agencyType }
        : {
            organizationType:
              input.role === "client-agency" ? "client_agency" : "brand",
            companySize: input.companySize,
          },
  };
}
