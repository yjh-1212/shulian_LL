# 北粮南运 · 智能多式联运物流数据系统

按 `doc/智能多式联运系统开发设计规范.md` 分阶段开发。当前已实现 **Phase 1 系统底座与顶部导航、Phase 2 交易订单与供需管理、Phase 3 联运方案与公共线路价格、Phase 4 供需匹配与承运确认、Phase 5 模拟合同签署与联运执行、Phase 6 全程可视化与运输数据归集、Phase 7 预测预警与智能助手、Phase 8 对账结算与授权数据服务、Phase 9 完整联调与部署准备**，并纳入 2026-10-01 更新的合同管理需求。完整需求与九阶段业务规划见 [需求映射](docs/architecture/requirements-map.md)，新版合同差异见 [合同更新](docs/architecture/contract-update.md)。

## 当前可以操作

- 平台、贸易企业、物流运营商真实账号登录、退出、刷新会话、修改密码。
- 平台用户管理：新增、搜索、分页、查看、编辑、停用、软删除、重置密码；新账号/重置账号强制修改密码。
- 数据库角色、权限、菜单。平台可调整六个基础角色的授权；API 每次请求重新读取权限。
- 主体维护、字典新增/编辑/启停、登录日志与操作日志。
- 白色顶栏、红色激活态、二级下拉菜单、ResizeObserver 自动“更多”收纳、面包屑。
- 角色工作台使用真实账号/主体/审计统计；智能助手支持上下文问踪、正式求解、单据识别及有依据的分析。
- 辽粮智运智能体中心：图片入口、独立聊天页面、六个业务智能体、地址与运输条件确认、真实联运推荐、分段地图、单据复核及本人历史对话；详见 [智能体中心](docs/architecture/agent-center.md)。
- SQLite、Prisma migration/seed、Swagger、统一异常与响应、服务端参数校验、企业数据范围限制。
- 交易订单及明细：平台幂等导入，贸易企业选择本企业订单生成运输需求。
- 运输需求：创建、编辑、详情、发布、撤回、取消、删除草稿；整数公斤占用、并发超量与版本冲突校验。
- 运输供给：创建、编辑、发布、暂停、失效和删除；外部企业仅查看有效已发布记录。
- 搜索、组合筛选、排序、分页、所选导出、详情深链、发布历史、业务审计、鉴权图片/PDF附件。

- 联运方案：手工输入或从需求带入、真实高德选点与道路路线、受约束的线路组合、候选比选、区段费用和时效汇总、版本记录、完整方案选择。
- 线路价格：平台维护节点、公共线路、有效期参考价格和铁路/水运路径几何；企业只读；价格快照、变更审计和乐观版本控制。

- 供需匹配：需求/供给大厅、粮食卡片与列表、组合筛选、完整需求/方案发布、供给反向定向匹配。
- 商务协同：整单报价、多轮还价/接受/拒绝/撤回、报价比选、承运确认/取消、按数量分配、并发防超量及审计。

**接入边界：** ETA 使用可验证路径、近期速度或本企业同区段历史；数据不足会停止精确推断。高德气象可查询，港口态势需登记带来源与有效期的数据；未配置 GPS/AIS/铁路供应商实时订阅。合同签章与司机端按用户要求采用电脑浏览器模拟。第三方电子签章与微信原生发布尚未接入。

## Phase 7–9

- 预测预警：当前区段 ETA、可信度、参考区间、延误、港口/环境影响、持续及恢复历史。
- 智能助手：继承当前用户权限和页面上下文，DeepSeek 分析、业务链接、AgentRun/Result 日志、故障降级。默认使用本地分析；发送至模型需页面明确勾选。2026-10-02 已用用户授权的模拟铁路任务完成真实联调。
- 单据：本地识别 PNG/JPEG、PDF 文本与 XLSX，保留原件、摘要和提取文本，人工复核结果独立留存。
- 对账：完成任务制单、合同/执行/费用比照、差异、新版本、双方确认、部分结算、异常记录、线下凭证与归档；履约页显示待结算金额。
- 数据服务：产品目录、版本、发布流程、主体授权、字段白名单、到期/撤销、独立订阅密钥、限额、调用日志和专题应用。测试运输业务排除在输出之外。
- 轨迹：详情最多返回最新2000点，并显示总量和窗口提示，可按时间查询历史；地图保留聚合、图层开关及断点回放。

详细设计见 [Phase 7–9 架构](docs/architecture/phase-7-9.md)，执行结果见 [验收报告](docs/acceptance/phase-7-9.md)，部署和备份见 [部署说明](docs/deployment.md)。

## 技术与目录

Vue 3 + TypeScript + Vite + Vue Router + Pinia + Element Plus + Axios；NestJS + Prisma 6 + SQLite。bcrypt 口令哈希，15 分钟 JWT Access Token，7 天 HttpOnly/SameSite=Strict Refresh Cookie，数据库存 Refresh Token 的 SHA-256 摘要。

```text
apps/web/                Vue PC 前端
apps/api/                NestJS API
prisma/schema.prisma     Phase 1–9 数据模型
prisma/migrations/       正式迁移记录
prisma/seed.ts           幂等开发样例初始化
tools/setup.mjs          创建本地环境与空 SQLite 文件
tests/                   可复用的真实浏览器验收脚本
docs/architecture/       业务、权限、导航、UI契约、合同更新
docs/api/openapi.json    API schema 快照
docs/acceptance/         测试结果与截图
doc/                     用户原始需求文档
Picture/                 用户原始布局与粮食素材
api_key/                 用户本地密钥，已忽略版本控制
```

## 安装与运行

已验证 Windows / Node **24.17.0** / npm **11.13.0**。要求 Node >=22.12。使用 npm workspaces，依赖锁在 `package-lock.json`；本项目未使用 pnpm lock。

```powershell
npm ci
npm run setup
npm run amap:configure
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- PC：<http://127.0.0.1:5173>
- API：<http://127.0.0.1:3001/api>
- Swagger：<http://127.0.0.1:3001/api/docs>

`setup` 不覆盖已有 `.env`。JWT Secret 使用随机字节生成。后端修改后需重启 `npm run dev`；Vite 页面支持热更新。

独立启动与构建：

```powershell
npm run build
npm run start -w @grain/api
npm run dev -w @grain/web
```

在受限沙箱中，Prisma/esbuild/浏览器子进程可能需要本地执行许可。普通终端直接使用上述命令即可。

## 开发账号

首次运行 `npm run setup` 会生成随机初始化密码，保存到本地 `.env` 的 `SEED_PASSWORD`。首次 seed 使用该值；再次 seed 不覆盖已有密码、权限和主体配置。

| 账号 | 角色 | 主体 |
| --- | --- | --- |
| `admin` | 平台管理员 | 平台开发样例 |
| `trader` / `trader.staff` | 贸易管理员 / 业务员 | 粮贸 A 开发样例 |
| `trader.b` | 贸易管理员 | 粮贸 B 开发样例 |
| `carrier` / `carrier.staff` | 物流管理员 / 调度员 | 物流 A 开发样例 |
| `carrier.b` | 物流管理员 | 物流 B 开发样例 |
| `driver` | 司机 | 物流 A；禁止进入 PC |

以上用户、主体均为 `isTestData=true`；没有用真实企业名称编造交易。开发环境新增用户/主体也标记为开发数据。`NODE_ENV=production` 禁止开发 seed，且开发样例账号无法登录。上线需单独创建生产主体、管理员并配置 HTTPS。

## 环境变量与外部服务

见 `.env.example`：`DATABASE_URL`、`JWT_SECRET`、`PORT`、`WEB_ORIGIN`、`NODE_ENV`、`SEED_PASSWORD`。`.env`、SQLite 文件、`api_key/` 不进入版本控制。

高德已接入。`npm run amap:configure` 从本地 `api_key/高德api.txt` 读取已有配置并写入 `.env`，不输出密钥。也可手动配置 `AMAP_JSAPI_KEY`、`AMAP_SECURITY_JS_CODE`、`AMAP_WEB_SERVICE_KEY`。只有公开 JSAPI Key 会发送给地图加载器；安全码经后端受会话保护的白名单代理注入，Web 服务 Key 仅由后端使用。大模型调用留待后续阶段，预留 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`。

粮食原图保留在 `Picture/`；玉米、大豆、小麦、稻谷已核对并复制到 `apps/web/public/assets/grain/`。业务上传照片优先展示，其他品种使用中性占位。方案使用真实高德底图和通用道路路线，尚未验证货车限行服务授权。六个港口/车站定位保留高德 POI 来源。GPS、实时 AIS 尚未接入；铁路/水运须由平台提供可核验线路资料，缺少几何时只展示节点。样例公路单价用于功能验收，不代表市场报价。

## 数据与权限

- 账号必须绑定有效主体；角色类型与主体类型一致；司机角色不能与 PC 角色混用。
- 平台管理同时校验 permission 和主体类型，给企业角色添加平台权限会被拒绝。
- `/api/workspace/entities` 由服务端注入企业范围，企业传其他主体 ID 返回 403。
- Access Token 绑定数据库会话。退出撤销当前会话，改密、重置、禁用撤销相关会话；旧 JWT 即使未过期也不可使用。
- 角色修改不会覆盖实体数据范围。平台管理员必须保留账号和权限维护能力。
- 写操作与审计日志在同一事务内；审计不保存明文密码或密码哈希。
- 当前管理页面不含商业确认动作；后续承运确认、合同签署、派车和结算必须保留业务主体确认门禁。

## 迁移与备份

```powershell
# 开发时变更 schema 后生成迁移
npx prisma migrate dev --name meaningful_change
# 部署时应用已存在迁移
npm run db:migrate
```

停止 API 后备份 `prisma/dev.db`、`.local/uploads/` 和 `.env`；恢复时停服务并恢复配套文件。不得删除现有数据库后用 seed 冒充迁移。后续迁移 PostgreSQL/MySQL 需要更换 Prisma datasource、生成新目标库迁移、导入并核对主键/关系/日期、重跑权限及事务验收；不直接复用 SQLite SQL。

交易订单已有平台专属导入接口与批量工具，见 [订单导入说明](docs/api/order-import.md)。正式上游定时同步协议尚未接入。线路/节点实施约束见 [Phase 3 说明](docs/architecture/phase-3.md)，验收见 [Phase 3 验收](docs/acceptance/phase-3.md)。开发样例不得改标签后当作生产事实。司机端按当前要求在 PC 浏览器中模拟，独立入口 `http://127.0.0.1:5174/`，可单独构建。

## 浏览器验收

先启动 API 和 Web。脚本默认用独立、可见的 Edge 窗口，不读取个人浏览器配置。

```powershell
npm run test:e2e
npm run test:accounts
npm run test:phase2
# 重启 API 后校验上一次 Phase2 验收数据
npm run test:phase2-restart
# 与上一套件间隔一分钟（登录限流）
npm run test:phase2-scope
# Phase3 功能、地图及价格维护
npm run test:phase3
# 重启 API 后核验上一次 Phase3 验收数据和缓存
npm run test:phase3-restart
npm run test:phase3-boundaries
# 独立新库，不修改日常开发数据库
npm run test:phase3-fresh-db
```

无 Edge 时安装 Playwright Chromium 并将脚本 channel 改为本机可用浏览器。CI 可设置 `PW_HEADLESS=true`。重复运行会产生带“验收”名称的开发记录与审计记录，账号验收在结束时软删除专用测试用户。登录接口有速率限制，两个套件连续密集运行可能需等待一分钟。

Phase 2 业务规则见 [实施契约](docs/architecture/phase-2.md)，功能与测试结果见 [Phase 2 验收](docs/acceptance/phase-2.md)。区域选择使用明确标注版本的2019参考区划，上线前需更新核对。

测试结果：[导航与权限](docs/acceptance/e2e-results.json)、[账号安全](docs/acceptance/account-results.json)、[重启持久化](docs/acceptance/restart-persistence.json)。截图覆盖 1920、1440、1280、390px。

## 后续开发

需求带入与公开班线补充已完成，见 [验收说明与资料出处](docs/acceptance/public-services.md)。现有9个高德定位节点、X8784/3铁路班列及IC9/IC15水运产品参考。开发访问使用 `http://127.0.0.1:5173`；`localhost` 页面请求会自动跳转。公开班线可形成待报价的联运候选，实际班期、运力与粮食装载条件须确认。运行 `npx tsx tools/import-public-services.ts` 可在已有库幂等导入，先执行 `npm run db:migrate` 与 `npm run db:generate`。

后续阶段为 Phase7 AI 预测与预警、Phase8 对账与数据服务、Phase9 完整联调。电子签章和司机端按用户要求采用浏览器模拟；真实签章服务商、微信发布及 GPS/AIS/铁路实时订阅未接入。

## Phase 4 使用与验收

入口：[供需匹配大厅](http://127.0.0.1:5173/matches)。贸易企业从需求发布、已选完整方案发布，或供给卡片反向匹配。物流报价后，双方协商并接受当前条款，最后由贸易企业确认承运。需求页同步展示已落实吨数与匹配进度。

- 公开竞价的报价仅相关物流商、发布贸易方和平台可见；定向业务仅指定双方及平台可见。
- 完整方案整体承接。运输需求可开启按数量分配；总确认数量不得超过需求数量。
- 取消确认保留历史并释放已落实数量；关闭后可重新发布剩余需求。报价截止后不可确认。
- 正式匹配需关联本企业订单生成的需求；手工求解未关联需求时仅供比选。
- 旧发布在升级时补齐可用资料并标记历史来源。API 升级后请刷新页面加载菜单权限。

```powershell
npm run test:phase4
node tests/phase4-install.cjs
```

[Phase 4 实施契约](docs/architecture/phase-4.md) · [Phase 4 验收记录](docs/acceptance/phase-4.md)。精确地址匹配按当前要求暂缓；合同与执行任务现已进入 Phase 5 模拟流程。


## Phase 5 使用与验收

- 贸易方：供需匹配的承运确认 → 合同签署 → 生成合同包 → 提交承运方确认。
- 承运方确认正文后，双方分别模拟签署主合同与附加合同。模式 B 还需要平台签署附加合同。
- 生效合同 → 建立联运业务 → 车辆与司机 → 分配区段任务。公路由司机反馈，铁路和水运由承运方在 PC 反馈。
- [司机电脑模拟端](http://127.0.0.1:5174/)：使用 `driver` 账号及已有开发密码。可与 PC 登录同时使用，不需要微信 AppID。
- 散改集业务支持批次、多车到货、来源重量分配、多箱及船舶航次，并可在派单时关联批次和箱号。
- 合同变更重新签署，原文和签署摘要保留；履约页面显示末段交付、异常和到期提示；档案导出包含单据索引。

```powershell
npm run test:phase5
```

[Phase 5 实施说明](docs/architecture/phase-5.md) · [Phase 5 验收记录](docs/acceptance/phase-5.md)。


司机模拟端采用独立手机式页面，开发启动 `npm run dev:driver`，网址 `http://127.0.0.1:5174/`。`npm run dev` 同时启动 API、PC 管理端与司机端；`npm run build:driver` 单独输出 `apps/web/dist-driver/driver.html`，完整 Web 构建也包含独立的 `driver.html` 入口。原开发地址 `/driver` 自动跳转到司机网址。底部导航为任务、单据、我的，消息展示新任务与异常处理记录。


## Phase 6 使用与验收

入口：[运行总览](http://127.0.0.1:5173/tracking/overview)、[全程跟踪](http://127.0.0.1:5173/tracking/journeys)、[预测预警](http://127.0.0.1:5173/tracking/alerts)、[专题视图](http://127.0.0.1:5173/tracking/themes)。从左侧任务或地图位置打开详情，在联运衔接中切换区段；下方查看采集轨迹回放、物流时间轴及任务单据。

关联承运商在任务详情选择“接入运输数据”，粘贴定位批次、铁路事件或 EPCIS 子集 JSON。请填写带时区的采集时间和来源记录编号。未接入供应商时不会虚构实时定位或 ETA。开发环境“包含测试样本”开关控制验收数据展示。

实现说明：[Phase 6 架构](docs/architecture/phase-6.md)。验证结果与当前范围：[Phase 6 验收](docs/acceptance/phase-6.md)。运行 `npm run test:phase6` 验证完整接入流程，重启 API 后运行 `node tests/phase6-boundaries.cjs` 检查持久化与监测边界。
