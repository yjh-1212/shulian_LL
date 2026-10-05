ALTER TABLE DataAuthorization ADD COLUMN constraints TEXT NOT NULL DEFAULT '{}';
ALTER TABLE DataAuthorization ADD COLUMN dailyLimit INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE DataAuthorization ADD COLUMN requestId TEXT;
CREATE UNIQUE INDEX DataAuthorization_requestId_key ON DataAuthorization(requestId);
ALTER TABLE DataCall ADD COLUMN parameters TEXT NOT NULL DEFAULT '{}';
CREATE TABLE DataAccessRequest (
 id TEXT NOT NULL PRIMARY KEY, productId TEXT NOT NULL, productVersion INTEGER NOT NULL,
 entityId TEXT NOT NULL, userId TEXT NOT NULL, department TEXT NOT NULL, applicationName TEXT NOT NULL,
 scenarios TEXT NOT NULL, purpose TEXT NOT NULL, edition TEXT NOT NULL, scope TEXT NOT NULL,
 constraints TEXT NOT NULL, startsAt DATETIME NOT NULL, expiresAt DATETIME NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING', version INTEGER NOT NULL DEFAULT 1, reviewNote TEXT NOT NULL DEFAULT '',
 reviewedBy TEXT, reviewedAt DATETIME, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT DataAccessRequest_productId_fkey FOREIGN KEY(productId) REFERENCES DataProduct(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX DataAccessRequest_entityId_status_createdAt_idx ON DataAccessRequest(entityId,status,createdAt);
INSERT OR IGNORE INTO Permission(id,code,name,module) VALUES ('data-subscribe','data:subscribe','申请授权与管理本企业订阅','数据服务');
INSERT OR IGNORE INTO RolePermission(roleId,permissionId) SELECT r.id,p.id FROM Role r,Permission p WHERE r.entityType IN ('TRADER','CARRIER','PLATFORM') AND r.code!='driver' AND p.code IN ('data:read','data:subscribe');
UPDATE Menu SET enabled=0 WHERE parentId='data';
