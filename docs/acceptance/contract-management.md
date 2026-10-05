# 合同管理调整验收

日期：2026-10-02。采用现有红色主题，按参考截图完善页面结构与业务流程。

## 已完成

| 模块 | 页面及业务 |
| --- | --- |
| 合同模板 | 卡片展示名称、文件类型、版本、上传时间、生效时间和状态；支持上传 PDF、DOCX、UTF-8 TXT、预览、下载、发布、复制新版本。PDF 保留页面排版，DOCX/TXT 展示提取的正文。 |
| 合同签署 | 待签署/已签署列表按本企业签署情况分类；合同目录、正文、企业模拟印章、插入/清除/调整印章位置、签署确认、签署人及时间；保存签章位置和版本摘要。双方完成规定文件签署后合同生效。 |
| 合同履行 | 生效合同列表展示付款与运输进度；详情包含履约时间线、付款、收款、变更协议、运输任务、合同与凭证。付款登记及收款确认沿用现有结算业务，运输记录来自实际任务事件。 |
| 合同归档 | 待归档/已归档列表；归档填写目录号、案卷号、档案分类、档案名称、保存期限、归档日期；保存企业独立的归档记录和履约快照，可查看详情并导出档案。 |

模板维护仍由平台负责；合同、附件、归档和履约信息按企业权限读取。归档前检查合同状态、变更状态、运输完成、异常处理、对账及结算；归档后阻止合同新增变更。历史合同正文和签署记录保留。

电子签章继续采用用户要求的模拟方式。验收运输任务、付款与收款均为本地演示记录。

## 验证结果

- API 与 Web 构建通过。
- `node tests/contract-workspace.cjs`：4 组全流程通过，包括附件权限、模拟签章持久化、运输与结算、归档及企业隔离。
- `node tests/phase5.cjs`：原有合同、司机、联运执行、变更及平台签署门禁等 10 组回归通过。
- `node tests/contract-file-boundaries.cjs`：有效文件、编码错误、伪装/截断文件、外部 XML 实体、伪造解压大小的压缩文件校验通过。
- 浏览器实际验证上传模板、PDF 页面渲染、插章及两份文件签署、签署分类、付款与收款详情、变更详情、归档表单及归档详情。
- API 重启后归档记录保留，列表按日期排序正确。
- 与迁移前备份对照：原有 12 份合同、16 个版本、63 条签署记录及订单、供需、履约、结算等 16 张业务表的已有记录未修改或丢失；数据库外键检查通过。

数据库已应用新增迁移 `20261002130000_contract_workspace`。修改前备份：`.local/backups/2026-10-02T12-45-41-954Z/database.db`。

## 页面截图

![模板卡片](D:/项目资料/Code/liaoliang/docs/acceptance/contract-template-upload-browser.png)

![PDF 预览](D:/项目资料/Code/liaoliang/docs/acceptance/contract-template-preview-browser.png)

![模拟签署](D:/项目资料/Code/liaoliang/docs/acceptance/contract-signing-browser.png)

![付款及收款](D:/项目资料/Code/liaoliang/docs/acceptance/contract-receipts-browser.png)

![变更协议](D:/项目资料/Code/liaoliang/docs/acceptance/contract-changes-browser.png)

![归档表单](D:/项目资料/Code/liaoliang/docs/acceptance/contract-archive-form-browser.png)

![归档详情](D:/项目资料/Code/liaoliang/docs/acceptance/contract-archive-detail-browser.png)
