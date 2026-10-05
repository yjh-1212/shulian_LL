-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlanRun" (
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
    "isTestData" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PlanRun_businessEntityId_fkey" FOREIGN KEY ("businessEntityId") REFERENCES "BusinessEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanRun_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "TransportDemand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlanRun" ("businessEntityId", "businessNo", "createdAt", "createdBy", "demandId", "demandVersion", "groupId", "id", "input", "isTestData", "revision", "selectedPlanId", "status", "version", "warnings") SELECT "businessEntityId", "businessNo", "createdAt", "createdBy", "demandId", "demandVersion", "groupId", "id", "input", "isTestData", "revision", "selectedPlanId", "status", "version", "warnings" FROM "PlanRun";
DROP TABLE "PlanRun";
ALTER TABLE "new_PlanRun" RENAME TO "PlanRun";
CREATE UNIQUE INDEX "PlanRun_businessNo_key" ON "PlanRun"("businessNo");
CREATE INDEX "PlanRun_businessEntityId_createdAt_idx" ON "PlanRun"("businessEntityId", "createdAt");
CREATE UNIQUE INDEX "PlanRun_groupId_version_key" ON "PlanRun"("groupId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
