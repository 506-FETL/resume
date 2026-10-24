# 模板页资源加载优化实现计划

> 使用 executing-plans 按任务执行，阶段完成后按 requesting-code-review 做规格与质量审查。用户已批准方案，按仓库要求留在当前分支，不提交或推送既有修改。

**目标：** 模板缩略图通过 CDN 直接展示，保留分页，减少无意悬停导致的请求，并给出可复核的性能对比。

**架构：** 内容哈希寻址的公开 Storage 副本负责静态预览；原素材表及校验逻辑继续服务真实渲染。受控同步工具和目录写入门禁确保资源先可用后发布，前端只延迟预取必要数据。

**技术栈：** React、TypeScript、Zustand、Supabase Postgres/Storage、Vite。

## 全局约束

- 每页 12 条、底部 480px、缩略图 600px 阈值不变。
- Storage 桶 `resume-template-previews`，对象名为原始 SHA-256，不覆盖既有对象；只同步已发布图片，禁止前端获得维护凭据。
- 不改变完整素材、模板正文、打印样式或分页算法；保留已有 `vite.config.ts` 修改。
- 不推送。临时验收代码完成后从 tests 删除，记录真实结果而非估算收益。

## 任务 1：基线与 CDN 发布保障

- [x] 在 `tests/template-performance/` 建立临时浏览器报告入口，导入真实应用，记录模板请求与图片完成时间；在修改前保存基线。
- [x] 用 CLI 查询链接项目的桶、Storage 策略、当前目录及迁移账本，确认当前发布链路。
- [x] 使用 `pnpm exec supabase migration new official_template_preview_cdn` 生成迁移：创建公开只读专用桶；增加目录发布前对象检查，复用原目录约束。
- [x] 添加 `scripts/sync-template-previews.mjs` 受控同步工具：从现有配置读取项目，维护密钥仅内存读取；分页读取已发布预览，校验后创建对象，`cacheControl: '31536000'`、不允许 upsert；显式哈希用于未来发布。
- [x] 部署完整迁移（桶与发布门禁）、同步当前预览、核对真实 GET，再验证迁移账本与门禁。使用回滚事务和临时表，不持久修改现有目录内容。

## 任务 2：前端图片与预取

- [x] 在 Source 增加严格哈希到可信公开图片 URL 的纯函数；不引入自由 URL 字段。
- [x] 调整 `use-template-preview.ts` 与调用点，让真实 `<img>` 加载 URL，保留加载/失败/重试状态、已有过渡及减少动效；检查卡片、完整预览占位和编辑器画廊。
- [x] 添加 `use-template-prefetch.ts` 管理 200ms 意图延迟，离开/失焦/卸载清理定时器；卡片和示例选择接入。
- [x] `prefetchTemplatePreview` 仅请求定义、示例；删除悬停时全部素材及 Base64 缩略图预取。
- [x] 运行相关 ESLint、`pnpm exec tsc -b`、`pnpm build`；仅修复本次引入的问题。

## 任务 3：线上与浏览器验收

- [x] 与基线相同视口和起始状态测试首屏、空闲、快速悬停、稳定悬停、点击预览、翻页、筛选、重复访问及窄屏。
- [x] 统计模板业务 GET、OPTIONS、传输量及首批图片完成耗时，区分冷缓存与热缓存；如果无法采集某项，说明限制，不推断通过。
- [x] 当前所有缩略图 URL 返回正确图片，命中 CDN/缓存响应；匿名写入失败，未知哈希和草稿不能进入同步工具。
- [x] 完成独立审查并修复重要发现，更新 `docs/resume-template-maintenance.md` 及配套验收记录。
- [x] 清理本轮 tests 文件，检查最终 diff 范围，报告本地前端结果与已部署云端迁移状态。

验收结果见 [配套验收记录](2026-10-24-template-page-performance-validation.md)。OPTIONS 与浏览器传输量的采集限制、冷/热缓存区别均已注明。
