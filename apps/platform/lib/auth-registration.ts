import { randomUUID } from "node:crypto";
import { getDatabase, Prisma } from "@futures-medialab/database";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
} from "better-auth/api";
import { z } from "zod";
import {
  registrationSchema,
  registrationOrganization,
} from "./registration-input";

const localeValues = { en: "EN", ko: "KO", zh: "ZH" } as const;

export function organizationRegistration() {
  return {
    id: "organization-registration",
    endpoints: {
      signUpOrganization: createAuthEndpoint(
        "/sign-up/organization",
        {
          method: "POST",
          body: z.unknown(),
          use: [formCsrfMiddleware],
        },
        async (ctx) => {
          const parsed = registrationSchema.safeParse(ctx.body);
          if (!parsed.success) {
            throw APIError.fromStatus("BAD_REQUEST", {
              code: "INVALID_REGISTRATION",
              message: "Check the required organization and account details.",
            });
          }

          const input = parsed.data;
          // Use the same hasher as standard Better Auth email sign-in. Hashing
          // happens before the transaction so it does not hold database locks.
          const passwordHash = await ctx.context.password.hash(input.password);
          const database = getDatabase();

          try {
            await database.$transaction(async (transaction) => {
              const user = await transaction.user.create({
                data: {
                  email: input.email,
                  emailVerified: false,
                  name: input.organizationName,
                  locale: localeValues[input.locale],
                },
                select: { id: true },
              });

              await transaction.account.create({
                data: {
                  userId: user.id,
                  accountId: user.id,
                  providerId: "credential",
                  password: passwordHash,
                },
              });

              await transaction.organization.create({
                data: {
                  name: input.organizationName,
                  slug: `${input.role}-${randomUUID()}`,
                  ...registrationOrganization(input),
                  members: {
                    create: { userId: user.id, role: "OWNER" },
                  },
                },
              });
            });
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              // Driver adapters expose unique-constraint metadata differently.
              // Confirm the email after rollback instead of relying on metadata.
              const existing = await database.user
                .findUnique({
                  where: { email: input.email },
                  select: { id: true },
                })
                .catch(() => null);
              if (existing) {
                throw APIError.fromStatus("CONFLICT", {
                  code: "USER_ALREADY_EXISTS",
                  message:
                    "An account with this email already exists. Please log in.",
                });
              }
            }
            // Never return database errors, password hashes, or submitted data.
            throw APIError.fromStatus("INTERNAL_SERVER_ERROR", {
              code: "REGISTRATION_FAILED",
              message: "Registration could not be completed. Please try again.",
            });
          }

          return ctx.json({ success: true });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
