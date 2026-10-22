CREATE TYPE "AgencyDocumentKind" AS ENUM ('BUSINESS_REGISTRATION', 'CONTRACT');
CREATE TYPE "AgencyDocumentState" AS ENUM ('PENDING', 'UPLOADED', 'REJECTED');

CREATE TABLE "AgencyDocument" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "AgencyDocumentKind" NOT NULL,
  "state" "AgencyDocumentState" NOT NULL DEFAULT 'PENDING',
  "pathname" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgencyDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgencyDocument_size_check" CHECK ("size" > 0 AND "size" <= 20971520)
);

CREATE UNIQUE INDEX "AgencyDocument_pathname_key" ON "AgencyDocument"("pathname");
CREATE INDEX "AgencyDocument_organizationId_kind_state_idx" ON "AgencyDocument"("organizationId", "kind", "state");
CREATE INDEX "AgencyDocument_organizationId_createdAt_idx" ON "AgencyDocument"("organizationId", "createdAt");
CREATE INDEX "AgencyDocument_userId_idx" ON "AgencyDocument"("userId");
ALTER TABLE "AgencyDocument" ADD CONSTRAINT "AgencyDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyDocument" ADD CONSTRAINT "AgencyDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
