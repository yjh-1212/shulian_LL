# 司机账号初始化

本地数据库和本次完整服务器包中的司机账号为 `driver`，密码为 `shulian`。已有司机的姓名、所属物流企业、用户编号和任务关联保留；仅授予司机角色，不能登录企业后台。

## 已部署的腾讯云服务器

本地更新数据库不会自动同步腾讯云。将 `liaoliang-driver-account-fix.zip` 解压，把包内 `liaoliang-server/` 里面的文件覆盖到服务器应用根目录，即含 `package.json` 的目录。在该目录执行一次：

```sh
DRIVER_ACCOUNT_PASSWORD=shulian node tools/configure-driver-account.cjs --server
```

脚本读取现有 `.env.server` 中的数据库地址，只初始化 `driver` 账号，保持已有业务和其他账号。密码只作为本次进程的临时变量传入，不写入配置；后续启动不会自动重置密码。

若实际使用其他环境文件，可指定 `ENV_FILE=/实际配置路径`。若进程管理工具单独设置数据库地址，应在命令执行时传入同一个 `DATABASE_URL`。

执行成功后，在手机浏览器打开 `http://124.222.207.72:8080/driver`，使用 `driver / shulian` 登录。账号更新后旧司机会话失效，重新登录即可，无需重新导入业务数据库。
