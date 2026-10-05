INSERT INTO "Permission" ("id","code","name","module") VALUES
('p3-plan-solve','plan:solve','求解联运方案','联运方案'),
('p3-plan-select','plan:select','选择完整方案','联运方案'),
('p3-plan-maintain','plan:maintain','维护公共线路与价格','联运方案');
INSERT OR IGNORE INTO "RolePermission" ("roleId","permissionId") SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE
(r.code IN ('platform_admin','trader_admin','trader_member','carrier_admin','carrier_member') AND p.code IN ('plan:read','plan:solve')) OR
(r.code IN ('trader_admin','trader_member') AND p.code='plan:select') OR
(r.code='platform_admin' AND p.code='plan:maintain');
