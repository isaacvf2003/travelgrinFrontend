-- AlterTable
ALTER TABLE "categories" ADD COLUMN "descriptionI18n" JSONB;

-- AlterTable
ALTER TABLE "filter_groups" ADD COLUMN "labelI18n" JSONB;

-- AlterTable
ALTER TABLE "filter_options" ADD COLUMN "labelI18n" JSONB;

-- AlterTable
ALTER TABLE "publications" ADD COLUMN "categoryI18n" JSONB;
ALTER TABLE "publications" ADD COLUMN "descriptionI18n" JSONB;
ALTER TABLE "publications" ADD COLUMN "subcategoryI18n" JSONB;
ALTER TABLE "publications" ADD COLUMN "titleI18n" JSONB;
