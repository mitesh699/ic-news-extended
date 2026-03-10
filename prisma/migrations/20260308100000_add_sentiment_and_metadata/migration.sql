-- AlterTable
ALTER TABLE "Article" ADD COLUMN "sentiment" TEXT,
ADD COLUMN "isBreaking" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Summary" ADD COLUMN "metadata" TEXT;
