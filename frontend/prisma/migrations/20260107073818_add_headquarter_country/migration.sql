/*
  Warnings:

  - You are about to drop the column `providerName` on the `publications` table. All the data in the column will be lost.
  - You are about to alter the column `socialLinks` on the `publications` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_publications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "primaryGroupKey" TEXT,
    "contentLanguage" TEXT,
    "publisherName" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "country" TEXT,
    "headquarterCountry" TEXT,
    "city" TEXT,
    "location" JSONB,
    "userType" TEXT,
    "subUserType" TEXT,
    "serviceType" TEXT,
    "userRol" TEXT,
    "activity" TEXT,
    "currency" TEXT,
    "price" TEXT,
    "languages" JSONB,
    "fields" JSONB,
    "images" JSONB,
    "website" TEXT,
    "socialLinks" JSONB,
    "expiration" DATETIME
);
INSERT INTO "new_publications" ("activity", "category", "city", "contentLanguage", "country", "createdAt", "currency", "description", "expiration", "featured", "fields", "id", "images", "languages", "location", "price", "primaryGroupKey", "publisherName", "serviceType", "socialLinks", "status", "subUserType", "subcategory", "title", "updatedAt", "userRol", "userType", "website") SELECT "activity", "category", "city", "contentLanguage", "country", "createdAt", "currency", "description", "expiration", "featured", "fields", "id", "images", "languages", "location", "price", "primaryGroupKey", "publisherName", "serviceType", "socialLinks", "status", "subUserType", "subcategory", "title", "updatedAt", "userRol", "userType", "website" FROM "publications";
DROP TABLE "publications";
ALTER TABLE "new_publications" RENAME TO "publications";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
