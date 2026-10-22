-- Published directory data is deliberately separate from private creator rosters.
CREATE TABLE "CreatorDirectoryEntry" (
  "id" TEXT NOT NULL, "platform" TEXT NOT NULL,
  "isDemo" BOOLEAN NOT NULL DEFAULT false, "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorDirectoryEntry_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CreatorCollection" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorCollection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CreatorCollectionItem" (
  "collectionId" TEXT NOT NULL, "entryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorCollectionItem_pkey" PRIMARY KEY ("collectionId", "entryId")
);
CREATE TABLE "DirectorySearch" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "mode" TEXT NOT NULL, "filtersJson" JSONB NOT NULL, "resultIdsJson" JSONB NOT NULL,
  "isDemo" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectorySearch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ShortLink" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL, "title" TEXT NOT NULL, "targetUrl" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "clickCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WorkspaceToolRequest" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "tool" TEXT NOT NULL, "title" TEXT NOT NULL, "inputJson" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceToolRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreatorDirectoryEntry_platform_isPublished_isDemo_idx" ON "CreatorDirectoryEntry"("platform", "isPublished", "isDemo");
CREATE UNIQUE INDEX "CreatorCollection_organizationId_name_key" ON "CreatorCollection"("organizationId", "name");
CREATE INDEX "CreatorCollectionItem_entryId_idx" ON "CreatorCollectionItem"("entryId");
CREATE INDEX "DirectorySearch_organizationId_createdAt_idx" ON "DirectorySearch"("organizationId", "createdAt");
CREATE INDEX "DirectorySearch_userId_createdAt_idx" ON "DirectorySearch"("userId", "createdAt");
CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");
CREATE INDEX "ShortLink_organizationId_createdAt_idx" ON "ShortLink"("organizationId", "createdAt");
CREATE INDEX "WorkspaceToolRequest_organizationId_createdAt_idx" ON "WorkspaceToolRequest"("organizationId", "createdAt");
ALTER TABLE "CreatorCollection" ADD CONSTRAINT "CreatorCollection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorCollectionItem" ADD CONSTRAINT "CreatorCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "CreatorCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorCollectionItem" ADD CONSTRAINT "CreatorCollectionItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CreatorDirectoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectorySearch" ADD CONSTRAINT "DirectorySearch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectorySearch" ADD CONSTRAINT "DirectorySearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceToolRequest" ADD CONSTRAINT "WorkspaceToolRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceToolRequest" ADD CONSTRAINT "WorkspaceToolRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
