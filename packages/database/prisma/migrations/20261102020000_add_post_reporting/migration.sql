-- CreateEnum
CREATE TYPE "ReportingStatus" AS ENUM ('AWAITING_SUBMISSION', 'ADMIN_REVIEW', 'AGENCY_REVISION', 'PUBLISHED');

-- CreateTable
CREATE TABLE "ReportingItem" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "productionItemId" TEXT NOT NULL,
    "status" "ReportingStatus" NOT NULL DEFAULT 'AWAITING_SUBMISSION',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingSubmission" (
    "id" TEXT NOT NULL,
    "reportingItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ReportingStatus" NOT NULL DEFAULT 'ADMIN_REVIEW',
    "sourceTitle" TEXT NOT NULL,
    "sourcePostUrl" TEXT NOT NULL,
    "sourcePublishedAt" TIMESTAMP(3) NOT NULL,
    "sourceMetricsAsOf" TIMESTAMP(3),
    "sourceMetrics" JSONB NOT NULL,
    "sourceEvidenceUrl" TEXT,
    "sourceNote" TEXT NOT NULL DEFAULT '',
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminReviewedById" TEXT,
    "adminReviewedAt" TIMESTAMP(3),
    "agencyFeedback" TEXT NOT NULL DEFAULT '',
    "internalNote" TEXT NOT NULL DEFAULT '',
    "releasedTitle" TEXT,
    "releasedPostUrl" TEXT,
    "releasedPublishedAt" TIMESTAMP(3),
    "releasedMetricsAsOf" TIMESTAMP(3),
    "releasedMetrics" JSONB,
    "releasedEvidenceUrl" TEXT,
    "releasedNote" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingMutation" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "reportingItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportingMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportingItem_productionItemId_key" ON "ReportingItem"("productionItemId");

-- CreateIndex
CREATE INDEX "ReportingItem_campaignId_status_idx" ON "ReportingItem"("campaignId", "status");

-- CreateIndex
CREATE INDEX "ReportingSubmission_reportingItemId_releasedAt_idx" ON "ReportingSubmission"("reportingItemId", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingSubmission_reportingItemId_version_key" ON "ReportingSubmission"("reportingItemId", "version");

-- CreateIndex
CREATE INDEX "ReportingMutation_campaignId_idx" ON "ReportingMutation"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingMutation_actorId_clientRequestId_key" ON "ReportingMutation"("actorId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "ReportingItem" ADD CONSTRAINT "ReportingItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingItem" ADD CONSTRAINT "ReportingItem_productionItemId_fkey" FOREIGN KEY ("productionItemId") REFERENCES "ProductionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingSubmission" ADD CONSTRAINT "ReportingSubmission_reportingItemId_fkey" FOREIGN KEY ("reportingItemId") REFERENCES "ReportingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingSubmission" ADD CONSTRAINT "ReportingSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingSubmission" ADD CONSTRAINT "ReportingSubmission_adminReviewedById_fkey" FOREIGN KEY ("adminReviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingMutation" ADD CONSTRAINT "ReportingMutation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingMutation" ADD CONSTRAINT "ReportingMutation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingMutation" ADD CONSTRAINT "ReportingMutation_reportingItemId_fkey" FOREIGN KEY ("reportingItemId") REFERENCES "ReportingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
