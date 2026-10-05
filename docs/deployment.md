# 部署、迁移和备份

## 本地开发

Node >=22.12，已验证24.17.0。首次安装：`npm ci`、`npm run setup`、`npm run amap:configure`、`npm run llm:configure`、`npm run db:generate`、`npm run db:migrate`、`npm run db:seed`、`node tools/fetch-ocr.mjs`、`npm run dev`。密钥保存在本地.env，禁止提交。PC5173、司机5174、API3001。开发seed禁止在production运行。

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
