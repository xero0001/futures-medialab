-- CreateEnum
CREATE TYPE "OfficialSettlementStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID');

-- CreateTable
CREATE TABLE "CampaignCompletion" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "proposalVersion" INTEGER NOT NULL,
    "proposalRevision" INTEGER NOT NULL,
    "readinessToken" TEXT NOT NULL,
    "evidenceSnapshot" JSONB NOT NULL,
    "note" TEXT NOT NULL,
    "completedById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandInvoice" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "completionId" TEXT NOT NULL,
    "brandOrganizationId" TEXT NOT NULL,
    "status" "OfficialSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "lineSnapshot" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "internalNote" TEXT NOT NULL DEFAULT '',
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "paymentRecordedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(18,2),
    "externalPaymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyPayout" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "completionId" TEXT NOT NULL,
    "supplierOrganizationId" TEXT NOT NULL,
    "status" "OfficialSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "lineSnapshot" JSONB NOT NULL,
    "supplierCostBasis" TEXT NOT NULL DEFAULT 'ITEM_TOTAL',
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "internalNote" TEXT NOT NULL DEFAULT '',
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "paymentRecordedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(18,2),
    "externalPaymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementMutation" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "completionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCompletion_campaignId_key" ON "CampaignCompletion"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandInvoice_campaignId_key" ON "BrandInvoice"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandInvoice_completionId_key" ON "BrandInvoice"("completionId");

-- CreateIndex
CREATE INDEX "BrandInvoice_brandOrganizationId_status_idx" ON "BrandInvoice"("brandOrganizationId", "status");

-- CreateIndex
CREATE INDEX "AgencyPayout_campaignId_idx" ON "AgencyPayout"("campaignId");

-- CreateIndex
CREATE INDEX "AgencyPayout_supplierOrganizationId_status_idx" ON "AgencyPayout"("supplierOrganizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyPayout_completionId_supplierOrganizationId_key" ON "AgencyPayout"("completionId", "supplierOrganizationId");

-- CreateIndex
CREATE INDEX "SettlementMutation_campaignId_idx" ON "SettlementMutation"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementMutation_actorId_clientRequestId_key" ON "SettlementMutation"("actorId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "CampaignCompletion" ADD CONSTRAINT "CampaignCompletion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCompletion" ADD CONSTRAINT "CampaignCompletion_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "CampaignProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCompletion" ADD CONSTRAINT "CampaignCompletion_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandInvoice" ADD CONSTRAINT "BrandInvoice_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandInvoice" ADD CONSTRAINT "BrandInvoice_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "CampaignCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandInvoice" ADD CONSTRAINT "BrandInvoice_brandOrganizationId_fkey" FOREIGN KEY ("brandOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandInvoice" ADD CONSTRAINT "BrandInvoice_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandInvoice" ADD CONSTRAINT "BrandInvoice_paymentRecordedById_fkey" FOREIGN KEY ("paymentRecordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyPayout" ADD CONSTRAINT "AgencyPayout_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyPayout" ADD CONSTRAINT "AgencyPayout_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "CampaignCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyPayout" ADD CONSTRAINT "AgencyPayout_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyPayout" ADD CONSTRAINT "AgencyPayout_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyPayout" ADD CONSTRAINT "AgencyPayout_paymentRecordedById_fkey" FOREIGN KEY ("paymentRecordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementMutation" ADD CONSTRAINT "SettlementMutation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementMutation" ADD CONSTRAINT "SettlementMutation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementMutation" ADD CONSTRAINT "SettlementMutation_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "CampaignCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
