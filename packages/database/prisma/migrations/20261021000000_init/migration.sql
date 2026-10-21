-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('EN', 'KO', 'ZH');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('PLATFORM', 'BRAND', 'AGENCY');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('OPEN_BIDDING', 'MANAGED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'REVIEW', 'RECRUITING', 'IN_PROGRESS', 'VERIFYING', 'SETTLING', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'PUBLISHED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('KRW', 'USD', 'CNY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "countryCode" VARCHAR(2),
    "businessNumber" TEXT,
    "websiteUrl" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "brandOrganizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL DEFAULT 'OPEN_BIDDING',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "privateTitle" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "briefUrl" TEXT,
    "coverImageUrl" TEXT,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "followerMin" INTEGER,
    "followerMax" INTEGER,
    "budgetAmount" DECIMAL(18,2),
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "requirements" JSONB NOT NULL DEFAULT '{}',
    "settlementPolicy" JSONB NOT NULL DEFAULT '{}',
    "managedRequest" JSONB NOT NULL DEFAULT '{}',
    "applicationDeadline" TIMESTAMP(3),
    "contentDeadline" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL,
    "agencyOrganizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "countryCode" VARCHAR(2),
    "primaryLanguage" "Locale" NOT NULL DEFAULT 'KO',
    "channels" JSONB NOT NULL DEFAULT '[]',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignApplication" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "agencyOrganizationId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "proposal" TEXT NOT NULL DEFAULT '',
    "proposedAmount" DECIMAL(18,2),
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "rosterSnapshot" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationCreator" (
    "applicationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "deliverables" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ApplicationCreator_pkey" PRIMARY KEY ("applicationId","creatorId")
);

-- CreateTable
CREATE TABLE "CampaignQuestion" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "agencyOrganizationId" TEXT NOT NULL,
    "askedById" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSubmission" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "draftUrl" TEXT,
    "publishedUrl" TEXT,
    "reviewNotes" TEXT NOT NULL DEFAULT '',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "agencyOrganizationId" TEXT NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "grossAmount" DECIMAL(18,2) NOT NULL,
    "platformFeeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,2) NOT NULL,
    "exchangeRate" DECIMAL(18,8),
    "transferReference" TEXT,
    "requestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_type_status_idx" ON "Organization"("type", "status");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_role_idx" ON "OrganizationMember"("organizationId", "role");

-- CreateIndex
CREATE INDEX "Campaign_status_applicationDeadline_idx" ON "Campaign"("status", "applicationDeadline");

-- CreateIndex
CREATE INDEX "Campaign_brandOrganizationId_status_idx" ON "Campaign"("brandOrganizationId", "status");

-- CreateIndex
CREATE INDEX "Campaign_type_status_idx" ON "Campaign"("type", "status");

-- CreateIndex
CREATE INDEX "CreatorProfile_agencyOrganizationId_isActive_idx" ON "CreatorProfile"("agencyOrganizationId", "isActive");

-- CreateIndex
CREATE INDEX "CampaignApplication_agencyOrganizationId_status_idx" ON "CampaignApplication"("agencyOrganizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignApplication_campaignId_agencyOrganizationId_key" ON "CampaignApplication"("campaignId", "agencyOrganizationId");

-- CreateIndex
CREATE INDEX "ApplicationCreator_creatorId_idx" ON "ApplicationCreator"("creatorId");

-- CreateIndex
CREATE INDEX "CampaignQuestion_campaignId_createdAt_idx" ON "CampaignQuestion"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignQuestion_agencyOrganizationId_createdAt_idx" ON "CampaignQuestion"("agencyOrganizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentSubmission_status_submittedAt_idx" ON "ContentSubmission"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentSubmission_applicationId_version_key" ON "ContentSubmission"("applicationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_applicationId_key" ON "Settlement"("applicationId");

-- CreateIndex
CREATE INDEX "Settlement_agencyOrganizationId_status_idx" ON "Settlement"("agencyOrganizationId", "status");

-- CreateIndex
CREATE INDEX "Settlement_status_requestedAt_idx" ON "Settlement"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandOrganizationId_fkey" FOREIGN KEY ("brandOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_agencyOrganizationId_fkey" FOREIGN KEY ("agencyOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApplication" ADD CONSTRAINT "CampaignApplication_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApplication" ADD CONSTRAINT "CampaignApplication_agencyOrganizationId_fkey" FOREIGN KEY ("agencyOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApplication" ADD CONSTRAINT "CampaignApplication_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationCreator" ADD CONSTRAINT "ApplicationCreator_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CampaignApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationCreator" ADD CONSTRAINT "ApplicationCreator_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuestion" ADD CONSTRAINT "CampaignQuestion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuestion" ADD CONSTRAINT "CampaignQuestion_agencyOrganizationId_fkey" FOREIGN KEY ("agencyOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuestion" ADD CONSTRAINT "CampaignQuestion_askedById_fkey" FOREIGN KEY ("askedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSubmission" ADD CONSTRAINT "ContentSubmission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CampaignApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CampaignApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_agencyOrganizationId_fkey" FOREIGN KEY ("agencyOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

