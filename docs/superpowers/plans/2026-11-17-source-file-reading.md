# 文件读取与后续对话修复实现计划

> 使用 subagent-driven-development 分派独立解析模块并审查；按当前分支实施，不执行 TDD，不 commit 或 push。用户已授权本期修复。

**目标：** 上传只按大小校验，已上传文件可按需阅读并在后续对话继续使用。

**架构：** 原件仍为存储真源；轻量目录恢复文件，内容读取器按需加载现有解析库。模型和出处查看使用同一稳定段落，账户与版本缓存沿用现有 store。

**技术栈：** React、Zustand、PDF.js、fflate、SheetJS、Supabase 既有私有读取。

## 任务 1：普通文件文字读取

- [x] 在 `src/lib/experience-sources/read-file/` 实现独立内容读取器，导出 `readExperienceFile(blob, fileName, signal)`，返回 `{text, blocks, warning?}`。文件类型分派只决定能否读取，不参与上传校验。
- [x] PDF 使用已有 PDF.js 文本拼接器；DOCX 复用已有 XML 到段落转换；表格在 Worker 内使用现有 SheetJS；文本按真实字节解码。全量解析不限制页数或字数，输出通过 `createExperienceBlocks` 分段，PDF 空白页说明、取消与清理齐全。
- [x] 临时真实 DOCX/PDF/TXT/表格夹具验证尾部、空白页、损坏文件与取消；不复制业务实现到测试。

## 任务 2：来源目录、模型及出处链路

- [x] `src/pages/assistant/store/source-scope.ts` 恢复文件目录；显式附件选择与对话归属不变。
- [x] 增加 `src/lib/experience-sources/read-content.ts`，先读取元信息/旧段落，有原件但无段落时按需读取；成功和在途解析按 Blob 共享，失败重试，账户/版本变化取消。原始详情读取继续轻量。
- [x] `evidence-tools.ts` 接入内容读取，分页、精确段落和真实出处同一语义；搜索返回未索引文件候选，不把未搜索的文件当作无匹配。升级上下文投影指纹。
- [x] SourceReader/CitedBlock 接入内容读取，保留原件预览、下载与现有加载/失败/重试、焦点和动效；不新增自制控件。

## 任务 3：上传限制与验证交付

- [x] 验证档案和对话的真实保存请求为 `kind=file,text='',blocks=[]`，不执行提取。核对超 30 页、超 60000 字符、未知格式、空文件、大小边界与超限。
- [x] 完成实际浏览器的首轮、追问、刷新、出处、明确附件、账户/对话隔离及失败重试；如改 Edge/迁移则发布当前 linked 项目并核对账本、版本和线上 smoke。
- [x] 执行 `pnpm exec prettier <files> --write`、`pnpm exec eslint <files> --fix --fix-type layout`、`pnpm exec tsc -b --pretty false`、`pnpm build`、`pnpm format:check`、`git diff --check`。审查全部改动，更新防回归及验收记录，清理本期 tests/临时数据。

实施完成；验证通过；清理完成；用户审查待进行。

## 任务 4：全文与检索混合读取（用户追加授权）

- [x] 模型运行器按实际 messages/tools 计算共享工具输出预算，在工具上下文传递；正常小文档一次返回全文，保留输出空间。
- [x] `read-content.ts` 增加完整内容读取，旧段落由应用内聚合分页；保留真实版本、段落与权限检查。
- [x] 独立 `experience-read-tool.ts` 处理按预算读取、文件内关键词检索及长文档预览；旧 offset/blockIds 兼容。提示词不再引导每8段循环。
- [x] 同一35段DOCX真实模型只读取一次即可回答尾部；大文本关键词检索覆盖末尾，实际输出不超过剩余预算；执行原集成、取消、范围与出处回归，独立审查最终改动。

- [x] 修复跨硬切块关键词漏检，以及复用全文后的跨轮出处；新回复仅持久化实际引用证据，覆盖超过 30 条历史后的刷新。

验收记录：[上传文件读取与全文检索](../specs/2026-11-17-source-file-reading-acceptance.md)。
