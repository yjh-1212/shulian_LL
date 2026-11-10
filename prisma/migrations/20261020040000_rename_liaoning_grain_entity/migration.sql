UPDATE "BusinessEntity"
SET "name" = '辽宁省粮食发展集团有限责任公司',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = '沈阳丰谷粮食贸易有限公司';

UPDATE "Bill"
SET "reference" = json_set("reference", '$.snapshot.trader.name', '辽宁省粮食发展集团有限责任公司')
WHERE "traderId" IN (SELECT "id" FROM "BusinessEntity" WHERE "name" = '辽宁省粮食发展集团有限责任公司')
  AND json_extract("reference", '$.snapshot.trader.name') = '沈阳丰谷粮食贸易有限公司';
