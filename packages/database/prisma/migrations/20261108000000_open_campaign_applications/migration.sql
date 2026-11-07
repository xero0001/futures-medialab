ALTER TYPE "ApplicationStatus" ADD VALUE 'DRAFT';
ALTER TABLE "CreatorProfile" ADD COLUMN "partnerProfile" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "CampaignApplication" ADD COLUMN "submissionKey" TEXT, ADD COLUMN "submissionHash" TEXT;
CREATE TABLE "ApplicationRow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicationId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "creatorName" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "channelUrl" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "unitAmount" DECIMAL(18,2) NOT NULL CHECK ("unitAmount" > 0),
  "availableOn" DATE NOT NULL,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationRow_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CampaignApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ApplicationRow_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ApplicationRow_applicationId_creatorId_platform_format_key" ON "ApplicationRow"("applicationId", "creatorId", "platform", "format");
CREATE INDEX "ApplicationRow_creatorId_idx" ON "ApplicationRow"("creatorId");
ALTER TABLE "ProposalItem" ADD COLUMN "applicationRowId" TEXT;
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_applicationRowId_fkey" FOREIGN KEY ("applicationRowId") REFERENCES "ApplicationRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ProposalItem_proposalId_applicationRowId_key" ON "ProposalItem"("proposalId", "applicationRowId");
