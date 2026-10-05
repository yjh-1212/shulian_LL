# Phase 2 验收记录

日期：2026-10-01。范围依据开发设计规范 Phase 2，以及供需管理需求说明。

## 已交付

- TradeOrder / TradeOrderItem、TransportDemand、TransportSupply、需求发布记录及附件模型；升级迁移保留 Phase 1 数据。
- 需求列表、新建、详情、编辑。新建从本企业有效交易订单明细选择，带入粮食品种、规格、联系人与余量。
- 草稿即占用数量，编辑按差额调整，撤回保留占用，取消/草稿删除释放。数据库整数公斤与事务约束防止并发超量。
- 需求公开/定向发布、响应截止、报价口径、信息公开设置和发布历史。同一需求仅有一个有效发布记录。
- 物流方供给 CRUD、发布/暂停/终止有效期；定时及请求时判定到期，外部查询只返回当前有效发布。
- 企业范围、只读平台、操作权限和版本冲突校验。附件私有存储，下载重新校验所属业务权限。
- 四种用户提供的粮食示意图；照片优先、品种默认图其次、其他品种中性占位。
- 独立需求/供给路由，红白顶部导航；查询与新增工具栏分开，分页、排序、所选导出、错误重试、未保存保护、详情深链。
- 平台交易订单导入 API、批量导入工具及来源追溯。

## 运行与证据

本地 NestJS API + SQLite + Vite 页面；浏览器使用独立可见 Edge，无个人浏览器资料。

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| TypeScript / Vue 校验与生产构建 | 通过 | `npm run build`；Vite 提示主包体积约 1.12MB，后续可按路由拆分 |
| 真实业务与浏览器流程 10 组 | 通过 | [phase2-results.json](phase2-results.json) |
| 定向访问、字段隐私、撤回收权、公开设置、导入权限及幂等 4 组 | 通过 | [phase2-scope.json](phase2-scope.json) |
| 中文附件上传下载、照片优先及未保存保护 3 组 | 通过 | [phase2-files-ui.json](phase2-files-ui.json) |
| API 进程重启后保留需求、供给、发布记录、占用及审计 | 通过 | [phase2-restart.json](phase2-restart.json) |
| 独立空库执行3个迁移，连续2次 seed，初始账号/订单/权限无重复 | 通过 | [phase2-clean-install.json](phase2-clean-install.json) |
| Phase 1 导航、角色、用户主体、日志、会话与移动工作台 20 组回归 | 通过 | [e2e-results.json](e2e-results.json) |
| 依赖审计 | 当前报告 0 项 | [phase2-dependency-audit.json](phase2-dependency-audit.json) |

业务测试包含：贸易/物流/平台越权；其他企业订单与记录访问；重复发布；三位小数数量；超量拒绝；同一1吨订单两笔0.75吨并发只一笔成功；草稿删除释放；供给暂停和自动到期；附件伪造类型拒绝、私有文档拒绝外部下载、公开照片下载；组合筛选不会覆盖关键词。

定向访问验收临时向开发物流角色授予需求读取权限，以验证 Phase 4 大厅将使用的范围限制，随后恢复原授权。默认物流角色仍只开放供给维护菜单。

截图已人工检查：

- [需求列表 1440px](phase2-demand-1440.png)、[需求列表 1280px](phase2-demand-1280.png)
- [需求表单](phase2-demand-form.png)、[需求详情](phase2-demand-detail.png)
- [供给详情](phase2-supply-detail.png)

## 数据与边界

- 当前数据库中的交易订单、验收供需记录明确标记为开发样例。重复验收会保留可追溯的开发业务记录。
- 区划为 `china-area-data 5.0.1` 的2019参考数据；正式部署前应核对更新。服务器验证省市区层级，未调用高德路线或大模型。
- 附件位于 `.local/uploads/`；备份时需与数据库一并保留。移除为软删除，便于追溯；对象存储及长期保留策略尚未接入。
- 上游交易系统自动同步尚未接入，平台可按来源标识导入订单，见 [导入说明](../api/order-import.md)。
- 本阶段完成发布数据与状态规则；报价、议价、匹配成交在 Phase 4。联运求解和真实地图从 Phase 3 开始。新版合同需求仍按 Phase 5 实施。

复验：启动服务后执行 `npm run test:phase2`；重启 API 再执行 `npm run test:phase2-restart`。`npm run test:phase2-scope` 验证定向隐私，`npm run test:phase2-files` 验证附件和未保存保护。不同套件之间间隔一分钟，以免开发账号登录触发真实限流。
