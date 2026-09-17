ALTER TABLE "categories" ADD COLUMN "isPrimaryCategory" BOOLEAN NOT NULL DEFAULT false;

UPDATE "categories"
SET "isPrimaryCategory" = true
WHERE "parentId" IS NULL;
