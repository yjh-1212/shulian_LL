# 腾讯云地图更新

## 已确认的原因

2026-10-06 对 `http://124.222.207.72:8080` 的检查确认了两处问题：

- 旧版网页响应头为 `Referrer-Policy: no-referrer`，高德 SDK 请求没有网站来源，出现 `INVALID_USER_DOMAIN`。
- `/_AMapService/v3/log/init` 返回有效 JSONP，却标记为 `application/json`，浏览器因严格 MIME 检查拒绝执行。

代码已改为发送 `strict-origin-when-cross-origin`；代理只将与请求回调匹配、内容可解析为 JSON 的 JSONP 标记为 JavaScript。错误 JSON、二进制内容和地图会话校验均保留。HTTP 页面不再发送仅适用于可信来源的 COOP 策略；HTTPS 仍使用该策略。

在测试浏览器中应用上述修复后，同一腾讯云地址的底图正常绘制，相关控制台错误消失。检查未修改服务器文件。现有腾讯云 IP 白名单可通过本次测试，不需要为这次修复更换密钥。

## 已有服务器更新

使用 `ll_dist/liaoliang-map-fix.zip`。这个更新包没有数据库、密钥配置、附件和依赖目录。

1. 按服务器当前运行方式停止 Node 服务。
2. 解压更新包，将包内 `liaoliang-server` 的内容覆盖到实际项目根目录（包含 `package.json` 的目录），注意不要多套一层文件夹。
3. 按原方式重启服务。直接 Node 部署可在项目目录执行 `npm start`；面板、PM2 或 systemd 部署通过原管理入口重启。
4. 重新打开浏览器标签页，按 `Ctrl+F5` 刷新。全程跟踪、专题视图和地点选择应能显示底图。

无需重新安装依赖或初始化数据库。正在使用的 `.env.server`、`prisma/server.db` 和 `.local/uploads` 保持原状。更新包包含新的 `release-manifest.json`，`node tools/verify-package.mjs` 可核对程序文件；已经运行过的数据库不要用 `--initial` 验证首次快照。

如果前面另有 Nginx、CDN 或服务器面板强制设置 `Referrer-Policy: no-referrer`，需要将这条设置改为 `strict-origin-when-cross-origin`，避免覆盖应用返回的策略。

## 首次安装

使用完整包 `ll_dist/liaoliang-server.zip`，按包内 README 安装。本次打包沿用原有数据库及密钥配置，账号密码未改动。

## 文档

[高德 JSAPI 安全密钥及 serviceHost 代理说明](https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode)
