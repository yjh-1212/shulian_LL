INSERT INTO "Permission" ("id","code","name","module") VALUES
('p2-demand-write','demand:write','维护运输需求','运输需求'),
('p2-demand-publish','demand:publish','发布运输需求','运输需求'),
('p2-supply-write','supply:write','维护运输供给','运输供给'),
('p2-supply-publish','supply:publish','发布运输供给','运输供给'),
('p2-orders-read','trade-orders:read','查看交易订单','交易订单'),
('p2-orders-import','trade-orders:import','导入交易订单','交易订单');
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE
(r.code IN ('trader_admin','trader_member') AND p.code IN ('demand:write','demand:publish','trade-orders:read')) OR
(r.code IN ('carrier_admin','carrier_member') AND p.code IN ('supply:write','supply:publish')) OR
(r.code='platform_admin' AND p.code IN ('trade-orders:read','trade-orders:import'));
