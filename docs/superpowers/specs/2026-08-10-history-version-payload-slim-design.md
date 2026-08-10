# 历史版本 P2 #8-A：列表载荷瘦身（按需取 snapshot）设计

- 日期：2026-08-10
- 来源：`docs/superpowers/specs/2026-08-10-history-version-critique.md` P2 #8，经调研收敛为「载荷瘦身」
- 范围：把版本列表从「随列表全量拉每条 snapshot」改为「列表轻量、snapshot 按需取」；**不做**分页、**不做**自动删除保留策略
- 文案原则：用户可见文案轻量口语化

---

## 一、问题与目标

**问题：** `listResumeHistoryVersions` 用完整 `VERSION_SELECTOR`（含 `snapshot` jsonb）拉所有版本，只为渲染侧边栏列表。N 个版本 = 下载 N 份完整简历 JSON。列表渲染根本用不到 snapshot。

**目标：** 列表查询不含 snapshot；snapshot 仅在「选中后」场景（详情面板 / 对比 / PDF / 恢复）按需单条拉取并缓存。

**非目标（明确排除）：** 分页 / 加载更多；自动删除旧版本的保留策略；`listResumeHistoryVersionSummaries`（跨简历摘要，已经是轻量 selector，不动）。

---

## 二、现状消费点（必须全部改造，否则去 snapshot 会拖垮功能）

`version.snapshot` 当前被同步读取的位置：
1. `store/history-data.ts` `hydrate` → `versions.map(normalizeHistoryVersion)`（normalize 里 `buildResumeSnapshot(version.snapshot)`）。
2. `utils.ts:239` `getCurrentSyncState` → `areSnapshotsEqual(currentResume.snapshot, versions[0]?.snapshot)`（同步徽标）。
3. `detail-content.tsx:22` → `state.selectedVersion?.snapshot`（详情面板「简历」tab）。
4. `compare-dialog/index.tsx:50` → `versions.find(...)?.snapshot`（对比）。
5. `detail-header.tsx:199` → `selectedVersion.snapshot`（PDF 导出按钮）。
6. `store` `restoreVersion` → 把整个 `targetVersion`（含 snapshot）传给 `restoreResumeHistoryVersion`（`restore.ts:26` 读 `targetVersion.snapshot`）。

---

## 三、方案

### 数据层（`src/lib/supabase/resume/history/queries.ts`）
- 新增 `VERSION_LIST_SELECTOR`：等于 `VERSION_SELECTOR` **去掉 `snapshot`**（保留 `content_hash`、`company_id`、`submitted_at` 等所有轻量列）。
- `listResumeHistoryVersions` 改用 `VERSION_LIST_SELECTOR`，返回类型 `ResumeHistoryVersionListRow`（不含 snapshot）。
- 新增 `getResumeHistoryVersionSnapshot(id: number): Promise<ResumeSnapshot>`：`select('snapshot').eq('id', id).eq('user_id', ...).single()`，返回 `buildResumeSnapshot(row.snapshot)`。

### 类型（`src/lib/supabase/resume/history/types.ts`）
- 拆分 Base：`ResumeHistoryVersionMeta`（所有列**除** snapshot）；`ResumeHistoryVersionRecord = ResumeHistoryVersionMeta & { snapshot: ResumeSnapshot }`（保持向后兼容，仍表示「带 snapshot 的完整版本」，供 create/restore 返回）。
- 新增 `ResumeHistoryVersionListItem = ResumeHistoryVersionMeta`（列表项，无 snapshot）。
- `createResumeHistoryVersion`/`updateResumeHistoryVersion` 仍返回完整 Row（它们 `.select(VERSION_SELECTOR)` 带 snapshot，保持不变——create/update 后需要完整记录）。

### Store（`src/pages/history/store/`）
- `versions: ResumeHistoryVersionListItem[]`（轻量，无 snapshot）。
- 新增 `snapshotCache: Record<number, ResumeSnapshot>`。
- 新增 action `loadVersionSnapshot(id): Promise<ResumeSnapshot | null>`：命中缓存直接返回；否则 `getResumeHistoryVersionSnapshot(id)` → 存缓存 → 返回。带 in-flight 去重（可选，本轮简单实现即可）。
- `hydrate`：`versions` 用轻量 normalize（不再 `buildResumeSnapshot`，因为无 snapshot）；重置 `snapshotCache`。
- `saveCurrentVersion`：`content_hash` 去重逻辑不变（用 `versions[0].content_hash`，本就不依赖 snapshot）；create 返回的完整记录写入时——**列表项存轻量版**（剥掉 snapshot），并把其 snapshot 塞进 `snapshotCache`。
- `restoreVersion`：`targetVersion` 现在无 snapshot → 先 `loadVersionSnapshot(versionId)` 拿到 snapshot，再传给 `restoreResumeHistoryVersion`（改其入参为直接收 `targetSnapshot` + 轻量 targetVersion 元信息，或在 store 侧组装完整对象）。

### 同步徽标改用 hash（`utils.ts` `getCurrentSyncState`）
- 不再 `areSnapshotsEqual(currentResume.snapshot, versions[0].snapshot)`。
- 改为比对 hash：`currentResume` 带上 `contentHash`（`buildCurrentResume` 时 `createResumeSnapshotHash` 算一次），与 `versions[0].content_hash` 比较。
- `HistoryCurrentResume` 加 `contentHash: string`；`buildCurrentResume` 变 async 或在 hydrate 里算（hydrate 已 async）。
- `getCurrentSyncState` 签名不变（仍收 currentResume + versions），内部改比 hash。

### 消费点改造
- **detail-content**：选中版本时用 `loadVersionSnapshot(selectedVersion.id)`，得到 snapshot 前「简历」tab 显示 skeleton/loading。
- **compare-dialog**：`snapshotOf` 改为异步——组件内对选中的 base/target 各 `loadVersionSnapshot`，加载态显示「加载中」。
- **version-pdf-export**：按钮点击时确保 snapshot 已加载（`loadVersionSnapshot` 后再打印）；或按钮组件接收 `versionId`，内部加载。
- **detail-header** 传给 PDF 按钮的从 `snapshot` 改为 `versionId`。

---

## 四、影响面 / 风险 / 验证

### 改动文件
- 改：`history/queries.ts`、`history/types.ts`、`pages/history/store/*`（data slice + types）、`pages/history/utils.ts`（normalize/sync/buildCurrentResume）、`detail-content.tsx`、`compare-dialog/index.tsx`、`version-pdf-export/index.tsx`、`detail-header.tsx`、`restore.ts`（入参）。
- 无 DB 迁移（纯查询 + 前端）。

### 风险（诚实）
- 回归面大：同步徽标、对比、PDF、恢复、详情简历 tab 全部从「同步读」变「异步取」。每处都要处理加载态。
- **重点验证**：恢复功能（现在要先 load snapshot 再恢复，不能拿到 undefined）；同步徽标（hash 比对结果要与旧的 snapshot 比对一致）。

### 验证
- `tsc --noEmit` + `eslint` 改动文件全绿。
- 纯逻辑（sync-state hash 比对、列表 normalize 不再需要 snapshot）用一次性 node 脚本验证后删。
- 人工：列表加载正常且更快（Network 面板确认列表响应不含 snapshot）；选中版本→简历 tab 正常渲染；对比两版正常；导出 PDF 正常；恢复正常；同步徽标「已同步/有未保存更新」正确。
- 本仓库默认不写持久化测试。

### 非目标复述
分页、自动删除保留策略 —— 不在本轮。
