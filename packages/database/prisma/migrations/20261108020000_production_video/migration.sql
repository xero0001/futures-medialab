CREATE TABLE "ProductionMedia" (
 "id" TEXT NOT NULL,
 "productionItemId" TEXT NOT NULL,
 "uploadedById" TEXT NOT NULL,
 "revision" INTEGER NOT NULL,
 "pathname" TEXT NOT NULL,
 "filename" TEXT NOT NULL,
 "contentType" TEXT NOT NULL,
 "size" INTEGER NOT NULL,
 "etag" TEXT,
 "completedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProductionMedia_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ProductionMedia_productionItemId_fkey" FOREIGN KEY ("productionItemId") REFERENCES "ProductionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ProductionMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductionMedia_pathname_key" ON "ProductionMedia"("pathname");
CREATE INDEX "ProductionMedia_productionItemId_uploadedById_idx" ON "ProductionMedia"("productionItemId", "uploadedById");
