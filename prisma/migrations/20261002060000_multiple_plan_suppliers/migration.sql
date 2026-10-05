CREATE TABLE "MatchRecipient" (
    "publicationId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "supplyId" TEXT,
    "supplyVersion" INTEGER,
    PRIMARY KEY ("publicationId", "carrierId"),
    CONSTRAINT "MatchRecipient_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "MatchPublication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchRecipient_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "BusinessEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MatchRecipient_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "TransportSupply" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "MatchRecipient_carrierId_publicationId_idx" ON "MatchRecipient"("carrierId", "publicationId");
INSERT INTO "MatchRecipient" ("publicationId", "carrierId", "supplyId", "supplyVersion")
SELECT p."id", p."targetCarrierId", p."supplyId", s."version"
FROM "MatchPublication" p LEFT JOIN "TransportSupply" s ON s."id" = p."supplyId"
WHERE p."mode" = 'DIRECTED' AND p."targetCarrierId" IS NOT NULL;
