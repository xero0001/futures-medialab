import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { z } from "zod";

export const MAX_CREATOR_IMAGE_BYTES = 2 * 1024 * 1024;
const imageIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const imageVersionSchema = z.string().regex(/^[a-f0-9]{64}$/);
const sourceUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  });

export const creatorAvatarSchema = z.strictObject({
  pathname: z.string().min(1).max(300),
  sha256: imageVersionSchema,
  contentType: z.literal("image/webp"),
  sourceUrl: sourceUrlSchema,
  sourcePageUrl: sourceUrlSchema,
});

const manifestSchema = z
  .array(creatorAvatarSchema.extend({ id: imageIdSchema }))
  .max(500);
const imageEntrySchema = z.object({
  id: imageIdSchema,
  isDemo: z.literal(true),
  isPublished: z.literal(true),
  payload: z.object({
    id: imageIdSchema,
    identityKind: z.literal("public_channel"),
    avatar: creatorAvatarSchema,
  }),
});

/** @param {string} id @param {string} version */
function expectedPathname(id, version) {
  return `creator-directory/public-demo/${id}/${version}.webp`;
}

/**
 * The manifest is a server-reviewed approval list, not request input. Invalid
 * entries or duplicate IDs fail the entire manifest closed.
 * @param {unknown} manifest
 */
export function parseCreatorImageManifest(manifest) {
  const parsed = manifestSchema.safeParse(manifest);
  if (!parsed.success) return [];
  const ids = new Set();
  for (const image of parsed.data) {
    if (
      ids.has(image.id) ||
      image.pathname !== expectedPathname(image.id, image.sha256)
    )
      return [];
    ids.add(image.id);
  }
  return parsed.data;
}

/** @param {unknown} manifest @param {unknown} id @param {unknown} version */
export function findApprovedCreatorImage(manifest, id, version) {
  if (
    !imageIdSchema.safeParse(id).success ||
    !imageVersionSchema.safeParse(version).success
  )
    return null;
  return (
    parseCreatorImageManifest(manifest).find(
      (image) => image.id === id && image.sha256 === version,
    ) ?? null
  );
}

/**
 * No publication flag, pathname prefix or source URL alone grants access.
 * Approval binds an exact ID, content digest, path and source to a published
 * demo row. Private attachments and onboarding documents cannot match.
 * @param {unknown} manifest
 * @param {unknown} entry
 * @param {unknown} [version]
 */
export function approvedCreatorImageForEntry(manifest, entry, version) {
  const parsed = imageEntrySchema.safeParse(entry);
  if (!parsed.success || parsed.data.id !== parsed.data.payload.id) return null;
  const { avatar } = parsed.data.payload;
  const image = findApprovedCreatorImage(
    manifest,
    parsed.data.id,
    version ?? avatar.sha256,
  );
  if (!image) return null;
  for (const key of [
    "pathname",
    "sha256",
    "contentType",
    "sourceUrl",
    "sourcePageUrl",
  ]) {
    if (avatar[key] !== image[key]) return null;
  }
  return image;
}

/**
 * Only the derived image URL may cross the workspace DTO boundary. Preserve
 * the creator's canonical profile URL, which may contain the channel ID.
 * @param {unknown} manifest
 * @param {unknown} entry
 */
export function creatorImagePublicProperties(manifest, entry) {
  const image = approvedCreatorImageForEntry(manifest, entry);
  return image
    ? {
        avatarUrl: `/api/creator-images/${image.id}/${image.sha256}`,
      }
    : null;
}

/**
 * The input has already been read with a byte limit. Verify the actual payload,
 * not just a claimed MIME type, before making private-store bytes public.
 * @param {Uint8Array} bytes
 * @param {{sha256: string, size: number}} expected
 */
export function validCreatorImageBytes(bytes, expected) {
  if (
    bytes.byteLength < 12 ||
    bytes.byteLength > MAX_CREATOR_IMAGE_BYTES ||
    bytes.byteLength !== expected.size ||
    !imageVersionSchema.safeParse(expected.sha256).success
  )
    return false;
  const header = Buffer.from(bytes.buffer, bytes.byteOffset, 12);
  return (
    header.toString("ascii", 0, 4) === "RIFF" &&
    header.toString("ascii", 8, 12) === "WEBP" &&
    header.readUInt32LE(4) + 8 === bytes.byteLength &&
    createHash("sha256").update(bytes).digest("hex") === expected.sha256
  );
}
