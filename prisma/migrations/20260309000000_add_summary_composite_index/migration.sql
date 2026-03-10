-- DropIndex
DROP INDEX IF EXISTS "Summary_companyId_idx";

-- CreateIndex
CREATE INDEX "Summary_companyId_generatedAt_idx" ON "Summary"("companyId", "generatedAt" DESC);
