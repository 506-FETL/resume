# 简历全文划词评论实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在简历编辑器最终画布和公开分享页提供版本隔离、支持匿名身份、桌面/移动端自适应的全文划词评论能力，同时确保锚点可重定位、权限可审计、打印与 PDF 永不包含评论层。

**架构：** 先为简历数组条目补齐持久 `entryId`，由共享 Runtime 输出字段级语义节点，再以独立 Overlay 计算选区和高亮；评论数据按 working/history/share_release scope 隔离，经 `resume-comments` Edge Function 统一鉴权、限流和写入。分享链接改为指向不可变 release，编辑页与分享页只负责注入当前 scope、actor 和响应式容器，共享评论领域模块负责锚点、Store、实时通知、未读和线程 UI。

**技术栈：** React 19、TypeScript 5.9、Zustand 5、Supabase PostgreSQL/RLS/Edge Functions/Realtime、Base UI Drawer、Radix UI、Tailwind CSS 4、Vite 7、Zod 4、pnpm

**规格：** `docs/superpowers/specs/2026-08-13-resume-full-text-comments-design.md`

**验证：** 仓库没有测试基础设施，且 `AGENTS.md` 明确不执行 TDD。本计划不引入测试框架；用可重复 TypeScript/SQL 验证脚本、TypeScript、定向 ESLint、生产构建和真实浏览器/设备交互验证替代测试先行。

---

## 实施约束

- 计划编写时分支为 `feat/comment`，相对 upstream 领先规格提交 `5a04e30`；按仓库规则继续在当前分支实施，不创建或切换分支。
- 不执行 `git push`。每个任务只暂存该任务列出的路径，提交前检查 `git diff --cached --name-status`。
- 每个阶段必须保持现有编辑器预览、历史版本、分享读取和 PDF 导出可用；数据库迁移遵循“先兼容写、再切读、最后停用旧列”。
- 评论 UI 只挂载于最终只读 Runtime 画布，不进入左侧 Tiptap 表单、分页测量 source、打印 DOM 或 PDF 导出树。
- 离线简历不支持评论：不创建 scope、不挂载评论 Provider、不保存本地评论；入口显示禁用说明“转为在线简历后可评论”，转云端时没有评论迁移。
- `entryId` 是业务稳定 ID；React Hook Form `useFieldArray` 自带的 `field.id` 仍只是表单渲染 ID，两者不能互换。
- 所有匿名与公开分享写入必须经过 Edge Function；浏览器不能直接读取或写入评论领域表。
- 不实现图片、附件、富文本、@、点赞、翻译、举报、邮件通知、跨设备匿名恢复、评论迁移或带批注 PDF。
- 只有完成 iOS Safari 与 Android Chrome 的真实交互验收后，才可以宣称移动端功能可用。

## 文件结构与职责

### 新增

- `src/lib/schema/resume/entry-id.ts`：数组条目 ID 生成、旧快照确定性回填与断言。
- `supabase/functions/shared/resume-comment-core.ts`：浏览器与 Edge Function 共用的纯 TypeScript legacy ID、可见文案投影和 anchor document 核心。
- `src/features/resume-comments/types.ts`：scope、actor、thread、comment、event、权限和 API 领域类型。
- `src/features/resume-comments/const.ts`：字数、上下文、Drawer、轮询和限流展示常量。
- `src/features/resume-comments/anchors/types.ts`：AnchorSchema 与 anchor document 类型。
- `src/features/resume-comments/anchors/graphemes.ts`：NFC、`Intl.Segmenter` 和 DOM/字素偏移转换。
- `src/features/resume-comments/anchors/projection.ts`：把结构化字段投影成与 Runtime 完全一致的可见文字。
- `src/features/resume-comments/anchors/document.ts`：从 ResumeSchema 构造权威 anchor document。
- `src/features/resume-comments/anchors/selection.ts`：合法选区解析、引用上下文和重叠判断。
- `src/features/resume-comments/anchors/relocate.ts`：同 nodeKey 内的确定性重定位。
- `src/features/resume-comments/anchors/geometry.ts`：可见页 Range 矩形与缩放坐标转换。
- `src/features/resume-comments/api/client.ts`：`resume-comments` Edge Function 客户端。
- `src/features/resume-comments/api/anonymous-identity.ts`：按 share 隔离的浏览器匿名凭证。
- `src/features/resume-comments/api/realtime.ts`：失效通知订阅、断线补偿与 60 秒分享状态刷新。
- `src/features/resume-comments/store/types.ts`：页面级评论 Store 契约。
- `src/features/resume-comments/store/create-store.ts`：按 scope 隔离的 Zustand Store。
- `src/features/resume-comments/context.tsx`：评论宿主依赖注入，不把领域状态塞入 Runtime。
- `src/features/resume-comments/hooks/use-comment-selection.ts`：桌面/移动选区生命周期。
- `src/features/resume-comments/hooks/use-highlight-geometry.ts`：分页完成、缩放、字体和 resize 后重算。
- `src/features/resume-comments/hooks/use-comment-realtime.ts`：event_seq 增量、缺口回拉与未读推进。
- `src/features/resume-comments/components/comment-surface.tsx`：共享评论层总入口。
- `src/features/resume-comments/components/selection-action.tsx`：桌面气泡与移动底部操作条。
- `src/features/resume-comments/components/highlight-overlay.tsx`：不可打印的独立高亮层。
- `src/features/resume-comments/components/thread-picker.tsx`：重叠锚点线程选择器。
- `src/features/resume-comments/components/comments-panel.tsx`：桌面右侧与移动底部 Drawer 内容。
- `src/features/resume-comments/components/thread-list.tsx`：未解决、已解决、失去锚点筛选与排序。
- `src/features/resume-comments/components/thread-detail.tsx`：主评论、一级回复和线程操作。
- `src/features/resume-comments/components/comment-composer.tsx`：纯文本多行输入、字数和安全自动链接。
- `src/features/resume-comments/components/comment-source-selector.tsx`：编辑器当前、历史、分享和归档来源选择。
- `src/pages/resume/editor/hooks/use-comment-review-mode.ts`：不可变版本审阅与当前工作状态恢复。
- `src/pages/share/view/hooks/use-share-comment-access.ts`：公开访问令牌、匿名身份和只读切换。
- `supabase/migrations/20260813000001_add_resume_share_releases.sql`：不可变 release、现有分享回填和原子重新发布。
- `supabase/migrations/20260813000002_add_resume_comments.sql`：scope、thread、comment、identity、event、read state、幂等与限流表。
- `supabase/functions/shared/resume-comment-schema.ts`：服务端请求、锚点和纯文本验证。
- `supabase/functions/shared/resume-comment-auth.ts`：owner、collaborator、share visitor 和匿名身份鉴权。
- `supabase/functions/shared/resume-comment-events.ts`：事务事件、event_seq 和脱敏 Realtime 失效通知。
- `supabase/functions/resume-comments/index.ts`：评论领域唯一公开 API。
- `supabase/tests/resume-comments.sql`：本地数据库迁移、隔离、级联、并发与限流验证。
- `scripts/verify-resume-comment-anchors.ts`：无需测试框架的纯逻辑断言脚本。

### 修改

- `src/lib/schema/resume/form/shared.ts`、五类经历/教育 schema、`hobbies.ts`、`honorsCertificates.ts`、`skillSpecialty.ts`：数组条目 schema、类型和默认值增加 `entryId`。
- `src/lib/schema/resume/normalize.ts`：旧快照稳定补齐条目 ID，新数据保留已有 ID。
- `src/pages/resume/editor/components/forms/hooks/use-resume-field-form.ts` 及三个标签型表单：新增条目使用随机业务 ID。
- `src/components/resume/runtime/ResumeTemplateRuntime.tsx`、`renderers/shared.tsx` 和 12 个 renderer：输出 `data-comment-node-key`、块序号和字段元数据。
- `src/components/resume/pagination/canonical-paged-document.tsx`、`scaled-resume-document.tsx`：声明可见页/测量源和 Overlay 坐标容器。
- `src/lib/supabase/resume/share.types.ts`、`share.ts`：release、评论开关、归档和访问令牌契约。
- `src/pages/share/store/`、`src/pages/share/components/`：创建/重新发布 release、评论开关、归档和永久删除。
- `supabase/functions/resume-share/index.ts`：匿名读取从 current release 取快照并签发短期评论访问令牌。
- `src/pages/resume/editor/components/preview/index.tsx`、`src/pages/resume/editor/index.tsx`：当前 scope、全局入口、右侧 Drawer 和审阅模式。
- `src/pages/share/view/[token].tsx`：公开分享评论层、匿名身份、未读和移动 Drawer。
- `src/lib/supabase/resume/history/queries.ts`、`src/pages/history/store/history-data.ts` 及删除确认 UI：历史删除级联对应 scope。
- `src/lib/collaboration/session/` 与编辑器协作 hooks：注册、签发和撤销协作者评论权限。
- `src/index.css`：评论层 print 强制隐藏和选区/高亮视觉变量。
- `package.json`：增加 `verify:comments` 脚本，不增加测试依赖或运行时依赖。

### 明确不修改

- 左侧 Tiptap 编辑器的 mark、extension 和文档 JSON；评论锚点不存入富文本。
- `docx`、PDF 和打印导出内容协议；只通过不挂载与 CSS 隐藏保证评论层缺席。
- 现有分享旧快照列的删除；本期只停止把旧列当作读取真源。

---

### 任务 1：为所有可重复简历条目建立持久业务 ID

**文件：**

- 创建：`src/lib/schema/resume/entry-id.ts`
- 创建：`supabase/functions/shared/resume-comment-core.ts`
- 修改：`src/lib/schema/resume/form/shared.ts`
- 修改：`src/lib/schema/resume/form/eduBackground.ts`
- 修改：`src/lib/schema/resume/form/workExperience.ts`
- 修改：`src/lib/schema/resume/form/internshipExperience.ts`
- 修改：`src/lib/schema/resume/form/campusExperience.ts`
- 修改：`src/lib/schema/resume/form/projectExperience.ts`
- 修改：`src/lib/schema/resume/form/hobbies.ts`
- 修改：`src/lib/schema/resume/form/honorsCertificates.ts`
- 修改：`src/lib/schema/resume/form/skillSpecialty.ts`
- 修改：`src/lib/schema/resume/normalize.ts`
- 修改：`src/store/resume/slices/document.ts`
- 修改：`src/store/resume/slices/sync.ts`
- 修改：`src/lib/automerge/document/sync.ts`
- 修改：`src/lib/template/fixtures/demo-resume.ts`
- 修改：`src/lib/ai/tools/resume.ts`
- 修改：`src/pages/optimize/utils.ts`
- 修改：`src/pages/optimize/components/editors/skill-list-editor/index.tsx`
- 修改：`src/pages/optimize/components/advanced-tools/formatter/utils.ts`
- 修改：`src/pages/resume/editor/components/forms/hooks/use-resume-field-form.ts`
- 修改：`src/pages/resume/editor/components/forms/skill-specialty/index.tsx`
- 修改：`src/pages/resume/editor/components/forms/honors-certificates/index.tsx`
- 修改：`src/pages/resume/editor/components/forms/hobbies/index.tsx`

- [x] **步骤 1：定义不会与 React Hook Form 冲突的 `entryId` 契约**

先在不依赖 React、DOM、Zod 或 `Deno` 全局的 `resume-comment-core.ts` 实现 `stableStringify`、同步 FNV-1a 和 `createLegacyResumeEntryId`；`entry-id.ts` 只增加 Zod schema、随机 ID，并重导出共用 legacy 函数：

```ts
export const resumeEntryIdSchema = z.string().min(1).max(128)

export function createResumeEntryId(): string {
  return crypto.randomUUID()
}

export function createLegacyResumeEntryId(input: {
  sectionKey: string
  collectionKey: string
  index: number
  value: unknown
}): string
```

旧快照 ID 以 section、collection、index 和稳定 JSON 的两路 FNV-1a 32-bit 摘要构造 `legacy_<16位十六进制>`；该函数保持同步，使现有同步归一化链路无需改为 Promise。相同旧快照重复归一化必须得到相同值。不得只使用内容 hash，因为两个内容相同的并列条目仍需不同 ID。Edge Function 后续必须直接导入这一实现，不能复制算法。

- [x] **步骤 2：把 `entryId` 加入全部重复条目 schema 与默认值**

`createExperienceSchema` 在 `z.object(fields)` 外统一合并 `entryId`；五类经历的 item 类型改为从完整 form schema 推导，教育、爱好、证书和技能项显式增加 `entryId`。五类经历与教育的默认首项分别使用固定且互不重复的 `default_<section>_1`，避免模块导入时产生随机数据。

- [x] **步骤 3：归一化旧快照并保持已有 ID**

在 `normalizeResumeFormData` 合并默认值后调用 `ensureResumeEntryIds`，覆盖：

```ts
const COLLECTIONS = [
  ['edu_background', 'items'],
  ['work_experience', 'items'],
  ['internship_experience', 'items'],
  ['campus_experience', 'items'],
  ['project_experience', 'items'],
  ['skill_specialty', 'skills'],
  ['honors_certificates', 'certificates'],
  ['hobbies', 'hobbies'],
] as const
```

已有合法且在同一 collection 内唯一的 `entryId` 原样保留；缺失、空值或重复 ID 按 index 确定性修复。移动、远端同步、历史快照加载和分享快照加载都不能重新生成。

- [x] **步骤 4：让所有新增入口分配随机 ID**

`useResumeFieldForm.onAddItem()` 改为 append 克隆对象并写入新的 `entryId`。技能、证书和爱好的预设添加、手输添加以及优化页技能编辑器也显式调用 `createResumeEntryId()`；远端 `append` 不改写对方已经携带的 ID。模板演示快照使用固定 demo ID。AI 优化仍按既有协议输出不含内部 ID 的技能数组，应用建议、助手工具写入和替换快照时先由领域归一化补齐 ID，再执行严格 schema 校验，不能放宽 schema 或要求模型生成内部 ID。

- [x] **步骤 5：在线加载时一次性持久化 legacy ID**

`entry-id.ts` 增加 `collectMissingResumeEntryIdPatches(source, normalized)`。`document.ts` 初始化 Automerge 后若存在 patch，先用一次 `manager.change` 只写各数组项的 `entryId`，再走现有 `syncToSupabase()` 同时保存 Automerge 与 `resume_config`；`DocumentSlice` 用 `entryIdMigrationReady` 暴露评论前置状态。加载 Promise 等迁移保存完成后才允许评论 bootstrap。迁移失败按现有同步错误处理，评论入口保持禁用，不能用只存在内存里的 ID 建 working scope；`sync.ts` 在后续成功保存且当前文档 ID 完整时把该状态恢复为 true。离线加载只做内存归一化，不创建评论 scope；以后转在线时由在线加载执行同一迁移。

- [ ] **步骤 6：验证旧数据和表单行为**

运行：

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/lib/schema/resume/entry-id.ts src/lib/schema/resume/form/shared.ts src/lib/schema/resume/form/eduBackground.ts src/lib/schema/resume/form/workExperience.ts src/lib/schema/resume/form/internshipExperience.ts src/lib/schema/resume/form/campusExperience.ts src/lib/schema/resume/form/projectExperience.ts src/lib/schema/resume/form/hobbies.ts src/lib/schema/resume/form/honorsCertificates.ts src/lib/schema/resume/form/skillSpecialty.ts src/lib/schema/resume/normalize.ts src/store/resume/slices/document.ts src/store/resume/slices/sync.ts src/lib/automerge/document/sync.ts src/lib/template/fixtures/demo-resume.ts src/lib/ai/tools/resume.ts src/pages/optimize/utils.ts src/pages/optimize/components/editors/skill-list-editor/index.tsx src/pages/optimize/components/advanced-tools/formatter/utils.ts src/pages/resume/editor/components/forms/hooks/use-resume-field-form.ts src/pages/resume/editor/components/forms/skill-specialty/index.tsx src/pages/resume/editor/components/forms/honors-certificates/index.tsx src/pages/resume/editor/components/forms/hobbies/index.tsx
if command -v deno >/dev/null 2>&1; then deno check supabase/functions/shared/resume-comment-core.ts; else node --experimental-strip-types -e "import('./supabase/functions/shared/resume-comment-core.ts')"; fi
git diff --check
```

手工确认：同一旧快照加载两次 ID 相同；重复旧 ID 被修复；在线首次加载后 Automerge 与 `resume_config` 都包含 ID；迁移保存失败时评论禁用；新增两个同内容条目 ID 不同；拖拽排序后 ID 跟随条目；保存历史和生成分享快照均包含 `entryId`。

验证状态（2026-08-13）：纯逻辑断言、TypeScript、定向 ESLint、生产构建和离线浏览器新增条目回归已通过；临时离线简历已删除。由于浏览器没有登录态，在线首次迁移双写、迁移失败禁用、历史/分享快照和真实拖拽仍保留为后续集成验收项，因此本步骤暂不勾选。

- [x] **步骤 7：提交稳定条目 ID**

```bash
git add docs/superpowers/plans/2026-08-13-resume-full-text-comments.md supabase/functions/shared/resume-comment-core.ts src/lib/schema/resume/entry-id.ts src/lib/schema/resume/form/shared.ts src/lib/schema/resume/form/eduBackground.ts src/lib/schema/resume/form/workExperience.ts src/lib/schema/resume/form/internshipExperience.ts src/lib/schema/resume/form/campusExperience.ts src/lib/schema/resume/form/projectExperience.ts src/lib/schema/resume/form/hobbies.ts src/lib/schema/resume/form/honorsCertificates.ts src/lib/schema/resume/form/skillSpecialty.ts src/lib/schema/resume/normalize.ts src/store/resume/slices/document.ts src/store/resume/slices/sync.ts src/lib/automerge/document/sync.ts src/lib/template/fixtures/demo-resume.ts src/lib/ai/tools/resume.ts src/pages/optimize/utils.ts src/pages/optimize/components/editors/skill-list-editor/index.tsx src/pages/optimize/components/advanced-tools/formatter/utils.ts src/pages/resume/editor/components/forms/hooks/use-resume-field-form.ts src/pages/resume/editor/components/forms/skill-specialty/index.tsx src/pages/resume/editor/components/forms/honors-certificates/index.tsx src/pages/resume/editor/components/forms/hobbies/index.tsx
git diff --cached --name-status
git commit -m "feat(resume): 添加稳定条目业务标识"
```

---

### 任务 2：引入不可变分享发布批次并兼容既有链接

**文件：**

- 创建：`supabase/migrations/20260813000001_add_resume_share_releases.sql`
- 修改：`src/lib/supabase/resume/share.types.ts`
- 修改：`src/lib/supabase/resume/share.ts`
- 修改：`supabase/functions/resume-share/index.ts`

- [x] **步骤 1：创建 release 表并扩展分享主表**

迁移创建 `resume_share_releases`，字段与规格 6.1 一致；为 `resume_shares` 增加：

```sql
ALTER TABLE public.resume_shares
  ADD COLUMN IF NOT EXISTS current_release_id uuid,
  ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
```

release 的 snapshot、template_manifest 和来源元数据均不可更新；owner 只能通过 RPC 发布，客户端不获得表级写权限。

- [x] **步骤 2：回填既有分享并添加延迟外键**

按 share ID 稳定回填 `release_no = 1`，复制旧 snapshot、template_manifest、display_name 和来源字段，再设置 `current_release_id`。校验无遗漏后增加 `current_release_id → resume_share_releases(id)` 外键；迁移重跑不得创建第二个 release。

- [x] **步骤 3：实现原子发布 RPC**

创建 `publish_resume_share_release(p_share_id, p_snapshot, p_template_manifest, p_display_name, p_source_*)`：

1. 锁定 owner 的 share 行；
2. 拒绝 archived share；
3. `max(release_no) + 1` 创建新 release；
4. 同事务创建 share_release comment scope 的入口由下一迁移补齐；
5. 切换 `current_release_id`，更新 `updated_at`；
6. 返回 release ID 与编号。

本迁移先允许 scope 为空；任务 3 完成后由第二个 RPC 版本强制原子创建 scope。

- [x] **步骤 4：领域层切换读取真源**

`ResumeShareRecord` 增加 `currentReleaseId`、`currentRelease`、`allowComments`、`archivedAt`。创建分享先写旧兼容列再创建 release；重新发布只调用 RPC。owner 列表和匿名 fetch 从 current release 返回快照，旧列仅保留兼容回滚用途。

- [x] **步骤 5：保持既有公开分享协议可用**

`resume-share` 的 fetch 在没有评论迁移时先返回：

```ts
interface ShareViewResult {
  snapshot: ResumeSchema
  templateManifest: TemplateManifest
  shareId: string
  releaseId: string
  releaseNo: number
  allowComments: boolean
}
```

密码、过期、停用和访问计数语义不变；归档行按不可用处理。

- [ ] **步骤 6：本地迁移和兼容验证**

```bash
supabase db reset
deno check supabase/functions/resume-share/index.ts
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/lib/supabase/resume/share.types.ts src/lib/supabase/resume/share.ts
git diff --check
```

预期：旧分享回填一条 release；同 URL 重新发布后 current release 变化；旧 release 行仍存在；公开读取仍只得到当前快照。

验证状态（2026-08-13）：TypeScript、前端与 Edge Function 定向 ESLint、生产构建和差异检查已通过；本机缺少 Docker/Podman 与 Deno，`supabase db reset` 和 `deno check` 无法执行，因此回填、重发和旧 release 保留仍为本地数据库环境恢复后的集成验收项，本步骤暂不勾选。

- [x] **步骤 7：提交发布批次基础**

```bash
git add supabase/migrations/20260813000001_add_resume_share_releases.sql src/lib/supabase/resume/share.types.ts src/lib/supabase/resume/share.ts supabase/functions/resume-share/index.ts
git diff --cached --name-status
git commit -m "feat(share): 引入不可变发布批次"
```

---

### 任务 3：创建评论领域表、约束、事务 RPC 和数据验证

**文件：**

- 创建：`supabase/migrations/20260813000002_add_resume_comments.sql`
- 创建：`supabase/tests/resume-comments.sql`

- [x] **步骤 1：按规格建立七类真源数据**

创建：

- `resume_comment_scopes`；
- `resume_comment_threads`；
- `resume_comments`；
- `resume_comment_anonymous_identities`；
- `resume_comment_read_states`；
- `resume_comment_events`；
- `resume_comment_requests` 和 `resume_comment_rate_limits`。

scope 使用部分唯一索引隔离 working、history、share_release，并保存 `projection_reference_date date not null`；comment 使用部分唯一索引保证每个 thread 只有一个 root；actor、parent、scope kind、anchor status 和 resolve actor 均用 CHECK 或触发器约束。

- [x] **步骤 2：把锚点文档和 revision 作为数据库并发边界**

scope 必须保存 `anchor_document jsonb`、`document_hash text`、`document_revision integer`。线程保存 `anchor jsonb`、`anchor_status`、`revision`。数据库函数拒绝空 exactQuote、非法 offset、错误 nodeKey 和不匹配 document_hash；服务端任务还会做同一套 Zod 校验。

- [x] **步骤 3：建立事件序列、幂等和限流 RPC**

创建内部函数：

```sql
next_resume_comment_event_seq(p_scope_id uuid) returns bigint
claim_resume_comment_request(p_actor_key text, p_request_id uuid) returns boolean
check_resume_comment_rate_limit(
  p_actor_key text,
  p_network_key text,
  p_share_id uuid,
  p_thread_id uuid
) returns integer
```

同一 actor + request_id 重放返回首次响应；event_seq 在 scope 内单调递增；限流返回 `retry_after_seconds`，不保存原始 IP。

- [x] **步骤 4：完成发布与 scope 原子创建**

在第二个迁移中使用 `CREATE OR REPLACE FUNCTION` 替换任务 2 的发布 RPC，使其必须接收由共用核心生成的 `p_anchor_document`、`p_document_hash` 和 `p_projection_reference_date`，并让新 release 与 share_release scope 在同一事务创建；不回写已应用的第一个迁移。新增：

- `ensure_resume_working_comment_scope`；
- `ensure_resume_history_comment_scope`；
- `sync_resume_working_comment_document`；
- `archive_resume_share`；
- `delete_resume_share_permanently`；
- `delete_resume_history_version_with_comments`。

历史 scope 懒创建；历史永久删除级联自身评论，但独立 share release 保留。另提供仅 service role 可调用的 `ensure_resume_share_release_comment_scope`：锁定 backfill release，在服务端已从 snapshot 构造权威文档后幂等补齐旧 release scope；公开请求不能直接调用或传入权威文档。

- [x] **步骤 5：锁死直接表访问**

评论领域表全部启用 RLS，撤销 anon/authenticated 直接 SELECT/INSERT/UPDATE/DELETE；owner、collaborator 和 visitor 统一由 Edge Function service role 访问。Realtime 只广播不含正文的失效事件，客户端收到后经 API 增量拉取。

- [ ] **步骤 6：编写本地 SQL 验证矩阵**

`resume-comments.sql` 必须用事务断言：

- 旧分享回填与 current release；
- backfill release 只允许 service role 幂等补齐一次权威 scope；
- 不同 share、release、history、working scope 唯一与隔离；
- 重新发布同时创建 scope 并切指针；
- request_id 重放；
- expected revision/document revision 冲突；
- reply 不能回复 reply；
- 归档保留数据，永久删除级联；
- 历史删除不影响 share release；
- 三层限流与 60 秒封禁。

运行：

```bash
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/resume-comments.sql
supabase db lint --local
```

预期：三个命令退出码均为 `0`，SQL 脚本最后输出 `resume comments verification passed`。

验证状态（2026-08-13）：使用 PostgreSQL 官方语法解析器内核 `pgsql-parser` 成功解析两个迁移和 SQL 验证脚本，并通过 `git diff --check`；本机缺少 Docker/Podman 与 `psql`，无法执行 `supabase db reset`、事务断言或 `supabase db lint --local`，因此本步骤暂不勾选，所有数据库行为仍需在本地 Supabase 环境实跑后确认。

- [x] **步骤 7：提交评论数据库**

```bash
git add supabase/migrations/20260813000002_add_resume_comments.sql supabase/tests/resume-comments.sql
git diff --cached --name-status
git commit -m "feat(comments): 建立评论数据与事务边界"
```

---

### 任务 4：实现语义锚点、Unicode 字素与可重复验证脚本

**文件：**

- 创建：`src/features/resume-comments/types.ts`
- 创建：`src/features/resume-comments/const.ts`
- 创建：`src/features/resume-comments/anchors/types.ts`
- 创建：`src/features/resume-comments/anchors/graphemes.ts`
- 创建：`src/features/resume-comments/anchors/projection.ts`
- 创建：`src/features/resume-comments/anchors/document.ts`
- 创建：`src/features/resume-comments/anchors/selection.ts`
- 创建：`src/features/resume-comments/anchors/relocate.ts`
- 创建：`scripts/verify-resume-comment-anchors.ts`
- 修改：`package.json`
- 修改：`supabase/functions/shared/resume-comment-core.ts`
- 修改：`src/lib/supabase/resume/share.ts`（适配任务 3 强制要求 anchor document 的发布 RPC）

- [x] **步骤 1：定义严格领域联合类型**

核心契约：

```ts
export type CommentScopeKind = 'working' | 'history' | 'share_release'
export type CommentActor
  = { kind: 'user'; userId: string }
  | { kind: 'anonymous'; anonymousId: string; secret: string }

export interface CommentAnchor {
  nodeKey: string
  startGraphemeOffset: number
  endGraphemeOffset: number
  blockOrdinal: number
  exactQuote: string
  prefix: string
  suffix: string
  nodeTextHash: string
  createdAtContentHash: string
}
```

thread、comment、event 和权限全部使用可辨识联合；客户端不能用可选布尔组合表达互斥身份。

- [x] **步骤 2：实现 NFC 与字素映射**

`graphemes.ts` 统一使用 `new Intl.Segmenter(undefined, { granularity: 'grapheme' })`。导出字符串字素计数、切片、DOM Text UTF-16 offset → 字素 offset、字素 offset → DOM Text offset；所有输入先 `.normalize('NFC')`。

- [x] **步骤 3：构造与模板无关的权威 anchor document**

把纯投影和 document builder 实现在 `resume-comment-core.ts`；浏览器的 `projection.ts`、`document.ts` 只以相对路径重导出并补充前端类型。它是 Runtime、浏览器选区和 Edge Function 的唯一可见文案来源，统一处理年龄、单位、薪资、日期区间和空值，不允许 renderer 与 builder 各自拼字符串。`buildCommentAnchorDocument(resume, projectionReferenceDate)` 输出稳定顺序的节点：

```ts
interface CommentAnchorDocumentNode {
  nodeKey: string
  sectionKey: keyof ResumeSchema
  entryId: string | 'singleton'
  fieldKey: string
  text: string
  blocks: Array<{ ordinal: number; start: number; end: number }>
}
```

`anchor_document` 同时保存 `projectionReferenceDate`。working 使用本次成功保存的日期；history 使用版本创建时间；share_release 使用 release 创建时间，使年龄等派生文案在不可变审阅中不会随自然日漂移。富文本使用受控、纯函数 HTML token scanner 生成段落、列表项、标题和引用块；只消费已允许标签并解码常用实体，script/style 内容丢弃，内联样式不拆块。document hash 对规范化节点 JSON 做 SHA-256。

- [x] **步骤 4：实现合法选区和重叠判断**

`selection.ts` 必须：从 Range 两端向上查找同一个 `data-comment-node-key` 与 `data-comment-block-ordinal`；拒绝 collapsed、跨 node、跨 block、测量 source 和不可见页；生成 exactQuote/prefix/suffix；识别完全相同与部分重叠。

- [x] **步骤 5：实现固定顺序重定位**

`relocateAnchor(anchor, nextNode)` 返回：

```ts
type RelocationResult =
  | { status: 'anchored'; anchor: CommentAnchor; moved: boolean; contextChanged: boolean }
  | { status: 'detached'; reason: 'node_missing' | 'quote_missing' | 'ambiguous' }
```

只在相同 nodeKey 内按“原偏移、唯一 quote + 上下文、唯一 quote、detached”顺序执行，禁止相似度和全文搜索。

- [x] **步骤 6：建立无需测试框架的断言脚本**

在 package scripts 增加：

```json
"verify:comments": "node --experimental-strip-types scripts/verify-resume-comment-anchors.ts"
```

脚本用 `node:assert/strict` 覆盖 nodeKey、中文、英文、emoji、组合字符、跨 DOM Text、跨块拒绝、唯一重定位、重复文本 detached、document hash/revision 输入、完全相同/部分重叠和权限矩阵。

- [ ] **步骤 7：运行纯逻辑与静态验证**

```bash
pnpm verify:comments
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/features/resume-comments scripts/verify-resume-comment-anchors.ts
deno check supabase/functions/shared/resume-comment-core.ts
git diff --check
```

预期：验证脚本输出 `resume comment anchor verification passed`，其余命令退出码为 `0`。

验证状态（2026-08-13）：`pnpm verify:comments`、TypeScript、定向 ESLint、生产构建和差异检查已通过；脚本覆盖 SHA-256、NFC、中文/英文/emoji/组合字符、跨 DOM Text 数据映射、跨块边界拒绝、富文本分块、稳定 nodeKey/hash、重定位、重叠和权限矩阵。本机没有 Deno，无法执行 `deno check`；共享核心已由 Node 原生 TypeScript strip-types 成功导入执行，因此本步骤暂不勾选 Deno 部分。

- [x] **步骤 8：提交锚点领域层**

```bash
git add docs/superpowers/plans/2026-08-13-resume-full-text-comments.md package.json scripts/verify-resume-comment-anchors.ts supabase/functions/shared/resume-comment-core.ts src/features/resume-comments/types.ts src/features/resume-comments/const.ts src/features/resume-comments/anchors/types.ts src/features/resume-comments/anchors/graphemes.ts src/features/resume-comments/anchors/projection.ts src/features/resume-comments/anchors/document.ts src/features/resume-comments/anchors/selection.ts src/features/resume-comments/anchors/relocate.ts src/lib/supabase/resume/share.ts
git diff --cached --name-status
git commit -m "feat(comments): 实现语义锚点领域层"
```

---

### 任务 5：让共享 Runtime 暴露语义节点并建立可见页几何层

**文件：**

- 修改：`src/components/resume/runtime/ResumeTemplateRuntime.tsx`
- 修改：`src/components/resume/runtime/TemplateRuntimeProviders.tsx`
- 修改：`src/components/resume/runtime/context/resume-context.tsx`
- 修改：`src/components/resume/runtime/renderers/shared.tsx`
- 修改：`src/components/resume/runtime/renderers/ApplicationInfoRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/BasicsRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/CampusExperienceRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/EducationRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/HobbiesRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/HonorsCertificatesRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/InternshipExperienceRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/JobIntentRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/ProjectExperienceRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/SelfEvaluationRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/SkillsRenderer.tsx`
- 修改：`src/components/resume/runtime/renderers/WorkExperienceRenderer.tsx`
- 修改：`src/components/resume/pagination/canonical-paged-document.tsx`
- 修改：`src/components/resume/pagination/scaled-resume-document.tsx`
- 创建：`src/features/resume-comments/anchors/geometry.ts`

- [x] **步骤 1：建立共享 CommentableText 边界**

在 `shared.tsx` 增加 `CommentableText` 与 `CommentableRichText`。字段节点统一输出：

```tsx
<span
  data-comment-node-key={nodeKey}
  data-comment-block-ordinal="0"
  data-comment-field-label={fieldLabel}
>
  {children}
</span>
```

富文本容器保留字段级 nodeKey，并把顶层语义块标记连续 ordinal；不得改变现有安全 HTML 过滤和视觉样式。

- [x] **步骤 2：所有 renderer 使用 stable entryId 与 field key**

`RuntimeEntry` 接收 `sectionKey`、`entryId` 和各字段 key；标题、副标题、时间和正文分别成为节点。Basics、JobIntent、ApplicationInfo、自我评价和三个描述字段使用 `singleton`。数组 React key 从 index/content 改为 `entryId`。

`ResumeTemplateRuntime` 增加可选 `projectionReferenceDate`，由 `TemplateRuntimeProviders` 放入 runtime context；renderer 的年龄、日期、单位和组合行一律调用任务 4 的投影函数。普通 working 预览默认当前日期，评论宿主、history 和 release 必须传 scope 中固定的 reference date。

- [x] **步骤 3：声明可见页、测量源与 Overlay 容器**

分页组件输出：

- 可见页 `data-resume-page-index`；
- 测量源 `data-resume-source="true" aria-hidden="true"`；
- 每页 `data-comment-overlay-root`；
- 当前 scale 的 CSS 自定义属性或 DOM 属性。

Runtime 不读取评论 store，也不渲染高亮。

- [x] **步骤 4：实现可见矩形转换**

`geometry.ts` 只接受可见页内 Range，调用 `getClientRects()` 后：裁剪到 page viewport、过滤零面积与 overflow 外矩形、减去 page rect、除以实际 scale，合并同一行相邻矩形。页面重新分页后用 page index 重新解析，不持久化几何坐标。

- [ ] **步骤 5：验证渲染不回归**

```bash
pnpm verify:comments
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/components/resume/runtime/ResumeTemplateRuntime.tsx src/components/resume/runtime/TemplateRuntimeProviders.tsx src/components/resume/runtime/context/resume-context.tsx src/components/resume/runtime/renderers src/components/resume/pagination/canonical-paged-document.tsx src/components/resume/pagination/scaled-resume-document.tsx src/features/resume-comments/anchors/geometry.ts
pnpm build
git diff --check
```

桌面浏览器比较修改前后单页、多页、内置模板和自定义模板；确认打印预览 DOM 中没有 Overlay。

验证记录（2026-08-13）：`verify:comments`、TypeScript、定向 ESLint、生产构建和 `git diff --check` 通过；浏览器在 `scale < 1` 下检查了 6 套内置模板、单页/多页、普通字段属性、富文本连续 ordinal、测量源隔离和空 Overlay root。当前浏览器控制接口不能动态切换 viewport，且离线环境没有可用自定义模板/历史打印快照，因此桌面与移动双 viewport、自定义模板和实际打印预览 DOM 留到评论 UI 接入后的宿主联调，不将其记作已验证。

- [x] **步骤 6：提交 Runtime 语义层**

```bash
git add src/components/resume/runtime/ResumeTemplateRuntime.tsx src/components/resume/runtime/TemplateRuntimeProviders.tsx src/components/resume/runtime/context/resume-context.tsx src/components/resume/runtime/renderers/shared.tsx src/components/resume/runtime/renderers/ApplicationInfoRenderer.tsx src/components/resume/runtime/renderers/BasicsRenderer.tsx src/components/resume/runtime/renderers/CampusExperienceRenderer.tsx src/components/resume/runtime/renderers/EducationRenderer.tsx src/components/resume/runtime/renderers/HobbiesRenderer.tsx src/components/resume/runtime/renderers/HonorsCertificatesRenderer.tsx src/components/resume/runtime/renderers/InternshipExperienceRenderer.tsx src/components/resume/runtime/renderers/JobIntentRenderer.tsx src/components/resume/runtime/renderers/ProjectExperienceRenderer.tsx src/components/resume/runtime/renderers/SelfEvaluationRenderer.tsx src/components/resume/runtime/renderers/SkillsRenderer.tsx src/components/resume/runtime/renderers/WorkExperienceRenderer.tsx src/components/resume/pagination/canonical-paged-document.tsx src/components/resume/pagination/scaled-resume-document.tsx src/features/resume-comments/anchors/geometry.ts
git diff --cached --name-status
git commit -m "feat(comments): 暴露简历语义评论节点"
```

---

### 任务 6：实现评论 Edge Function 的鉴权、写操作与访问令牌

**文件：**

- 创建：`supabase/functions/shared/resume-comment-schema.ts`
- 创建：`supabase/functions/shared/resume-comment-auth.ts`
- 创建：`supabase/functions/shared/resume-comment-events.ts`
- 创建：`supabase/functions/resume-comments/index.ts`
- 创建：`supabase/migrations/20260813000003_add_resume_comment_api_transactions.sql`
- 创建：`scripts/verify-resume-comment-service.ts`
- 修改：`supabase/functions/resume-share/index.ts`
- 修改：`supabase/functions/shared/resume-comment-core.ts`
- 修改：`supabase/tests/resume-comments.sql`
- 修改：`supabase/config.toml`
- 修改：`src/features/resume-comments/anchors/relocate.ts`
- 修改：`package.json`

- [x] **步骤 1：定义稳定 op 与错误协议**

Edge Function 只接受规格列出的 14 个 op，响应统一为：

```ts
type CommentApiResponse<T> =
  | { ok: true; data: T; eventSeq: number }
  | {
      ok: false
      error: {
        code: CommentErrorCode
        message: string
        retryAfterSeconds?: number
      }
    }
```

错误码固定为规格 12 节的集合；未知 op 返回 `not_found`，内部异常返回无敏感细节的 `unexpected`。

- [x] **步骤 2：实现四类服务端 actor 鉴权**

- owner：Supabase auth user 与 scope.owner_user_id 相同；
- collaborator：有效短期 token 绑定 session_id、resume_id、user_id、role，仅 working scope；
- share visitor：15 分钟 HMAC token 绑定 share_id、current_release_id、scope_id、密码验证世代；
- anonymous：identity ID + 256-bit secret，经恒定时间摘要比较且 share_id 必须匹配。

登录访问者的新内容一律记 user；请求可同时附旧匿名凭证，仅用于管理原浏览器旧评论，不做身份合并。

- [x] **步骤 3：签发和刷新公开评论访问令牌**

`resume-share` 在分享状态、有效期和密码校验后签发 token，并返回 release/scope/allowComments/15 分钟 expiresAt。token 原文不入库；每次评论写入重新校验 share 当前 release，因此重新发布后旧 token 立即返回 `stale_release`。

签发前若 backfill release 尚无 scope，`resume-share` 必须用 `resume-comment-core.ts` 从数据库中的 release snapshot 和 release.created_at 构造权威文档，再调用 service-role-only ensure RPC；不得接受浏览器提交的 anchor document。

- [x] **步骤 4：实现读取、写入和权限矩阵**

实现 bootstrap/list/create/reply/edit/delete/resolve/reopen/relink/mark_read/sync document。每个写请求：

1. 验证 request_id；
2. 验证 actor 和权限；
3. 验证 allow_comments、release/document/thread revision；
4. 验证 1–2,000 字素纯文本和锚点 schema；
5. 检查限流；
6. 事务写数据与 event；
7. 返回首次结果。

根评论有回复时删除为 tombstone；owner 删除线程为软删除并写审计事件。

- [x] **步骤 5：实现脱敏实时失效通知**

数据库提交成功后广播仅包含 `eventSeq` 和事件种类的通知，不包含 scope ID、正文、用户资料、匿名 ID、secret hash 或限流 key。公开 topic 由 `base64url(HMAC(realtimeSecret, scopeId:releaseId:15分钟时间桶))` 派生，令牌在当前时间桶结束时过期且最长有效 15 分钟；客户端提前刷新，服务端只向当前桶广播。owner 另获得同样短期的用户聚合 topic，用来刷新跨 scope 未读索引。广播失败不回滚数据库；客户端通过 list_threads/events 补偿。

- [x] **步骤 6：实现纯文本安全和安全链接**

服务端去除首尾空白与禁止控制字符，按字素计数；正文始终以字符串存储。链接识别只允许 `http:`、`https:`、`mailto:`，客户端渲染使用 React 节点，不使用 `dangerouslySetInnerHTML`。

- [ ] **步骤 7：检查函数与本地接口矩阵**

```bash
deno check supabase/functions/shared/resume-comment-core.ts supabase/functions/shared/resume-comment-schema.ts supabase/functions/shared/resume-comment-auth.ts supabase/functions/shared/resume-comment-events.ts supabase/functions/resume-comments/index.ts supabase/functions/resume-share/index.ts
supabase functions serve --no-verify-jwt
```

另开终端用 curl 验证 owner、登录 visitor、anonymous、comments disabled、stale release、stale document、stale revision、rate limited 和 request replay。预期均返回稳定 code，且数据库无重复 comment/event。

验证记录（2026-08-13）：通过 `deno check`、纯逻辑服务脚本、锚点脚本、定向 ESLint 和 SQL parser；SQL 验证脚本已扩充匿名身份、事务创建/回复、request replay、revision 冲突、mark_read 和 working 文档同步。`supabase functions serve --no-verify-jwt` 因本机没有 Docker/Podman 无法启动，所以 curl 接口矩阵和数据库实际事务执行尚未验证，不能以静态解析代替。

- [x] **步骤 8：提交评论服务**

```bash
git add supabase/functions/shared/resume-comment-core.ts supabase/functions/shared/resume-comment-schema.ts supabase/functions/shared/resume-comment-auth.ts supabase/functions/shared/resume-comment-events.ts supabase/functions/resume-comments/index.ts supabase/functions/resume-share/index.ts
git diff --cached --name-status
git commit -m "feat(comments): 实现统一评论服务"
```

---

### 任务 7：建立评论客户端、匿名凭证、Store 与实时补偿

**文件：**

- 创建：`src/features/resume-comments/api/client.ts`
- 创建：`src/features/resume-comments/api/anonymous-identity.ts`
- 创建：`src/features/resume-comments/api/realtime.ts`
- 创建：`src/features/resume-comments/api/realtime-recovery.ts`
- 创建：`src/features/resume-comments/store/types.ts`
- 创建：`src/features/resume-comments/store/create-store.ts`
- 创建：`src/features/resume-comments/context.tsx`
- 创建：`src/features/resume-comments/hooks/use-comment-realtime.ts`
- 创建：`scripts/verify-resume-comment-client.ts`
- 修改：`supabase/migrations/20260813000003_add_resume_comment_api_transactions.sql`
- 修改：`supabase/tests/resume-comments.sql`
- 修改：`package.json`

- [x] **步骤 1：实现不泄漏页面细节的 API client**

client 接受 `CommentAccessContext`，每个写方法自动附 `requestId`、actor credential、release/document/thread revision。遇到 stale 错误只返回领域错误，不自动把草稿写到新版本。

- [x] **步骤 2：实现按分享链接隔离的匿名身份**

localStorage key 为 `resume-comment-anonymous:<shareId>`，值只含 version、anonymousId、secret。首次评论前生成 256-bit secret 并调用 create identity；读取页面不强制创建身份。头像颜色和图形只由 anonymousId 派生，展示名恒为“匿名用户”。

- [x] **步骤 3：建立按 scope 隔离的 Store**

Store 保存；owner 的 `bootstrap_scope` 同时返回当前可访问 scope 摘要和短期用户聚合 topic，visitor/collaborator 只返回被授权的单个 scope：

```ts
interface CommentScopeState {
  scope: CommentScopeSummary
  threadsById: Record<string, CommentThread>
  orderedThreadIds: string[]
  activeThreadId: string | null
  selection: PendingCommentSelection | null
  draftsByThreadKey: Record<string, string>
  lastEventSeq: number
  lastReadEventSeq: number
  highlightsHidden: boolean
  connection: 'idle' | 'connecting' | 'live' | 'offline'
}
```

组件本地只保存输入展开、菜单和 Drawer snap；版本、线程、未读、草稿、选区和连接进入 Store。

- [x] **步骤 4：实现 event_seq 缺口补偿**

Realtime 通知只有序号。连续序号触发增量拉取；断线、序号跳跃、token 过期或 schema version 不匹配触发 bootstrap。公开页面每 60 秒刷新分享状态；关闭评论转只读并保留草稿，归档转不可用。

- [x] **步骤 5：实现未读推进规则**

自己事件不增加未读；新主评论、回复、reopen 按规格决定接收者。线程卡片进入 Drawer 可视区域并稳定 500ms 后调用 mark_read；乐观 UI 只降本地 badge，服务端失败后恢复。

- [ ] **步骤 6：静态验证并模拟离线恢复**

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/features/resume-comments/api src/features/resume-comments/store src/features/resume-comments/context.tsx src/features/resume-comments/hooks/use-comment-realtime.ts
git diff --check
```

在浏览器 DevTools 切离线后创建草稿，确认不无限重试；恢复网络先 bootstrap，再允许显式重发；同 requestId 重发不重复创建。

验证记录（2026-08-14）：`verify:comment-client` 已覆盖 scope 草稿隔离、离线状态、未读单调推进、连续序号增量和缺口 bootstrap；类型检查、定向 ESLint、服务/锚点脚本与 SQL parser 均通过。评论 Surface 尚未挂载到真实页面，因此 DevTools 离线交互和恢复后显式重发留到任务 8/10 接入页面后验证；数据库 request replay 的实际执行仍受本机缺少 Docker/Podman 限制。

- [x] **步骤 7：提交客户端领域状态**

```bash
git add src/features/resume-comments/api src/features/resume-comments/store src/features/resume-comments/context.tsx src/features/resume-comments/hooks/use-comment-realtime.ts
git diff --cached --name-status
git commit -m "feat(comments): 建立评论客户端状态与实时补偿"
```

---

### 任务 8：实现桌面选区、高亮和共享线程 Drawer

**文件：**

- 创建：`src/features/resume-comments/hooks/use-comment-selection.ts`
- 创建：`src/features/resume-comments/hooks/use-highlight-geometry.ts`
- 创建：`src/features/resume-comments/hooks/use-comment-actions.ts`
- 创建：`src/features/resume-comments/components/comment-surface.tsx`
- 创建：`src/features/resume-comments/components/selection-action.tsx`
- 创建：`src/features/resume-comments/components/highlight-overlay.tsx`
- 创建：`src/features/resume-comments/components/thread-picker.tsx`
- 创建：`src/features/resume-comments/components/comments-panel.tsx`
- 创建：`src/features/resume-comments/components/thread-list.tsx`
- 创建：`src/features/resume-comments/components/thread-detail.tsx`
- 创建：`src/features/resume-comments/components/comment-composer.tsx`
- 创建：`src/features/resume-comments/components/types.ts`
- 修改：`src/components/resume/pagination/canonical-paged-document.tsx`
- 修改：`src/features/resume-comments/const.ts`
- 修改：`src/index.css`

- [x] **步骤 1：实现选区生命周期和非法提示**

桌面监听 `selectionchange`、pointerup 和 keyup；只解析 CommentProvider 宿主内的可见 Range。合法选区显示附近气泡；跨节点、跨 block、跨页时不创建 selection，并以短提示说明“请选择同一段落或字段内的文字”。Esc 先清气泡，再关闭线程详情。

- [x] **步骤 2：实现 Overlay 高亮和重叠选择**

每页独立绝对定位 Overlay，`pointer-events: none`；可点击命中层只覆盖几何矩形。未解决低透明暖黄，active 加强，resolved/detached 不画。相同或部分重叠矩形合并命中区域，点击后 ThreadPicker 展示引用、作者和最近活动。

- [x] **步骤 3：实现 400px 桌面 Drawer 内容**

`CommentsPanel` 接受 responsive presentation，不拥有页面级 Store。桌面宽度 400px；宽屏由宿主预留空间，窄桌面覆盖。顶部包含来源、未读、隐藏高亮；列表有未解决、已解决、失去锚点三个筛选。

- [x] **步骤 4：实现线程与一级回复**

root + replies 一层结构；作者菜单按权限显示编辑/删除；owner 可删除任意和整线程；root 作者/owner 可 resolve/reopen/relink。删除 root 且有回复时显示“原评论已删除”tombstone。

- [x] **步骤 5：实现纯文本 Composer**

Textarea 支持换行、字素计数、2,000 上限和保留草稿。渲染正文时把安全 URL 切成 React `<a rel="noreferrer noopener">`；非法协议保持普通文字。未发送关闭不创建空线程，成功后才清选区和草稿。

- [x] **步骤 6：建立重算触发与打印双保险**

字体 `document.fonts.ready`、ResizeObserver、分页完成、scale、窗口 resize、版本切换和 threads 变化时重算。CSS 增加：

```css
@media print {
  [data-resume-comment-ui] {
    display: none !important;
  }
}
```

- [ ] **步骤 7：静态与桌面交互验证**

```bash
pnpm verify:comments
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/features/resume-comments
pnpm build
git diff --check
```

桌面 Chromium 验证：键盘选区、鼠标选区、同选区复用线程、部分重叠、隐藏高亮、筛选、编辑/删除/解决/重开、字体加载、resize、多页、scale < 1、打印预览。

验证记录（2026-08-14）：锚点/客户端脚本、类型检查、全评论目录 ESLint 和生产构建通过；高亮实现已按每个分页可见副本分别裁剪，并为打印 Overlay 增加统一隐藏属性。共享 Surface 尚未挂载到编辑器或分享路由，因此上述真实桌面交互矩阵留到任务 9/10 接入后执行，不能以本批静态通过代替。

- [x] **步骤 8：提交共享桌面评论层**

```bash
git add src/features/resume-comments/hooks/use-comment-selection.ts src/features/resume-comments/hooks/use-highlight-geometry.ts src/features/resume-comments/components/comment-surface.tsx src/features/resume-comments/components/selection-action.tsx src/features/resume-comments/components/highlight-overlay.tsx src/features/resume-comments/components/thread-picker.tsx src/features/resume-comments/components/comments-panel.tsx src/features/resume-comments/components/thread-list.tsx src/features/resume-comments/components/thread-detail.tsx src/features/resume-comments/components/comment-composer.tsx src/index.css
git diff --cached --name-status
git commit -m "feat(comments): 实现桌面划词评论交互"
```

---

### 任务 9：接入编辑器当前工作版本和确定性重定位

**文件：**

- 修改：`src/pages/resume/editor/index.tsx`
- 创建：`src/pages/resume/editor/hooks/use-comment-review-mode.ts`
- 创建：`src/features/resume-comments/api/working-document-sync.ts`
- 修改：`src/features/resume-comments/api/client.ts`
- 修改：`src/features/resume-comments/components/comment-surface.tsx`
- 修改：`src/features/resume-comments/components/comments-panel.tsx`
- 修改：`src/features/resume-comments/context.tsx`
- 修改：`src/features/resume-comments/hooks/use-comment-actions.ts`
- 修改：`src/store/resume/slices/sync.ts`
- 修改：`supabase/functions/resume-comments/index.ts`
- 修改：`scripts/verify-resume-comment-service.ts`

- [x] **步骤 1：在最终画布挂载当前 working scope**

Preview 仅在 `mode === 'online'` 时将 `documentRef`、visible page root、resumeId、owner/current collaborator actor 和当前 ResumeSchema 注入 CommentProvider。全局评论按钮显示当前可访问 scope 未读；离线模式不请求 bootstrap，入口禁用并提示“转为在线简历后可评论”。不修改表单组件。

- [x] **步骤 2：让桌面编辑面板与评论侧栏互斥**

桌面打开评论时关闭右侧 EditPanel 并记录之前状态；评论关闭后仅在用户未主动切换面板时恢复。此互斥状态留在 editor 页面本地 UI，不进入全局 resume Store。移动端编辑 Drawer 与评论 Drawer 的互斥归入任务 11 的移动端交互统一处理。

- [x] **步骤 3：在成功同步之后更新权威 anchor document**

`working-document-sync.ts` 提供注册/注销持久化完成监听器。`sync.ts` 在 `saveToSupabase` 与 `updateResumeConfig` 都成功后只通知一次，监听器再调用 `sync_working_document(document, hash, expectedRevision)`；评论文档同步失败不回滚已成功的简历保存，而是在评论 Store 标记待重试。本地未同步内容只投影高亮；从未同步内容创建评论时先触发现有 `manualSync()`，检查 `syncError`/`pendingChanges` 后再写评论，失败则保留草稿并显示可恢复错误。

- [x] **步骤 4：处理 document revision 竞争**

sync 返回 stale_document 时拉取最新 scope，再对当前已保存 ResumeSchema 重建 document；不盲重试覆盖。服务端事务重定位全部未解决线程，客户端应用 anchor_moved/detached event。

- [x] **步骤 5：权限验证**

owner 可管理任意当前评论；普通登录但无协作 token 的用户不能进入 working scope；collaborator 接入留给任务 13。登出或切换 resume 时销毁订阅、清选区和临时高亮。

- [ ] **步骤 6：验证编辑与锚点变化**

运行静态命令后在桌面验证：插入前缀后唯一引用移动；删除引用后 detached；制造重复引用后 detached；切换模板 nodeKey 不变；保存失败不把服务端锚点更新到未保存内容。

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint scripts/verify-resume-comment-service.ts src/pages/resume/editor/index.tsx src/pages/resume/editor/hooks/use-comment-review-mode.ts src/features/resume-comments/api/client.ts src/features/resume-comments/api/working-document-sync.ts src/features/resume-comments/context.tsx src/features/resume-comments/hooks/use-comment-actions.ts src/store/resume/slices/sync.ts
pnpm verify:comment-service
pnpm build
git diff --check
```

验证记录（2026-08-14）：评论服务、客户端和锚点断言脚本，TypeScript、定向 ESLint、Deno Edge 检查、生产构建和差异检查均通过；签名篡改断言改为翻转解码后的实际字节，并连续运行 20 次稳定通过。浏览器真实创建并打开了一份离线简历，确认评论按钮禁用且提示“离线简历不能评论”，没有挂载评论侧栏。已登录的在线编辑器最初稳定复现 React `getSnapshot` 未缓存和 `Maximum update depth`，错误组件为 `CommentSurface`；根因是两处 Zustand selector 每次创建新的线程数组，统一改用仓库现有 `useShallow` 后，刷新可正常渲染简历，未再出现对应控制台错误。真实确认评论侧栏可打开、空线程分类正常、与 EditPanel 互斥且关闭后恢复原编辑面板。没有向真实简历写入测试评论，因此创建、唯一引用移动、detached、重复引用和保存失败矩阵仍保留为未验证，不能以静态通过替代。

- [x] **步骤 7：提交编辑器接入**

```bash
git add src/pages/resume/editor/components/preview/index.tsx src/pages/resume/editor/index.tsx src/pages/resume/editor/hooks/use-comment-review-mode.ts src/pages/resume/editor/hooks/use-resume-loader.ts src/features/resume-comments/api/working-document-sync.ts src/store/resume/slices/sync.ts
git diff --cached --name-status
git commit -m "feat(comments): 接入简历工作版本评论"
```

---

### 任务 10：接入公开分享、匿名评论与短期访问刷新

**文件：**

- 创建：`src/pages/share/view/hooks/use-share-comment-access.ts`
- 修改：`src/pages/share/view/[token].tsx`
- 修改：`src/lib/supabase/resume/share.types.ts`
- 修改：`src/lib/supabase/resume/share.ts`
- 修改：`src/components/resume/scaled-readonly-preview.tsx`
- 修改：`src/features/resume-comments/context.tsx`
- 修改：`src/features/resume-comments/hooks/use-comment-actions.ts`
- 修改：`src/features/resume-comments/hooks/use-comment-realtime.ts`
- 修改：`src/features/resume-comments/store/create-store.ts`
- 修改：`src/features/resume-comments/store/types.ts`
- 修改：`supabase/functions/resume-share/index.ts`
- 修改：`scripts/verify-resume-comment-client.ts`
- 修改：`scripts/verify-resume-comment-service.ts`

- [x] **步骤 1：让公开页面只绑定 current release scope**

从 fetch 结果取得 shareId、releaseId、scopeId、allowComments、accessToken、expiresAt 和 capability topic；CommentProvider 不接受外部任意 scopeId。分享页面不显示历史或旧 release 切换器。

- [x] **步骤 2：按登录状态选择新评论身份**

已登录时新评论使用当前 `useCurrentUser` 的 user ID、姓名和头像；未登录时在第一次写入创建匿名身份。已登录请求仍携带当前 share 的旧匿名凭证，以便同浏览器编辑/删除旧匿名内容。

- [x] **步骤 3：实现评论关闭和分享状态变化**

allow_comments=false 仍读取已有评论，但隐藏/禁用所有写操作。每 60 秒刷新状态；密码变化、过期、停用和归档按现有分享错误页处理；重新发布返回 stale_release 后清旧 scope、保留草稿并刷新当前页面快照。

访问刷新使用 `refresh: true`，不重复累计分享浏览量；每次刷新签发新 15 分钟访问令牌并重启对应 Realtime。重新发布或写入返回 `stale_release` 时，只允许下一次 scope 切换携带现有草稿，选区和旧线程状态仍清空。公开 Runtime 使用 comment scope 的固定 `projectionReferenceDate`，避免年龄等派生文字与锚点文档漂移。

- [ ] **步骤 4：验证匿名生命周期和多窗口实时**

覆盖：未登录创建/编辑/删除；刷新后凭证恢复；清除 localStorage 后只能读不能管旧评论；登录后新评论显示用户信息且旧匿名仍可管；两个窗口互相收到评论/回复/resolve；不同 share URL 看不到彼此评论。

- [x] **步骤 5：静态验证与提交**

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/pages/share/view src/lib/supabase/resume/share.ts src/lib/supabase/resume/share.types.ts src/components/resume/scaled-readonly-preview.tsx src/features/resume-comments/context.tsx src/features/resume-comments/hooks/use-comment-actions.ts src/features/resume-comments/hooks/use-comment-realtime.ts src/features/resume-comments/store scripts/verify-resume-comment-client.ts scripts/verify-resume-comment-service.ts supabase/functions/resume-share/index.ts
pnpm verify:comment-client
pnpm verify:comment-service
pnpm dlx deno-bin check --no-lock supabase/functions/resume-share/index.ts
pnpm build
git diff --check
```

```bash
git add src/pages/share/view src/lib/supabase/resume/share.ts src/lib/supabase/resume/share.types.ts src/components/resume/scaled-readonly-preview.tsx src/features/resume-comments/context.tsx src/features/resume-comments/hooks/use-comment-actions.ts src/features/resume-comments/hooks/use-comment-realtime.ts src/features/resume-comments/store/create-store.ts src/features/resume-comments/store/types.ts scripts/verify-resume-comment-client.ts scripts/verify-resume-comment-service.ts supabase/functions/resume-share/index.ts
git diff --cached --name-status
git commit -m "feat(comments): 接入分享匿名评论"
```

验证记录（2026-08-14）：根据产品纠正，桌面评论面板已在独立提交 `59cae6b` 中统一改用项目 Base UI `Drawer`，编辑器为右侧非模态 Drawer，公开分享为右侧模态 Drawer，不再使用 `Sheet` 或常驻 `aside`。Task 10 的 TypeScript、定向 ESLint、评论客户端/服务断言、两支 Edge Deno 检查、生产构建和差异检查通过。已登录浏览器连接在进入分享管理页时中断，因此没有向真实分享写入测试评论；匿名创建/恢复/清存储失权、登录身份切换、双窗口 Realtime 与 URL 隔离矩阵仍保持未勾选，不能以静态验证代替。

---

### 任务 11：实现移动端原生选区操作条与底部 Drawer

**文件：**

- 修改：`src/features/resume-comments/hooks/use-comment-selection.ts`
- 修改：`src/features/resume-comments/components/selection-action.tsx`
- 修改：`src/features/resume-comments/components/comments-panel.tsx`
- 修改：`src/features/resume-comments/components/comment-surface.tsx`
- 修改：`src/pages/resume/editor/index.tsx`
- 修改：`src/pages/share/view/[token].tsx`

- [ ] **步骤 1：移动端保留浏览器原生选择体验**

在现有 `useIsMobile` 断点下不渲染桌面 floating bubble，不拦截 `contextmenu`、copy 或 selection handles。合法原生选区稳定后显示底部固定操作条：“已选择 N 个字 · 评论”。

- [ ] **步骤 2：复用 Base UI Drawer 的两个 snap point**

评论面板移动 presentation 使用现有 `src/components/ui/drawer.tsx`，snap points 为 `0.56` 和 `0.92`，显示 swipe handle。打开/关闭不重置画布 scroll；关闭线程后滚动回原锚点仅在用户未主动滚动时执行。

- [ ] **步骤 3：处理键盘、安全区和操作冲突**

Composer 聚焦时 Drawer 提升至 92%；底部 padding 使用 `env(safe-area-inset-bottom)`；操作条避开现有编辑器底部按钮。编辑 Drawer、评论 Drawer 和分享页其他 modal 同时最多打开一个。

- [ ] **步骤 4：验证 768px 两侧响应式切换**

在 767px、768px、769px 验证组件不会同时渲染桌面和移动入口；旋转设备时关闭临时气泡但保留草稿和 active thread；分页/缩放后的底部操作条不遮住原生选区。

- [ ] **步骤 5：真实设备验收**

至少完成：

- iOS Safari：中文、英文、emoji 长按；复制菜单；匿名评论；键盘；56%/92%；
- Android Chrome：相同矩阵；
- 编辑器与公开分享各一轮；
- 单页、多页、scale < 1 各一轮。

记录设备、系统、浏览器版本和结果；失败时不得用静态检查宣称通过。

- [ ] **步骤 6：静态验证与提交**

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/features/resume-comments src/pages/resume/editor/index.tsx 'src/pages/share/view/[token].tsx'
pnpm build
git diff --check
```

```bash
git add src/features/resume-comments/hooks/use-comment-selection.ts src/features/resume-comments/components/selection-action.tsx src/features/resume-comments/components/comments-panel.tsx src/features/resume-comments/components/comment-surface.tsx src/pages/resume/editor/index.tsx 'src/pages/share/view/[token].tsx'
git diff --cached --name-status
git commit -m "feat(comments): 完成移动端评论交互"
```

---

### 任务 12：实现版本审阅、分享反馈、评论开关与归档删除

**文件：**

- 创建：`src/features/resume-comments/components/comment-source-selector.tsx`
- 修改：`src/pages/resume/editor/hooks/use-comment-review-mode.ts`
- 修改：`src/pages/share/store/types.ts`
- 修改：`src/pages/share/store/data.ts`
- 修改：`src/pages/share/store/ui.ts`
- 修改：`src/pages/share/components/settings-dialog/index.tsx`
- 创建：`src/pages/share/components/archive-dialog/index.tsx`
- 修改：`src/pages/share/components/delete-dialog/index.tsx`
- 修改：`src/pages/share/components/version-dialog/index.tsx`
- 修改：`src/pages/share/components/card/index.tsx`
- 修改：`src/pages/share/components/quick-dialog/index.tsx`
- 修改：`src/pages/share/components/quick-dialog/link-row.tsx`
- 修改：`src/pages/share/components/mobile-list/index.tsx`
- 修改：`src/pages/share/components/mobile-list/mobile-item.tsx`
- 修改：`src/pages/share/components/mobile-list/action-drawer.tsx`
- 修改：`src/pages/history/store/history-data.ts`
- 修改：`src/pages/history/components/timeline/version-card.tsx`
- 修改：`src/pages/history/components/detail-panel/detail-header.tsx`
- 修改：`src/lib/supabase/resume/history/queries.ts`

- [ ] **步骤 1：实现 owner 评论来源列表**

编辑器 Drawer 来源包含当前工作、历史版本、分享反馈和已归档分享。当前/历史按文档顺序，分享反馈按最后活动倒序，展示未读与 release 编号。同一 underlying V1 的两个 share release 始终是两个独立项。

- [ ] **步骤 2：切换不可变只读审阅模式**

选择 history/share release 时加载其 snapshot + template manifest + scope，保存当前编辑器 scroll、选中 section、EditPanel 状态和工作快照引用，画布切为只读。退出审阅恢复原工作版本与 UI；审阅模式禁止表单持久化和 working document sync。

- [ ] **步骤 3：实现手动重新关联**

detached 线程显示原引用和字段名。owner 或 root 作者点击“重新关联”后进入一次性选区模式，仅接受当前目标 scope 的合法文本，提交 expected thread revision + document hash；失败保留 thread 和选择提示。

- [ ] **步骤 4：加入 `allow_comments` 设置**

分享设置 Dialog 增加默认开启的 Switch。关闭后 owner 内部仍能管理；公开页面收到设置事件后转只读。快速分享、管理页卡片和移动列表都显示“允许评论/仅查看”。

- [ ] **步骤 5：区分归档和永久删除**

原主操作“删除分享”改为“归档分享”，由新 `archive-dialog` 确认：外部立即不可访问，owner 仍在“已归档”来源审阅。现有 `delete-dialog` 保留为次级“永久删除”，并明确 release 和评论不可恢复。重新发布同 URL 创建空评论的新 release，旧 release 仅 owner 可见。

- [ ] **步骤 6：历史版本删除同步清理评论**

历史删除改用 `delete_resume_history_version_with_comments` RPC；确认文案明确“该历史版本的内部评论也会永久删除，已发布分享不受影响”。删除成功后编辑器若正在审阅该 history，退出到 working。

- [ ] **步骤 7：版本隔离浏览器验证**

覆盖：working 保存 history 不复制评论；同 V1 两个链接隔离；同 URL republish 新 release 为空；旧 release owner 可审阅、visitor 不可读；历史删除清内部 scope、不影响 release；归档保留、永久删除级联。

- [ ] **步骤 8：静态验证与提交**

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/features/resume-comments/components/comment-source-selector.tsx src/pages/resume/editor/hooks/use-comment-review-mode.ts src/pages/share/store/types.ts src/pages/share/store/data.ts src/pages/share/store/ui.ts src/pages/share/components/settings-dialog/index.tsx src/pages/share/components/archive-dialog/index.tsx src/pages/share/components/delete-dialog/index.tsx src/pages/share/components/version-dialog/index.tsx src/pages/share/components/card/index.tsx src/pages/share/components/quick-dialog/index.tsx src/pages/share/components/quick-dialog/link-row.tsx src/pages/share/components/mobile-list/index.tsx src/pages/share/components/mobile-list/mobile-item.tsx src/pages/share/components/mobile-list/action-drawer.tsx src/pages/history/store/history-data.ts src/pages/history/components/timeline/version-card.tsx src/pages/history/components/detail-panel/detail-header.tsx src/lib/supabase/resume/history/queries.ts
pnpm build
git diff --check
```

```bash
git add src/features/resume-comments/components/comment-source-selector.tsx src/pages/resume/editor/hooks/use-comment-review-mode.ts src/pages/share/store/types.ts src/pages/share/store/data.ts src/pages/share/store/ui.ts src/pages/share/components/settings-dialog/index.tsx src/pages/share/components/archive-dialog/index.tsx src/pages/share/components/delete-dialog/index.tsx src/pages/share/components/version-dialog/index.tsx src/pages/share/components/card/index.tsx src/pages/share/components/quick-dialog/index.tsx src/pages/share/components/quick-dialog/link-row.tsx src/pages/share/components/mobile-list/index.tsx src/pages/share/components/mobile-list/mobile-item.tsx src/pages/share/components/mobile-list/action-drawer.tsx src/pages/history/store/history-data.ts src/pages/history/components/timeline/version-card.tsx src/pages/history/components/detail-panel/detail-header.tsx src/lib/supabase/resume/history/queries.ts
git diff --cached --name-status
git commit -m "feat(comments): 完成版本审阅与分享归档"
```

---

### 任务 13：把现有实时编辑协作者纳入受限评论权限

**文件：**

- 修改：`src/lib/collaboration/session/types.ts`
- 修改：`src/lib/collaboration/session/store.ts`
- 修改：`src/pages/resume/editor/hooks/use-collaboration-panel-value.ts`
- 修改：`src/lib/collaboration/session/service.ts`
- 修改：`src/lib/collaboration/session/state.ts`
- 修改：`supabase/functions/resume-comments/index.ts`
- 修改：`supabase/functions/shared/resume-comment-auth.ts`
- 修改：`supabase/migrations/20260813000002_add_resume_comments.sql`

- [ ] **步骤 1：增加服务端可验证的协作成员记录**

迁移增加 `resume_comment_collaboration_sessions` 与 members：session_id、resume_id、owner_user_id、user_id、role、expires_at、revoked_at。只允许 service role 写；客户端声明 role 不参与授权。

- [ ] **步骤 2：接入 host/join/leave 生命周期**

owner 开始协作时注册 session；已登录 guest 成功加入后换取绑定 session_id/resume_id/user_id/role 的短期评论 token；续期需 active session；leave、host stop、resume 切换和超时撤销。

- [ ] **步骤 3：限制协作者可见范围和动作**

collaborator 只能 bootstrap working scope，不能请求 history/share feedback/archive；可创建、回复、编辑/删除自己的内容；只能 resolve/reopen/relink 自己创建的 root；不能删除他人或整线程。

- [ ] **步骤 4：验证伪造和过期 token**

验证：修改客户端 role 无效；token 用于另一个 resume 无效；host 结束后写入失败；owner 能看到协作者当前评论；协作者看不到任何分享反馈；协作者离线草稿在 token 失效后保留但不能发送。

- [ ] **步骤 5：静态、SQL 与接口验证**

```bash
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/resume-comments.sql
deno check supabase/functions/shared/resume-comment-auth.ts supabase/functions/resume-comments/index.ts
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/lib/collaboration/session/types.ts src/lib/collaboration/session/store.ts src/lib/collaboration/session/service.ts src/lib/collaboration/session/state.ts src/pages/resume/editor/hooks/use-collaboration-panel-value.ts
git diff --check
```

- [ ] **步骤 6：提交协作者权限**

```bash
git add supabase/migrations/20260813000002_add_resume_comments.sql supabase/tests/resume-comments.sql supabase/functions/shared/resume-comment-auth.ts supabase/functions/resume-comments/index.ts src/lib/collaboration/session/types.ts src/lib/collaboration/session/store.ts src/lib/collaboration/session/service.ts src/lib/collaboration/session/state.ts src/pages/resume/editor/hooks/use-collaboration-panel-value.ts
git diff --cached --name-status
git commit -m "feat(comments): 接入实时协作者权限"
```

---

### 任务 14：完成全链路回归、真实设备记录与运维说明

**文件：**

- 修改：`docs/superpowers/specs/2026-08-13-resume-full-text-comments-design.md`（仅记录与批准规格一致的实施事实）
- 创建：`docs/superpowers/verification/2026-08-13-resume-full-text-comments.md`
- 修改：本计划的复选框与验证结果

- [ ] **步骤 1：运行完整静态与纯逻辑验证**

```bash
pnpm verify:comments
pnpm exec tsc --noEmit --pretty false
pnpm lint
pnpm build
git diff --check
```

记录每条命令的时间、exit code 和关键输出；不得把计划中的预期结果写成实际通过。

- [ ] **步骤 2：运行本地数据库和 Edge Function 验证**

```bash
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/resume-comments.sql
supabase db lint --local
deno check supabase/functions/shared/resume-comment-schema.ts supabase/functions/shared/resume-comment-auth.ts supabase/functions/shared/resume-comment-events.ts supabase/functions/resume-comments/index.ts supabase/functions/resume-share/index.ts
```

验证文档注明本地 Supabase 版本和是否使用隔离项目；不连接生产数据库做破坏性验证。

- [ ] **步骤 3：完成桌面矩阵**

Chromium 至少覆盖：owner working、history、两个 share、republish、archive、anonymous、authenticated visitor、collaborator、双窗口 Realtime、离线恢复、重叠线程、detached/relink、评论关闭、密码分享、多页、缩放、内置/自定义模板、打印/PDF。

- [ ] **步骤 4：完成移动设备矩阵**

记录 iOS Safari 与 Android Chrome 的设备、系统、浏览器版本和每项结果。若环境没有真实设备，明确标记“未验证”，不能用响应式桌面模拟替代完成状态。

- [ ] **步骤 5：审计安全和隐私边界**

确认：数据库无匿名 secret 原文和原始 IP；公开响应无 owner 私有版本列表；Realtime 无正文；评论表无直接 anon/authenticated grant；旧 release token 失效；URL 协议白名单；正文无 `dangerouslySetInnerHTML`；PDF/打印树无评论 UI。

- [ ] **步骤 6：记录发布与回滚顺序**

验证文档写明：先部署迁移，再部署两个 Edge Function，再部署前端；旧列保留用于回滚。回滚前端时仍能从兼容旧列读取；不要回滚已产生 release/comment 数据的迁移。正式清理旧 snapshot 列必须另开规格与迁移。

- [ ] **步骤 7：最终复核提交边界**

```bash
git status --short
git log --oneline --decorate -15
git diff upstream/feat/comment...HEAD --stat
git diff upstream/feat/comment...HEAD --check
```

确认没有 `.env`、本地 Supabase 数据、匿名 secret、截图、设备标识或 `.superpowers/brainstorm/` 进入提交。

- [ ] **步骤 8：提交验证记录**

```bash
git add docs/superpowers/specs/2026-08-13-resume-full-text-comments-design.md docs/superpowers/plans/2026-08-13-resume-full-text-comments.md docs/superpowers/verification/2026-08-13-resume-full-text-comments.md
git diff --cached --name-status
git commit -m "docs(comments): 记录全文评论验证结果"
```

---

## 完成判定

只有同时满足以下条件才可宣布功能完成：

1. 任务 1–14 的实现和验证项均有实际证据；
2. 规格 18 节的 17 条验收清单逐条通过或明确记录未通过；
3. 本地数据库、Edge Function、TypeScript、ESLint、生产构建和 diff 检查通过；
4. 桌面真实浏览器通过；
5. iOS Safari 与 Android Chrome 真实设备通过，否则移动端状态必须写为“未验证”；
6. 现有编辑器、历史、分享、打印和 PDF 无回归；
7. 没有超出规格的身份合并、评论迁移或外部通知能力。
