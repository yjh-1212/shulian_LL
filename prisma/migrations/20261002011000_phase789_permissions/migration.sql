INSERT OR IGNORE INTO Permission (id,code,name,module) VALUES ('billing-write','billing:write','编制、核对与确认结算','对账结算'),('data-write','data:write','维护产品授权与外部态势','数据服务');
INSERT OR IGNORE INTO RolePermission (roleId,permissionId) SELECT r.id,p.id FROM Role r,Permission p WHERE (r.code IN ('trader_admin','carrier_admin') AND p.code='billing:write') OR (r.code='platform_admin' AND p.code='data:write');
CREATE INDEX IF NOT EXISTS "TransportTask_businessId_status_idx" ON "TransportTask"("businessId","status");
CREATE UNIQUE INDEX IF NOT EXISTS "RiskRecord_active_unique" ON "RiskRecord"("taskId","type") WHERE "status" IN ('NEW','ONGOING');
