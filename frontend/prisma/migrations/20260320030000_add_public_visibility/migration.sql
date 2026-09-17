ALTER TABLE "categories" ADD COLUMN "isPublicVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "filter_groups" ADD COLUMN "isPublicVisible" BOOLEAN NOT NULL DEFAULT true;
