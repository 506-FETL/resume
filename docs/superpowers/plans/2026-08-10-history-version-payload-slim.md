# 历史版本 列表载荷瘦身（P2 #8-A）实现计划

> **面向 AI 代理的工作者：** 用 superpowers:executing-plans 逐任务实现，步骤用 `- [ ]` 跟踪。
>
> **本仓库特例：** 「不需要写测试」。不新增持久化测试文件；纯逻辑用一次性 node 脚本验证后删除，其余用 `tsc --noEmit` + `eslint`。用户可见文案轻量口语化。
>
> **无 DB 迁移**——纯查询 + 前端。

**目标：** 版本列表查询不再拉每条 `snapshot`；snapshot 仅在选中/对比/PDF/恢复时按需单条拉取并缓存。同步徽标改用 `content_hash` 比对，彻底解除列表对 snapshot 的依赖。

**架构：** 新增轻量 list selector + `getResumeHistoryVersionSnapshot(id)` 按需取；store 存轻量 `versions[]` + `snapshotCache` + `loadVersionSnapshot(id)`；`getCurrentSyncState` 与 `HistoryCurrentResume.contentHash` 用 hash 比对；4 个消费点改异步取 + 加载态。

**技术栈：** Supabase 查询 + Zustand + React。

---

## 文件结构

- 改 `src/lib/supabase/resume/history/types.ts` — 拆 Meta / ListItem 类型。
- 改 `src/lib/supabase/resume/history/queries.ts` — VERSION_LIST_SELECTOR + getResumeHistoryVersionSnapshot。
- 改 `src/lib/supabase/resume/history/restore.ts` — 入参从 targetVersion.snapshot 改为显式 targetSnapshot。
- 改 `src/pages/history/types.ts` — HistoryCurrentResume 加 contentHash；store 类型加 snapshotCache/loadVersionSnapshot。
- 改 `src/pages/history/utils.ts` — normalize 轻量化、buildCurrentResume 加 hash、getCurrentSyncState 改 hash 比对。
- 改 `src/pages/history/store/types.ts` + `store/history-data.ts` — 轻量 versions + snapshotCache + loadVersionSnapshot + restore 改造。
- 改 `src/pages/history/components/detail-panel/detail-content.tsx` — 简历 tab 按需取 + loading。
- 改 `src/pages/history/components/compare-dialog/index.tsx` — 两侧按需取 + loading。
- 改 `src/pages/history/components/version-pdf-export/index.tsx` + `detail-header.tsx` — PDF 按 versionId 按需取。

---

## 任务 1：查询层 —— 轻量 selector + 按需取 snapshot

**文件：** 修改 `src/lib/supabase/resume/history/queries.ts`

- [ ] **步骤 1：新增 `VERSION_LIST_SELECTOR`（VERSION_SELECTOR 去掉 snapshot）**

在 `VERSION_SELECTOR` 定义之后加：

```ts
const VERSION_LIST_SELECTOR = `
  id,
  created_at,
  updated_at,
  user_id,
  resume_id,
  version_no,
  version_name,
  description,
  milestone_name,
  source_type,
  tags,
  content_hash,
  base_updated_at,
  company_id,
  submitted_at
`
```

- [ ] **步骤 2：`listResumeHistoryVersions` 改用轻量 selector + 返回类型**

```ts
export async function listResumeHistoryVersions(resumeId: string) {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config_versions')
    .select(VERSION_LIST_SELECTOR)
    .eq('resume_id', resumeId)
    .eq('user_id', user.id)
    .order('version_no', { ascending: false })

  if (error)
    throw error

  return (data ?? []) as ResumeHistoryVersionListRow[]
}
```
（`ResumeHistoryVersionListRow` 在任务 2 定义；先写这里，tsc 会在任务 2 前报缺类型，属预期。）

- [ ] **步骤 3：新增 `getResumeHistoryVersionSnapshot`**

在 `listResumeHistoryVersions` 之后加：

```ts
export async function getResumeHistoryVersionSnapshot(id: number) {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config_versions')
    .select('snapshot')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error)
    throw error

  return (data as { snapshot: ResumeSnapshot | Record<string, unknown> }).snapshot
}
```
（确认文件顶部已 import `ResumeSnapshot` 类型；若无则从 `./types` 补 import。）

---

## 任务 2：类型 —— 拆 Meta / ListItem

**文件：** 修改 `src/lib/supabase/resume/history/types.ts`

- [ ] **步骤 1：把 Base 拆成 Meta（无 snapshot）+ 完整 Record**

将现有 `ResumeHistoryVersionBase<TSnapshot>` 替换为：

```ts
// 版本元信息（不含 snapshot）
export interface ResumeHistoryVersionMeta {
  id: number
  created_at: string
  updated_at: string
  user_id: string
  resume_id: string
  version_no: number
  version_name: string | null
  description: string | null
  milestone_name: string | null
  source_type: ResumeVersionSourceType
  tags: string[] | null
  content_hash: string | null
  base_updated_at: string | null
  company_id: string | null
  submitted_at: string | null
}

// 轻量列表项（DB 行 / 归一后一致，均无 snapshot）
export type ResumeHistoryVersionListRow = ResumeHistoryVersionMeta
export type ResumeHistoryVersionListItem = ResumeHistoryVersionMeta

// 完整记录（含 snapshot）——create/update/restore 返回、按需加载后使用
export type ResumeHistoryVersionRow = ResumeHistoryVersionMeta & { snapshot: ResumeSnapshot | Record<string, unknown> }
export type ResumeHistoryVersionRecord = ResumeHistoryVersionMeta & { snapshot: ResumeSnapshot }
```

保持 `CreateResumeHistoryVersionInput` / `UpdateResumeHistoryVersionInput` 不变（它们已含 company_id/submitted_at）。

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`
预期：会在「消费 `version.snapshot`」的地方报错（下游任务修复）；记录这些报错点作为待改清单。`queries.ts` 应已不报（ListRow 已定义）。

---

## 任务 3：restore 入参解耦 snapshot

**文件：** 修改 `src/lib/supabase/resume/history/types.ts`、`src/lib/supabase/resume/history/restore.ts`

- [ ] **步骤 1：改 `RestoreResumeHistoryVersionInput`**

把 `targetVersion: ResumeHistoryVersionRecord` 拆为「元信息 + 显式 snapshot」：

```ts
export interface RestoreResumeHistoryVersionInput {
  resumeId: string
  targetVersion: ResumeHistoryVersionListItem // 仅用其 version_no/version_name/milestone_name/tags
  targetSnapshot: ResumeSnapshot // 按需加载后显式传入
  currentSnapshot: ResumeSnapshot
  currentUpdatedAt: string | null
  strategy: RestoreStrategy
}
```

- [ ] **步骤 2：改 `restore.ts` 用 `targetSnapshot`**

把 `restore.ts:26` 的 `targetVersion.snapshot` 改为入参 `targetSnapshot`：

```ts
export async function restoreResumeHistoryVersion({
  resumeId,
  targetVersion,
  targetSnapshot,
  currentSnapshot,
  currentUpdatedAt,
  strategy,
}: RestoreResumeHistoryVersionInput) {
  if (strategy === 'with_backup') {
    await createResumeHistoryVersion({
      resume_id: resumeId,
      version_name: '恢复前备份',
      description: `恢复到 V${targetVersion.version_no} 前自动保存`,
      source_type: 'autosave',
      tags: ['恢复前备份'],
      snapshot: currentSnapshot,
      content_hash: await createResumeSnapshotHash(currentSnapshot),
      base_updated_at: currentUpdatedAt,
    })
  }

  const restoredSnapshot = await replaceAutomergeDocumentSnapshot(resumeId, targetSnapshot)

  return createResumeHistoryVersion({
    resume_id: resumeId,
    version_name: `从 V${targetVersion.version_no} 恢复`,
    description: trimToNull(
      targetVersion.version_name
        ? `从「${targetVersion.version_name}」恢复当前内容`
        : `从 V${targetVersion.version_no} 恢复当前内容`,
    ),
    milestone_name: trimToNull(targetVersion.milestone_name),
    source_type: 'restore',
    tags: targetVersion.tags ?? [],
    snapshot: restoredSnapshot,
    content_hash: await createResumeSnapshotHash(restoredSnapshot),
    base_updated_at: currentUpdatedAt,
  })
}
```

- [ ] **步骤 3：验证 + Commit（任务1-3 一起）**

运行：`npx tsc --noEmit 2>&1 | head -40`（此时 pages 层仍会报错，属预期；确认 lib 层无报错）。
运行：`npx eslint src/lib/supabase/resume/history`（应 exit 0）。

```bash
git add src/lib/supabase/resume/history
git commit -m "feat(history): 版本列表查询去 snapshot，新增按需取快照与 restore 解耦"
```

---

## 任务 4：utils —— normalize 轻量化 + 当前内容 hash + 同步徽标改 hash

**文件：** 修改 `src/pages/history/types.ts`、`src/pages/history/utils.ts`

- [ ] **步骤 1：`HistoryCurrentResume` 加 `contentHash`**（`src/pages/history/types.ts`）

```ts
export interface HistoryCurrentResume {
  resumeId: string
  displayName: string
  description: string
  updatedAt: string | null
  type: ResumeType
  snapshot: ResumeSnapshot
  contentHash: string
}
```

- [ ] **步骤 2：新增轻量 normalize + 保留完整 normalize**（`utils.ts`）

把 `normalizeHistoryVersion`（现读 snapshot）替换为两个函数：

```ts
// 列表项：无 snapshot，仅归一 tags
export function normalizeHistoryVersionListItem(row: ResumeHistoryVersionListRow): ResumeHistoryVersionListItem {
  return { ...row, tags: normalizeTags(row.tags) }
}

// 完整记录（create/update/restore 返回，含 snapshot）
export function normalizeHistoryVersion(version: ResumeHistoryVersionRow): ResumeHistoryVersionRecord {
  return {
    ...version,
    tags: normalizeTags(version.tags),
    snapshot: buildResumeSnapshot(version.snapshot),
  }
}
```
补 import：`ResumeHistoryVersionListRow`、`ResumeHistoryVersionListItem` from `@/lib/supabase/resume/history`。

- [ ] **步骤 3：`buildCurrentResume` 计算 contentHash（改为 async）**

```ts
export async function buildCurrentResume(record: ResumeHistoryResumeRecord): Promise<HistoryCurrentResume> {
  const snapshot = buildResumeSnapshot(record)
  return {
    resumeId: record.resume_id,
    displayName: record.display_name?.trim() || '未命名简历',
    description: record.description?.trim() || '',
    updatedAt: record.updated_at,
    type: normalizeResumeType(record.type),
    snapshot,
    contentHash: await createResumeSnapshotHash(snapshot),
  }
}
```
补 import：`createResumeSnapshotHash` from `@/lib/supabase/resume`（确认导出）。

- [ ] **步骤 4：`getCurrentSyncState` 改用 hash 比对（含 null 兜底）**

```ts
export function getCurrentSyncState(currentResume: HistoryCurrentResume | null, versions: ResumeHistoryVersionListItem[]) {
  if (!currentResume || versions.length === 0) {
    return { latestVersionNo: null, synced: false }
  }
  const latest = versions[0]
  // content_hash 为 null（迁移前旧数据）→ 保守显示「有未保存的更新」，不误报已同步
  const synced = Boolean(latest?.content_hash) && latest.content_hash === currentResume.contentHash
  return {
    latestVersionNo: latest?.version_no ?? null,
    synced,
  }
}
```
（`getCurrentSyncState` 的 `versions` 形参类型从 `ResumeHistoryVersionRecord[]` 改为 `ResumeHistoryVersionListItem[]`；`areSnapshotsEqual` 若不再被其它地方使用可保留，不强制删。）

- [ ] **步骤 5：一次性 node 脚本验证 sync 逻辑（跑完删）**

写 `/tmp/test-sync.mjs` 验证：
1. versions 空 → synced=false
2. latest.content_hash===current.contentHash → synced=true
3. 不等 → false
4. latest.content_hash=null（旧数据）→ false（兜底）

运行：`node /tmp/test-sync.mjs`，全 PASS 后 `rm -f /tmp/test-sync.mjs`。

- [ ] **步骤 6：验证**

运行：`npx tsc --noEmit 2>&1 | head -40`（store 层仍报错，预期）。`npx eslint src/pages/history/utils.ts src/pages/history/types.ts` 应针对本文件通过（引用未改的 store 不在范围）。

---

## 任务 5：store —— 轻量 versions + snapshotCache + loadVersionSnapshot + restore 改造

**文件：** 修改 `src/pages/history/store/types.ts`、`src/pages/history/store/history-data.ts`

- [ ] **步骤 1：store 类型加字段**（`store/types.ts`）

`HistoryStoreState` 里：
- `versions: ResumeHistoryVersionRecord[]` → `versions: ResumeHistoryVersionListItem[]`
- 加 `snapshotCache: Record<number, ResumeSnapshot>`
- 加 `loadVersionSnapshot: (id: number) => Promise<ResumeSnapshot | null>`

补 import `ResumeHistoryVersionListItem`、`ResumeSnapshot`。

- [ ] **步骤 2：`hydrate` 用轻量 normalize + 重置缓存**

```ts
const hydrate = async (resumeId: string) => {
  const [resume, versions] = await Promise.all([
    getResumeHistoryResume(resumeId),
    listResumeHistoryVersions(resumeId),
  ])
  set({
    currentResume: await buildCurrentResume(resume),
    versions: versions.map(normalizeHistoryVersionListItem),
    snapshotCache: {},
    error: null,
    loading: false,
  })
}
```
（`buildCurrentResume` 现为 async，注意 await；import `normalizeHistoryVersionListItem`。）

- [ ] **步骤 3：初始 state 加 `snapshotCache: {}`**

在 slice 返回对象里（`versions: []` 附近）加 `snapshotCache: {},`。

- [ ] **步骤 4：实现 `loadVersionSnapshot`**

```ts
async loadVersionSnapshot(id) {
  const cached = get().snapshotCache[id]
  if (cached)
    return cached
  try {
    const raw = await getResumeHistoryVersionSnapshot(id)
    const snapshot = buildResumeSnapshot(raw)
    set(state => ({ snapshotCache: { ...state.snapshotCache, [id]: snapshot } }))
    return snapshot
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '加载版本内容失败')
    return null
  }
}
```
补 import：`getResumeHistoryVersionSnapshot` from `@/lib/supabase/resume`、`buildResumeSnapshot` from `../utils`。

- [ ] **步骤 5：`saveCurrentVersion` create 后写缓存 + 存轻量项**

create 返回的完整记录（含 snapshot）拆分：列表项存轻量、snapshot 进缓存。把原 `set({ versions: [created, ...versions] })` 段改为：

```ts
const createdRow = await createResumeHistoryVersion({ ... }) // 保持原参数
const createdList = normalizeHistoryVersionListItem(createdRow)
const createdRecord = normalizeHistoryVersion(createdRow)
set(state => ({
  versions: [createdList, ...state.versions],
  snapshotCache: { ...state.snapshotCache, [createdRecord.id]: createdRecord.snapshot },
}))
```
（`saveCurrentVersion` 里 `latest.content_hash` 去重逻辑不变。）

- [ ] **步骤 6：`restoreVersion` 先按需取 snapshot 再恢复**

```ts
async restoreVersion(versionId, strategy) {
  const { resumeId, currentResume, versions } = get()
  const targetVersion = versions.find(version => version.id === versionId)
  if (!resumeId || !currentResume || !targetVersion)
    return null

  set({ restoring: true })
  try {
    const targetSnapshot = await get().loadVersionSnapshot(versionId)
    if (!targetSnapshot)
      return null

    const restoredRow = await restoreResumeHistoryVersion({
      resumeId,
      targetVersion,
      targetSnapshot,
      currentSnapshot: currentResume.snapshot,
      currentUpdatedAt: currentResume.updatedAt,
      strategy,
    })
    const restoredVersion = normalizeHistoryVersion(restoredRow)
    await hydrate(resumeId)
    toast.success('已恢复至所选版本')
    return restoredVersion
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '恢复版本失败')
    return null
  }
  finally {
    set({ restoring: false })
  }
}
```

- [ ] **步骤 7：验证 + Commit**

运行：`npx tsc --noEmit 2>&1 | head -40`（此时仅剩组件层 detail-content/compare/pdf 报错，预期）。
`npx eslint src/pages/history/store src/pages/history/utils.ts src/pages/history/types.ts`。

```bash
git add src/pages/history/store src/pages/history/utils.ts src/pages/history/types.ts
git commit -m "feat(history): store 轻量版本列表 + 按需加载快照，同步徽标改用 hash"
```

---

## 任务 6：详情面板简历 tab 按需取

**文件：** 修改 `src/pages/history/components/detail-panel/detail-content.tsx`

前置事实：`detailSnapshot` 现取自 `currentResume?.snapshot`（current 分支，仍同步有）或 `state.selectedVersion?.snapshot`（历史版本，现在**无** snapshot）。只有历史版本分支需要按需取。

- [ ] **步骤 1：历史版本分支按需取 snapshot + loading**

在组件内加：

```tsx
const { currentResume, loadVersionSnapshot, snapshotCache } = useHistoryStore()
const [versionSnapshot, setVersionSnapshot] = useState<ResumeSnapshot | null>(null)

const selectedVersionId = state.selectedEntry === 'current' ? null : state.selectedVersion?.id ?? null

useEffect(() => {
  if (selectedVersionId == null) {
    setVersionSnapshot(null)
    return
  }
  const cached = snapshotCache[selectedVersionId]
  if (cached) {
    setVersionSnapshot(cached)
    return
  }
  let cancelled = false
  setVersionSnapshot(null)
  loadVersionSnapshot(selectedVersionId).then((snap) => {
    if (!cancelled)
      setVersionSnapshot(snap)
  })
  return () => {
    cancelled = true
  }
}, [selectedVersionId, snapshotCache, loadVersionSnapshot])

const detailSnapshot = state.selectedEntry === 'current'
  ? currentResume?.snapshot
  : versionSnapshot
```

「简历」tab 内容：`detailSnapshot` 为 null（历史版本加载中）时显示 skeleton，否则 `<HistoryResumePreview snapshot={detailSnapshot} />`。加 `Skeleton` import（`@/components/ui/skeleton`）：

```tsx
{detailSnapshot
  ? <HistoryResumePreview snapshot={detailSnapshot} />
  : <Skeleton className="h-96 w-full" />}
```

注意：概览 tab 仍用 `state.selectedVersion`（元信息，不需要 snapshot），不受影响；`detailSnapshot` 为 null 时不要 early-return 整个组件（否则概览也没了）——把原 `if (!detailSnapshot) return null` 改为仅 current 分支缺失时的保护。

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit && npx eslint src/pages/history/components/detail-panel/detail-content.tsx`
预期：exit 0。

---

## 任务 7：对比弹窗按需取

**文件：** 修改 `src/pages/history/components/compare-dialog/index.tsx`

前置事实：现 `snapshotOf(id)` 同步从 `versions.find().snapshot` 取（现已无）。改为按需取两侧。

- [ ] **步骤 1：base/target 各按需取 snapshot**

```tsx
const { versions, currentResume, loadVersionSnapshot, snapshotCache } = useHistoryStore()
const [beforeSnap, setBeforeSnap] = useState<ResumeSnapshot | null>(null)
const [afterSnap, setAfterSnap] = useState<ResumeSnapshot | null>(null)
const [loadingSnap, setLoadingSnap] = useState(false)

const resolveSnap = useCallback(async (id: string): Promise<ResumeSnapshot | null> => {
  if (id === CURRENT)
    return currentResume?.snapshot ?? null
  const numId = Number(id)
  return snapshotCache[numId] ?? await loadVersionSnapshot(numId)
}, [currentResume, snapshotCache, loadVersionSnapshot])

useEffect(() => {
  let cancelled = false
  setLoadingSnap(true)
  Promise.all([resolveSnap(base), resolveSnap(target)]).then(([b, a]) => {
    if (!cancelled) {
      setBeforeSnap(b)
      setAfterSnap(a)
      setLoadingSnap(false)
    }
  })
  return () => {
    cancelled = true
  }
}, [base, target, resolveSnap])

const diffs = useMemo(
  () => (beforeSnap && afterSnap ? diffSnapshots(beforeSnap, afterSnap) : []),
  [beforeSnap, afterSnap],
)
```

- [ ] **步骤 2：主体加载态**

diff 主体渲染处：`loadingSnap` 为 true 时显示「加载中」，否则现有的空态/diff 渲染。补 `useCallback` import。

- [ ] **步骤 3：验证**

运行：`npx tsc --noEmit && npx eslint src/pages/history/components/compare-dialog/index.tsx`
预期：exit 0。

---

## 任务 8：PDF 导出按 versionId 按需取

**文件：** 修改 `src/pages/history/components/version-pdf-export/index.tsx`、`src/pages/history/components/detail-panel/detail-header.tsx`

前置事实：`VersionPdfExportButton` 现收 `snapshot` prop（detail-header 传 `selectedVersion.snapshot`，现已无）。改为收 `versionId`，内部按需取。

- [ ] **步骤 1：`VersionPdfExportButton` 改收 versionId**

props 从 `{ snapshot, documentTitle, className }` 改为 `{ versionId, documentTitle, className }`。组件内：

```tsx
const { loadVersionSnapshot, snapshotCache } = useHistoryStore()
const snapshot = snapshotCache[versionId] ?? null
const [preparing, setPreparing] = useState(false)

const handleExport = async () => {
  setPreparing(true)
  const snap = snapshot ?? await loadVersionSnapshot(versionId)
  setPreparing(false)
  if (!snap)
    return
  // 确保离屏节点已用该 snapshot 渲染后再打印
  ...（用 state 存 snap，等渲染后 handlePrint；或直接把离屏渲染绑定到 snapshotCache[versionId]）
}
```
实现细节：把离屏 `PagedResumeShell` 的 `appearance`/`data` 绑定到「已加载的 snapshot state」，按钮点击 → 确保加载 → setState → 下一帧 `handlePrint()`。参考现有 off-screen 渲染结构，只是 snapshot 来源改为按需。

- [ ] **步骤 2：detail-header 传 versionId**

`detail-header.tsx` 里 `<VersionPdfExportButton snapshot={selectedVersion.snapshot} .../>` 改为 `versionId={selectedVersion.id}`。

- [ ] **步骤 3：验证 + Commit**

运行：`npx tsc --noEmit && npx eslint src/pages/history/components`
预期：exit 0。

```bash
git add src/pages/history/components
git commit -m "feat(history): 详情/对比/PDF 改为按需加载版本快照"
```

---

## 任务 9：整体验证

- [ ] **步骤 1：全量 tsc + eslint**

运行：`npx tsc --noEmit && npx eslint src/pages/history src/lib/supabase/resume/history`
预期：exit 0。

- [ ] **步骤 2：人工自检清单**
  - Network：`/history` 列表响应不含 snapshot（体积明显变小）。
  - 选中历史版本 → 简历 tab 先 skeleton 后渲染正常。
  - 对比两版正常出 diff；切换版本重新加载正常。
  - 导出某版本 PDF 正常。
  - 恢复某版本正常（不报 undefined snapshot）。
  - 同步徽标：保存后「已同步至 Vx」；编辑当前简历后「有未保存的更新」；旧数据（content_hash 为 null 的版本在首位）显示「有未保存的更新」不误报。

---

## 自检记录（作者已核对）

- **规格覆盖：** 轻量 selector+按需取(任务1)、类型拆分(2)、restore 解耦(3)、normalize/hash 同步徽标(4)、store 缓存+restore(5)、详情(6)、对比(7)、PDF(8)、验证(9)。非目标（分页、保留策略）未纳入。
- **null content_hash 兜底：** 任务 4 步骤 4 明确 `Boolean(latest.content_hash) && ===`，null 时保守 false。
- **类型一致：** `ResumeHistoryVersionListItem`（无 snapshot，列表/store/utils/sync）、`ResumeHistoryVersionRecord`（含 snapshot，create/restore 返回）、`snapshotCache: Record<number, ResumeSnapshot>`、`loadVersionSnapshot(id: number)` 贯穿任务 1-8 一致。
- **buildCurrentResume 变 async** 已在 hydrate（任务5步骤2）await。
- **无占位符**（任务 8 步骤 1 的离屏渲染实现有明确方向 + 参考现有结构，非 TODO）。
