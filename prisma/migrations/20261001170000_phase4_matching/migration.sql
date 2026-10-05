-- CreateTable
CREATE TABLE "MatchResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "terms" TEXT NOT NULL,
    "lastAuthorId" TEXT NOT NULL,
    "acceptedRound" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchResponse_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "MatchPublication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NegotiationRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "authorEntityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NegotiationRound_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "MatchResponse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CarrierConfirmation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "demandId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "terms" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "confirmedBy" TEXT NOT NULL,
    "confirmedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    CONSTRAINT "CarrierConfirmation_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "MatchPublication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CarrierConfirmation_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "MatchResponse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MatchPublication" (
    "objectType" TEXT NOT NULL DEFAULT 'DEMAND',
    "planRunId" TEXT,
    "supplyId" TEXT,
    "snapshot" TEXT NOT NULL DEFAULT '{}',
    "allowPartial" BOOLEAN NOT NULL DEFAULT false,
    "quantityKg" INTEGER NOT NULL DEFAULT 0,
    "matchedKg" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'WAITING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "riskNotes" TEXT NOT NULL DEFAULT '[]',
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
    CONSTRAINT "MatchPublication_planRunId_fkey" FOREIGN KEY ("planRunId") REFERENCES "PlanRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MatchPublication_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "TransportSupply" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MatchPublication_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "TransportDemand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MatchPublication_targetCarrierId_fkey" FOREIGN KEY ("targetCarrierId") REFERENCES "BusinessEntity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MatchPublication" ("budgetPublic", "businessNo", "closedAt", "contactPublic", "createdAt", "createdBy", "deadline", "demandId", "demandVersion", "id", "mode", "notes", "quoteType", "status", "targetCarrierId") SELECT "budgetPublic", "businessNo", "closedAt", "contactPublic", "createdAt", "createdBy", "deadline", "demandId", "demandVersion", "id", "mode", "notes", "quoteType", "status", "targetCarrierId" FROM "MatchPublication";
DROP TABLE "MatchPublication";
ALTER TABLE "new_MatchPublication" RENAME TO "MatchPublication";
CREATE UNIQUE INDEX "MatchPublication_businessNo_key" ON "MatchPublication"("businessNo");
CREATE INDEX "MatchPublication_demandId_status_idx" ON "MatchPublication"("demandId", "status");
CREATE TABLE "new_TransportDemand" (
    "matchStage" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matchedKg" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_TransportDemand" ("allowMultimodal", "allowTransfer", "arrivalAt", "budgetCents", "businessEntityId", "businessNo", "contact", "createdAt", "createdBy", "deletedAt", "departureAt", "destinationAddress", "destinationCodes", "destinationRegion", "id", "isTestData", "loadingType", "maxTransfers", "name", "notes", "orderItemId", "originAddress", "originCodes", "originRegion", "phone", "preference", "quantityKg", "sourceType", "status", "updatedAt", "updatedBy", "version") SELECT "allowMultimodal", "allowTransfer", "arrivalAt", "budgetCents", "businessEntityId", "businessNo", "contact", "createdAt", "createdBy", "deletedAt", "departureAt", "destinationAddress", "destinationCodes", "destinationRegion", "id", "isTestData", "loadingType", "maxTransfers", "name", "notes", "orderItemId", "originAddress", "originCodes", "originRegion", "phone", "preference", "quantityKg", "sourceType", "status", "updatedAt", "updatedBy", "version" FROM "TransportDemand";
DROP TABLE "TransportDemand";
ALTER TABLE "new_TransportDemand" RENAME TO "TransportDemand";
CREATE UNIQUE INDEX "TransportDemand_businessNo_key" ON "TransportDemand"("businessNo");
CREATE INDEX "TransportDemand_businessEntityId_status_createdAt_idx" ON "TransportDemand"("businessEntityId", "status", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MatchResponse_publicationId_carrierId_key" ON "MatchResponse"("publicationId", "carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "NegotiationRound_responseId_round_key" ON "NegotiationRound"("responseId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierConfirmation_businessNo_key" ON "CarrierConfirmation"("businessNo");

-- CreateIndex
CREATE INDEX "CarrierConfirmation_demandId_status_idx" ON "CarrierConfirmation"("demandId", "status");

UPDATE "MatchPublication" SET "quantityKg"=(SELECT "quantityKg" FROM "TransportDemand" WHERE "id"="MatchPublication"."demandId");
UPDATE "MatchPublication" SET "status"='EXPIRED',"closedAt"=CURRENT_TIMESTAMP WHERE "status"='ACTIVE' AND "deadline"<=unixepoch('now')*1000;
CREATE UNIQUE INDEX "MatchPublication_one_active_demand" ON "MatchPublication"("demandId") WHERE "status"='ACTIVE';
CREATE UNIQUE INDEX "CarrierConfirmation_one_active_response" ON "CarrierConfirmation"("responseId") WHERE "status"='CONFIRMED';
INSERT INTO "Permission" ("id","code","name","module") VALUES
('p4-publish','match:publish','发布匹配','供需匹配'),
('p4-quote','match:quote','提交报价','供需匹配'),
('p4-negotiate','match:negotiate','参与议价','供需匹配'),
('p4-confirm','match:confirm','确认承运','供需匹配');
INSERT OR IGNORE INTO "RolePermission" ("roleId","permissionId") SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE
(r.code IN ('trader_admin','trader_member') AND p.code IN ('match:publish','match:negotiate','match:confirm')) OR
(r.code IN ('carrier_admin','carrier_member') AND p.code IN ('match:quote','match:negotiate'));
