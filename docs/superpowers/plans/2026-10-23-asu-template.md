# 阿酥模版实现计划

**目标：** 在模板库新增可编辑、可更换、可导出的阿酥模版，并使用用户指定的新示例头像。

**架构：** 云端声明式定义与独立示例。前端补充通用混排字体及受控富文本元素样式，不按模板 ID 分派。

**技术栈：** React、TypeScript、Fontsource、Supabase、Playwright、Chrome PDF、PyMuPDF。

## 文件与执行步骤

- [x] 渲染并测量用户 PDF 两页，记录边距、颜色、字体和条目几何；确认使用虚构示例。
- [x] 在 `src/lib/schema/resume/config/font.ts` 注册 Tinos 混排字体，`src/main.tsx` 导入固定版本的 Latin 常规/粗体/斜体字体，检查 `waitForResumeFont` 适配完整字体栈。依赖写入 `package.json` 与锁文件。
- [x] 扩展 `src/lib/resume-template/declarative/types.ts`、`schema.ts`、`validate.ts` 的 richText.elementStyles 白名单和能力验证；在 `declarative-renderer.tsx` 解析样式，`fields/commentable-rich-text/index.tsx` 为净化元素应用样式，保留评论块序号和用户内联样式。
- [x] 在 `tests/asu-template/` 编写候选资源与验证工具，生成 `/tmp/resume-asu-template/definition.json`、`example.json`。严格校验协议、照片、字段投影及预算。以原稿约 42px 边距、30.7px 姓名、21.6px 章节标题、13.6px 正文及指定颜色建立基线。
- [x] 通过隔离浏览器网络夹具加载候选定义和示例，真实渲染，逐项对照 PDF 调整资源；原稿个人信息不进入候选示例或云端。
- [x] 从真实导出入口生成阿酥及默认模板短、临界、多页的背景开关 PDF，检查所有标记与段落，不放宽签名；另导出虚构示例完整 PDF 并生成真实首页 PNG。
- [x] 执行修改文件 ESLint、`pnpm exec tsc -b --pretty false`、`pnpm build`、`git diff --check`；运行非法元素标签、样式引用、能力声明及评论投影回归。
- [x] 通过受控 Supabase SQL 事务发布 hash 校验后的素材、示例、定义和目录；保持现有 62 套不变，新增后为 63 套；匿名 API 回读内容及哈希，再在实际列表预览、创建、刷新与导出。
- [x] 更新验证记录，移走 `tests/asu-template/` 临时文件，保留规格与计划；不提交或推送 Git。

## 关键验证命令

`node tests/asu-template/build.cjs`：输出 schema3 候选资源，原图 JPEG 字节保持一致。

`node tests/asu-template/browser.mjs`：候选资源隔离预览、示例截图与入口检查；生产验证模式不拦截公开模板请求。

`node tests/asu-template/pdf.mjs`：真实导出入口校验并生成短、临界、长内容 PDF；Python 检查每一条文本、字符边界及两种背景栅格。

发布工具只执行资源 INSERT 和最后的目录事务，不修改旧版本，不调用数据库迁移或 Edge Function 部署。

## 执行结果

全部步骤完成。已发布 `asu@1` 和 `asu-fullstack@1`，活动目录 63 套。详细资源哈希、12 份 PDF 回归及云端实际入口检查见 `docs/resume-asu-template-validation.md`。WebKit 26.4 字体与打印前签名检查通过。临时脚本移入 `/tmp/resume-asu-template/verification-tools`。
