import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import test from "node:test";
import {
  MAX_CREATOR_IMAGE_BYTES,
  approvedCreatorImageForEntry,
  creatorAvatarSchema,
  creatorImagePublicProperties,
  findApprovedCreatorImage,
  parseCreatorImageManifest,
  validCreatorImageBytes,
} from "../lib/creator-image-policy.mjs";

const id = "demo-korean-channel";
const sha256 = "a".repeat(64);
const avatar = {
  pathname: `creator-directory/public-demo/${id}/${sha256}.webp`,
  sha256,
  contentType: "image/webp",
  sourceUrl: "https://images.example.com/public-channel.webp",
  sourcePageUrl: "https://www.youtube.com/@public-channel",
};
const manifest = [{ id, ...avatar }];
const entry = {
  id,
  isDemo: true,
  isPublished: true,
  payload: { id, identityKind: "public_channel", avatar },
};

test("only the manifest's exact ID and content version resolve", () => {
  assert.deepEqual(findApprovedCreatorImage(manifest, id, sha256), manifest[0]);
  for (const badId of ["unknown", "../" + id, id + "/secret", "", null]) {
    assert.equal(findApprovedCreatorImage(manifest, badId, sha256), null);
  }
  for (const version of [
    "b".repeat(64),
    sha256.toUpperCase(),
    "..",
    "",
    null,
  ]) {
    assert.equal(findApprovedCreatorImage(manifest, id, version), null);
  }
});

test("unpublished, non-demo and unapproved identities never expose an image", () => {
  assert.deepEqual(approvedCreatorImageForEntry(manifest, entry), manifest[0]);
  for (const changed of [
    { ...entry, isDemo: false },
    { ...entry, isPublished: false },
    { ...entry, isPublished: "true" },
    { ...entry, payload: { ...entry.payload, identityKind: "fictional" } },
    { ...entry, payload: { ...entry.payload, id: "another-id" } },
    { ...entry, payload: { id, identityKind: "public_channel" } },
    null,
  ])
    assert.equal(approvedCreatorImageForEntry(manifest, changed), null);
});

test("metadata must match every reviewed field, not just the path prefix", () => {
  for (const [key, value] of Object.entries({
    pathname: `agency-documents/${id}/${sha256}.webp`,
    sha256: "b".repeat(64),
    contentType: "image/jpeg",
    sourceUrl: "https://images.example.com/unreviewed.webp",
    sourcePageUrl: "https://www.youtube.com/@another-channel",
  })) {
    const changed = {
      ...entry,
      payload: { ...entry.payload, avatar: { ...avatar, [key]: value } },
    };
    assert.equal(approvedCreatorImageForEntry(manifest, changed), null, key);
  }
});

test("malformed, duplicate, traversal and private-store manifest paths fail closed", () => {
  for (const invalid of [
    null,
    {},
    [...manifest, ...manifest],
    [{ ...manifest[0], pathname: `request-attachments/${id}/file.webp` }],
    [
      {
        ...manifest[0],
        pathname: `creator-directory/public-demo/${id}/../file.webp`,
      },
    ],
    [{ ...manifest[0], pathname: avatar.pathname + "/other" }],
    [{ ...manifest[0], token: "not-allowed" }],
  ])
    assert.deepEqual(parseCreatorImageManifest(invalid), []);
});

test("avatar metadata accepts only HTTPS sources and rejects credentials or extra fields", () => {
  assert.equal(creatorAvatarSchema.safeParse(avatar).success, true);
  for (const sourceUrl of [
    "http://images.example.com/a.webp",
    "javascript:alert(1)",
    "https://user:password@example.com/a.webp",
  ]) {
    assert.equal(
      creatorAvatarSchema.safeParse({ ...avatar, sourceUrl }).success,
      false,
    );
  }
  assert.equal(
    creatorAvatarSchema.safeParse({ ...avatar, token: "not-allowed" }).success,
    false,
  );
});

test("public properties add only a versioned same-origin image URL and preserve the canonical profile", () => {
  const properties = creatorImagePublicProperties(manifest, entry);
  assert.deepEqual(properties, {
    avatarUrl: `/api/creator-images/${id}/${sha256}`,
  });
  const canonicalProfileUrl =
    "https://www.youtube.com/channel/UC-public-channel-id";
  const creator = { profileUrl: canonicalProfileUrl, ...properties };
  assert.equal(creator.profileUrl, canonicalProfileUrl);
  assert.equal(JSON.stringify(properties).includes(avatar.pathname), false);
  assert.equal(JSON.stringify(properties).includes(avatar.sourceUrl), false);
  assert.equal(creatorImagePublicProperties([], entry), null);
});

test("published bytes must have the reviewed digest, WebP header and bounded exact size", () => {
  // Only a RIFF envelope is needed to exercise the guard; this is never served.
  const bytes = Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(
    validCreatorImageBytes(bytes, { sha256: digest, size: bytes.length }),
    true,
  );
  assert.equal(
    validCreatorImageBytes(bytes, { sha256, size: bytes.length }),
    false,
  );
  assert.equal(
    validCreatorImageBytes(bytes, { sha256: digest, size: bytes.length + 1 }),
    false,
  );
  const invalidHeader = Buffer.from(bytes);
  invalidHeader.write("JPEG", 8);
  assert.equal(
    validCreatorImageBytes(invalidHeader, {
      sha256: createHash("sha256").update(invalidHeader).digest("hex"),
      size: invalidHeader.length,
    }),
    false,
  );
  const oversized = Buffer.alloc(MAX_CREATOR_IMAGE_BYTES + 1);
  assert.equal(
    validCreatorImageBytes(oversized, { sha256, size: oversized.length }),
    false,
  );
});
