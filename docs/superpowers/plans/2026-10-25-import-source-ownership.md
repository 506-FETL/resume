# 简历导入分类修复实施计划

> **For agentic workers:** 本期在当前分支执行，完成后进行独立代码审查；沿用用户已授权范围，不重复请求批准。

**Goal:** 修复真实 PDF 的重复经历、续页错误拆分及技能双重分类。

**Architecture:** 本地 parser 记录行号来源，mapping 按来源匹配/归类，兼容旧无来源结果；沿用现有免费端点。

**Tech Stack:** TypeScript、PDF.js、现有简历 schema 与来源映射契约。

- [x] 在 `tests/import-sample-diagnosis/` 记录真实 PDF 和合法映射的失败回放，明确人工标注的预期。
- [x] `src/lib/resume-import/{types,parse,sections}.ts`：记录条目来源、识别模块/续页、清洗字段、保留头部信息。
- [x] `src/lib/resume-import/mapping.ts`：同源匹配、子标题保护、文本模块及新经历来源转移与标题清理，保留未映射内容。
- [x] `organize.ts`：非空导入一次免费语义识别，更新上传说明；实际入口验证游客、取消、字段反转。
- [x] 真实样本14项和合成边界20项回放，浏览器实际模块验证；局部 prettier/eslint、tsc、构建通过。
- [x] 独立审查并修复；记录事实、限制与防回归约束；不提交/推送。
- [x] 清理临时个人数据、渲染图片与测试；原始文件保留。
