# Render 部署

在 [Render Dashboard](https://dashboard.render.com/) 选择 **New → Blueprint**，连接 `yjh-1212/shulian_LL` 的 `main` 分支。根目录的 `render.yaml` 配置了 Node Web Service、健康检查和 1 GB 持久磁盘。磁盘需要付费 Web Service。

在本机的 `ll_dist/render-*/.env.render` 找到与本次提交对应的配置文件。根据 Blueprint 的提示，在 Render 中填写其中的 `RENDER_SNAPSHOT_KEY`、高德和 DeepSeek 凭据。如有自定义模型地址或名称，可在服务的 **Environment** 中添加对应变量。Render 会为新服务生成 JWT 密钥。

首次启动用解密密钥恢复 `deploy/render-data.tar.gz.enc`，再应用 Prisma 迁移。数据库和供需上传附件位于 `/var/data/liaoliang`。以后重启和重新部署会沿用磁盘上的数据库和附件。恢复后仍可用本地已有账号和密码登录，已有会话需重新登录。

服务就绪后访问 Render 提供的 HTTPS 地址。首页进入工作台，登录后可打开驾驶舱。公开部署关闭自动以 trader 登录，并对驾驶舱 API 启用登录校验。司机端入口为 `/driver`。使用高德地图前，将实际访问域名加入高德 JSAPI Key 的域名白名单。

更新代码时继续推送 `main`。首次恢复是本地数据库的一次迁移，Render 和本地随后各自保存数据。请留存私有配置文件，以便在新磁盘上恢复这份快照。
