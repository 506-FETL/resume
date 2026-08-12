# 简历分享版本选择 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让简历只读分享在创建和更新时可以选择“当前版本”或任一历史版本，并在 URL 不变的前提下稳定发布所选版本快照。

**Architecture:** `resume_shares` 继续保存独立脱敏快照，同时新增仅 owner 可见的版本来源列；领域层区分“可发布选择”“已解析 release”“持久化来源”和“已删除版本占位”，避免空历史版本 ID 进入发布。分享 store 分页并重验历史版本元数据，两个宿主继续分别提供编辑器内存当前快照和管理页云端当前快照；匿名读取协议保持不变。

**Tech Stack:** React 19 · TypeScript 5.9 · Zustand 5 · Supabase PostgreSQL/RLS · Vite 7 · Radix/shadcn UI · Sonner

**Verification:** 当前仓库没有测试基础设施，且 `AGENTS.md` 明确本仓库不执行 TDD。本计划不新增测试框架、测试文件或测试脚本；使用 TypeScript、ESLint、生产构建、SQL 静态核对和桌面/移动手工验收。

---

## 实施约束

- 规格：`docs/superpowers/specs/2026-08-12-resume-share-version-design.md`。
- 当前分支为 `main`；按仓库规则直接在当前分支实施，不创建/切换分支，不执行 `git push`。
- 工作区已有用户修改：`AGENTS.md`（未暂存）与 `src/pages/resume/components/resume-card/index.tsx`（已暂存）。本计划不修改或提交这两个文件。
- 每次提交使用路径限定的 `git add` 与 `git commit --only <paths...>`；提交前检查 `git diff --cached --name-status`。
- 匿名 `resume-share` Edge Function 不返回版本来源，本计划不修改它。
- 不把版本来源写入 URL，不把历史版本列表暴露给访问者。

## 文件结构与职责

### 新增

- `supabase/migrations/20260812000001_add_resume_share_version_source.sql`：来源列、跨列约束、外键与 owner 列权限。
- `src/lib/supabase/pagination.ts`：与查询实现解耦的分页收集器。
- `src/lib/supabase/resume/share-version.ts`：数据库来源列与领域来源之间的纯转换。
- `src/pages/share/components/version-selector/index.tsx`：可搜索版本选择器。
- `src/pages/share/components/version-dialog/index.tsx`：已有链接的显式版本发布流程。
- `src/pages/share/components/version-badge/index.tsx`：owner 管理界面共用的来源 badge。

### 修改

- `src/lib/supabase/resume/share.types.ts`：selection/source/release/数据库来源列类型。
- `src/lib/supabase/resume/share.ts`：读取来源列、解析 release、创建带来源分享、原子发布 release。
- `src/lib/supabase/resume/history/types.ts`：分享发布查询结果类型。
- `src/lib/supabase/resume/history/queries.ts`：历史列表分页；按 `id + resume_id + user_id` 读取发布版本。
- `src/lib/supabase/resume/history/index.ts`：导出新增查询与类型。
- `src/pages/share/types.ts`：版本弹窗选择和缓存类型；保留现有无参 `SnapshotProvider`。
- `src/pages/share/utils.ts`：来源文案、删除占位与发布类型守卫。
- `src/pages/share/store/types.ts`：版本缓存、版本弹窗和发布 action 契约。
- `src/pages/share/store/data.ts`：版本加载/重验、create/publish 双列表一致性。
- `src/pages/share/store/ui.ts`：版本弹窗目标 ID；快速分享打开时触发重验。
- `src/pages/share/components/quick-dialog/index.tsx`：按选择解析 release，挂载版本弹窗。
- `src/pages/share/components/quick-dialog/create-form.tsx`：加入版本选择器。
- `src/pages/share/components/quick-dialog/link-row.tsx`：展示来源并打开版本弹窗。
- `src/pages/share/components/create-dialog/index.tsx`：管理页按版本创建分享。
- `src/pages/share/components/card/index.tsx`：展示来源并打开版本弹窗。
- `src/pages/share/components/mobile-list/mobile-item.tsx`：显示来源摘要。
- `src/pages/share/components/mobile-list/action-drawer.tsx`：打开版本弹窗。
- `src/pages/share/index.tsx`：挂载使用云端 current provider 的版本弹窗。

### 明确不修改

- `package.json`、`pnpm-lock.yaml`：不引入测试依赖。
- `supabase/functions/resume-share/index.ts`：匿名读取协议不变。
- `src/pages/share/view/[token].tsx`：访问者不感知版本来源。
- `src/pages/resume/editor/index.tsx`、`src/pages/resume/index.tsx`：现有 `QuickDialog.getSnapshot` 已区分内存 current 与云端 current。
- `AGENTS.md`、`src/pages/resume/components/resume-card/index.tsx`：保留用户工作区改动。

---

### Task 1: 建立版本来源领域契约

**Files:**

- Modify: `src/lib/supabase/resume/share.types.ts`
- Create: `src/lib/supabase/resume/share-version.ts`
- Modify: `src/pages/share/types.ts`
- Modify: `src/pages/share/utils.ts`

- [ ] **Step 1: 定义不可表达非法发布状态的类型**

在 `share.types.ts` 增加：

```ts
export type ShareVersionSelection =
  | { kind: 'current' }
  | { kind: 'history'; versionId: number }

export type ShareVersionSource =
  | { kind: 'current' }
  | {
      kind: 'history'
      versionId: number | null
      versionNo: number
      versionLabel: string
      versionCreatedAt: string
    }

export type ResolvedShareVersionSource =
  | { kind: 'current' }
  | {
      kind: 'history'
      versionId: number
      versionNo: number
      versionLabel: string
      versionCreatedAt: string
    }

export interface ResolvedResumeShareRelease extends ResumeShareSnapshotSource {
  source: ResolvedShareVersionSource
}

export type CurrentResumeShareSnapshotProvider
  = (resumeId: string) => Promise<ResumeShareSnapshotSource>

export interface ResumeShareVersionSourceColumns {
  source_kind: 'current' | 'history'
  source_version_id: number | null
  source_version_no: number | null
  source_version_label: string | null
  source_version_created_at: string | null
}
```

`ResumeShareRecord` 增加 `source: ShareVersionSource`，不向 UI 暴露 snake_case 来源列。

- [ ] **Step 2: 实现数据库来源纯转换**

创建 `share-version.ts`：

```ts
export function readShareVersionSource(
  row: ResumeShareVersionSourceColumns,
): ShareVersionSource

export function toShareVersionSourcePatch(
  source: ResolvedShareVersionSource,
): ResumeShareVersionSourceColumns
```

规则：

- current 序列化时 4 个历史字段全部置 null；
- history release 必须一次性写出 ID、编号、稳定标签和保存时间；
- 读取 `history + null ID` 时保留 history，用于历史版本删除后的 owner 展示；
- 若数据库返回缺少编号/标签/时间的损坏 history 行，安全回退 `{ kind: 'current' }`，但发布输入不能使用该回退。

- [ ] **Step 3: 定义弹窗删除占位与类型守卫**

在页面 `types.ts` 保留现有：

```ts
export type SnapshotProvider = () => Promise<ResumeShareSnapshotSource>
```

并增加：

```ts
export type VersionDialogSelection =
  | ShareVersionSelection
  | {
      kind: 'deleted-history'
      versionNo: number
      versionLabel: string
      versionCreatedAt: string
    }
```

在 `utils.ts` 实现：

- `formatShareVersionSource(source)`：current →“当前版本”；history → `Vn · label`；
- `toVersionDialogSelection(source)`：history ID 为空时得到 deleted-history，不回退 current；
- `isPublishableVersionSelection(value)`：带类型谓词，只接受 current 或带 ID 的 history。

- [ ] **Step 4: 验证类型与目标 lint**

```bash
pnpm exec tsc --noEmit
pnpm eslint src/lib/supabase/resume/share.types.ts \
  src/lib/supabase/resume/share-version.ts \
  src/pages/share/types.ts src/pages/share/utils.ts
```

Expected: exit 0；TypeScript 能阻止 deleted-history 进入只接收 `ShareVersionSelection` 的接口。

- [ ] **Step 5: 提交 Task 1**

```bash
git add src/lib/supabase/resume/share.types.ts \
  src/lib/supabase/resume/share-version.ts \
  src/pages/share/types.ts src/pages/share/utils.ts
git commit --only src/lib/supabase/resume/share.types.ts \
  src/lib/supabase/resume/share-version.ts \
  src/pages/share/types.ts src/pages/share/utils.ts \
  -m "feat(share): 建立版本发布领域契约"
```

---

### Task 2: 数据库迁移与列权限

**Files:**

- Create: `supabase/migrations/20260812000001_add_resume_share_version_source.sql`

- [ ] **Step 1: 编写幂等迁移**

核心结构：

```sql
ALTER TABLE public.resume_shares
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS source_version_id bigint,
  ADD COLUMN IF NOT EXISTS source_version_no integer,
  ADD COLUMN IF NOT EXISTS source_version_label text,
  ADD COLUMN IF NOT EXISTS source_version_created_at timestamptz;
```

用 `DO $$ ... pg_constraint ... $$` 幂等增加：

```sql
CHECK (source_kind IN ('current', 'history'))
```

以及跨列约束：

```sql
CHECK (
  (source_kind = 'current'
    AND source_version_id IS NULL
    AND source_version_no IS NULL
    AND source_version_label IS NULL
    AND source_version_created_at IS NULL)
  OR
  (source_kind = 'history'
    AND source_version_no IS NOT NULL
    AND source_version_label IS NOT NULL
    AND source_version_created_at IS NOT NULL)
)
```

增加 `source_version_id → resume_config_versions(id) ON DELETE SET NULL` 外键。history 不要求 ID 非空，因此删除后不违反跨列约束。

- [ ] **Step 2: 补充 owner 列权限，不扩大匿名权限**

为 authenticated 增加 5 个新列的 `SELECT`、`INSERT`、`UPDATE` 权限；不修改现有 RLS policy，不向 anon 授权，不把 snapshot/template_manifest 加入 owner SELECT。

- [ ] **Step 3: 静态核对迁移**

逐项检查：

- 旧记录因 default 迁移为 current，历史字段均为空；
- current/history 两分支覆盖所有合法状态；
- `ON DELETE SET NULL` 后 history 的编号、稳定标签、时间仍保留；
- owner 可读写来源列；anon 权限没有变化；
- migration 重跑不会重复创建约束。

可用时运行：

```bash
supabase db lint --local
```

若本地 Supabase 未启动，记录为环境跳过，不连接或修改远端项目。

- [ ] **Step 4: 提交 Task 2**

```bash
git add supabase/migrations/20260812000001_add_resume_share_version_source.sql
git commit --only supabase/migrations/20260812000001_add_resume_share_version_source.sql \
  -m "feat(share): 记录分享版本来源"
```

---

### Task 3: 分页读取历史版本并解析 release

**Files:**

- Create: `src/lib/supabase/pagination.ts`
- Modify: `src/lib/supabase/resume/history/types.ts`
- Modify: `src/lib/supabase/resume/history/queries.ts`
- Modify: `src/lib/supabase/resume/history/index.ts`
- Modify: `src/lib/supabase/resume/share.ts`

- [ ] **Step 1: 实现分页收集器**

```ts
export async function collectPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 200,
): Promise<T[]>
```

范围为闭区间 `[from, from + pageSize - 1]`；返回长度 `< pageSize` 时终止。第一页为空只请求一次；整页后允许下一页为空并正常终止。

- [ ] **Step 2: 让历史版本列表读取全部分页**

把 `listResumeHistoryVersions(resumeId)` 攄为通过 `collectPages` 重复执行现有 owner/resume/order 查询：

```ts
return collectPages(async (from, to) => {
  const { data, error } = await supabase
    .from('resume_config_versions')
    .select(VERSION_LIST_SELECTOR)
    .eq('resume_id', resumeId)
    .eq('user_id', user.id)
    .order('version_no', { ascending: false })
    .range(from, to)
  if (error)
    throw error
  return (data ?? []) as ResumeHistoryVersionListRow[]
})
```

- [ ] **Step 3: 增加原子读取发布版本的查询**

在 history types 增加 `ResumeHistoryShareReleaseRow`，包含：`snapshot`、`version_no`、`version_name`、`milestone_name`、`created_at`、`resume_id`。

实现：

```ts
getResumeHistoryVersionForShare(
  resumeId: string,
  versionId: number,
): Promise<ResumeHistoryShareReleaseRow>
```

必须同时过滤 `.eq('id', versionId)`、`.eq('resume_id', resumeId)`、`.eq('user_id', user.id)`，一次 `.single()` 返回 snapshot 与实际元数据，不能信任 UI 缓存中的版本信息。

- [ ] **Step 4: 实现 release resolver，确保只处理一次**

在 `share.ts` 增加：

```ts
export async function resolveResumeShareRelease(input: {
  resumeId: string
  displayName: string | null
  selection: ShareVersionSelection
  getCurrentSource: CurrentResumeShareSnapshotProvider
}): Promise<ResolvedResumeShareRelease>
```

- current：`await getCurrentSource(resumeId)` 后只附加 `{ kind: 'current' }`；不再次脱敏或解析模板。
- history：读取实际版本；用 `mapSourceToPersistedSnapshot(row.snapshot)` 归一；调用一次 `buildResumeShareSnapshotSource(snapshot, displayName)`；label 按 `version_name || milestone_name || '未命名版本'` 固化。

- [ ] **Step 5: 静态审查分支和验证**

人工逐分支检查：current 不调用历史查询，history 不调用 current provider；history 元数据取同一次数据库结果；两个分支都只产生一个完整 release。

```bash
pnpm exec tsc --noEmit
pnpm eslint src/lib/supabase/pagination.ts src/lib/supabase/resume/history \
  src/lib/supabase/resume/share.ts
```

Expected: exit 0。

- [ ] **Step 6: 提交 Task 3**

```bash
git add src/lib/supabase/pagination.ts \
  src/lib/supabase/resume/history/types.ts \
  src/lib/supabase/resume/history/queries.ts \
  src/lib/supabase/resume/history/index.ts \
  src/lib/supabase/resume/share.ts
git commit --only src/lib/supabase/pagination.ts \
  src/lib/supabase/resume/history/types.ts \
  src/lib/supabase/resume/history/queries.ts \
  src/lib/supabase/resume/history/index.ts \
  src/lib/supabase/resume/share.ts \
  -m "feat(share): 解析当前与历史发布版本"
```

---

### Task 4: 持久化 release 并管理版本缓存

**Files:**

- Modify: `src/lib/supabase/resume/share.ts`
- Modify: `src/pages/share/store/types.ts`
- Modify: `src/pages/share/store/data.ts`
- Modify: `src/pages/share/store/ui.ts`

- [ ] **Step 1: 更新 owner 分享记录读写协议**

`SHARE_SELECT` 加入 5 个来源列；`toRecord` 提取 snake_case 来源列并通过 `readShareVersionSource` 生成 `record.source`。

先新增不破坏旧调用方的接口：

```ts
createResumeShareRelease(
  resumeId: string,
  release: ResolvedResumeShareRelease,
  options?: CreateShareOptions,
): Promise<ResumeShareRecord>
```

INSERT 同时写 release 内容和 `toShareVersionSourcePatch(release.source)`；带密码的未激活 → 设置密码 → 激活补偿流程保持不变。

为保证任务结束时可独立通过 TypeScript，本任务暂时保留旧 `createResumeShare(resumeId, snapshot, templateManifest, displayName, options)`；Task 5 迁完两个创建调用方后再删除旧接口。

- [ ] **Step 2: 用单次 UPDATE 原子发布 release**

新增：

```ts
publishResumeShareRelease(
  shareId: string,
  release: ResolvedResumeShareRelease,
): Promise<ResumeShareRecord>
```

一次 UPDATE 写 snapshot、template_manifest、display_name 与 5 个来源列，并 `.select(SHARE_SELECT).single()` 返回权威记录。不得修改 token、is_active、密码、有效期、访问统计。

本任务暂时保留 `pushResumeShareSnapshot`，供尚未迁移的 `LinkRow`、`LinkCard`、`ActionDrawer` 使用；但它必须包装成 `{ ...snapshotSource, source: { kind: 'current' } }` 后调用 `publishResumeShareRelease`，并返回/映射权威记录，使兼容期旧“推送最新版”也会同步把来源改成 current，不产生快照与来源不一致。Task 6 迁完全部入口后再删除该兼容包装。

- [ ] **Step 3: 定义版本选项缓存**

在 store types 增加：

```ts
interface VersionOptionsEntry {
  items: ResumeHistoryVersionListItem[]
  loading: boolean
  error: string | null
  requestId: number
  loaded: boolean
}
```

Data slice 增加：

- `versionOptionsByResumeId`；
- `loadVersionOptions(resumeId, { force?: boolean })`；
- `createRelease(resumeId, release, options)`；
- `publishRelease(shareId, release)`。

现有 `create` 与 `pushSnapshot` action 暂时作为兼容入口保留，内部行为不变；分别在 Task 5、Task 6 完成调用方迁移后删除。

使用模块级 `Map<string, Promise<void>>` 去重同 resume 请求。force 打开后台重验但保留旧 items；失败保留旧 items 只写 error；requestId 防旧响应覆盖；请求结束只清理属于自己的 in-flight Promise。

- [ ] **Step 4: 保持快速列表与管理列表一致**

`publishRelease` 沿用 `pendingShareIds` 防同一链接并发；成功后以后端返回记录同时替换 `shares`、`allShares`，不相关记录保持原引用。`createRelease` 成功沿用现有双列表插入规则；legacy `create` 在兼容期保持原行为。legacy `pushSnapshot` 改用上述 current release 包装并同样映射后端权威记录。

- [ ] **Step 5: 增加版本弹窗 UI 状态并触发重验**

UI slice 增加 `versionDialogOpen`、`versionShareId`、`openVersionDialog`、`closeVersionDialog`。

`openDialog(resumeId, ...)` 在加载分享列表同时调用 `loadVersionOptions(resumeId, { force: true })`；两类错误状态互不覆盖。

- [ ] **Step 6: 静态路径审查和验证**

人工模拟：两次并发 load 只复用一个 Promise；旧 requestId 不落状态；失败保留缓存；publish 只替换同 ID 的两份列表。确认 legacy `create`/`pushSnapshot` 仍存在，使旧组件在本任务结束时继续通过 TypeScript。

```bash
pnpm exec tsc --noEmit
pnpm eslint src/lib/supabase/resume/share.ts src/pages/share/store
```

Expected: exit 0。

- [ ] **Step 7: 提交 Task 4**

```bash
git add src/lib/supabase/resume/share.ts \
  src/pages/share/store/types.ts src/pages/share/store/data.ts \
  src/pages/share/store/ui.ts
git commit --only src/lib/supabase/resume/share.ts \
  src/pages/share/store/types.ts src/pages/share/store/data.ts \
  src/pages/share/store/ui.ts \
  -m "feat(share): 持久化并缓存分享版本"
```

---

### Task 5: 版本选择器与按版本创建分享

**Files:**

- Modify: `src/lib/supabase/resume/share.ts`
- Modify: `src/pages/share/store/types.ts`
- Modify: `src/pages/share/store/data.ts`
- Create: `src/pages/share/components/version-selector/index.tsx`
- Create: `src/pages/share/components/version-badge/index.tsx`
- Modify: `src/pages/share/components/quick-dialog/create-form.tsx`
- Modify: `src/pages/share/components/quick-dialog/index.tsx`
- Modify: `src/pages/share/components/create-dialog/index.tsx`

- [ ] **Step 1: 实现可搜索版本选择器**

`VersionSelector` 使用现有 `Popover + Command`：

```ts
interface VersionSelectorProps {
  value: VersionDialogSelection
  versions: ResumeHistoryVersionListItem[]
  loading: boolean
  error: string | null
  disabled?: boolean
  onChange: (value: ShareVersionSelection) => void
  onRetry: () => void
}
```

交互规则：

- 第一项固定 current，并提示“发布后不会自动更新”；
- history 主文案 `V{n} · {version_name || milestone_name || '未命名版本'}`，辅助文案为保存时间；
- deleted-history 只作为当前值显示，不可选择；
- loading 不清空已有 versions；error 显示重试但不禁用 current；
- CommandList 限高滚动，按版本号、名称、里程碑检索。

- [ ] **Step 2: 实现共用来源 badge**

`VersionBadge` 只接收 `ShareVersionSource`：current 显示“当前版本”；history 显示 `Vn · label`；ID 为空时增加“原版本已删除” tooltip/辅助标记。

- [ ] **Step 3: 接入快速分享创建**

`CreateForm.onCreate` 改为 `(selection, options) => Promise<boolean>`；本地 selection 默认 current，成功后重置 current。

`QuickDialog.handleCreate`：

```ts
const release = await resolveResumeShareRelease({
  resumeId: openForResumeId,
  displayName: openForResumeName,
  selection,
  getCurrentSource: async () => getSnapshot(),
})
await createRelease(openForResumeId, release, options)
```

描述改为“生成所选版本的只读快照”；从 store 读取当前 resume 的缓存/加载/错误状态传给 selector。

- [ ] **Step 4: 接入分享管理页创建**

选择 resume 时重置 selection 为 current，并调用 `loadVersionOptions(resumeId, { force: true })`。提交时以 `getResumeSnapshotById` 作为 current provider，以 `selectedResume.displayName` 作为 displayName；提交期间锁定 resume 和版本选择。

两个创建调用方都迁到 `createRelease` 后，删除 legacy store `create` action 和旧 `createResumeShare` 数据接口；使用 `rg -n "createResumeShare\(|\bcreate\("` 定向确认分享创建链路没有旧签名残留，再运行 TypeScript。

- [ ] **Step 5: 验证创建路径**

```bash
pnpm exec tsc --noEmit
pnpm eslint src/pages/share/components/version-selector \
  src/pages/share/components/version-badge \
  src/pages/share/components/quick-dialog \
  src/pages/share/components/create-dialog
```

人工检查：切换 resume 必定重置 current；没有历史版本时只显示 current；加载失败仍可创建 current；历史选择传入实际 ID。

- [ ] **Step 6: 提交 Task 5**

```bash
git add src/pages/share/components/version-selector/index.tsx \
  src/pages/share/components/version-badge/index.tsx \
  src/pages/share/components/quick-dialog/create-form.tsx \
  src/pages/share/components/quick-dialog/index.tsx \
  src/pages/share/components/create-dialog/index.tsx \
  src/lib/supabase/resume/share.ts \
  src/pages/share/store/types.ts src/pages/share/store/data.ts
git commit --only src/pages/share/components/version-selector/index.tsx \
  src/pages/share/components/version-badge/index.tsx \
  src/pages/share/components/quick-dialog/create-form.tsx \
  src/pages/share/components/quick-dialog/index.tsx \
  src/pages/share/components/create-dialog/index.tsx \
  src/lib/supabase/resume/share.ts \
  src/pages/share/store/types.ts src/pages/share/store/data.ts \
  -m "feat(share): 支持按版本创建分享"
```

---

### Task 6: 已有链接显式更换版本

**Files:**

- Modify: `src/lib/supabase/resume/share.ts`
- Modify: `src/pages/share/store/types.ts`
- Modify: `src/pages/share/store/data.ts`
- Create: `src/pages/share/components/version-dialog/index.tsx`
- Modify: `src/pages/share/components/quick-dialog/index.tsx`
- Modify: `src/pages/share/components/quick-dialog/link-row.tsx`
- Modify: `src/pages/share/components/card/index.tsx`
- Modify: `src/pages/share/components/mobile-list/mobile-item.tsx`
- Modify: `src/pages/share/components/mobile-list/action-drawer.tsx`
- Modify: `src/pages/share/index.tsx`

- [ ] **Step 1: 实现版本发布弹窗**

```ts
interface VersionDialogProps {
  getCurrentSnapshot: CurrentResumeShareSnapshotProvider
}
```

组件从 `versionShareId` 在 `allShares/shares` 找目标；打开时保留 retained share 供关闭动画使用，用 `toVersionDialogSelection(share.source)` 初始化并强制重验版本列表。

重验成功后，仅当“当前 selection 仍是 share 原来源的同一 history ID”且该 ID 已不在完整版本列表中时，转换为由 `share.source` 冗余元数据构造的 deleted-history。重验失败或用户已经明确改选时不得覆盖当前 selection，也不得自动回退 current。

提交门禁：

```ts
if (!share || !isPublishableVersionSelection(selection))
  return
```

随后 resolve release → `publishRelease`；成功提示“已发布所选版本”并关闭。pending 时禁用关闭、selector 和按钮。

history 提交前保存删除占位所需元数据，优先级为：① 当前缓存中同 ID 的版本元数据；② 若所选 ID 等于 `share.source.versionId`，回退使用 share 已冗余的 `versionNo/versionLabel/versionCreatedAt`。因此即使首次重验失败、缓存为空，原来源仍能构造删除占位。

若 resolver 失败：强制重验版本列表；重验成功且所选 ID 已不存在、且上述任一来源提供了元数据时，把 selection 转成 deleted-history，提示“所选历史版本已删除”，原链接保持不变；若版本仍存在或确实没有可用元数据，则保留可发布 selection 并显示原始发布错误。这样同时覆盖弹窗打开前已删除、首次重验失败，以及打开后/提交前才删除的竞态。

deleted-history 显示：“原历史版本已删除，当前链接仍保留原快照。请选择新的版本后再发布。”主按钮禁用，绝不自动选择 current。

- [ ] **Step 2: 在两个宿主挂载正确 current provider**

快速弹窗内部：

```tsx
<VersionDialog getCurrentSnapshot={async () => getSnapshot()} />
```

分享管理页根部：

```tsx
<VersionDialog getCurrentSnapshot={getResumeSnapshotById} />
```

保持编辑器内存 current 和管理页云端 current 的区别。

- [ ] **Step 3: 替换所有旧更新入口并展示来源**

- `LinkRow`：移除直接 `getSnapshot/pushSnapshot`，加入 badge 与“更换分享版本”；
- `LinkCard`：移除 `getResumeSnapshotById/pushSnapshot`，菜单项打开版本弹窗；
- `ActionDrawer`：同样只打开版本弹窗；
- `MobileItem`：摘要加入 current 或 `Vn · label`；
- settings/password/expiry 行为不变。

全部入口迁移后删除 legacy store `pushSnapshot` action 和 `pushResumeShareSnapshot` 数据接口；最终只保留 `publishRelease` / `publishResumeShareRelease`。

- [ ] **Step 4: 验证旧行为已完全收敛**

```bash
rg -n "推送最新版|pushSnapshot|pushResumeShareSnapshot" \
  src/pages/share src/lib/supabase/resume/share.ts
pnpm exec tsc --noEmit
pnpm eslint src/pages/share
```

Expected: `rg` 无旧行为残留；TypeScript/ESLint exit 0。

人工检查：deleted-history 初始化后按钮禁用；列表重验不能把它改成 current；版本在弹窗打开后删除会在失败重验后转成 deleted-history；只有用户明确选择 current/有效 history 才能发布。

- [ ] **Step 5: 提交 Task 6**

```bash
git add src/pages/share/components/version-dialog/index.tsx \
  src/pages/share/components/quick-dialog/index.tsx \
  src/pages/share/components/quick-dialog/link-row.tsx \
  src/pages/share/components/card/index.tsx \
  src/pages/share/components/mobile-list/mobile-item.tsx \
  src/pages/share/components/mobile-list/action-drawer.tsx \
  src/pages/share/index.tsx \
  src/lib/supabase/resume/share.ts \
  src/pages/share/store/types.ts src/pages/share/store/data.ts
git commit --only src/pages/share/components/version-dialog/index.tsx \
  src/pages/share/components/quick-dialog/index.tsx \
  src/pages/share/components/quick-dialog/link-row.tsx \
  src/pages/share/components/card/index.tsx \
  src/pages/share/components/mobile-list/mobile-item.tsx \
  src/pages/share/components/mobile-list/action-drawer.tsx \
  src/pages/share/index.tsx \
  src/lib/supabase/resume/share.ts \
  src/pages/share/store/types.ts src/pages/share/store/data.ts \
  -m "feat(share): 支持原链接更换发布版本"
```

---

### Task 7: 全量静态验证与手工验收

**Files:**

- Modify only if verification exposes defects in Tasks 1–6 files.

- [ ] **Step 1: 运行完整静态验证**

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Expected: 全部 exit 0，不以“已有失败”为由忽略新增问题。

- [ ] **Step 2: 检查迁移与匿名协议**

```bash
rg -n "source_kind|source_version" \
  supabase/migrations/20260812000001_add_resume_share_version_source.sql
rg -n "source_kind|source_version" \
  supabase/functions/resume-share/index.ts src/pages/share/view
```

Expected: 5 个来源字段只出现在 owner 持久化链路；匿名 Function/查看页无新增来源字段。可用时执行 `supabase db lint --local`；不可用时明确记录环境限制。

- [ ] **Step 3: 启动应用验收桌面与移动流程**

```bash
pnpm dev --host 127.0.0.1
```

验收矩阵：

1. 编辑器未同步的 current 可创建分享；
2. 快速分享可选择历史版本创建；
3. 管理页选简历后可选择历史版本创建；
4. current → history、history → current 后 URL 不变；
5. 重新发布 current 会更新快照；
6. 删除来源历史版本后链接仍访问，owner 端显示“原版本已删除”，按钮保持禁用直至明确重选；
7. 版本列表加载失败仍可选 current，重试恢复；
8. 历史快照/模板发布失败不改变原链接；
9. 桌面卡片、快速弹窗、移动列表/抽屉来源一致；
10. 匿名响应不含版本来源。

- [ ] **Step 4: 检查工作区保护与最终差异**

```bash
git status --short
git diff --check
git diff --cached --name-status
git log --oneline -10
```

确认 `AGENTS.md` 与 `src/pages/resume/components/resume-card/index.tsx` 仍是用户独立改动，未进入功能提交；不执行 push。

- [ ] **Step 5: 仅在验收暴露缺陷时提交修复**

```bash
git commit --only <verified-fix-paths...> -m "fix(share): 修正版本分享验收问题"
```

无修复则不创建空提交。

---

## 完成定义

- 创建和更新分享都支持 current + 全部历史版本；
- URL/token 不因更换版本改变，内容仍为独立脱敏快照；
- owner 刷新后能解释来源，删除历史版本后仍保留标签与快照；
- deleted-history 不会自动发布 current；
- current provider 不重复脱敏或模板解析；
- 列表分页、重验、并发去重和双列表一致性经过静态路径审查与手工模拟；
- migration、类型检查、lint 和生产构建通过；
- 未新增测试依赖、测试文件或测试脚本；
- 用户已有工作区修改保持独立；
- 未执行 `git push`。
