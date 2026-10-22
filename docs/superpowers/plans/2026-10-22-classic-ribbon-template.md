# 经典蓝金模板实现计划

> 按用户既有要求在当前分支、当前会话顺序执行；使用 executing-plans，不创建子代理或推送。

**目标：** 将参考图的蓝金斜角标题设计接入现有简历模板链路。

**架构：** 独立模板配置组合公共版本化视觉部件。复用内容映射、评论字段、创建服务与分页；分享冻结完整模板定义。

**技术栈：** React、TypeScript、Zod、Zustand、现有 A4 分页。

## 步骤

- [x] 扩展 `definition-schema.ts` 的布局、页头、标题、经历和技能能力联合；添加严格 `palette`。在 Runtime Providers 中解析模板配色，不修改 default@1。
- [x] 在 `template-layouts/ruled-column/v1/` 和 `template-parts/{banner-profile,ribbon-heading,aligned-entry-list,skill-meters}/v1/` 实现部件；登记 `registry/visual-components.tsx`。字段统一使用 CommentableText / CommentableRichText，条目头和技能标记分页原子元素。
- [x] 在 `definitions/classic-ribbon/v1.ts`、`catalog/classic-ribbon.ts`、`source/local.ts` 登记新模板，复用两份示例；更新页面筛选元数据。
- [x] 更新分享序列化器支持经校验的新定义；扩展 `scripts/verify-resume-templates.ts`，检查新定义创建、颜色、字段身份、隐藏、分享冻结及非法能力拒绝。
- [x] 浏览器检查模板预览、手机 Drawer、实际本地创建、编辑与刷新、长内容分页、评论 DOM 锚点和导出；核对默认模板回归。
- [x] 执行 `pnpm verify:templates`、两个 TS 配置检查、变更文件 ESLint、`pnpm build`、`git diff --check`，更新维护文档及验证结果。

实际验收与限制见 `2026-10-22-classic-ribbon-template-validation.md`。
