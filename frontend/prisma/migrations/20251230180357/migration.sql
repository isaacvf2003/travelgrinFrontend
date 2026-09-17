/*
  Warnings:

  - You are about to drop the column `order` on the `categories` table. All the data in the column will be lost.

*/
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
INSERT INTO "new_categories" ("createdAt", "description", "id", "parentId", "taxonomyType", "updatedAt") SELECT "createdAt", "description", "id", "parentId", "taxonomyType", "updatedAt" FROM "categories";
DROP TABLE "categories";
ALTER TABLE "new_categories" RENAME TO "categories";
CREATE INDEX "categories_taxonomyType_parentId_idx" ON "categories"("taxonomyType", "parentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
