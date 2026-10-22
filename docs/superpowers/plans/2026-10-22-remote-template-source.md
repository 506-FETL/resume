# 官方简历模板远端迁移实现计划

> 维护状态（2026-10-23）：本地模板资源、一次性模板发布/验收工具及截图/PDF 已按用户要求清理。下文涉及这些路径和命令的内容是当时的实施记录；当前操作以 `docs/resume-template-maintenance.md` 为准。云端已发布资源保持不变。

> 在当前会话使用 executing-plans 顺序执行；不创建子代理、分支或 worktree，不执行 git push。用户已明确授权从本地迁移到 Supabase，承接已批准的远端架构契约。

**目标：** 线上数据库保存官方目录、精确模板版本和示例，前端通过有界请求与持久缓存加载，兼容既有简历链路。

**架构：** 公共只读 Data API → 受控 transport → 统一缓存 Source → 资源 store／页面／创建／分享。模板视觉代码仍由前端白名单注册。

**技术栈：** PostgreSQL、Supabase Data API、TypeScript、Zod、IndexedDB（idb）、Zustand、现有 React 渲染与分页。

## 文件职责

- `supabase/migrations/*_official_resume_template_resources.sql`：表、索引、RLS、发布保护、筛选 RPC 与精确版本数据。
- `src/lib/resume-template/source/{types,resource-schema,remote,cache,transport,index}.ts`：契约、校验、缓存、网络访问与唯一装配。
- `src/lib/resume-template/catalog/*.ts`：补齐目录筛选与示例文案，作为迁移输入。
- `src/store/resume-template/`：保持定义／示例状态，增加独立目录分页和筛选选项状态。
- `src/pages/template/`：服务端分页筛选、懒加载卡片、线上示例文案。
- `src/lib/ai/tools/misc.ts`：模板列表有界分页。
- `tests/resume-template/remote-source.ts`：网络缓存与状态隔离验证。
- `tests/resume-template/online.ts`：线上资源一致性与公开权限验收。
- `tests/resume-template/database.sql`：隔离数据库权限、发布保护与索引验证。
- `scripts/build-template-seed.ts`：生成可审查的精确资源迁移数据，使用已有 Vite SSR 模块加载方式。

## 顺序执行

- [x] 1. 通过 CLI 创建迁移文件；建立表、哈希校验、发布不可变保护与只读 RLS；脚本序列化现有定义／示例生成 INSERT，不修改用户简历表。使用本地隔离数据库验证匿名读取与禁止写入。
- [x] 2. 扩展 Source：`listTemplatePage({ offset, style, layout })`、`getCatalogFacets()` 和精确版本读取。远端输入统一 Zod 校验；内容 SHA-256 与行哈希匹配。原 listTemplates 保留兼容，常用列表入口迁到分页。
- [x] 3. 实现内存／IndexedDB 缓存、项目命名空间、5 分钟目录 TTL、精确版本复用、4 请求并发限制、10 秒超时、损坏缓存移除与去重；预览和创建共用 Source。
- [x] 4. 页面 store 保存目录分页状态；筛选选项与目录独立加载，迟到请求不能覆盖新筛选结果；增加加载更多与独立重试，保留已有弹窗动画。卡片使用 IntersectionObserver 限制完整预览挂载。移除前端按模板 ID 的文案／分类映射。
- [x] 5. 专项验证并发只发一次、热读／刷新缓存、离线、无缓存错误、损坏恢复、版本冲突、数据库权限和索引；执行 `pnpm verify:templates`、新增专项脚本、两套 `tsc --noEmit`、ESLint、`pnpm build`、`git diff --check`。
- [x] 6. 部署新迁移到链接项目并核对 migration ledger；线上精确内容哈希与本地一致，验证公开目录／筛选／精确版本以及禁止写入；记录 Edge Functions 未变更。
- [x] 7. 浏览器实测两套模板预览／创建／刷新、手机 Drawer、缓存请求数；专项验证冻结分享与评论身份；经典蓝金模板 PDF 保色／分页回归；更新维护手册和本期验收记录。

验收结果记录至 `docs/superpowers/plans/2026-10-22-remote-template-source-validation.md`。未通过项目必须说明具体阻塞，不以协议校验替代真实浏览器或线上核验。
