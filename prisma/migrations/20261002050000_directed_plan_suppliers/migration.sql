-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BusinessEntity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contact" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isTestData" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "registeredRegion" TEXT NOT NULL DEFAULT '',
    "registeredCodes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "BusinessEntity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BusinessEntity" ("contact", "createdAt", "deletedAt", "id", "isTestData", "name", "organizationId", "phone", "status", "type", "updatedAt") SELECT "contact", "createdAt", "deletedAt", "id", "isTestData", "name", "organizationId", "phone", "status", "type", "updatedAt" FROM "BusinessEntity";
DROP TABLE "BusinessEntity";
ALTER TABLE "new_BusinessEntity" RENAME TO "BusinessEntity";
CREATE UNIQUE INDEX "BusinessEntity_name_key" ON "BusinessEntity"("name");
CREATE TABLE "new_TransportDemand" (
    "matchStage" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matchedKg" INTEGER NOT NULL DEFAULT 0,
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessEntityId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "grainId" TEXT,
    "cargoName" TEXT NOT NULL DEFAULT '',
    "specification" TEXT NOT NULL DEFAULT '',
    "quantityKg" INTEGER NOT NULL,
    "originCodes" TEXT NOT NULL,
    "originRegion" TEXT NOT NULL,
    "originAddress" TEXT NOT NULL,
    "destinationCodes" TEXT NOT NULL,
    "destinationRegion" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "departureAt" DATETIME NOT NULL,
    "arrivalAt" DATETIME,
    "allowMultimodal" BOOLEAN NOT NULL,
    "allowTransfer" BOOLEAN NOT NULL,
    "maxTransfers" INTEGER NOT NULL,
    "loadingType" TEXT NOT NULL,
    "preference" TEXT NOT NULL,
    "budgetCents" INTEGER,
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
    CONSTRAINT "TransportDemand_businessEntityId_fkey" FOREIGN KEY ("businessEntityId") REFERENCES "BusinessEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportDemand_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "TradeOrderItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportDemand_grainId_fkey" FOREIGN KEY ("grainId") REFERENCES "Dictionary" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TransportDemand" ("allowMultimodal", "allowTransfer", "arrivalAt", "budgetCents", "businessEntityId", "businessNo", "contact", "createdAt", "createdBy", "deletedAt", "departureAt", "destinationAddress", "destinationCodes", "destinationRegion", "id", "isTestData", "loadingType", "matchStage", "matchedKg", "maxTransfers", "name", "notes", "orderItemId", "originAddress", "originCodes", "originRegion", "phone", "preference", "quantityKg", "sourceType", "status", "updatedAt", "updatedBy", "version") SELECT "allowMultimodal", "allowTransfer", "arrivalAt", "budgetCents", "businessEntityId", "businessNo", "contact", "createdAt", "createdBy", "deletedAt", "departureAt", "destinationAddress", "destinationCodes", "destinationRegion", "id", "isTestData", "loadingType", "matchStage", "matchedKg", "maxTransfers", "name", "notes", "orderItemId", "originAddress", "originCodes", "originRegion", "phone", "preference", "quantityKg", "sourceType", "status", "updatedAt", "updatedBy", "version" FROM "TransportDemand";
DROP TABLE "TransportDemand";
ALTER TABLE "new_TransportDemand" RENAME TO "TransportDemand";
CREATE UNIQUE INDEX "TransportDemand_businessNo_key" ON "TransportDemand"("businessNo");
CREATE INDEX "TransportDemand_businessEntityId_status_createdAt_idx" ON "TransportDemand"("businessEntityId", "status", "createdAt");
UPDATE "TransportDemand" SET "grainId"=(SELECT "grainId" FROM "TradeOrderItem" WHERE "id"="TransportDemand"."orderItemId"), "cargoName"=(SELECT "cargoName" FROM "TradeOrderItem" WHERE "id"="TransportDemand"."orderItemId"), "specification"=(SELECT "specification" FROM "TradeOrderItem" WHERE "id"="TransportDemand"."orderItemId") WHERE "orderItemId" IS NOT NULL;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
