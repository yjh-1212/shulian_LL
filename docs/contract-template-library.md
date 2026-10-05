# 粮食联运合同模板库

新增六份可复用条款文件：公铁、公水、铁水、公铁水、粮食多式联运通用主合同，以及平台服务附加合同。全部包含正文、版本、上传和生效时间、PDF 附件、摘要校验值及来源审计记录。条款支持玉米、大豆、小麦、稻谷，以及散粮和集装箱交接。

这些文件为按业务要求新编的合同模板，不是实际签署合同，也不是政府发布的示范文本。参考来源为[民法典合同编运输合同](https://www.spp.gov.cn/spp/ssmfdyflvdtpgz/202008/t20200831_478413.shtml)及[市场监管总局合同示范文本库](https://htsfwb.samr.gov.cn/)。库内不填造签章、账户、付款或第三方凭证。

模板保留企业、货物、数量、起讫地、成交价格、作业和结算要求的动态约定。合同生成默认使用通用主合同与平台附加合同，避免将某一条港站路线或单一运输组合写入其他业务。已有合同快照、历史版本、文件和签署记录保持不变。

## 生成与入库

使用 Codex 工作区提供的 Python 运行 `tools/generate-contract-template-files.py`，输出 `output/contract-templates` 中的 PDF、可编辑 UTF-8 条款和清单。模板的两页 PDF 已经由 Poppler 渲染并逐页检查。

`node tools/initialize-contract-templates.cjs` 默认仅预览。增加 `--apply` 时，先使用 SQLite `VACUUM INTO` 创建一致性备份，再在事务中添加六个模板、六份附件和一条审计记录。初始化标记阻止重复添加。备份位置和来源详见 `docs/acceptance/contract-template-library-initialization.json`。

`node tests/contract-template-library.cjs` 只读核验文件边界、默认模板与合同正文生成，校验旧模板、合同、履约、档案、费用和任务未改动，并确认重复运行不会新增模板。
