-- Add new optional fields to publications
ALTER TABLE "publications" ADD COLUMN "primaryGroupKey" TEXT;
ALTER TABLE "publications" ADD COLUMN "contentLanguage" TEXT;
ALTER TABLE "publications" ADD COLUMN "website" TEXT;
ALTER TABLE "publications" ADD COLUMN "socialLinks" JSON;

-- Create join table for publication filter options
CREATE TABLE IF NOT EXISTS "publication_filter_options" (
  "publicationId" TEXT NOT NULL,
  "filterOptionId" TEXT NOT NULL,
  PRIMARY KEY ("publicationId", "filterOptionId"),
  CONSTRAINT "publication_filter_options_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "publication_filter_options_filterOptionId_fkey" FOREIGN KEY ("filterOptionId") REFERENCES "filter_options" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "publication_filter_options_filterOptionId_idx" ON "publication_filter_options"("filterOptionId");
