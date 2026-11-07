BEGIN;
-- The invoice is the receivable. A new issue archives its public document, not a second debt.
ALTER TABLE "BrandInvoice" ADD COLUMN "documentVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "BrandInvoiceVersion" (
  "invoiceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "title" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "documentUrl" TEXT,
  "currency" "Currency" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "lineSnapshot" JSONB NOT NULL,
  "reason" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "issuedById" TEXT,
  CONSTRAINT "BrandInvoiceVersion_pkey" PRIMARY KEY ("invoiceId", "version"),
  CONSTRAINT "BrandInvoiceVersion_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BrandInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BrandInvoiceVersion_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BrandInvoiceVersion_issuedAt_idx" ON "BrandInvoiceVersion"("issuedAt");

INSERT INTO "BrandInvoiceVersion" ("invoiceId", "version", "title", "note", "dueAt", "documentUrl", "currency", "amount", "lineSnapshot", "issuedAt", "issuedById")
SELECT "id", 1, "title", "note", "dueAt", "documentUrl", "currency", "amount", "lineSnapshot", "issuedAt", "issuedById"
FROM "BrandInvoice" WHERE status IN ('ISSUED','PAID') AND "issuedAt" IS NOT NULL;
UPDATE "BrandInvoice" SET "documentVersion" = 1 WHERE status IN ('ISSUED','PAID') AND "issuedAt" IS NOT NULL;

COMMIT;
