-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "inputDigest" TEXT NOT NULL,
    "predictedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RiskRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recoveredAt" DATETIME
);

-- CreateTable
CREATE TABLE "MonitoringSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nodeId" TEXT,
    "region" TEXT NOT NULL DEFAULT '',
    "bounds" TEXT NOT NULL DEFAULT '[]',
    "level" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "details" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL,
    "validFrom" DATETIME NOT NULL,
    "validTo" DATETIME NOT NULL,
    "isTestData" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "contextId" TEXT NOT NULL DEFAULT '',
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "provider" TEXT NOT NULL DEFAULT 'RULES',
    "error" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgentResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "structured" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "sources" TEXT NOT NULL,
    "links" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BLOB NOT NULL,
    "digest" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "recognized" TEXT NOT NULL,
    "confirmed" TEXT,
    "confirmedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "periodFrom" DATETIME NOT NULL,
    "periodTo" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalCents" INTEGER NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "remark" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isTestData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "confirmedAt" DATETIME,
    "archivedAt" DATETIME
);

-- CreateTable
CREATE TABLE "BillTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    CONSTRAINT "BillTask_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "feeCode" TEXT NOT NULL,
    "feeName" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "BillVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillVersion_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillDifference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "billVersion" INTEGER NOT NULL,
    "itemSequence" INTEGER,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acceptedCents" INTEGER NOT NULL,
    "billedCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "userId" TEXT NOT NULL,
    "handledBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" DATETIME,
    CONSTRAINT "BillDifference_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "confirmedCents" INTEGER NOT NULL,
    "settledCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Settlement_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SettlementRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "plannedAt" DATETIME NOT NULL,
    "actualAt" DATETIME NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "registeredBy" TEXT NOT NULL,
    "registeredEntityId" TEXT NOT NULL,
    "confirmedBy" TEXT,
    "response" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    CONSTRAINT "SettlementRecord_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "bytes" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillEvidence_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "fields" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "coverage" TEXT NOT NULL,
    "serviceMode" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DataProductVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DataProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "productVersion" INTEGER NOT NULL,
    "entityId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'OWN',
    "fields" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "approver" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataAuthorization_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DataProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "dailyLimit" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataSubscription_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "DataAuthorization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataCall_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "DataSubscription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "subscriptionIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Forecast_taskId_predictedAt_idx" ON "Forecast"("taskId", "predictedAt");

-- CreateIndex
CREATE INDEX "RiskRecord_taskId_status_idx" ON "RiskRecord"("taskId", "status");

-- CreateIndex
CREATE INDEX "MonitoringSignal_kind_validTo_idx" ON "MonitoringSignal"("kind", "validTo");

-- CreateIndex
CREATE INDEX "AgentRun_entityId_createdAt_idx" ON "AgentRun"("entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentResult_runId_key" ON "AgentResult"("runId");

-- CreateIndex
CREATE INDEX "DocumentReview_taskId_createdAt_idx" ON "DocumentReview"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_businessNo_key" ON "Bill"("businessNo");

-- CreateIndex
CREATE INDEX "Bill_traderId_carrierId_status_idx" ON "Bill"("traderId", "carrierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillTask_taskId_key" ON "BillTask"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "BillItem_billId_sequence_key" ON "BillItem"("billId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "BillVersion_billId_number_key" ON "BillVersion"("billId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_businessNo_key" ON "Settlement"("businessNo");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_billId_key" ON "Settlement"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementRecord_settlementId_requestKey_key" ON "SettlementRecord"("settlementId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "DataProduct_code_key" ON "DataProduct"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DataProductVersion_productId_number_key" ON "DataProductVersion"("productId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DataSubscription_keyHash_key" ON "DataSubscription"("keyHash");

-- CreateIndex
CREATE INDEX "DataCall_subscriptionId_createdAt_idx" ON "DataCall"("subscriptionId", "createdAt");

