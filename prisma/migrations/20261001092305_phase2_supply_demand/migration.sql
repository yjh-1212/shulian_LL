-- CreateTable
CREATE TABLE "TradeOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "businessEntityId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "shipperContact" TEXT NOT NULL,
    "shipperPhone" TEXT NOT NULL,
    "recipientContact" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceDigest" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'INTERNAL',
    "isTestData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeOrder_businessEntityId_fkey" FOREIGN KEY ("businessEntityId") REFERENCES "BusinessEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeOrderId" TEXT NOT NULL,
    "lineNo" TEXT NOT NULL,
    "grainId" TEXT NOT NULL,
    "cargoName" TEXT NOT NULL,
    "specification" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "reservedKg" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TradeOrderItem_tradeOrderId_fkey" FOREIGN KEY ("tradeOrderId") REFERENCES "TradeOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TradeOrderItem_grainId_fkey" FOREIGN KEY ("grainId") REFERENCES "Dictionary" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportDemand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessEntityId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
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
    CONSTRAINT "TransportDemand_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "TradeOrderItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DemandMode" (
    "demandId" TEXT NOT NULL,
    "modeId" TEXT NOT NULL,

    PRIMARY KEY ("demandId", "modeId"),
    CONSTRAINT "DemandMode_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "TransportDemand" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DemandMode_modeId_fkey" FOREIGN KEY ("modeId") REFERENCES "Dictionary" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchPublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "demandId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "targetCarrierId" TEXT,
    "deadline" DATETIME NOT NULL,
    "quoteType" TEXT NOT NULL,
    "budgetPublic" BOOLEAN NOT NULL,
    "contactPublic" BOOLEAN NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "demandVersion" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "MatchPublication_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "TransportDemand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MatchPublication_targetCarrierId_fkey" FOREIGN KEY ("targetCarrierId") REFERENCES "BusinessEntity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportSupply" (
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
    "serviceStart" DATETIME NOT NULL,
    "serviceEnd" DATETIME NOT NULL,
    "durationHours" INTEGER,
    "referencePriceCents" INTEGER,
    "priceUnit" TEXT,
    "capabilities" TEXT NOT NULL DEFAULT '',
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
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

-- CreateTable
CREATE TABLE "SupplyGrain" (
    "supplyId" TEXT NOT NULL,
    "grainId" TEXT NOT NULL,

    PRIMARY KEY ("supplyId", "grainId"),
    CONSTRAINT "SupplyGrain_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "TransportSupply" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplyGrain_grainId_fkey" FOREIGN KEY ("grainId") REFERENCES "Dictionary" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demandId" TEXT,
    "supplyId" TEXT,
    "name" TEXT NOT NULL,
    "storageName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "BusinessFile_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "TransportDemand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BusinessFile_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "TransportSupply" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TradeOrder_businessNo_key" ON "TradeOrder"("businessNo");

-- CreateIndex
CREATE INDEX "TradeOrder_businessEntityId_status_idx" ON "TradeOrder"("businessEntityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOrder_sourceSystem_sourceRecordId_key" ON "TradeOrder"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOrderItem_tradeOrderId_lineNo_key" ON "TradeOrderItem"("tradeOrderId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "TransportDemand_businessNo_key" ON "TransportDemand"("businessNo");

-- CreateIndex
CREATE INDEX "TransportDemand_businessEntityId_status_createdAt_idx" ON "TransportDemand"("businessEntityId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPublication_businessNo_key" ON "MatchPublication"("businessNo");

-- CreateIndex
CREATE INDEX "MatchPublication_demandId_status_idx" ON "MatchPublication"("demandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportSupply_businessNo_key" ON "TransportSupply"("businessNo");

-- CreateIndex
CREATE INDEX "TransportSupply_businessEntityId_status_createdAt_idx" ON "TransportSupply"("businessEntityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TransportSupply_status_validFrom_validUntil_idx" ON "TransportSupply"("status", "validFrom", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessFile_storageName_key" ON "BusinessFile"("storageName");
