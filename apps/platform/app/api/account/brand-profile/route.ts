import { getDatabase, Prisma } from "@futures-medialab/database";
import { getAuth } from "../../../../lib/auth";
import { brandProfileSchema } from "../../../../lib/brand-profile";

export const preferredRegion = "sin1";
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "no-store" };

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ code, message }, { status, headers: responseHeaders });
}

export async function POST(request: Request) {
  try {
    const auth = getAuth();
    const configuredUrl = auth.options.baseURL;
    if (typeof configuredUrl !== "string") {
      throw new Error("An explicit application origin is required.");
    }

    // This route is outside Better Auth's router, so enforce CSRF protection
    // explicitly. Never infer trust from the incoming Host or forwarding headers.
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (
      origin !== new URL(configuredUrl).origin ||
      (fetchSite !== null && fetchSite !== "same-origin")
    ) {
      return errorResponse(
        403,
        "INVALID_ORIGIN",
        "This request is not allowed.",
      );
    }

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return errorResponse(401, "UNAUTHORIZED", "Log in to continue.");
    }

    if (
      request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
      "application/json"
    ) {
      return errorResponse(
        400,
        "INVALID_BRAND_PROFILE",
        "Submit a valid company profile.",
      );
    }
    let body: unknown;
    try {
      const text = await request.text();
      if (text.length > 16_384) {
        return errorResponse(
          400,
          "INVALID_BRAND_PROFILE",
          "Submit a valid company profile.",
        );
      }
      body = JSON.parse(text);
    } catch {
      return errorResponse(
        400,
        "INVALID_BRAND_PROFILE",
        "Submit a valid company profile.",
      );
    }
    const parsed = brandProfileSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        400,
        "INVALID_BRAND_PROFILE",
        "Check the required company details and interests.",
      );
    }
    const input = parsed.data;

    const saved = await getDatabase().$transaction(
      async (transaction) => {
        const membership = await transaction.organizationMember.findFirst({
          where: {
            userId: session.user.id,
            organization: { type: "BRAND" },
          },
          orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
          select: {
            role: true,
            organization: {
              select: { id: true, status: true, metadata: true },
            },
          },
        });
        if (
          !membership ||
          membership.role !== "OWNER" ||
          membership.organization.status === "SUSPENDED"
        )
          return false;

        const currentMetadata = membership.organization.metadata;
        const metadata =
          currentMetadata &&
          typeof currentMetadata === "object" &&
          !Array.isArray(currentMetadata)
            ? currentMetadata
            : {};

        await transaction.organization.update({
          where: { id: membership.organization.id },
          data: {
            name: input.organizationName,
            countryCode: input.countryCode,
            metadata: {
              ...metadata,
              industry: input.industry,
              companySize: input.companySize,
              contactName: input.contactName,
              phoneDialCode: input.phoneDialCode ?? "",
              phoneNumber: (input.phoneNumber ?? "").replace(/[ ()-]/g, ""),
              interests: input.interests,
              note: input.note ?? "",
              profileCompletedAt: new Date().toISOString(),
            },
          },
        });
        return true;
      },
      // Avoid losing concurrent metadata changes between the read and update.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (!saved) {
      return errorResponse(
        403,
        "FORBIDDEN",
        "Only a brand owner can save this profile.",
      );
    }

    return Response.json({ success: true }, { headers: responseHeaders });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return errorResponse(
        409,
        "PROFILE_CONFLICT",
        "The profile changed. Please try again.",
      );
    }
    // A static event is useful operationally without exposing contact details.
    console.error("brand_profile_save_failed");
    return errorResponse(
      500,
      "PROFILE_SAVE_FAILED",
      "Your profile could not be saved. Please try again.",
    );
  }
}
