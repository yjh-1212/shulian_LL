CREATE TABLE IF NOT EXISTS "CockpitAppearance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "payload" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);
