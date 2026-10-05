-- CreateTable
CREATE TABLE "TransportNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "lng" REAL NOT NULL,
    "lat" REAL NOT NULL,
    "coordinateSystem" TEXT NOT NULL DEFAULT 'GCJ02',
    "source" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "quality" TEXT NOT NULL DEFAULT 'PROVIDER',
    "verifiedAt" DATETIME NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RouteGeometry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cacheKey" TEXT NOT NULL,
    "pathIndex" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "routeProfile" TEXT NOT NULL,
    "coordinates" TEXT NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "queriedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "checksum" TEXT NOT NULL,
    "steps" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "TransportLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "viaNodes" TEXT NOT NULL DEFAULT '',
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "capacityKg" INTEGER,
    "grainIds" TEXT NOT NULL DEFAULT '[]',
    "loadingTypes" TEXT NOT NULL DEFAULT '["BULK","CONTAINER"]',
    "transferMinutes" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "maintainer" TEXT NOT NULL,
    "quality" TEXT NOT NULL DEFAULT 'DRAFT',
    "geometryId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isTestData" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportLine_originId_fkey" FOREIGN KEY ("originId") REFERENCES "TransportNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportLine_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "TransportNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportLine_geometryId_fkey" FOREIGN KEY ("geometryId") REFERENCES "RouteGeometry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoutePrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineId" TEXT,
    "grainId" TEXT,
    "unit" TEXT NOT NULL,
    "rateMillis" INTEGER NOT NULL,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "maintainer" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isTestData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoutePrice_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "TransportLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessNo" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "businessEntityId" TEXT NOT NULL,
    "demandId" TEXT,
    "demandVersion" INTEGER,
    "input" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "selectedPlanId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isTestData" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "PlanCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "transferCount" INTEGER NOT NULL,
    "arrivalAt" DATETIME NOT NULL,
    "modes" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "geometryComplete" BOOLEAN NOT NULL,
    CONSTRAINT "PlanCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PlanRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "lineId" TEXT,
    "lineName" TEXT,
    "geometryId" TEXT,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "waitSeconds" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL,
    "priceSnapshot" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "routeProfile" TEXT NOT NULL,
    CONSTRAINT "PlanSegment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "PlanCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanSegment_geometryId_fkey" FOREIGN KEY ("geometryId") REFERENCES "RouteGeometry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RouteGeometry_cacheKey_expiresAt_idx" ON "RouteGeometry"("cacheKey", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransportLine_businessNo_key" ON "TransportLine"("businessNo");

-- CreateIndex
CREATE INDEX "RoutePrice_lineId_validFrom_validUntil_idx" ON "RoutePrice"("lineId", "validFrom", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PlanRun_businessNo_key" ON "PlanRun"("businessNo");

-- CreateIndex
CREATE INDEX "PlanRun_businessEntityId_createdAt_idx" ON "PlanRun"("businessEntityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanRun_groupId_version_key" ON "PlanRun"("groupId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PlanSegment_candidateId_sequence_key" ON "PlanSegment"("candidateId", "sequence");
