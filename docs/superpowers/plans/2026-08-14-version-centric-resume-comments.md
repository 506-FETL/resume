# 版本中心化简历评论实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将简历全文评论改为以稳定 `version_id` 为唯一正文与评论边界，并完成性能、双端 Drawer、飞书式书签、递归回复、Motion 和异步反馈的系统治理。

**架构：** `resume_config_versions` 同时承载可变的活动版本与不可变的冻结版本，`resume_shares` 和 `resume_comment_scopes` 直接绑定版本。Edge Function 返回可增量应用的标准化实体和事件序号；客户端使用版本级缓存、乐观更新和 Realtime 去重。桌面端与移动端复用评论领域组件，但分别使用右侧 Drawer 与无 snap points 的底部 Drawer。

**技术栈：** React 19、TypeScript、Zustand 5、Motion 12、Base UI Drawer 1.7、Supabase Postgres/Auth/Realtime/Edge Functions、Deno、Tailwind CSS 4。

**仓库约束：** 当前仓库不要求 TDD；本计划使用现有 `verify:comments`、`verify:comment-client`、`verify:comment-service` 脚本、SQL 验证、类型检查、定向 ESLint 和生产构建作为逐阶段验证。

---

## 文件结构

### 数据与版本领域

- 创建 `supabase/migrations/20260814000001_add_version_centric_resume_comments.sql`：添加版本状态、分享版本引用、版本评论空间、版本级匿名身份、递归回复约束、迁移映射与原子 RPC。
- 修改 `supabase/migrations/init_table.sql`：同步最新全量初始化结构。
- 修改 `src/lib/supabase/resume/history/types.ts`：增加活动/冻结版本字段和版本列表类型。
- 修改 `src/lib/supabase/resume/history/queries.ts`：查询当前版本、列出所有版本、创建新活动版本和读取版本快照。
- 修改 `src/lib/supabase/resume/share.types.ts`：分享记录与公开读取结果增加 `versionId/documentRevision`。
- 修改 `src/lib/supabase/resume/share.ts`：创建分享时绑定版本，owner 列表读取版本元数据。
- 修改 `src/lib/supabase/resume/share-version.ts`：将 current/history 选择解析为明确 `versionId`。

### Edge Functions

- 修改 `supabase/functions/resume-share/index.ts`：公开分享从版本读取正文，签发绑定版本的评论访问令牌。
- 修改 `supabase/functions/resume-comments/index.ts`：直接解析版本空间、批量 bootstrap、递归回复、增量 mutation、事件去重、短期权限续签、Server-Timing 和结构化错误。

### 评论客户端与状态

- 修改 `src/features/resume-comments/types.ts`：版本访问、递归评论、标准化 mutation 和错误类型。
- 修改 `src/features/resume-comments/store/types.ts`：版本来源、实体 pending、缓存状态和结构化错误。
- 修改 `src/features/resume-comments/store/create-store.ts`：乐观增删改、回滚、增量事件、草稿冲突和强/弱高亮状态。
- 创建 `src/features/resume-comments/api/cache.ts`：IndexedDB 版本级 stale-while-revalidate 缓存。
- 创建 `src/features/resume-comments/api/performance.ts`：客户端性能标记和请求 ID 观测。
- 修改 `src/features/resume-comments/api/anonymous-identity.ts`：匿名身份从分享级改为版本级。
- 修改 `src/features/resume-comments/api/client.ts`：版本访问上下文、会话复用、标准化错误、增量响应与 timings。
- 修改 `src/features/resume-comments/api/realtime-recovery.ts`：区分忽略、增量补偿和完整恢复。
- 修改 `src/features/resume-comments/hooks/use-comment-actions.ts`：共享 pending、乐观更新、失败回滚，不再写后全量刷新。
- 修改 `src/features/resume-comments/hooks/use-comment-realtime.ts`：缓存先显、事件去重、权限续签不 bootstrap。
- 修改 `src/features/resume-comments/context.tsx`：初始化缓存和领域状态。

### 评论 UI

- 修改 `src/features/resume-comments/const.ts`：统一 `COMMENT_MOTION` 与布局常量。
- 创建 `src/features/resume-comments/components/comment-bookmark.tsx`：飞书式贴边评论入口。
- 创建 `src/features/resume-comments/components/comment-status-bar.tsx`：同步、离线、权限和缓存过期反馈。
- 创建 `src/features/resume-comments/components/comment-tree.tsx`：递归树、最大可视缩进和回复详情入口。
- 修改 `src/features/resume-comments/components/comments-panel.tsx`：桌面/移动 Drawer、无 snap points、有界高度、虚拟键盘。
- 修改 `src/features/resume-comments/components/thread-list.tsx`：AnimatePresence 列表、快捷解决和卡片迁移。
- 修改 `src/features/resume-comments/components/thread-detail.tsx`：递归回复详情、消息气泡快捷回复、tombstone 和局部操作反馈。
- 修改 `src/features/resume-comments/components/comment-composer.tsx`：发送/回复中、草稿保留和 revision 冲突提示。
- 修改 `src/features/resume-comments/components/comment-source-selector.tsx`：仅版本来源、局部加载和错误重试。
- 修改 `src/features/resume-comments/components/highlight-overlay.tsx`：弱/强高亮状态过渡。
- 修改 `src/features/resume-comments/components/comment-surface.tsx`：缓存/状态条/树状视图集成。

### 页面接入与验证

- 修改 `src/pages/resume/editor/hooks/use-comment-review-mode.ts`：版本来源独立容错和版本审阅。
- 修改 `src/pages/resume/editor/index.tsx`：书签停靠、编辑侧栏互斥、桌面右侧 Drawer。
- 修改 `src/pages/share/view/[token].tsx`：移动端首帧一致、底部 Drawer、版本正文实时更新。
- 修改 `src/pages/share/view/hooks/use-share-comment-access.ts`：版本级访问刷新。
- 修改 `scripts/verify-resume-comment-client.ts`：乐观更新、事件去重、缓存和递归树验证。
- 修改 `scripts/verify-resume-comment-service.ts`：版本权限、递归回复、结构化响应和性能请求预算验证。
- 修改 `scripts/verify-resume-comment-anchors.ts`：正文 revision 变化和 detached 验证。
- 创建 `docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md`：逐项记录静态、浏览器和真机证据。

---

### 任务 1：建立版本中心化数据库不变量

**文件：**
- 创建：`supabase/migrations/20260814000001_add_version_centric_resume_comments.sql`
- 修改：`supabase/migrations/init_table.sql`

- [ ] **步骤 1：添加活动/冻结版本和权威外键**

迁移必须增加：

```sql
alter table public.resume_config_versions
  add column if not exists status text,
  add column if not exists document_revision bigint not null default 1,
  add column if not exists projection_reference_date date;

alter table public.resume_config
  add column if not exists current_version_id bigint
  references public.resume_config_versions(id);

alter table public.resume_shares
  add column if not exists version_id bigint
  references public.resume_config_versions(id);

alter table public.resume_comment_scopes
  add column if not exists version_id bigint
  references public.resume_config_versions(id);
```

回填后增加 `status in ('active','frozen')` 检查、每份简历单活动版本部分唯一索引和每版本单评论空间部分唯一索引。

- [ ] **步骤 2：回填活动版本和分享版本**

对每份在线简历：如果不存在活动版本，则从 `resume_config` 当前持久字段构造 snapshot，创建活动版本并更新 `current_version_id`；既有历史版本标记 `frozen`。`source_kind='current'` 的分享绑定活动版本，明确 `source_version_id` 的历史分享绑定对应冻结版本。

- [ ] **步骤 3：迁移评论空间**

建立 legacy scope 映射表；工作空间和 current 分享空间映射活动版本，history 和历史分享空间映射目标冻结版本。保留全部线程 ID，按版本重新分配事件序号并验证评论计数。迁移函数使用 `on conflict` 和存在性检查保证幂等。

- [ ] **步骤 4：建立原子版本 RPC**

创建以下签名：

```sql
create function public.create_next_resume_version(
  p_resume_id uuid,
  p_version_name text default null
) returns bigint;

create function public.sync_active_resume_version(
  p_resume_id uuid,
  p_snapshot jsonb,
  p_content_hash text,
  p_anchor_document jsonb,
  p_projection_reference_date date,
  p_expected_document_revision bigint
) returns jsonb;
```

第一个 RPC 冻结旧版本、复制快照、创建空评论空间并切换指针；第二个 RPC 只允许 owner 更新活动版本并在同一事务中更新评论锚点文档。

- [ ] **步骤 5：同步初始化 SQL 并验证**

运行：

```bash
pnpm exec supabase db reset
pnpm exec supabase db lint
git diff --check
```

预期：迁移成功；lint 不出现本迁移新增错误；工作树无空白错误。

- [ ] **步骤 6：提交**

```bash
git add supabase/migrations/20260814000001_add_version_centric_resume_comments.sql supabase/migrations/init_table.sql
git commit -m "feat(db): 建立版本中心化评论模型"
```

### 任务 2：切换版本与分享领域 API

**文件：**
- 修改：`src/lib/supabase/resume/history/types.ts`
- 修改：`src/lib/supabase/resume/history/queries.ts`
- 修改：`src/lib/supabase/resume/share.types.ts`
- 修改：`src/lib/supabase/resume/share.ts`
- 修改：`src/lib/supabase/resume/share-version.ts`
- 修改：`src/pages/resume/editor/components/toolbar/quick-save-version-dialog.tsx`

- [ ] **步骤 1：定义版本类型**

```ts
export type ResumeVersionStatus = 'active' | 'frozen'

export interface ResumeVersionMeta extends ResumeHistoryVersionMeta {
  status: ResumeVersionStatus
  document_revision: number
  projection_reference_date: string
  shared_link_count: number
}
```

列表统一返回当前活动版本和冻结版本，版本 ID 是来源 key。

- [ ] **步骤 2：实现版本查询和创建新版本**

增加 `getCurrentResumeVersion(resumeId)`、`listResumeVersions(resumeId)` 和 `createNextResumeVersion(resumeId, versionName)`；`createResumeHistoryVersion` 的手动保存入口改为调用原子 RPC，而不是简单插入另一条与工作区无关联的历史记录。

- [ ] **步骤 3：分享记录绑定版本**

`ResumeShareRecord` 和 `ShareViewResult` 增加：

```ts
versionId: number
documentRevision: number
```

创建分享时，current 解析为 `current_version_id`，history 使用选择的版本 ID。owner 列表从 `version_id` 读取版本号、名称和状态。

- [ ] **步骤 4：修正快速保存交互**

快速保存成功后编辑器切换到新的活动版本；旧分享链接留在旧版本。保留允许空版本名称的既有行为。

- [ ] **步骤 5：运行类型与定向 lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/lib/supabase/resume/history src/lib/supabase/resume/share.ts src/lib/supabase/resume/share.types.ts src/lib/supabase/resume/share-version.ts src/pages/resume/editor/components/toolbar/quick-save-version-dialog.tsx
```

预期：命令退出码为 0。

- [ ] **步骤 6：提交**

```bash
git add src/lib/supabase/resume/history src/lib/supabase/resume/share.ts src/lib/supabase/resume/share.types.ts src/lib/supabase/resume/share-version.ts src/pages/resume/editor/components/toolbar/quick-save-version-dialog.tsx
git commit -m "feat(resume): 统一活动与冻结版本操作"
```

### 任务 3：改造公开分享和评论服务

**文件：**
- 修改：`supabase/functions/resume-share/index.ts`
- 修改：`supabase/functions/resume-comments/index.ts`
- 修改：`scripts/verify-resume-comment-service.ts`

- [ ] **步骤 1：公开分享读取权威版本**

`resume-share` 在校验 token、密码、有效期和启用状态后，通过 `resume_shares.version_id` 读取版本 snapshot，并返回：

```json
{
  "version_id": 42,
  "document_revision": 7,
  "comment_scope_id": "uuid",
  "comment_access_token": "signed-token"
}
```

访问令牌绑定 `shareId/versionId/commentsEnabled/principal/expiry`，不再绑定 release 作为评论边界。

- [ ] **步骤 2：评论服务直接解析版本空间**

owner、collaborator 和 share 三类访问最终都解析出：

```ts
interface ResolvedCommentAccess {
  versionId: number
  scopeId: string
  principal: Principal
  canRead: boolean
  canCreate: boolean
  canModerate: boolean
}
```

删除每次请求重新读取完整简历和 `ensureWorkingScopeForOwner` 的路径。

- [ ] **步骤 3：聚合 bootstrap 与增量 mutation**

Bootstrap 批量返回版本、权限、计数、线程、递归评论、profiles、event seq 和 Realtime token。Mutation 返回标准化变更：

```ts
interface MutationPayload {
  thread: RawThread | null
  comment: RawComment | null
  removedCommentId: string | null
  counts: { unresolved: number, resolved: number, detached: number }
  event: RawCommentEvent
}
```

数据库成功后先响应；广播失败写结构化日志，不把已提交评论变成前端超时。

- [ ] **步骤 4：支持任意父评论**

`create_reply` 接收 `parentCommentId`，验证父评论属于目标线程且无环。删除有后代的评论生成 tombstone，无后代的回复保持软删除审计。

- [ ] **步骤 5：增加 request id 和分段耗时**

为 auth、access、query、mutation、broadcast 写入非敏感 timing，并在响应头返回：

```text
Server-Timing: auth;dur=12, access;dur=8, db;dur=34, broadcast;dur=5
X-Request-Id: <uuid>
```

- [ ] **步骤 6：扩展服务验证脚本**

脚本必须验证：版本绑定访问、同版本多链接、只读链接、递归父评论、环检测、tombstone、结构化 mutation、一次写入不依赖 list 请求。

- [ ] **步骤 7：运行 Deno 与脚本验证**

```bash
deno check supabase/functions/resume-share/index.ts
deno check supabase/functions/resume-comments/index.ts
pnpm verify:comment-service
```

预期：全部退出码为 0。

- [ ] **步骤 8：提交**

```bash
git add supabase/functions/resume-share/index.ts supabase/functions/resume-comments/index.ts scripts/verify-resume-comment-service.ts
git commit -m "feat(comments): 切换版本级评论服务"
```

### 任务 4：建立客户端缓存、增量状态与性能观测

**文件：**
- 修改：`src/features/resume-comments/types.ts`
- 修改：`src/features/resume-comments/store/types.ts`
- 修改：`src/features/resume-comments/store/create-store.ts`
- 创建：`src/features/resume-comments/api/cache.ts`
- 创建：`src/features/resume-comments/api/performance.ts`
- 修改：`src/features/resume-comments/api/anonymous-identity.ts`
- 修改：`src/features/resume-comments/api/client.ts`
- 修改：`src/features/resume-comments/context.tsx`
- 修改：`scripts/verify-resume-comment-client.ts`

- [ ] **步骤 1：把作用域类型统一为版本**

```ts
export interface CommentVersionReference {
  versionId: number
  versionNo: number
  versionName: string | null
  status: 'active' | 'frozen'
  documentHash: string
  documentRevision: number
  sharedLinkCount: number
}
```

访问上下文使用 `versionId`；share 访问保留 `shareId/accessToken/commentsEnabled` 用于能力校验。

- [ ] **步骤 2：实现版本级缓存**

使用 `idb` 创建 `resume-comment-cache-v1`，缓存值包括 bootstrap 数据、event seq、缓存时间和访问指纹。提供：

```ts
readCommentCache(key: CommentCacheKey): Promise<CommentCacheEntry | null>
writeCommentCache(key: CommentCacheKey, value: CommentBootstrapResult): Promise<void>
deleteCommentCacheForPrincipal(principalKey: string): Promise<void>
```

缓存键不包含原始 token 或 secret。

- [ ] **步骤 3：实现实体级乐观操作与回滚**

Store 增加 `applyOptimisticMutation/commitMutation/rollbackMutation/applyRealtimeEvent`。Pending 使用实体 key，例如 `comment:<id>:delete`、`thread:<id>:resolve`，不再由每个 hook 的局部字符串独立维护。

- [ ] **步骤 4：复用安全会话并规范化错误**

Client 监听 Supabase auth 变化并缓存当前 access token；每次请求不再先单独 `getSession()`。错误类型增加 `requestId/details/retryAfterSeconds`，兼容非标准 Supabase 错误对象。

- [ ] **步骤 5：记录客户端性能**

`performance.ts` 为 cache、bootstrap、source、mutation 和 realtime recovery 提供开始/结束标记；开发环境输出 request count 和耗时，生产仅保留非敏感聚合。

- [ ] **步骤 6：匿名身份按版本存储**

存储 key 从 share ID 改为 version ID；同浏览器跨同版本链接复用，不同版本隔离。

- [ ] **步骤 7：扩展客户端验证脚本**

验证缓存键不含 secret、乐观失败完整回滚、递归实体归一化、同 event ID 去重和 active 强高亮退出。

- [ ] **步骤 8：运行验证并提交**

```bash
pnpm verify:comment-client
pnpm exec tsc --noEmit
pnpm exec eslint src/features/resume-comments/api src/features/resume-comments/store src/features/resume-comments/types.ts src/features/resume-comments/context.tsx
git add src/features/resume-comments scripts/verify-resume-comment-client.ts
git commit -m "refactor(comments): 建立缓存与增量状态模型"
```

### 任务 5：消除写后全量刷新和 Realtime 重复加载

**文件：**
- 修改：`src/features/resume-comments/api/realtime-recovery.ts`
- 修改：`src/features/resume-comments/api/realtime.ts`
- 修改：`src/features/resume-comments/hooks/use-comment-actions.ts`
- 修改：`src/features/resume-comments/hooks/use-comment-realtime.ts`
- 修改：`src/features/resume-comments/api/working-document-sync.ts`
- 修改：`src/pages/resume/editor/hooks/use-comment-review-mode.ts`

- [ ] **步骤 1：Mutation 直接提交实体**

`useCommentActions.execute` 顺序改为：乐观操作、准备 actor、单次 mutation、commit；失败 rollback。删除 `await refreshThreads(response.eventSeq)`。

- [ ] **步骤 2：Realtime 增量与去重**

本地维护最近 event ID 集合和 last event seq。连续事件直接 `applyRealtimeEvent`；断档调用增量 events 接口；协议不兼容才 bootstrap。

- [ ] **步骤 3：权限续签不重载评论**

60 秒定时器只刷新 access 和 Realtime token；权限不变时保持线程与缓存。链接变只读时更新 access state，失效时断开并保留只读缓存提示。

- [ ] **步骤 4：正文同步不重复 bootstrap**

`sync_active_resume_version` 响应直接包含新 scope revision、锚点变更和 event；客户端增量应用。仅 stale document 时获取最新 revision 并重试一次。

- [ ] **步骤 5：来源只加载版本且独立容错**

当前活动版本同步初始化；历史版本单独请求。错误归一化为 `{ message, code, requestId }`，来源失败不清空当前评论。

- [ ] **步骤 6：运行请求链验证并提交**

```bash
pnpm verify:comment-client
pnpm verify:comment-service
pnpm exec tsc --noEmit
git add src/features/resume-comments src/pages/resume/editor/hooks/use-comment-review-mode.ts
git commit -m "perf(comments): 消除重复全量刷新"
```

### 任务 6：实现递归评论树、快捷操作和 Motion

**文件：**
- 修改：`src/features/resume-comments/const.ts`
- 创建：`src/features/resume-comments/components/comment-tree.tsx`
- 创建：`src/features/resume-comments/components/comment-status-bar.tsx`
- 修改：`src/features/resume-comments/components/thread-list.tsx`
- 修改：`src/features/resume-comments/components/thread-detail.tsx`
- 修改：`src/features/resume-comments/components/comment-composer.tsx`
- 修改：`src/features/resume-comments/components/comment-source-selector.tsx`
- 修改：`src/features/resume-comments/components/comment-surface.tsx`

- [ ] **步骤 1：统一动画常量**

```ts
export const COMMENT_MOTION = {
  ease: [0.22, 1, 0.36, 1] as const,
  itemDuration: 0.18,
  contentDuration: 0.22,
  highlightDuration: 0.16,
  newItemEmphasisDuration: 0.6,
}
```

- [ ] **步骤 2：构造递归树**

按 `parentId` 构造节点；根节点下递归渲染。前两级以内联树线展示，宽度不足或可视层级超过阈值时显示“继续查看 N 条回复”，进入“回复详情”重置缩进。

- [ ] **步骤 3：实现回复快捷键**

桌面 Hover/focus 显示消息气泡按钮，移动端常显。使用 shadcn Tooltip，aria-label 和文案均为“回复 {displayName}”。

- [ ] **步骤 4：实现快捷解决和异步状态**

主题卡片右下角显示解决图标和回复数；pending 时 Spinner，失败卡片内提示。发送、回复、编辑、删除和来源切换分别显示对应进行中文案，成功不 Toast。

- [ ] **步骤 5：实现列表动画**

列表使用 `AnimatePresence initial={false} mode="popLayout"`。无后代删除执行淡出和高度收起；有后代交叉切换 tombstone；解决后卡片淡出未解决列表。所有动画尊重 `useReducedMotion`。

- [ ] **步骤 6：运行组件检查并提交**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/features/resume-comments/components src/features/resume-comments/const.ts
git add src/features/resume-comments/components src/features/resume-comments/const.ts
git commit -m "feat(comments): 重构递归评论树与操作反馈"
```

### 任务 7：修复 Drawer、书签和高亮交互

**文件：**
- 创建：`src/features/resume-comments/components/comment-bookmark.tsx`
- 修改：`src/features/resume-comments/components/comments-panel.tsx`
- 修改：`src/features/resume-comments/components/highlight-overlay.tsx`
- 修改：`src/pages/resume/editor/index.tsx`
- 修改：`src/pages/share/view/[token].tsx`
- 修改：`src/pages/share/view/hooks/use-share-comment-access.ts`

- [ ] **步骤 1：实现飞书式书签**

书签相对预览可视区域贴在右上边缘；编辑侧栏打开时停靠交界处。Tooltip 为“展开评论”，激活状态改变图标颜色。离线简历不渲染。

- [ ] **步骤 2：移除移动 Drawer snap points**

删除 `mobileSnapPoint`、`snapPoints`、`snapPoint` 和 `onSnapPointChange`。桌面明确 `swipeDirection="right"`，移动明确 `swipeDirection="down"`；首次渲染通过 CSS breakpoint/稳定媒体查询避免方向翻转。

- [ ] **步骤 3：实现移动有界高度与键盘**

短内容自然高度，长内容 `max-height: 92dvh`，加载态稳定 min-height。使用 `Drawer.VirtualKeyboardProvider`，头部和输入区固定，列表滚动，处理 safe area 和横屏。

- [ ] **步骤 4：修正高亮生命周期**

Store 区分 `activeThreadId` 与 `hoveredThreadId`。强高亮仅在 active/hover 时存在；关闭详情和 Drawer 清除 active，立即过渡回弱高亮。

- [ ] **步骤 5：分享正文 revision 更新**

分享页订阅版本正文更新；成功事件后拉取最新权威 snapshot。若存在未发送选区草稿，保留文本、清除选区并显示“简历内容已更新，请重新选择文字后发送”。

- [ ] **步骤 6：运行响应式检查并提交**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/features/resume-comments/components src/pages/resume/editor/index.tsx 'src/pages/share/view/[token].tsx' src/pages/share/view/hooks/use-share-comment-access.ts
git add src/features/resume-comments/components src/pages/resume/editor/index.tsx 'src/pages/share/view/[token].tsx' src/pages/share/view/hooks/use-share-comment-access.ts
git commit -m "fix(comments): 统一书签与双端 Drawer 交互"
```

### 任务 8：完善锚点同步和性能验证脚本

**文件：**
- 修改：`scripts/verify-resume-comment-anchors.ts`
- 修改：`scripts/verify-resume-comment-client.ts`
- 修改：`scripts/verify-resume-comment-service.ts`
- 创建：`docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md`

- [ ] **步骤 1：补充锚点 revision 场景**

验证正文增加、删除、移动文本时可靠重定位；无法唯一匹配时 detached；旧 revision 创建线程返回 `stale_document`。

- [ ] **步骤 2：补充客户端请求预算**

使用 fake client 记录调用：bootstrap 一次；create/reply/resolve/edit/delete 各一次 mutation 且零次紧随的 list；Realtime 自事件不触发 bootstrap。

- [ ] **步骤 3：补充服务权限矩阵**

覆盖 owner、协作者 editor/viewer、登录分享访客、同版本匿名跨链接、跨版本匿名拒绝、comments disabled 和失效链接。

- [ ] **步骤 4：运行全部专项验证**

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
```

预期：全部打印通过摘要并以 0 退出。

- [ ] **步骤 5：记录验证文档并提交**

文档逐项标注“已由脚本验证”“已由浏览器交互验证”“需要真机验收”，并记录命令、日期和结果。

```bash
git add scripts/verify-resume-comment-anchors.ts scripts/verify-resume-comment-client.ts scripts/verify-resume-comment-service.ts docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md
git commit -m "test(comments): 扩展版本评论验证矩阵"
```

### 任务 9：执行完整工程与浏览器验证

**文件：**
- 修改：`docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md`

- [ ] **步骤 1：运行工程检查**

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
pnpm exec tsc --noEmit
pnpm exec eslint src/features/resume-comments src/pages/resume/editor src/pages/share/view src/lib/supabase/resume/history src/lib/supabase/resume/share.ts
deno check supabase/functions/resume-share/index.ts
deno check supabase/functions/resume-comments/index.ts
pnpm build
git diff --check
```

记录每条命令退出码；全仓 lint 的既有基线与本功能定向 lint 分开陈述。

- [ ] **步骤 2：运行桌面浏览器矩阵**

至少验证：编辑侧栏 + 书签、右侧 Drawer、同版本双分享窗口、Realtime 增量、来源局部失败、发送/删除/解决动画、强弱高亮和新版本分叉。

- [ ] **步骤 3：运行移动视口矩阵**

在 375×667、390×844、430×932、844×390 视口验证首次打开方向和高度、长短内容、键盘、递归树、safe area 和分享页一致性；控制台不得出现 snapPoint 或 Maximum update depth 警告。

- [ ] **步骤 4：运行 reduced motion 与慢网验证**

启用 `prefers-reduced-motion` 后验证无位移/缩放；Slow 3G 下确认缓存先显、旧数据提示、草稿保留和失败回滚。

- [ ] **步骤 5：更新证据并提交**

```bash
git add docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md
git commit -m "docs(comments): 记录版本评论验收证据"
```

### 任务 10：最终差异审查与交付

**文件：**
- 检查：本计划列出的所有文件

- [ ] **步骤 1：检查规格覆盖**

逐条对照设计规格第 2–17 节和用户提出的 11 个问题，确认每项都有实现或明确的真机验收标记。

- [ ] **步骤 2：检查数据与安全边界**

确认浏览器没有 Service Role、原始匿名 secret 不进入日志/缓存键、旧字段未删除、迁移幂等、分享链接不能越权订阅其他版本。

- [ ] **步骤 3：检查最终工作树**

```bash
git status --short
git log --oneline --decorate -12
git diff HEAD~8 --stat
```

预期：没有未说明的临时文件；提交按数据库、领域、服务、客户端、UI、验证分层。

- [ ] **步骤 4：向用户交付验收清单**

报告已实现结果、性能证据、验证命令、数据库/Edge Function 尚未部署说明，以及 iOS Safari/Android Chrome 需要用户执行的最终真机验收项。
