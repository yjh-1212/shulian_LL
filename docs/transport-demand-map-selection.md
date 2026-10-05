# 运输需求地图选址

新建和编辑运输需求的起运、目的详细地址复用求解页的地图选址组件。可以搜索地点、选择已核验港口或场站，也可以点击地图确认位置，并补充仓库、场站出入口等详细地址。

- 订单带入地址仍保留，尚无坐标时需要在地图确认。取消选址不会改写已填写信息。
- 保存地址时同步保存 GCJ-02 坐标、地区和节点信息。再次编辑和进入求解时直接带入确认结果。
- 手动修改地址后清除旧坐标，避免以新地址配旧位置；既有接口未传坐标时兼容原地址流程。
- 既有需求未变更，新增两个可空字段。迁移前备份：`.local/backups/demand-map-locations-20261004`。
- 地图在弹窗打开时创建，关闭后销毁。搜索和地图地址解析只接受当前弹窗的最新结果。
- 选址接口允许求解读取或运输需求编辑权限；地图底图会话仍校验用户、企业、登录会话和权限。位置解析遵循[高德逆地理编码接口](https://lbs.amap.com/api/webservice/guide/api/georegeo/)，服务端使用 Web 服务凭据。

## 验证

- `npm run build -w @grain/api`
- `npm run build -w @grain/web`
- `node tests/demand-map-location.cjs`：SQLite 副本验证坐标保存、编辑清理、求解带入、节点校验和权限。
- `node tests/demand-optional-order.cjs`：订单可选及余量回归。
- `node tests/transport-demand-records.cjs`：只读验证原有数据和十条未转换订单。
- 浏览器截图与检查记录保存在 `docs/acceptance/demand-map-*`。
