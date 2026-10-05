-- Preserve existing demands; confirmed GCJ-02 points are stored independently of address text.
ALTER TABLE "TransportDemand" ADD COLUMN "originPoint" TEXT;
ALTER TABLE "TransportDemand" ADD COLUMN "destinationPoint" TEXT;
