# 服务器业务数据修复

服务器目标目录：`C:\liaoliang-server\liaoliang-server`（包含 package.json 的目录）。

## 原因与修复内容

上一包更新了程序和页面，未包含本机后来补充的业务记录。贸易企业的草稿账单尚未提交，因此账单列表为空。此包沿用服务器已有的已完成运单、费用和企业，通过业务服务补齐账单提交、核对、结算，以及数据申请、授权和订阅流程。

默认贸易企业“辽宁省粮食发展集团有限责任公司”修复后可见：

- 2 张账单（未对账、已确认），1 张部分结算单。
- 7 条数据申请（5 条通过、1 条待审核、1 条驳回）。
- 5 项授权，6 项订阅（包含暂停和即将到期状态）。

全体企业合计补齐 4 张账单的流程和 2 张结算单。记录由业务流程生成，结算说明不是银行回单，也不发送真实付款。

## Windows 服务器执行

1. 使用现有 Windows 服务或进程管理器停止辽粮应用。
2. 解压修复包，把 `liaoliang-server` **里面的内容**合并覆盖到上面的应用目录。保留服务器 `.env`、`.env.server`、`prisma` 下的数据库和 `.local` 附件。不要删除原应用目录。
3. 在 PowerShell 中执行：

```powershell
Set-Location -LiteralPath 'C:\liaoliang-server\liaoliang-server'
node tools/verify-package.mjs
npm run install:server
node tools/repair-business-data.cjs --apply
```

4. 看到“修复完成”后，用原来的服务管理器启动应用；手工启动可用 `npm start`。
5. 刷新 `/billing/bills`、`/billing/settlements`、数据服务的“我的授权”和“我的订阅”。

只上传和覆盖文件不会填入数据，必须执行上面的 `--apply` 命令。也可以使用 `npm run data:repair`。

## 数据保护与排查

- 默认读取 `.env.server`，没有时读取 `.env`，也支持 `ENV_FILE` 指定路径。现有进程的环境变量优先。开始时会打印实际数据库路径，请确认是线上使用的数据库。
- 只读检查命令：`node tools/repair-business-data.cjs`。
- 执行前备份至 `.local/backups/business-repair-*`，完成报告保存在 `.local/repair-reports/`。
- 可重复执行；已经补齐的记录会跳过，不重复新增。不重置账号、密码，不替换数据库。
- 只处理带 `BUSINESS_INITIALIZATION` 来源标记的指定账单；若已被人工处理且与预期冲突，会停止，避免覆盖。
- 账单与数据服务分别在事务内提交；某一步失败后保留已完成步骤，可处理原因后重跑。
- 缺少前置运单、企业、发布的数据产品或权限时会报错并停止。不要运行 `server:init`、开发 seed、`migrate reset`。
- 此包同时保留首页直达工作台、明亮背景、公司更名、驾驶舱统一蓝色风格及合同/账单界面更新。
