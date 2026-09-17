-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "travel_services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxonomyType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "typeProfile" TEXT,
    "email" TEXT NOT NULL,
    "isOfrezco" BOOLEAN DEFAULT false,
    "isIntermediario" BOOLEAN DEFAULT false,
    "country" TEXT,
    "destinationCountry" TEXT NOT NULL,
    "contanos" TEXT,
    "website" TEXT,
    "userId" TEXT,
    "whatSearching" TEXT,
    "whatStop" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "taxonomyType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "typeProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "taxonomyType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "publications" (
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
    "destinationCountry" TEXT,
    "destinationCity" TEXT,
    "userType" TEXT,
    "subUserType" TEXT,
    "serviceType" TEXT,
    "userRol" TEXT,
    "activity" TEXT,
    "currency" TEXT,
    "price" TEXT,
    "fields" JSONB,
    "expiration" DATETIME
);

-- CreateTable
CREATE TABLE "publication_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "publication_images_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "publication_languages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "publication_languages_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "publication_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" INTEGER,
    "currency" TEXT,
    "providerRef" TEXT,
    "raw" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "publication_payments_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "emails_email_key" ON "emails"("email");

-- CreateIndex
CREATE INDEX "publication_images_publicationId_idx" ON "publication_images"("publicationId");

-- CreateIndex
CREATE INDEX "publication_languages_publicationId_idx" ON "publication_languages"("publicationId");

-- CreateIndex
CREATE INDEX "publication_languages_code_idx" ON "publication_languages"("code");

-- CreateIndex
CREATE INDEX "publication_payments_publicationId_idx" ON "publication_payments"("publicationId");

-- CreateIndex
CREATE INDEX "publication_payments_provider_idx" ON "publication_payments"("provider");

-- CreateIndex
CREATE INDEX "publication_payments_status_idx" ON "publication_payments"("status");
