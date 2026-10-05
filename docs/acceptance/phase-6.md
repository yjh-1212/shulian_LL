# Phase 6 验收

## 交付

- 运行总览、全程跟踪、预测预警与公路/铁路/水运专题视图已开放。
- 高德在线地图支持位置选择、节点详情、计划与采集图层、模式筛选、地图适配、区段联动及轨迹回放。
- 合同、需求、原始方案（存在时）、联运执行可从跟踪任务穿透。浏览器刷新恢复 taskId。
- GPS/AIS/历史 AIS 批次、铁路节点和 EPCIS ObjectEvent 子集持久化归集。关联承运商可通过页面粘贴 JSON 接入。
- 采集与接入时间分开记录；WGS84 由高德转换为 GCJ-02；旧司机坐标不作为已转换轨迹使用。
- 来源编号防重复，不同内容不能覆盖，定位批次冲突整体回滚。JSON 字段顺序变化不视为内容变化。
- 司机位置反馈与执行事件同一事务归集，PC / 司机令牌继续隔离。铁路/EPCIS 观测保留来源，不绕过任务执行的数量、单据、节点顺序约束。
- 缺定位、定位过期、约定到达超期、作业节点超时、停留、参考路线偏离和执行异常提供基础监测。平台阈值维护支持版本冲突校验。
- 默认接口排除测试业务，开发页面显式提供测试开关，生产强制排除测试记录。

## 检查结果

| 检查 | 结果 / 证据 |
| --- | --- |
| API / Web 完整构建 | `npm run build` 通过；保留现有 Element Plus 公共包体积提示 |
| 8 组 API 流程 | [phase6-api.json](phase6-api.json) |
| 10 组浏览器检查 | [phase6-browser.json](phase6-browser.json)，JavaScript errors 为空 |
| 重启持久化及 5 组边界 | [phase6-boundaries.json](phase6-boundaries.json) |
| 12 个迁移、新库与重复初始化 | [phase6-install.json](phase6-install.json) |
| 接入与监测接口文档 | [OpenAPI](../api/openapi.json)，版本 0.6.0 |

浏览器使用真实 Edge 和在线高德底图，验证节点弹层、图层开关、播放/暂停/复位、公路/铁路/水运链路切换、合同与执行跳转、预警穿透、专题筛选、测试开关、故障恢复、390px 布局、承运商 JSON 接入与错误提示。截图见 [全程跟踪](phase6-tracking-1440.png)、[铁路](phase6-rail.png)、[水运](phase6-water.png)、[专题](phase6-themes.png)、[窄屏](phase6-tracking-390.png)。

修复了节点被车辆标记遮挡、刷新累积回放标记的问题。地图使用平面视图并等待底图 complete 后绘制图层；最终浏览器套件没有再次出现初次加载时的投影错误。

## 数据与范围说明

- 验收业务、司机和定位均为测试样本，页面明确标注。验证数据在数据库中持久化，不是前端写死的轨迹。
- AIS 的历史记录不会覆盖当前定位；过期 AIS 显示采集时间与定位过期，未接入 AIS 时显示暂无船舶定位。
- 缺铁路或水运几何只展示节点；没有使用高德道路冒充铁路，也没有画起终点直线作为公路路径。
- 目前建立了正式鉴权 ingest 接口，第三方供应商适配与订阅需接入协议及账号，不宣称已连接实时 GPS/AIS/铁路系统。
- EPCIS 仅实现已列明的 ObjectEvent / OBSERVE 归集子集。
- 本阶段不输出精确 ETA。ETA 模型、环境风险、港口拥堵及预测记录在 Phase 7 实现。
- 当前任务列表在服务端范围内聚合后分页；高量业务需要数据库聚合与异步风险计算。运行列表的停留评估使用每任务最近 500 个采集点，轨迹详情可通过时间区间查询；高频设备接入后应扩展轨迹归档、采样及评估窗口，避免把缺少历史样本误当成没有停留风险。

## 复验

```powershell
npm run build
npm run test:phase6
# 重启 API 后检查上一次验收数据；套件间留出登录限流窗口
node tests/phase6-boundaries.cjs
node tests/phase6-install.cjs
```

Playwright 脚本位于系统临时目录 `playwright-test-phase6.js`，通过项目内 playwright-skill/run.js 执行。重复 API 验收会建立新的独立测试业务；默认生产范围不会包含它们。
