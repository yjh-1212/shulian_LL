# Phase 7–9 验收报告

验收日期：2026-10-02（Asia/Shanghai）。本项目开发环境，Node24.17.0，Vue3 / NestJS / Prisma6 / SQLite。签章、运输反馈与线下付款凭证均为明确标注的模拟验收，不发生实际签署或支付。

## 结果

| 范围 | 结果与证据 |
|---|---|
| Phase7 API：7组 | 智能上下文企业隔离、角色令牌隔离、实际到达/缺数据降级、港口有效期、环境节点影响、OCR/PDF/XLSX原文及人工复核：[报告](phase7-api.json) |
| 预测边界：4组 | 真实公开高德几何与模拟速度样本、区间、后续区段限制、过期/偏离停算、模型故障降级、企业缓存隔离：[报告](phase7-forecast.json) |
| DeepSeek真实联调 | 用户明确授权模拟铁路任务摘要外发后调用成功，DEEPSEEK/SUCCEEDED；默认页面仍使用本地分析：[报告](phase7-deepseek.json) |
| Phase8 API：7组 | 重复制单锁定、版本、平台只读、部分结算、异常、凭证、密钥轮换、字段授权、限额、到期/撤销、产品新版本：[报告](phase8-api.json) |
| 全链路：6组 | 从需求带入，经智能体正式求解入口、公开竞价/议价、模拟合同生效、公路—铁路—公路逐段执行，到差异、新版本、结算归档；52条关联审计：[报告](phase9-chain.json) |
| 安全与大轨迹：5组 | 匿名/跨主体/司机令牌/CSRF阻断、8MB上传边界、伪文件、AI失败留痕、5011个轨迹窗口：[报告](phase9-security.json) |
| 真实Edge浏览器：10组 | 新建账单起连续完成差异、新版本、双方确认、凭证、归档、刷新，问踪上下文及链接、单据识别人工确认、数据目录登记、网络错误恢复、5174司机390px、轨迹回放。JavaScript异常0：[报告](phase789-browser.json) |
| 地图压力交互 | 浏览器拦截注入明确标记的120项模拟地图任务，聚合为8个地图标记，图层切换与2000点回放可操作，JavaScript异常0；不写入真实业务：[报告](phase9-map.json) |
| 新库与重复seed：6项 | 14个正式迁移、重复初始化、角色、空业务/任务、司机会话隔离及默认阈值：[报告](phase9-install.json) |
| 正式初始化 | 独立新库仅1个正式管理员，0开发账号/运输业务，强制初次改密，重复执行不重置：[报告](phase9-production-init.json) |
| 备份恢复 | VACUUM一致快照、SHA256校验、新文件恢复、账单和识别单据读取：[报告](phase9-backup.json) |
| 最终重启：2项 | 归档账单、5个历史版本、原凭证/提取文本仍可读取，企业预测缓存与实际到达正确：[报告](phase9-restart.json) |

以上为51项/组持久化验收记录。另有 Phase6 边界回归5组通过；API、PC和独立司机构建均通过。生产依赖 `npm audit --omit=dev` 为0漏洞。角色业务数据写入SQLite并在刷新及API重启后核验。

## 性能和界面

5011个真实写入测试任务的采集点，详情最大返回最新2000点并标记截断，总量保持可见；五次查询耗时83/104/106/109/110毫秒（原始顺序见JSON），响应约1.04MB。历史时间范围可查询。120项地图压力数据是独立浏览器模拟夹具，实测从导航到图层和回放操作约1855毫秒；原始数据和公网网络情况会影响耗时。

截图：

- [费用核对与归档](phase8-billing-browser.png)
- [跟踪、ETA与问踪入口](phase7-tracking-browser.png)
- [数据产品目录](phase8-data-browser.png)
- [独立司机站点](phase9-driver-browser.png)
- [地图聚合测试](phase9-map-load.png)

保持原白色顶部布局、红色激活态和既有紧凑表格风格。已在真实Edge（桌面和390px）执行Playwright；Codex内置浏览器另行检查对账详情布局。Chrome/Firefox/Safari未在本机执行专项兼容验收。

## 运行与复验

```powershell
npm run test:phase7
npm run test:phase7-forecast
npm run test:phase8
$env:PHASE9_AGENT='true'
npm run test:phase9
npm run test:phase9-security
npm run test:phase9-install
npm run test:phase9-production
npm run test:phase789-browser
npm run test:phase9-map
```

需要已运行API、PC5173、独立司机5174及SEED_PASSWORD。全链脚本先执行生成任务夹具；制单和浏览器脚本使用尚未结算的已完成任务。测试样本保留在开发库，查询默认有明确样本开关。单元解析/预测测试不向外部模型发送业务数据；`npm run test:deepseek`会发送指定模拟任务摘要，需沿用明确授权范围。登录保护为每分钟8次，连续重复执行多套脚本时应错开登录窗口。

## 部署准备与实际边界

Dockerfile、Compose、双站点Nginx、健康检查、正式初始化、迁移、备份/恢复及README已提供：[部署说明](../deployment.md)。本机无Docker，容器构建与HTTPS上线尚未实测，需在目标主机完成验收。Vite公共Element Plus包仍约1.02MB（gzip约337KB），构建会提示体积警告；业务页面已路由分包。

当前没有运营商实时GPS/AIS/铁路事件订阅和实时港口拥堵数据源。系统支持数据接入、来源/时间/有效期管理和高德天气查询；测试预警标为模拟，缺少可靠事实时显示需人工确认。OCR支持图片、文本层PDF与XLSX；扫描PDF没有文本层时提示转换图片或人工补录。用户要求的签章和司机端继续使用电脑浏览器模拟。
