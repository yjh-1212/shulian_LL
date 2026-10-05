# 部署、迁移和备份

## 本地开发

Node >=22.12，已验证24.17.0。首次安装：`npm ci`、`npm run setup`、`npm run amap:configure`、`npm run llm:configure`、`npm run db:generate`、`npm run db:migrate`、`npm run db:seed`、`node tools/fetch-ocr.mjs`、`npm run dev`。密钥保存在本地.env，禁止提交。PC5173、司机5174、API3001。开发seed禁止在production运行。

## Node.js 服务器部署

PC 网页、司机端和 API 可由一个 Node.js 进程提供服务。默认监听 `0.0.0.0:8080`，同时支持本机、局域网和服务器 IP 访问。

在项目根目录执行：

```sh
npm ci --include=dev
npm run server:setup
npm run db:generate
npm run build
```

`server:setup` 生成私有配置 `.env.server`，自动生成 JWT 密钥和新库管理员初始密码。如果本机已有 `.env`，会复制数据库地址、高德、DeepSeek 和固定账号密码配置；再次执行保留已有文件。实际密钥仍需私下转移，不进入 GitHub。

编辑 `.env.server`：

| 配置 | 填写方式 |
| --- | --- |
| `API_HOST` | `0.0.0.0`，本机和服务器都能访问 |
| `PORT` | 默认 `8080`，可改为服务器开放的端口 |
| `DATABASE_URL` | SQLite 文件地址；相对路径以 `prisma/` 为基准，例如 `file:./server.db` |
| `JWT_SECRET` | 安装脚本已随机生成 |
| 高德三项 / `DEEPSEEK_API_KEY` | 填入对应服务密钥，并在高德控制台配置实际访问域名 |
| `WEB_ORIGIN` / `DRIVER_ORIGIN` | 同端口访问可留空；分开部署时填写完整访问地址 |
| `CORS_ORIGINS` | 额外允许的访问来源，多个地址用逗号分隔 |
| `COOKIE_SECURE` | 默认 `auto`，直接 HTTP 和经可信代理的 HTTPS 都支持登录刷新 |
| `TRUST_PROXY` | 默认 `loopback`，适用于同机 Nginx；独立代理填写实际代理 IP 或网段 |

### 保留现有账号、合同和运单

GitHub 包含源码和初始化工具，现有业务数据库需单独迁移。先在原机器执行 `npm run backup -- .local/server-backup`，将备份私下复制到服务器，再使用下方“备份恢复”中的恢复命令创建新数据库文件，调整 `.env.server` 的 `DATABASE_URL` 指向它。这样 `admin`、`trader`、`carrier` 及密码、合同、运单会一起保留。服务启动会执行已有迁移，不覆盖业务记录。

需要重新设置这三个账号时，在 `.env.server` 填写 `FIXED_ACCOUNT_PASSWORD` 后执行 `npm run server:accounts`。不要用开发 seed 覆盖已经迁移的数据库。

### 全新数据库与启动

全新数据库先执行 `npm run server:init`。此命令创建正式平台管理员，账号和初始密码位于 `.env.server` 的 `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD`，首次登录修改密码。已有业务数据库直接启动。

```sh
npm run server:start
```

- 门户：`http://服务器IP:8080/`
- 工作台：`http://服务器IP:8080/workbench`
- 司机端：`http://服务器IP:8080/driver`
- 健康检查：`http://服务器IP:8080/api/health`
- 同机访问：`http://127.0.0.1:8080/`

将服务器防火墙/安全组的端口规则与 `PORT` 对应。Node 项目管理面板的启动命令填 `npm run server:start`，工作目录填项目根目录。配置文件也可用 `ENV_FILE` 指定。`server:init` 与 `server:start` 使用同一份服务器配置。

Linux 需要开机启动时可使用 `deploy/liaoliang.service`：先调整项目路径和 Node 路径，再交给 systemd 管理。需要域名和 HTTPS 时使用 `deploy/nginx.node.conf` 的反向代理配置，并在实际 HTTPS 站点设置中添加证书。该配置转发 Host 和协议，网页刷新、司机端和地图代理都使用同一地址。

服务器改动不影响本地开发：继续执行 `npm run dev`，PC 为 `http://127.0.0.1:5173/`，司机端为 `http://127.0.0.1:5174/`。开发服务同样支持局域网 IP；使用开发域名时，在 `.env` 的 `WEB_ALLOWED_HOSTS` 填写允许的域名。新增配置在服务重启后生效。

参考：[NestJS CORS](https://docs.nestjs.com/security/cors)、[Express 可信代理](https://expressjs.com/en/guide/behind-proxies/)、[Vite 监听配置](https://vite.dev/config/server-options)。

## Docker部署准备

1. 在目标主机安装Docker及Compose。复制 `deploy/env.production.example` 为根目录 `.env.production`，填写随机JWT_SECRET、两个HTTPS域名和服务密钥；域名加入高德许可。不要复用开发默认密码。
2. `docker compose build`；`docker compose up -d`。API仅在容器网络暴露；PC与司机入口默认绑定本机8080/8081，由可信HTTPS反向代理分别接入。生产刷新Cookie带Secure，需要HTTPS。
3. 第一次初始化新库：将BOOTSTRAP_PLATFORM_NAME、BOOTSTRAP_ADMIN_USERNAME、BOOTSTRAP_ADMIN_PASSWORD作为临时环境变量注入容器，执行 `npx tsx prisma/bootstrap-production.ts`。密码至少14位。只创建正式平台与管理员，首次登录改密；重复执行保留原密码与权限。不要运行开发seed，不要把开发数据库当生产库。
4. 登录平台后维护正式主体、用户、合同模板、粮食品种、节点、线路、价格及来源有效期。确认公共参考线路后再用于正式调度。签章与司机端仍为本项目模拟功能。
5. 公网两个站点的司机入口链接在构建前通过 `VITE_DRIVER_URL` 设置；默认Docker本机入口8081。`WEB_ORIGIN`/`DRIVER_ORIGIN`为实际域名；API_HOST为0.0.0.0。API健康检查 `/api/health`，Swagger `/api/docs`。
6. 验证登录、刷新Cookie、上传8MB、地图代理、DeepSeek故障降级及独立司机页面，再安排上线。SQLite单API写入实例，禁止多个副本共享文件；规模扩大应先迁移数据库及队列。

当前主机没有Docker，Docker文件已经备齐；本地源码构建、迁移、初始化及备份测试已执行，容器构建和公网TLS尚未实测。构建包含OCR官方语言包，需访问公开仓库；API保留必要依赖以支持解析和迁移。

## 升级迁移

上线前停止业务写入，记录当前构建版本并备份。运行 `prisma migrate deploy`，禁止 `migrate reset`/`db push` 替代正式升级。当前14个迁移，其中风险活动记录的部分唯一索引由SQL维护。升级前在备份新文件上演练迁移及业务读取，再切换服务；失败可切回旧构建与备份文件，不原地逆删账单、结算或审计数据。

## 备份恢复

`npm run backup -- <新备份目录>` 使用SQLite VACUUM INTO生成一致快照，不覆盖已有database.db，并保存校验摘要、大小和迁移清单。附件、单据及凭证都存数据库，随快照保存；环境密钥单独由运维安全管理。备份目录控制访问并离机保存。

恢复：停止API；`node tools/restore.mjs <备份目录> <新数据库绝对文件路径>` 校验SHA-256并只创建新文件，拒绝覆盖。使用该文件进行 `prisma migrate deploy` 及抽样账单/凭证/审计读取，确认后切换DATABASE_URL并启动API。原数据库保留用于回退。

容器中数据库位于/data/grain.db，可 `docker compose exec api node tools/backup.mjs /data/backups/<时间>`；复制备份到独立存储。备份频率与保留期限由实际业务要求确定。调用日志请求体不输出密钥；生产监控使用requestId定位错误。
