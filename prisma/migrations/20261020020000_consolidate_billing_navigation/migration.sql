UPDATE "Menu" SET "enabled" = false WHERE "path" = '/billing/reconciliations';
UPDATE "Menu" SET "displayOrder" = 1 WHERE "path" = '/billing/settlements';
