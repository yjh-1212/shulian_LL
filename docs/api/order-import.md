# 交易订单导入

Phase 2 提供平台专属 `POST /api/trade-orders/import`。订单正文及明细一并创建；来源系统和来源记录号组成幂等键，重复内容返回原订单，冲突内容返回 409。不会覆盖已经被运输需求引用的事实。

1. 用平台账号读取 `/api/users/options` 中贸易主体 ID，以及 `/api/transport-options` 中粮食品种 ID。
2. 按下列结构准备 JSON 对象或对象数组。
3. 在本地终端设置 `IMPORT_USERNAME`、`IMPORT_PASSWORD`，执行 `node tools/import-orders.mjs orders.json`。密码通过环境变量提供，不写入导入文件。
4. 贸易企业在新建需求的订单选择窗口中查看导入结果。

```json
{
  "businessNo": "外部系统唯一交易订单号",
  "businessEntityId": "实际贸易主体ID",
  "recipient": "收货单位",
  "shipperContact": "发货联系人",
  "shipperPhone": "13800000001",
  "recipientContact": "收货联系人",
  "recipientPhone": "13800000002",
  "sourceSystem": "上游交易系统标识",
  "sourceRecordId": "上游记录ID",
  "items": [{"lineNo":"1","grainId":"实际品种ID","cargoName":"玉米","specification":"国标二等","quantity":500}]
}
```

数量单位为吨，最多三位小数。默认 API 地址 `http://127.0.0.1:3001/api`，可通过 `API_URL` 修改。批量工具按订单逐笔事务提交；失败后停止，已成功记录保留，修正后可幂等重跑。

开发运行环境导入的订单明确标记 `isTestData=true`。正式环境只接受有效生产贸易主体，禁止将开发样例通过更改标记伪装为生产数据。真实上游系统定时同步、凭证管理和更新协议仍需按实际接口实施。
