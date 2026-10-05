ALTER TABLE "MatchRecipient" ADD COLUMN "invitedBy" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MatchRecipient" ADD COLUMN "invitedAt" DATETIME;
UPDATE "MatchRecipient" SET "invitedBy" = (SELECT "createdBy" FROM "MatchPublication" WHERE "id" = "publicationId"), "invitedAt" = (SELECT "createdAt" FROM "MatchPublication" WHERE "id" = "publicationId");
ALTER TABLE "MatchResponse" ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT '';
UPDATE "MatchResponse" SET "createdBy" = COALESCE((SELECT "authorId" FROM "NegotiationRound" WHERE "responseId" = "MatchResponse"."id" AND "action" = 'OFFER' ORDER BY "round" ASC LIMIT 1), 'LEGACY:' || "carrierId");
DROP INDEX "MatchResponse_publicationId_carrierId_key";
CREATE UNIQUE INDEX "MatchResponse_publicationId_createdBy_key" ON "MatchResponse"("publicationId", "createdBy");
