CREATE TABLE "TrackPoint" (
 "id" TEXT NOT NULL PRIMARY KEY, "taskId" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceSystem" TEXT NOT NULL, "sourceRecordId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
 "observedAt" DATETIME NOT NULL, "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "longitude" REAL NOT NULL, "latitude" REAL NOT NULL, "originalLongitude" REAL NOT NULL, "originalLatitude" REAL NOT NULL, "originalCoordinateSystem" TEXT NOT NULL,
 "coordinateSystem" TEXT NOT NULL DEFAULT 'GCJ02', "dataQuality" TEXT NOT NULL DEFAULT 'REPORTED', "isTestData" BOOLEAN NOT NULL DEFAULT false, "fingerprint" TEXT NOT NULL,
 CONSTRAINT "TrackPoint_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TransportTask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TrackPoint_taskId_sourceSystem_sourceRecordId_key" ON "TrackPoint"("taskId", "sourceSystem", "sourceRecordId");
CREATE INDEX "TrackPoint_taskId_observedAt_idx" ON "TrackPoint"("taskId", "observedAt");
CREATE TABLE "TransportObservation" (
 "id" TEXT NOT NULL PRIMARY KEY, "taskId" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceSystem" TEXT NOT NULL, "sourceRecordId" TEXT NOT NULL,
 "eventType" TEXT NOT NULL, "nodeId" TEXT, "nodeName" TEXT NOT NULL, "observedAt" DATETIME NOT NULL, "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "payload" TEXT NOT NULL, "isTestData" BOOLEAN NOT NULL DEFAULT false, "fingerprint" TEXT NOT NULL,
 CONSTRAINT "TransportObservation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TransportTask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TransportObservation_taskId_sourceSystem_sourceRecordId_key" ON "TransportObservation"("taskId", "sourceSystem", "sourceRecordId");
CREATE INDEX "TransportObservation_taskId_observedAt_idx" ON "TransportObservation"("taskId", "observedAt");
CREATE TABLE "TrackingRule" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default', "staleMinutes" INTEGER NOT NULL DEFAULT 30, "stationaryMinutes" INTEGER NOT NULL DEFAULT 120,
 "stationaryMeters" INTEGER NOT NULL DEFAULT 200, "deviationMeters" INTEGER NOT NULL DEFAULT 3000, "nodeHours" INTEGER NOT NULL DEFAULT 24,
 "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" DATETIME NOT NULL
);
