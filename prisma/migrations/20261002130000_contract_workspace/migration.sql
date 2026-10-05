ALTER TABLE "ContractTemplate" ADD COLUMN "fileId" TEXT REFERENCES "ContractTemplateFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractSignature" ADD COLUMN "sealName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContractSignature" ADD COLUMN "placement" TEXT NOT NULL DEFAULT '{}';
CREATE TABLE "ContractTemplateFile" (
 "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "mime" TEXT NOT NULL,
 "size" INTEGER NOT NULL, "digest" TEXT NOT NULL, "bytes" BLOB NOT NULL,
 "previewText" TEXT NOT NULL DEFAULT '', "createdBy" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ContractArchive" (
 "id" TEXT NOT NULL PRIMARY KEY, "packageId" TEXT NOT NULL, "entityId" TEXT NOT NULL,
 "revisionId" TEXT NOT NULL, "digest" TEXT NOT NULL, "directoryNo" TEXT NOT NULL,
 "dossierNo" TEXT NOT NULL, "classification" TEXT NOT NULL, "name" TEXT NOT NULL,
 "retention" TEXT NOT NULL, "archiveDate" DATETIME NOT NULL,
 "archivedBy" TEXT NOT NULL, "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "snapshot" TEXT NOT NULL,
 CONSTRAINT "ContractArchive_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ContractPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ContractArchive_packageId_entityId_key" ON "ContractArchive"("packageId", "entityId");
CREATE INDEX "ContractArchive_entityId_archiveDate_idx" ON "ContractArchive"("entityId", "archiveDate");
