-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TransportSupply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessEntityId" TEXT NOT NULL,
    "modeId" TEXT NOT NULL,
    "originCodes" TEXT NOT NULL,
    "originRegion" TEXT NOT NULL,
    "originAddress" TEXT NOT NULL,
    "destinationCodes" TEXT NOT NULL,
    "destinationRegion" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "viaNodes" TEXT NOT NULL DEFAULT '',
    "capacityKg" INTEGER NOT NULL,
    "minKg" INTEGER,
    "maxKg" INTEGER,
    "resourceType" TEXT NOT NULL,
    "resourceDescription" TEXT NOT NULL,
    "serviceStart" DATETIME,
    "serviceEnd" DATETIME,
    "durationHours" INTEGER,
    "referencePriceCents" INTEGER,
    "priceUnit" TEXT,
    "loadingType" TEXT NOT NULL DEFAULT 'BULK',
    "bulkPriceCents" INTEGER,
    "container20PriceCents" INTEGER,
    "container40PriceCents" INTEGER,
    "capabilities" TEXT NOT NULL DEFAULT '',
    "validFrom" DATETIME,
    "validUntil" DATETIME,
    "contact" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "isTestData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "TransportSupply_businessEntityId_fkey" FOREIGN KEY ("businessEntityId") REFERENCES "BusinessEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportSupply_modeId_fkey" FOREIGN KEY ("modeId") REFERENCES "Dictionary" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TransportSupply" ("businessEntityId", "businessNo", "capabilities", "capacityKg", "contact", "createdAt", "createdBy", "deletedAt", "destinationAddress", "destinationCodes", "destinationRegion", "durationHours", "id", "isTestData", "maxKg", "minKg", "modeId", "name", "notes", "originAddress", "originCodes", "originRegion", "phone", "priceUnit", "referencePriceCents", "resourceDescription", "resourceType", "serviceEnd", "serviceStart", "sourceType", "status", "updatedAt", "updatedBy", "validFrom", "validUntil", "version", "viaNodes") SELECT "businessEntityId", "businessNo", "capabilities", "capacityKg", "contact", "createdAt", "createdBy", "deletedAt", "destinationAddress", "destinationCodes", "destinationRegion", "durationHours", "id", "isTestData", "maxKg", "minKg", "modeId", "name", "notes", "originAddress", "originCodes", "originRegion", "phone", "priceUnit", "referencePriceCents", "resourceDescription", "resourceType", "serviceEnd", "serviceStart", "sourceType", "status", "updatedAt", "updatedBy", "validFrom", "validUntil", "version", "viaNodes" FROM "TransportSupply";
DROP TABLE "TransportSupply";
ALTER TABLE "new_TransportSupply" RENAME TO "TransportSupply";
CREATE UNIQUE INDEX "TransportSupply_businessNo_key" ON "TransportSupply"("businessNo");
CREATE INDEX "TransportSupply_businessEntityId_status_createdAt_idx" ON "TransportSupply"("businessEntityId", "status", "createdAt");
CREATE INDEX "TransportSupply_status_validFrom_validUntil_idx" ON "TransportSupply"("status", "validFrom", "validUntil");
PRAGMA foreign_keys=ON;
UPDATE "TransportSupply" SET "loadingType" = 'CONTAINER' WHERE "resourceType" = 'CONTAINER';
UPDATE "TransportSupply" SET "bulkPriceCents" = "referencePriceCents" WHERE "loadingType" = 'BULK' AND "priceUnit" = 'PER_TON';
UPDATE "TransportSupply" SET "minKg" = COALESCE("minKg", "maxKg", "capacityKg"), "maxKg" = COALESCE("maxKg", "capacityKg");
PRAGMA defer_foreign_keys=OFF;
