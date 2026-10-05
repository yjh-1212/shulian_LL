-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'A',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContractPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "confirmationId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "snapshot" TEXT NOT NULL,
    "effectiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContractRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "mode" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "terms" TEXT NOT NULL,
    "documents" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractRevision_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ContractPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractSignature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "revisionId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'SIMULATED',
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractSignature_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ContractRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogisticsBusiness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "waybillNo" TEXT,
    "needsContainerization" BOOLEAN NOT NULL DEFAULT false,
    "segments" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogisticsBusiness_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ContractPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetVehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carrierId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "capacityKg" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "TransportTask" (
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
    CONSTRAINT "TransportTask_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "LogisticsBusiness" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TransportTask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "bytes" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionEvidence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TransportTask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "ExecutionIssue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TransportTask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContainerBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "arrivals" TEXT NOT NULL DEFAULT '[]',
    "boxes" TEXT NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContainerBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "LogisticsBusiness" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RefreshToken" (
    "audience" TEXT NOT NULL DEFAULT 'grain-web',
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RefreshToken" ("createdAt", "expiresAt", "id", "revokedAt", "tokenHash", "userId") SELECT "createdAt", "expiresAt", "id", "revokedAt", "tokenHash", "userId" FROM "RefreshToken";
DROP TABLE "RefreshToken";
ALTER TABLE "new_RefreshToken" RENAME TO "RefreshToken";
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_type_version_key" ON "ContractTemplate"("type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ContractPackage_businessNo_key" ON "ContractPackage"("businessNo");

-- CreateIndex
CREATE UNIQUE INDEX "ContractPackage_confirmationId_key" ON "ContractPackage"("confirmationId");

-- CreateIndex
CREATE INDEX "ContractPackage_traderId_carrierId_status_idx" ON "ContractPackage"("traderId", "carrierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRevision_packageId_number_key" ON "ContractRevision"("packageId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ContractSignature_revisionId_documentType_role_key" ON "ContractSignature"("revisionId", "documentType", "role");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsBusiness_businessNo_key" ON "LogisticsBusiness"("businessNo");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsBusiness_packageId_key" ON "LogisticsBusiness"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsBusiness_waybillNo_key" ON "LogisticsBusiness"("waybillNo");

-- CreateIndex
CREATE UNIQUE INDEX "FleetVehicle_carrierId_plate_key" ON "FleetVehicle"("carrierId", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "TransportTask_businessNo_key" ON "TransportTask"("businessNo");

-- CreateIndex
CREATE INDEX "TransportTask_driverId_status_idx" ON "TransportTask"("driverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionEvent_taskId_requestKey_key" ON "ExecutionEvent"("taskId", "requestKey");

INSERT INTO Permission (id,code,name,module) VALUES ('p5-contract:write','contract:write','合同模拟签署与维护','合同');

INSERT INTO Permission (id,code,name,module) VALUES ('p5-contract-template:write','contract-template:write','维护合同模板','合同模板');

INSERT INTO Permission (id,code,name,module) VALUES ('p5-service:write','service:write','联运调度与执行','联运服务');
INSERT OR IGNORE INTO RolePermission (roleId,permissionId) SELECT r.id,p.id FROM Role r, Permission p WHERE r.code='platform_admin' AND p.code='contract:write';
INSERT OR IGNORE INTO RolePermission (roleId,permissionId) SELECT r.id,p.id FROM Role r, Permission p WHERE r.code='platform_admin' AND p.code='contract-template:write';
INSERT OR IGNORE INTO RolePermission (roleId,permissionId) SELECT r.id,p.id FROM Role r, Permission p WHERE r.code='trader_admin' AND p.code='contract:write';
INSERT OR IGNORE INTO RolePermission (roleId,permissionId) SELECT r.id,p.id FROM Role r, Permission p WHERE r.code='trader_member' AND p.code='contract:write';
INSERT OR IGNORE INTO RolePermission (roleId,permissionId) SELECT r.id,p.id FROM Role r, Permission p WHERE r.code='carrier_admin' AND p.code='contract:write';
INSERT OR IGNORE INTO RolePermission (roleId,permissionId) SELECT r.id,p.id FROM Role r, Permission p WHERE r.code='carrier_admin' AND p.code='service:write';
INSERT OR IGNORE INTO RolePermission (roleId,permissionId) SELECT r.id,p.id FROM Role r, Permission p WHERE r.code='carrier_member' AND p.code='service:write';
INSERT INTO ContractTemplate (id,type,name,version,body,mode,status,effectiveFrom) VALUES ('simulation-main-v1','MAIN','粮食运输主合同（模拟模板）',1,'本模拟合同由贸易方委托承运方完成约定粮食运输。双方核对数量、起讫地点、运价和作业要求，按约定交接、留存单据，争议由双方协商处理。','A','PUBLISHED',0);
INSERT INTO ContractTemplate (id,type,name,version,body,mode,status,effectiveFrom) VALUES ('simulation-addendum-v1','ADDENDUM','平台服务附加合同（模拟模板）',1,'平台提供信息撮合、合同记录及物流协同服务。平台费用单独约定；不代替承运方完成运输义务。各方确认服务范围、费用及数据使用约定。本文件用于模拟流程。','A','PUBLISHED',0);
