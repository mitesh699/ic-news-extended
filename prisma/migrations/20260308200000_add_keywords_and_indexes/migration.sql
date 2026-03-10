-- Add keywords column for company-specific search terms
ALTER TABLE "Company" ADD COLUMN "keywords" TEXT;

-- Add sector index for sector-based sorting/filtering
CREATE INDEX "Company_sector_idx" ON "Company"("sector");

-- Replace single-column indexes with composite indexes for common query patterns
DROP INDEX IF EXISTS "Article_companyId_idx";
DROP INDEX IF EXISTS "Article_fetchedAt_idx";

CREATE INDEX "Article_companyId_publishedAt_idx" ON "Article"("companyId", "publishedAt" DESC);
CREATE INDEX "Article_companyId_fetchedAt_idx" ON "Article"("companyId", "fetchedAt" DESC);
CREATE INDEX "Article_urlHash_idx" ON "Article"("urlHash");
