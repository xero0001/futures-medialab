CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "ProposalItemStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');
CREATE TYPE "ProposalDecisionKind" AS ENUM ('APPROVE', 'REQUEST_CHANGES', 'REJECT');
CREATE TABLE "CampaignProposal" (
  "id" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "version" INTEGER NOT NULL, "revision" INTEGER NOT NULL DEFAULT 0,
  "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT', "title" TEXT NOT NULL DEFAULT '', "summary" TEXT NOT NULL DEFAULT '',
  "changeSummary" TEXT NOT NULL DEFAULT '', "terms" TEXT NOT NULL DEFAULT '', "currency" "Currency" NOT NULL,
  "expiresAt" TIMESTAMP(3), "publishedAt" TIMESTAMP(3), "supersededAt" TIMESTAMP(3), "createdById" TEXT NOT NULL,
  "publishedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignProposal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignProposal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CampaignProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CampaignProposal_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CampaignProposal_campaignId_version_key" ON "CampaignProposal"("campaignId", "version");
CREATE INDEX "CampaignProposal_campaignId_status_idx" ON "CampaignProposal"("campaignId", "status");
CREATE INDEX "CampaignProposal_status_expiresAt_idx" ON "CampaignProposal"("status", "expiresAt");
CREATE TABLE "ProposalItem" (
  "id" TEXT NOT NULL, "proposalId" TEXT NOT NULL, "position" INTEGER NOT NULL,
  "creatorName" TEXT NOT NULL DEFAULT '', "platform" TEXT NOT NULL DEFAULT '', "channelLabel" TEXT NOT NULL DEFAULT '', "channelUrl" TEXT NOT NULL DEFAULT '',
  "followers" INTEGER, "averageViews" INTEGER, "deliverables" TEXT NOT NULL DEFAULT '', "quantity" INTEGER NOT NULL DEFAULT 0,
  "unitAmount" DECIMAL(18,2), "scheduledAt" TIMESTAMP(3), "rights" TEXT NOT NULL DEFAULT '', "status" "ProposalItemStatus" NOT NULL DEFAULT 'PENDING',
  "creatorId" TEXT, "supplierOrganizationId" TEXT, "supplierCost" DECIMAL(18,2), "internalNotes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProposalItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "CampaignProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProposalItem_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProposalItem_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProposalItem_proposalId_position_key" ON "ProposalItem"("proposalId", "position");
CREATE INDEX "ProposalItem_creatorId_idx" ON "ProposalItem"("creatorId");
CREATE TABLE "ProposalDecision" (
  "id" TEXT NOT NULL, "proposalId" TEXT NOT NULL, "actorId" TEXT NOT NULL, "decision" "ProposalDecisionKind" NOT NULL,
  "itemIds" TEXT[] NOT NULL, "message" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProposalDecision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "CampaignProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProposalDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProposalDecision_proposalId_createdAt_idx" ON "ProposalDecision"("proposalId", "createdAt");
CREATE TABLE "ProposalMutation" (
  "id" TEXT NOT NULL, "actorId" TEXT NOT NULL, "clientRequestId" TEXT NOT NULL, "action" TEXT NOT NULL, "payloadHash" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalMutation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProposalMutation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProposalMutation_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "CampaignProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProposalMutation_actorId_clientRequestId_key" ON "ProposalMutation"("actorId", "clientRequestId");
CREATE INDEX "ProposalMutation_proposalId_idx" ON "ProposalMutation"("proposalId");
