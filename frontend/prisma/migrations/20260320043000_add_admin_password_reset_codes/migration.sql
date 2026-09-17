CREATE TABLE "admin_password_reset_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_password_reset_codes_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "admin_password_reset_codes_adminId_expiresAt_idx" ON "admin_password_reset_codes"("adminId", "expiresAt");
