-- AlterTable
ALTER TABLE "WorkspaceToolRequest" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "adminReviewNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RequestMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "authorRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestAttachment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "messageId" TEXT,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "pathname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignContract" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "referenceUrl" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "confirmedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestMessage_requestId_createdAt_idx" ON "RequestMessage"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestAttachment_pathname_key" ON "RequestAttachment"("pathname");

-- CreateIndex
CREATE INDEX "RequestAttachment_requestId_messageId_idx" ON "RequestAttachment"("requestId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignContract_applicationId_key" ON "CampaignContract"("applicationId");

-- CreateIndex
CREATE INDEX "WorkspaceToolRequest_status_updatedAt_idx" ON "WorkspaceToolRequest"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkspaceToolRequest_assignedToId_dueAt_idx" ON "WorkspaceToolRequest"("assignedToId", "dueAt");

-- CreateIndex
CREATE INDEX "WorkspaceToolRequest_campaignId_idx" ON "WorkspaceToolRequest"("campaignId");

-- AddForeignKey
ALTER TABLE "WorkspaceToolRequest" ADD CONSTRAINT "WorkspaceToolRequest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceToolRequest" ADD CONSTRAINT "WorkspaceToolRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestMessage" ADD CONSTRAINT "RequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WorkspaceToolRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestMessage" ADD CONSTRAINT "RequestMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WorkspaceToolRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "RequestMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContract" ADD CONSTRAINT "CampaignContract_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CampaignApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


