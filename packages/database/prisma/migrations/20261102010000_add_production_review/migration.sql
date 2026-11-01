-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('AWAITING_SUBMISSION', 'ADMIN_REVIEW', 'AGENCY_REVISION', 'BRAND_REVIEW', 'BRAND_REVISION', 'APPROVED');

-- CreateEnum
CREATE TYPE "ProductionBrandDecision" AS ENUM ('APPROVE', 'REQUEST_CHANGES');

-- CreateTable
CREATE TABLE "ProductionItem" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "proposalItemId" TEXT NOT NULL,
    "supplierOrganizationId" TEXT,
    "assignedById" TEXT,
    "status" "ProductionStatus" NOT NULL DEFAULT 'AWAITING_SUBMISSION',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionSubmission" (
    "id" TEXT NOT NULL,
    "productionItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'ADMIN_REVIEW',
    "sourceTitle" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceNote" TEXT NOT NULL DEFAULT '',
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminReviewedById" TEXT,
    "adminReviewedAt" TIMESTAMP(3),
    "agencyFeedback" TEXT NOT NULL DEFAULT '',
    "internalNote" TEXT NOT NULL DEFAULT '',
    "releasedTitle" TEXT,
    "releasedUrl" TEXT,
    "releasedNote" TEXT,
    "releasedAt" TIMESTAMP(3),
    "brandDecision" "ProductionBrandDecision",
    "brandMessage" TEXT NOT NULL DEFAULT '',
    "brandDecidedById" TEXT,
    "brandDecidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMutation" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "productionItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionItem_proposalItemId_key" ON "ProductionItem"("proposalItemId");

-- CreateIndex
CREATE INDEX "ProductionItem_campaignId_status_idx" ON "ProductionItem"("campaignId", "status");

-- CreateIndex
CREATE INDEX "ProductionItem_supplierOrganizationId_status_idx" ON "ProductionItem"("supplierOrganizationId", "status");

-- CreateIndex
CREATE INDEX "ProductionSubmission_productionItemId_releasedAt_idx" ON "ProductionSubmission"("productionItemId", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionSubmission_productionItemId_version_key" ON "ProductionSubmission"("productionItemId", "version");

-- CreateIndex
CREATE INDEX "ProductionMutation_campaignId_idx" ON "ProductionMutation"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMutation_actorId_clientRequestId_key" ON "ProductionMutation"("actorId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "ProductionItem" ADD CONSTRAINT "ProductionItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItem" ADD CONSTRAINT "ProductionItem_proposalItemId_fkey" FOREIGN KEY ("proposalItemId") REFERENCES "ProposalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItem" ADD CONSTRAINT "ProductionItem_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItem" ADD CONSTRAINT "ProductionItem_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSubmission" ADD CONSTRAINT "ProductionSubmission_productionItemId_fkey" FOREIGN KEY ("productionItemId") REFERENCES "ProductionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSubmission" ADD CONSTRAINT "ProductionSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSubmission" ADD CONSTRAINT "ProductionSubmission_adminReviewedById_fkey" FOREIGN KEY ("adminReviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSubmission" ADD CONSTRAINT "ProductionSubmission_brandDecidedById_fkey" FOREIGN KEY ("brandDecidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMutation" ADD CONSTRAINT "ProductionMutation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMutation" ADD CONSTRAINT "ProductionMutation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMutation" ADD CONSTRAINT "ProductionMutation_productionItemId_fkey" FOREIGN KEY ("productionItemId") REFERENCES "ProductionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
