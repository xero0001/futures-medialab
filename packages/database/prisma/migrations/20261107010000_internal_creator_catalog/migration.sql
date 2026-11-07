BEGIN;

CREATE TABLE "InternalCreator" (
  "id" TEXT PRIMARY KEY, "displayName" TEXT NOT NULL, "affiliation" TEXT NOT NULL,
  "partnerOrganizationId" TEXT REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "rosterCreatorId" TEXT REFERENCES "CreatorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "channels" JSONB NOT NULL DEFAULT '[]', "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "languages" TEXT[] DEFAULT ARRAY[]::TEXT[], "formats" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "audienceNotes" TEXT NOT NULL DEFAULT '', "availability" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "availableFrom" TIMESTAMP(3), "availableThrough" TIMESTAMP(3), "availabilityNote" TEXT NOT NULL DEFAULT '',
  "acceptsChinaGames" TEXT NOT NULL DEFAULT 'UNKNOWN', "conflicts" TEXT NOT NULL DEFAULT '', "riskNotes" TEXT NOT NULL DEFAULT '',
  "availabilityCheckedAt" TIMESTAMP(3), "priceCheckedAt" TIMESTAMP(3), "isActive" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalCreator_affiliation_check" CHECK ("affiliation" IN ('IN_HOUSE','PARTNER','INDEPENDENT') AND (("affiliation"='PARTNER') = ("partnerOrganizationId" IS NOT NULL)) AND ("rosterCreatorId" IS NULL OR "affiliation"='PARTNER'))
);
CREATE UNIQUE INDEX "InternalCreator_rosterCreatorId_key" ON "InternalCreator"("rosterCreatorId");
CREATE INDEX "InternalCreator_isActive_affiliation_updatedAt_idx" ON "InternalCreator"("isActive", "affiliation", "updatedAt");
CREATE INDEX "InternalCreator_ownerId_idx" ON "InternalCreator"("ownerId");
CREATE INDEX "InternalCreator_partnerOrganizationId_idx" ON "InternalCreator"("partnerOrganizationId");
CREATE TABLE "InternalCreatorRateCard" (
  "id" TEXT PRIMARY KEY, "creatorId" TEXT NOT NULL REFERENCES "InternalCreator"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL, "rates" JSONB NOT NULL, "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "InternalCreatorRateCard_creatorId_version_key" ON "InternalCreatorRateCard"("creatorId","version");
CREATE TABLE "InternalCreatorMutation" (
  "id" TEXT PRIMARY KEY, "creatorId" TEXT NOT NULL REFERENCES "InternalCreator"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "requestId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "InternalCreatorMutation_actorId_requestId_key" ON "InternalCreatorMutation"("actorId","requestId");
ALTER TABLE "ProposalItem" ADD COLUMN "catalogCreatorId" TEXT REFERENCES "InternalCreator"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "catalogRateVersion" INTEGER;
CREATE INDEX "ProposalItem_catalogCreatorId_idx" ON "ProposalItem"("catalogCreatorId");

COMMIT;
