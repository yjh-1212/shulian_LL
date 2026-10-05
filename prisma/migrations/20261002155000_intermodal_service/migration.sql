-- AlterTable
ALTER TABLE "Bill" ADD COLUMN "serviceCompletionKey" TEXT;

-- CreateTable
CREATE TABLE "TransportStage" (
    "managed" BOOLEAN NOT NULL DEFAULT true,
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "plannedStartAt" DATETIME NOT NULL,
    "plannedEndAt" DATETIME NOT NULL,
    "actualEndAt" DATETIME,
    "allocations" TEXT NOT NULL DEFAULT '[]',
    "vessel" TEXT NOT NULL DEFAULT '',
    "voyage" TEXT NOT NULL DEFAULT '',
    "billOfLading" TEXT NOT NULL DEFAULT '',
    "railWaybillNo" TEXT NOT NULL DEFAULT '',
    "containerized" BOOLEAN NOT NULL DEFAULT false,
    "boxes" TEXT NOT NULL DEFAULT '[]',
    "weightTicketNo" TEXT NOT NULL DEFAULT '',
    "grossKg" INTEGER,
    "tareKg" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "completionNote" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportStage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "LogisticsBusiness" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StageAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "bytes" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StageAttachment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "TransportStage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceKey" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "stageId" TEXT,
    "taskId" TEXT,
    "source" TEXT NOT NULL,
    "feeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "evidenceId" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "billId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceFee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "LogisticsBusiness" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceFee_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "TransportStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceFee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TransportTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceFee_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BillItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "feeCode" TEXT NOT NULL,
    "feeName" TEXT NOT NULL,
    "taskId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'TASK',
    "sourceId" TEXT,
    "stageId" TEXT,
    "mode" TEXT NOT NULL,
    "resource" TEXT NOT NULL DEFAULT '',
    "quantityMillis" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "originalCents" INTEGER NOT NULL,
    "adjustmentCents" INTEGER NOT NULL DEFAULT 0,
    "finalCents" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "basis" TEXT NOT NULL,
    CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BillItem" ("adjustmentCents", "basis", "billId", "feeCode", "feeName", "finalCents", "id", "mode", "occurredAt", "originalCents", "quantityMillis", "resource", "sequence", "taskId", "unit", "unitPriceCents") SELECT "adjustmentCents", "basis", "billId", "feeCode", "feeName", "finalCents", "id", "mode", "occurredAt", "originalCents", "quantityMillis", "resource", "sequence", "taskId", "unit", "unitPriceCents" FROM "BillItem";
DROP TABLE "BillItem";
ALTER TABLE "new_BillItem" RENAME TO "BillItem";
CREATE UNIQUE INDEX "BillItem_billId_sequence_key" ON "BillItem"("billId", "sequence");
CREATE TABLE "new_ExecutionEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "bytes" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionEvidence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TransportTask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExecutionEvidence" ("bytes", "createdAt", "digest", "id", "mime", "name", "taskId", "userId") SELECT "bytes", "createdAt", "digest", "id", "mime", "name", "taskId", "userId" FROM "ExecutionEvidence";
DROP TABLE "ExecutionEvidence";
ALTER TABLE "new_ExecutionEvidence" RENAME TO "ExecutionEvidence";
CREATE TABLE "new_LogisticsBusiness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "waybillNo" TEXT,
    "needsContainerization" BOOLEAN NOT NULL DEFAULT false,
    "segments" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" DATETIME,
    CONSTRAINT "LogisticsBusiness_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ContractPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LogisticsBusiness" ("businessNo", "createdAt", "id", "mode", "needsContainerization", "packageId", "segments", "version", "waybillNo") SELECT "businessNo", "createdAt", "id", "mode", "needsContainerization", "packageId", "segments", "version", "waybillNo" FROM "LogisticsBusiness";
DROP TABLE "LogisticsBusiness";
ALTER TABLE "new_LogisticsBusiness" RENAME TO "LogisticsBusiness";
CREATE UNIQUE INDEX "LogisticsBusiness_businessNo_key" ON "LogisticsBusiness"("businessNo");
CREATE UNIQUE INDEX "LogisticsBusiness_packageId_key" ON "LogisticsBusiness"("packageId");
CREATE UNIQUE INDEX "LogisticsBusiness_waybillNo_key" ON "LogisticsBusiness"("waybillNo");
CREATE TABLE "new_TransportTask" (
    "serviceManaged" BOOLEAN NOT NULL DEFAULT false,
    "stageId" TEXT,
    "plannedStartAt" DATETIME,
    "plannedEndAt" DATETIME,
    "feedback" TEXT NOT NULL DEFAULT '{}',
    "feedbackSubmittedAt" DATETIME,
    "batchId" TEXT,
    "boxNo" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "segment" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "resource" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISPATCHED',
    "loadedKg" INTEGER,
    "unloadedKg" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "TransportStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransportTask_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "LogisticsBusiness" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TransportTask" ("batchId", "boxNo", "businessId", "businessNo", "createdAt", "driverId", "id", "loadedKg", "mode", "quantityKg", "resource", "segment", "status", "unloadedKg", "vehicleId", "version") SELECT "batchId", "boxNo", "businessId", "businessNo", "createdAt", "driverId", "id", "loadedKg", "mode", "quantityKg", "resource", "segment", "status", "unloadedKg", "vehicleId", "version" FROM "TransportTask";
DROP TABLE "TransportTask";
ALTER TABLE "new_TransportTask" RENAME TO "TransportTask";
CREATE UNIQUE INDEX "TransportTask_businessNo_key" ON "TransportTask"("businessNo");
CREATE INDEX "TransportTask_driverId_status_idx" ON "TransportTask"("driverId", "status");
CREATE INDEX "TransportTask_businessId_status_idx" ON "TransportTask"("businessId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TransportStage_businessId_status_idx" ON "TransportStage"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStage_businessId_sequence_key" ON "TransportStage"("businessId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceFee_sourceKey_key" ON "ServiceFee"("sourceKey");

-- CreateIndex
CREATE INDEX "ServiceFee_businessId_source_idx" ON "ServiceFee"("businessId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_serviceCompletionKey_key" ON "Bill"("serviceCompletionKey");

UPDATE Menu SET enabled = false WHERE path IN ('/services/organizations','/services/containers','/services/tracking');
