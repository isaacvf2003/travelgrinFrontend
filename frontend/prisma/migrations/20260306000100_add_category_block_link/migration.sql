ALTER TABLE "categories" ADD COLUMN "blockId" TEXT;

CREATE INDEX "categories_blockId_parentId_idx" ON "categories"("blockId", "parentId");
