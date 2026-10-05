ALTER TABLE "TransportStage" ADD COLUMN "vesselId" TEXT;
ALTER TABLE "TransportStage" ADD COLUMN "mmsi" TEXT NOT NULL DEFAULT '';
CREATE TABLE "VesselArchive" (
 "id" TEXT NOT NULL PRIMARY KEY, "carrierId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "voyage" TEXT NOT NULL, "mmsi" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "VesselArchive_carrierId_name_voyage_key" ON "VesselArchive"("carrierId","name","voyage");
CREATE INDEX "VesselArchive_mmsi_idx" ON "VesselArchive"("mmsi");
