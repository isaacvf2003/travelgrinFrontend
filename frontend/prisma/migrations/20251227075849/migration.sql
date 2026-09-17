/*
  Warnings:

  - You are about to drop the `categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `publication_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `publication_languages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `typeProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `providerRef` on the `publication_payments` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `publication_payments` table. All the data in the column will be lost.
  - You are about to drop the column `destinationCity` on the `publications` table. All the data in the column will be lost.
  - You are about to drop the column `destinationCountry` on the `publications` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `travel_services` table. All the data in the column will be lost.
  - Made the column `publicationId` on table `publication_payments` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "publication_images_publicationId_idx";

-- DropIndex
DROP INDEX "publication_languages_code_idx";

-- DropIndex
DROP INDEX "publication_languages_publicationId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "categories";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "publication_images";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "publication_languages";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "typeProfile";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_publication_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" TEXT,
    "currency" TEXT,
    "externalId" TEXT,
    "raw" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicationId" TEXT NOT NULL,
    CONSTRAINT "publication_payments_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_publication_payments" ("amount", "createdAt", "currency", "id", "provider", "publicationId", "raw", "status") SELECT "amount", "createdAt", "currency", "id", "provider", "publicationId", "raw", "status" FROM "publication_payments";
DROP TABLE "publication_payments";
ALTER TABLE "new_publication_payments" RENAME TO "publication_payments";
CREATE INDEX "publication_payments_provider_status_idx" ON "publication_payments"("provider", "status");
CREATE TABLE "new_publications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "country" TEXT,
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
    "expiration" DATETIME
);
INSERT INTO "new_publications" ("activity", "category", "city", "country", "createdAt", "currency", "description", "expiration", "featured", "fields", "id", "price", "serviceType", "status", "subUserType", "subcategory", "title", "updatedAt", "userRol", "userType") SELECT "activity", "category", "city", "country", "createdAt", "currency", "description", "expiration", "featured", "fields", "id", "price", "serviceType", "status", "subUserType", "subcategory", "title", "updatedAt", "userRol", "userType" FROM "publications";
DROP TABLE "publications";
ALTER TABLE "new_publications" RENAME TO "publications";
CREATE TABLE "new_travel_services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxonomyType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "typeProfile" TEXT,
    "email" TEXT NOT NULL,
    "isOfrezco" BOOLEAN DEFAULT false,
    "isIntermediario" BOOLEAN DEFAULT false,
    "country" TEXT,
    "destinationCountry" TEXT NOT NULL,
    "whatSearching" TEXT,
    "whatStop" TEXT,
    "contanos" TEXT,
    "website" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_travel_services" ("category", "contanos", "country", "createdAt", "destinationCountry", "email", "id", "isIntermediario", "isOfrezco", "taxonomyType", "typeProfile", "updatedAt", "website", "whatSearching", "whatStop") SELECT "category", "contanos", "country", "createdAt", "destinationCountry", "email", "id", "isIntermediario", "isOfrezco", "taxonomyType", "typeProfile", "updatedAt", "website", "whatSearching", "whatStop" FROM "travel_services";
DROP TABLE "travel_services";
ALTER TABLE "new_travel_services" RENAME TO "travel_services";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
