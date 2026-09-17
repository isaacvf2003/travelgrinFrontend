-- CreateTable
CREATE TABLE "filter_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'multi',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "filter_options" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "filter_options_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "filter_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "filter_options_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "filter_options" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "taxonomyType" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_categories" ("createdAt", "description", "id", "taxonomyType", "updatedAt") SELECT "createdAt", "description", "id", "taxonomyType", "updatedAt" FROM "categories";
DROP TABLE "categories";
ALTER TABLE "new_categories" RENAME TO "categories";
CREATE INDEX "categories_taxonomyType_parentId_idx" ON "categories"("taxonomyType", "parentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "filter_groups_key_key" ON "filter_groups"("key");

-- CreateIndex
CREATE INDEX "filter_options_groupId_parentId_idx" ON "filter_options"("groupId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "filter_options_groupId_value_parentId_key" ON "filter_options"("groupId", "value", "parentId");
