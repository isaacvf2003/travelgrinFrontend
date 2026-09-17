ALTER TABLE "categories" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE("blockId", ''), COALESCE("parentId", '')
      ORDER BY "createdAt", "description"
    ) - 1 AS rn
  FROM "categories"
)
UPDATE "categories"
SET "order" = (
  SELECT rn FROM ranked WHERE ranked."id" = "categories"."id"
);
