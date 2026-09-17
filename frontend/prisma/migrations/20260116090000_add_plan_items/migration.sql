-- CreateTable
CREATE TABLE "plan_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" TEXT,
    "currency" TEXT,
    "pricePeriod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "plan_items_sessionId_idx" ON "plan_items"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_items_sessionId_publicationId_key" ON "plan_items"("sessionId", "publicationId");
