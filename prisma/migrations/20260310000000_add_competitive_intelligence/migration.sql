-- ─── Source Registry ───
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'news',
    "language" TEXT NOT NULL DEFAULT 'en',
    "trustRank" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Source_domain_key" ON "Source"("domain");
CREATE INDEX "Source_domain_idx" ON "Source"("domain");

-- ─── Enrich Article with source metadata ───
ALTER TABLE "Article" ADD COLUMN "canonicalUrl" TEXT;
ALTER TABLE "Article" ADD COLUMN "sourceName" TEXT;
ALTER TABLE "Article" ADD COLUMN "author" TEXT;
ALTER TABLE "Article" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Article" ADD COLUMN "highlights" TEXT;
ALTER TABLE "Article" ADD COLUMN "readingTimeMs" INTEGER;

CREATE INDEX "Article_source_idx" ON "Article"("source");

-- ─── Competitor ───
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "sector" TEXT,
    "relevance" TEXT NOT NULL DEFAULT 'direct',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Competitor_companyId_name_key" ON "Competitor"("companyId", "name");
CREATE INDEX "Competitor_companyId_idx" ON "Competitor"("companyId");

-- ─── CompetitorArticle ───
CREATE TABLE "CompetitorArticle" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "source" TEXT,
    "sourceName" TEXT,
    "author" TEXT,
    "imageUrl" TEXT,
    "summary" TEXT,
    "highlights" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "urlHash" TEXT NOT NULL,
    "sentiment" TEXT,
    "signal" TEXT,

    CONSTRAINT "CompetitorArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompetitorArticle_urlHash_key" ON "CompetitorArticle"("urlHash");
CREATE INDEX "CompetitorArticle_competitorId_fetchedAt_idx" ON "CompetitorArticle"("competitorId", "fetchedAt" DESC);
CREATE INDEX "CompetitorArticle_urlHash_idx" ON "CompetitorArticle"("urlHash");
CREATE INDEX "CompetitorArticle_signal_idx" ON "CompetitorArticle"("signal");

-- ─── SectorBrief ───
CREATE TABLE "SectorBrief" (
    "id" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "briefText" TEXT NOT NULL,
    "metadata" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectorBrief_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SectorBrief_sector_generatedAt_idx" ON "SectorBrief"("sector", "generatedAt" DESC);
CREATE INDEX "SectorBrief_generatedAt_idx" ON "SectorBrief"("generatedAt");

-- ─── Foreign Keys ───
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitorArticle" ADD CONSTRAINT "CompetitorArticle_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
