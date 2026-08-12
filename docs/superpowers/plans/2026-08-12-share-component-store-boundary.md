# 分享模块组件与 Store 边界重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将分享管理页重构为 `optimize` 风格的薄页面，消除运输型 props，让子组件直接消费共享 Store，并把具体业务动作放回实际触发组件。

**架构：** Zustand Store 按 data/ui 职责分片，仅管理共享状态、请求隔离、pending IDs 和双列表一致性；页面组件直接读取 Store，快照获取、toast、导航、clipboard 与 overlay 关闭策略保留在触发组件。列表实例数据和宿主 `getSnapshot` 能力继续使用直接 props。

**技术栈：** React 19、TypeScript 5.9、Zustand 5、shadcn/ui Radix、Motion、Sonner、Vite 7

**验证约束：** 本仓库按既有约定不新增测试文件。使用静态接口检查、TypeScript、目标 ESLint、生产构建和浏览器回归验证。

**取代计划：** `2026-08-11-share-store-prop-drilling-refactor.md`

---

## 文件结构与职责

### 创建

- `src/pages/share/store/index.ts`：组装 data/ui slices，默认导出 Store。
- `src/pages/share/store/types.ts`：Store 分片与组合类型。
- `src/pages/share/store/data.ts`：加载、CRUD、请求隔离、pending IDs、双列表同步。
- `src/pages/share/store/ui.ts`：筛选、快速弹窗、设置/删除 overlay 状态。
- `src/pages/share/components/content/index.tsx`：管理页加载/错误/筛选/内容状态机。
- `src/pages/share/components/delete-dialog/index.tsx`：共享删除确认。
- `src/pages/share/components/mobile-list/mobile-item.tsx`：移动列表私有 Item。
- `src/pages/share/components/mobile-list/action-drawer.tsx`：移动列表私有 Drawer。
- `src/pages/share/components/quick-dialog/create-form.tsx`
- `src/pages/share/components/quick-dialog/link-row.tsx`
- `src/pages/share/components/quick-dialog/date-field.tsx`

### 修改

- `src/pages/share/index.tsx`：收敛为初始化、Motion 和页面组件组装。
- `src/pages/share/types.ts`：只保留页面领域类型与快照 provider。
- `src/pages/share/utils.ts`：保留纯 helper，增加记录解析 helper。
- `src/pages/share/hooks/use-share-page-bootstrap.ts`
- `src/pages/share/components/header/index.tsx`
- `src/pages/share/components/toolbar/index.tsx`
- `src/pages/share/components/grid/index.tsx`
- `src/pages/share/components/card/index.tsx`
- `src/pages/share/components/mobile-list/index.tsx`
- `src/pages/share/components/create-dialog/index.tsx`
- `src/pages/share/components/settings-dialog/index.tsx`
- `src/pages/share/components/empty-state/index.tsx`
- `src/pages/share/components/pdf-export/index.tsx`
- `src/pages/share/view/[token].tsx`
- `src/pages/resume/index.tsx`
- `src/pages/resume/editor/index.tsx`

### 重命名

- `components/share-dialog/` → `components/quick-dialog/`
- `components/animated-visibility-icon/` → `components/visibility-icon/`
- `ShareHeader` → `Header`
- `ShareToolbar` → `Toolbar`
- `ShareGrid` → `Grid`
- `ShareCard` → `LinkCard`
- `ShareMobileList` → `MobileList`
- `ShareMobileItem` → `MobileItem`
- `ShareActionDrawer` → `ActionDrawer`
- `ShareCreateDialog` → `CreateDialog`
- `ShareSettingsDialog` → `SettingsDialog`
- `ShareEmptyState` → `EmptyState`
- `ShareDialog` → `QuickDialog`
- `CreateShareForm` → `CreateForm`
- `ShareLinkRow` → `LinkRow`
- `ShareDateField` → `DateField`
- `AnimatedVisibilityIcon` → `VisibilityIcon`
- `SharePdfExport` → `PdfExport`

### 删除

- `src/pages/share/store.ts`
- `src/pages/share/components/action-drawer/`
- `src/pages/share/components/mobile-item/`
- `src/pages/share/components/share-dialog/`
- `src/pages/share/components/animated-visibility-icon/`

### 不修改

- `src/lib/supabase/resume/share.ts` 数据协议。
- Supabase migrations 与 Edge Function。
- 匿名查看页业务状态机与打印逻辑。
- `package.json` 与锁文件。

## 工作区保护

- 当前 `src/pages/share/index.tsx` 和 `src/pages/share/store.ts` 有用户未提交的 import 格式改动；重构应吸收其最新内容，不得回退其他工作。
- 当前分支为 `main`，按仓库规则继续在当前分支工作。
- 每个任务暂存前运行 `git diff --cached --name-status`。
- 每个提交只包含该任务列出的路径。
- 不执行 `git push`。

---

### 任务 1：无行为迁移 Store 到职责分片

**文件：**

- 创建：`src/pages/share/store/types.ts`
- 创建：`src/pages/share/store/data.ts`
- 创建：`src/pages/share/store/ui.ts`
- 创建：`src/pages/share/store/index.ts`
- 修改：`src/pages/share/types.ts`
- 删除：`src/pages/share/store.ts`

- [ ] **步骤 1：收敛页面领域类型**

将 `src/pages/share/types.ts` 改为：

```ts
import type { ResumeShareSnapshotSource } from '@/lib/supabase/resume/share.types'
import type { ResumeType } from '@/lib/schema'

export interface ResumeSummary {
  resumeId: string
  displayName: string
  type: ResumeType
}

export type SnapshotProvider = () => Promise<ResumeShareSnapshotSource>
```

- [ ] **步骤 2：按现有字段定义兼容 Store 契约**

创建 `src/pages/share/store/types.ts`：

```ts
import type { StateCreator } from 'zustand'
import type { ResumeSummary } from '../types'
import type { ShareStatusFilter } from '../utils'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { CreateShareOptions, ResumeShareRecord } from '@/lib/supabase/resume/share.types'

export interface SettingsPayload {
  label: string | null
  expiresAt: string | null
  password: string | null | undefined
}

export interface ShareDataSlice {
  ownerUserId: string | null
  pageRequestId: number
  shares: ResumeShareRecord[]
  allShares: ResumeShareRecord[]
  resumeMap: Record<string, ResumeSummary>
  loading: boolean
  pageLoading: boolean
  mutatingId: string | null
  error: string | null

  bootstrapPage: () => Promise<void>
  reloadPage: () => Promise<void>
  loadShares: (resumeId: string) => Promise<void>
  create: (
    resumeId: string,
    snapshot: PersistedResumeSnapshot,
    templateManifest: TemplateManifest,
    displayName: string | null,
    options?: CreateShareOptions,
  ) => Promise<void>
  setActive: (shareId: string, isActive: boolean) => Promise<void>
  updateSettings: (shareId: string, settings: SettingsPayload) => Promise<void>
  pushSnapshot: (
    shareId: string,
    snapshot: PersistedResumeSnapshot,
    templateManifest: TemplateManifest,
    displayName: string | null,
  ) => Promise<void>
  remove: (shareId: string) => Promise<void>
}

export interface ShareUiSlice {
  openForResumeId: string | null
  openForResumeName: string | null
  searchKeyword: string
  resumeFilters: string[]
  statusFilter: ShareStatusFilter
  actionShare: ResumeShareRecord | null
  actionTrigger: HTMLElement | null

  openDialog: (resumeId: string, resumeName: string | null) => void
  closeDialog: () => void
  setSearchKeyword: (value: string) => void
  setResumeFilters: (value: string[]) => void
  setStatusFilter: (value: ShareStatusFilter) => void
  setActionShare: (
    share: ResumeShareRecord | null,
    trigger?: HTMLElement | null,
  ) => void
}

export type ShareStoreState = ShareDataSlice & ShareUiSlice
export type ShareSlice<T> = StateCreator<ShareStoreState, [], [], T>
```

- [ ] **步骤 3：迁移 data slice，保持现有行为**

创建 `src/pages/share/store/data.ts`，逐行迁移现有 `bootstrapPage`、`loadShares` 和 CRUD。
此任务禁止重命名字段、改变错误行为或增加 pending 逻辑。

初始字段：

```ts
ownerUserId: null,
pageRequestId: 0,
shares: [],
allShares: [],
resumeMap: {},
loading: false,
pageLoading: false,
mutatingId: null,
error: null,
```

`bootstrapPage`、`loadShares`、`create`、`setActive`、`updateSettings`、
`pushSnapshot`、`remove` 的实现与迁移前完全一致。

- [ ] **步骤 4：迁移 ui slice**

创建 `src/pages/share/store/ui.ts`：

```ts
import type { ShareUiSlice, ShareSlice } from './types'

export const createShareUiSlice: ShareSlice<ShareUiSlice> = (set, get) => ({
  openForResumeId: null,
  openForResumeName: null,
  searchKeyword: '',
  resumeFilters: [],
  statusFilter: 'all',
  actionShare: null,
  actionTrigger: null,

  openDialog: (resumeId, resumeName) => {
    set({
      openForResumeId: resumeId,
      openForResumeName: resumeName,
      shares: [],
      loading: true,
      mutatingId: null,
      error: null,
    })
    get().loadShares(resumeId).catch(() => undefined)
  },

  closeDialog: () => set({
    openForResumeId: null,
    openForResumeName: null,
    shares: [],
    loading: false,
    mutatingId: null,
    error: null,
  }),

  setSearchKeyword: searchKeyword => set({ searchKeyword }),
  setResumeFilters: resumeFilters => set({ resumeFilters }),
  setStatusFilter: statusFilter => set({ statusFilter }),
  setActionShare: (actionShare, actionTrigger = null) => set({
    actionShare,
    actionTrigger,
  }),
})
```

- [ ] **步骤 5：组装 Store**

创建 `src/pages/share/store/index.ts`：

```ts
import { create } from 'zustand'
import { createShareDataSlice } from './data'
import type { ShareStoreState } from './types'
import { createShareUiSlice } from './ui'

const useShareStore = create<ShareStoreState>()((...args) => ({
  ...createShareDataSlice(...args),
  ...createShareUiSlice(...args),
}))

export default useShareStore
```

- [ ] **步骤 6：删除旧 Store 并验证 import 路径**

删除 `src/pages/share/store.ts`，运行：

```bash
rg -n "from ['\\\"].*/store\\.ts['\\\"]" src/pages/share src/pages/resume
```

预期：0 处。所有 Store import 仍是 `./store` 或 `@/pages/share/store`。

- [ ] **步骤 7：执行类型和 Lint 验证**

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/pages/share/store src/pages/share/types.ts
```

预期：全部通过，证明本任务只改变文件结构，没有改变组件契约。

- [ ] **步骤 8：提交 Store 结构迁移**

```bash
git add \
  src/pages/share/store.ts \
  src/pages/share/store \
  src/pages/share/types.ts
git diff --cached --name-status
git commit -m "refactor(share): 按职责拆分页面 Store"
```

---

### 任务 2：完善 Store 错误隔离、pending 与目标清理

**文件：**

- 修改：`src/pages/share/store/data.ts`
- 修改：`src/pages/share/store/ui.ts`
- 修改：`src/pages/share/store/types.ts`
- 修改：`src/pages/share/utils.ts`

- [ ] **步骤 1：增加纯记录解析 helper**

在 `utils.ts` 增加：

```ts
export function findShareById(
  allShares: ResumeShareRecord[],
  dialogShares: ResumeShareRecord[],
  shareId: string | null,
) {
  if (!shareId)
    return null
  return allShares.find(share => share.id === shareId)
    ?? dialogShares.find(share => share.id === shareId)
    ?? null
}
```

- [ ] **步骤 2：实现 pending helper**

在 `store/data.ts` 文件内增加：

```ts
function addPending(ids: string[], shareId: string) {
  return ids.includes(shareId) ? ids : [...ids, shareId]
}

function removePending(ids: string[], shareId: string) {
  return ids.filter(id => id !== shareId)
}
```

每个记录级 CRUD：

1. 若 `get().pendingShareIds.includes(shareId)`，抛出 `操作正在进行中`。
2. 开始时添加 ID。
3. 成功时同步两份列表。
4. `finally` 只移除当前 ID。

迁移期间保留 `mutatingId` 字段供旧组件编译，但新组件不得继续使用它。记录动作开始时
同时写入 `mutatingId: shareId`，结束时只在值仍等于当前 ID 时清理。

- [ ] **步骤 3：统一双列表更新**

在 `store/data.ts` 增加内部 helper：

```ts
function mapShareLists(
  state: ShareStoreState,
  updater: (share: ResumeShareRecord) => ResumeShareRecord,
) {
  return {
    allShares: state.allShares.map(updater),
    shares: state.shares.map(updater),
  }
}
```

`setActive`、`updateSettings`、`pushSnapshot` 统一调用此 helper。

- [ ] **步骤 4：删除后清理 overlay**

`remove` 成功的 set 必须同时返回：

```ts
allShares: state.allShares.filter(share => share.id !== shareId),
shares: state.shares.filter(share => share.id !== shareId),
settingsDialogOpen: state.settingsShareId === shareId
  ? false
  : state.settingsDialogOpen,
deleteDialogOpen: state.deleteShareId === shareId
  ? false
  : state.deleteDialogOpen,
```

保留 target ID，不在删除成功同一 tick 清空。

- [ ] **步骤 5：新增错误与请求隔离字段，同时保留兼容字段**

在 Store 类型和初始状态增加：

```ts
pageError: string | null
dialogLoading: boolean
dialogError: string | null
dialogRequestId: number
pendingShareIds: string[]
settingsDialogOpen: boolean
settingsShareId: string | null
deleteDialogOpen: boolean
deleteShareId: string | null
```

暂时保留以下兼容字段，直到任务 9 清理：

```text
loading
error
mutatingId
actionShare
actionTrigger
setActionShare
```

`loadDialogShares` 作为新方法加入，`loadShares` 暂时保留为兼容别名：

```ts
loadShares: resumeId => get().loadDialogShares(resumeId)
```

- [ ] **步骤 6：隔离错误字段**

确认：

- `bootstrapPage` 以 `pageError` 为权威，并在迁移期镜像到兼容 `error`。
- `loadDialogShares` 以 `dialogError` 为权威，并在迁移期镜像到兼容 `error`。
- CRUD 不写 page/dialog error，只抛错。
- CRUD 可继续镜像兼容 `error`，任务 9 删除该字段。
- `closeDialog` 清理 `dialogError` 和兼容 `error`。

- [ ] **步骤 7：增加共享 overlay UI 动作**

在 ui slice 增加：

```ts
openSettingsDialog: settingsShareId => set({
  settingsShareId,
  settingsDialogOpen: true,
}),
closeSettingsDialog: () => set({ settingsDialogOpen: false }),
openDeleteDialog: deleteShareId => set({
  deleteShareId,
  deleteDialogOpen: true,
}),
closeDeleteDialog: () => set({ deleteDialogOpen: false }),
```

`openDialog` 改为：

1. 递增 `dialogRequestId`。
2. 写入 `openForResumeId/openForResumeName`。
3. 同时设置 `dialogLoading/loading=true`。
4. 调用 `loadDialogShares(resumeId)`。

`closeDialog` 递增 `dialogRequestId`，同时清理 `dialogLoading/loading` 和
`dialogError/error`。

- [ ] **步骤 8：验证 Store**

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/pages/share/store src/pages/share/utils.ts
git diff --check
```

预期：全部通过；旧组件继续通过兼容字段工作。

- [ ] **步骤 9：提交 Store 能力**

```bash
git add src/pages/share/store src/pages/share/utils.ts
git diff --cached --name-status
git commit -m "refactor(share): 隔离请求与记录变更状态"
```

---

### 任务 3：重命名页面组件与私有文件

**文件：**

- 重命名：`src/pages/share/components/share-dialog/` → `quick-dialog/`
- 重命名：`animated-visibility-icon/` → `visibility-icon/`
- 移动：`mobile-item/index.tsx` → `mobile-list/mobile-item.tsx`
- 移动：`action-drawer/index.tsx` → `mobile-list/action-drawer.tsx`
- 修改：所有 share/resume 引用

- [ ] **步骤 1：执行目录机械重命名**

使用非交互命令：

```bash
mv src/pages/share/components/share-dialog src/pages/share/components/quick-dialog
mv src/pages/share/components/animated-visibility-icon src/pages/share/components/visibility-icon
mv src/pages/share/components/mobile-item/index.tsx src/pages/share/components/mobile-list/mobile-item.tsx
mv src/pages/share/components/action-drawer/index.tsx src/pages/share/components/mobile-list/action-drawer.tsx
rmdir src/pages/share/components/mobile-item
rmdir src/pages/share/components/action-drawer
mv src/pages/share/components/quick-dialog/create-share-form.tsx \
  src/pages/share/components/quick-dialog/create-form.tsx
mv src/pages/share/components/quick-dialog/share-link-row.tsx \
  src/pages/share/components/quick-dialog/link-row.tsx
mv src/pages/share/components/quick-dialog/share-date-field.tsx \
  src/pages/share/components/quick-dialog/date-field.tsx
```

- [ ] **步骤 2：重命名导出标识符**

按规格统一为：

```text
Header
Toolbar
Grid
LinkCard
MobileList
MobileItem
ActionDrawer
CreateDialog
SettingsDialog
EmptyState
QuickDialog
CreateForm
LinkRow
DateField
VisibilityIcon
PdfExport
```

`src/pages/share/index.tsx` 默认导出函数命名为 `Management`。

- [ ] **步骤 3：更新跨页面 QuickDialog import**

修改：

```text
src/pages/resume/index.tsx
src/pages/resume/editor/index.tsx
src/pages/share/index.tsx
```

导入路径改为：

```ts
import QuickDialog from '@/pages/share/components/quick-dialog'
```

管理页删除 QuickDialog import 与挂载；简历页和编辑器继续挂载。

- [ ] **步骤 4：更新匿名页 PdfExport**

`view/[token].tsx` 改为：

```ts
import PdfExport from '../components/pdf-export'
```

- [ ] **步骤 5：静态检查旧命名**

运行：

```bash
rg -n "Share(Header|Toolbar|Grid|Card|Mobile|Action|Create|Settings|Empty|Dialog|Link|Date|Pdf)|AnimatedVisibility" \
  src/pages/share src/pages/resume
rg -n "components/(share-dialog|animated-visibility-icon|action-drawer|mobile-item)" \
  src/pages/share src/pages/resume
```

预期：跨层领域类型除外，页面组件旧标识符和旧路径无命中。

- [ ] **步骤 6：类型验证并提交机械重命名**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/pages/share src/pages/resume/index.tsx src/pages/resume/editor/index.tsx
git add \
  src/pages/share/components \
  src/pages/share/view/'[token].tsx' \
  src/pages/resume/index.tsx \
  src/pages/resume/editor/index.tsx
git diff --cached --name-status
git commit -m "refactor(share): 统一页面组件命名"
```

---

### 任务 4：让 Header、Toolbar、CreateDialog 直接消费 Store

**文件：**

- 修改：`src/pages/share/index.tsx`
- 修改：`src/pages/share/components/header/index.tsx`
- 修改：`src/pages/share/components/toolbar/index.tsx`
- 修改：`src/pages/share/components/create-dialog/index.tsx`
- 修改：`src/pages/share/components/quick-dialog/date-field.tsx`
- 修改：`src/pages/share/components/visibility-icon/index.tsx`

- [ ] **步骤 1：收敛 Header**

`Header` 无 props，直接：

```ts
const { allShares, resumeMap } = useShareStore()
const [createDialogOpen, setCreateDialogOpen] = useState(false)
```

派生：

```ts
const activeCount = allShares.filter(
  share => deriveShareStatus(share) === 'active',
).length
const canCreate = Object.keys(resumeMap).length > 0
```

按钮打开本地 CreateDialog：

```tsx
<CreateDialog
  open={createDialogOpen}
  onOpenChange={setCreateDialogOpen}
/>
```

- [ ] **步骤 2：收敛 Toolbar**

删除全部 Props。直接读取：

```ts
const {
  resumeMap,
  searchKeyword,
  resumeFilters,
  statusFilter,
  setSearchKeyword,
  setResumeFilters,
  setStatusFilter,
} = useShareStore()
```

排序简历列表使用 `useMemo`。`resumeOpen` 保持本地。

- [ ] **步骤 3：CreateDialog 删除业务 props**

只保留：

```ts
interface CreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}
```

直接读取 `resumeMap/create`，本地派生 resumes。

`handleCreate` 本地：

1. `getResumeSnapshotById(resumeId)`
2. `create(...)`
3. 成功 toast、reset、close
4. 失败 toast，保留表单

- [ ] **步骤 4：CreateDialog 迁移 Field**

使用：

```tsx
<FieldGroup className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
  <Field className="sm:col-span-2">
    <FieldLabel>选择简历</FieldLabel>
    {/* Popover + Command */}
  </Field>
  <Field>
    <FieldLabel htmlFor="new-share-label">链接名称</FieldLabel>
    <Input id="new-share-label" />
  </Field>
  <Field>
    <FieldLabel htmlFor="new-share-password">访问密码</FieldLabel>
    {/* Input + VisibilityIcon */}
  </Field>
  <Field className="sm:col-span-2">
    <FieldLabel>有效期</FieldLabel>
    <DateField />
  </Field>
</FieldGroup>
```

- [ ] **步骤 5：更新页面调用，保留尚未迁移的内容逻辑**

页面入口 `Management`：

- 删除 `createDialogOpen`、`handleCreate`、`handleCreateShare`。
- Header 改为 `<Header />`。
- Toolbar 改为 `<Toolbar />`。
- 删除页面底部 CreateDialog。
- 暂时保留筛选派生、Grid/MobileList、ActionDrawer、SettingsDialog 和删除 AlertDialog。

这样任务 4 完成后行为保持完整，页面只先移除已经下沉的 Header/Toolbar/Create 逻辑。

- [ ] **步骤 6：类型与 Lint 验证**

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/pages/share/index.tsx \
  src/pages/share/components/header \
  src/pages/share/components/toolbar \
  src/pages/share/components/create-dialog \
  src/pages/share/components/quick-dialog/date-field.tsx \
  src/pages/share/components/visibility-icon
```

预期：通过。

- [ ] **步骤 7：提交 Header、Toolbar 与 CreateDialog**

```bash
git add \
  src/pages/share/index.tsx \
  src/pages/share/components/header \
  src/pages/share/components/toolbar \
  src/pages/share/components/create-dialog \
  src/pages/share/components/quick-dialog/date-field.tsx \
  src/pages/share/components/visibility-icon
git diff --cached --name-status
git commit -m "refactor(share): 下沉头部筛选与创建逻辑"
```

---

### 任务 5：移除桌面 Grid/Card 业务回调 props

**文件：**

- 修改：`src/pages/share/components/grid/index.tsx`
- 修改：`src/pages/share/components/card/index.tsx`
- 修改：`src/pages/share/index.tsx`

- [ ] **步骤 1：精简 Grid**

Props 只保留：

```ts
interface GridProps {
  shares: ResumeShareRecord[]
}
```

Card 调用：

```tsx
<LinkCard
  key={share.id}
  share={share}
  index={index}
/>
```

同步修改 `Management` 中 Grid 调用，只传 `shares={filteredShares}`。页面暂时保留
供移动端使用的业务 handler。

- [ ] **步骤 2：让 LinkCard 直接消费 Store**

读取：

```ts
const {
  pendingShareIds,
  openSettingsDialog,
  openDeleteDialog,
  pushSnapshot,
  setActive,
} = useShareStore()
```

实现本地 handler：

```text
handlePreview
handleCopy
handlePushLatest
handleToggleActive
```

`handlePushLatest`：

1. `getResumeSnapshotById(share.resume_id)`
2. `pushSnapshot(...)`
3. 成功/失败 toast

`handleToggleActive` 调用 `setActive(share.id, !share.is_active)`。

设置/删除按钮：

```ts
openSettingsDialog(share.id)
openDeleteDialog(share.id)
```

所有会改变记录的按钮根据：

```ts
const busy = pendingShareIds.includes(share.id)
```

禁用。

- [ ] **步骤 3：修正 Dropdown 组合**

`DropdownMenuContent` 内使用：

```tsx
<DropdownMenuGroup>
  <DropdownMenuItem />
  <DropdownMenuItem />
</DropdownMenuGroup>
<DropdownMenuSeparator />
<DropdownMenuGroup>
  <DropdownMenuItem variant="destructive" />
</DropdownMenuGroup>
```

Button 内图标使用 `data-icon`，不手动设置 size。

- [ ] **步骤 4：静态 props 检查**

运行：

```bash
rg -n "onPreview|onSettings|onPushLatest|onToggleActive|onDelete" \
  src/pages/share/components/grid \
  src/pages/share/components/card
```

预期：无 Props 定义或父级转发命中。

- [ ] **步骤 5：验证并提交**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/pages/share/components/grid src/pages/share/components/card
```

暂不提交。Card 已切换到共享 overlay，而 Settings/Delete 尚未切换；任务 5–7 连续执行，
在任务 7 完成完整可用链路后统一提交。

---

### 任务 6：收敛移动列表与 Action Drawer

**文件：**

- 修改：`src/pages/share/components/mobile-list/index.tsx`
- 修改：`src/pages/share/components/mobile-list/mobile-item.tsx`
- 修改：`src/pages/share/components/mobile-list/action-drawer.tsx`
- 修改：`src/pages/share/index.tsx`

- [ ] **步骤 1：MobileList 本地管理 Drawer**

Props 只保留：

```ts
interface MobileListProps {
  shares: ResumeShareRecord[]
}
```

本地状态：

```ts
const [selectedShare, setSelectedShare] = useState<ResumeShareRecord | null>(null)
const [restoreFocusTo, setRestoreFocusTo] = useState<HTMLElement | null>(null)
```

`handleOpen(share, trigger)` 保存两者；Drawer 关闭后恢复焦点。

同步修改 `Management`：

- MobileList 只传 `shares={filteredShares}`。
- 删除页面级 ActionDrawer 挂载。
- 删除 `actionShare/actionTrigger` 读取。
- 删除仅供桌面/移动动作使用的 preview/push/toggle handler。
- 设置与删除本地状态暂时保留到任务 7。

- [ ] **步骤 2：MobileItem 保留直接协议**

Props：

```ts
interface MobileItemProps {
  ref?: Ref<HTMLDivElement>
  share: ResumeShareRecord
  index: number
  onOpen: (trigger: HTMLElement) => void
}
```

复制逻辑保留本地。整卡触发 `onOpen`。

- [ ] **步骤 3：ActionDrawer 就地执行业务**

Props 只保留：

```ts
interface ActionDrawerProps {
  share: ResumeShareRecord | null
  restoreFocusTo: HTMLElement | null
  onOpenChange: (open: boolean) => void
}
```

直接读取 Store 的 `pendingShareIds/openSettingsDialog/openDeleteDialog/pushSnapshot/setActive`。

预览、推送、启停在 Drawer 内执行并 toast。设置/删除：

```ts
openSettingsDialog(share.id)
onOpenChange(false)
```

```ts
openDeleteDialog(share.id)
onOpenChange(false)
```

关闭时保留 share 直到 Drawer 完成退出；MobileList 在下一次打开时覆盖。

- [ ] **步骤 4：验证焦点与删除**

如果 `shares` 不再包含 `selectedShare.id`，MobileList effect 关闭 Drawer。

关闭回调：

```ts
requestAnimationFrame(() => {
  if (restoreFocusTo?.isConnected)
    restoreFocusTo.focus()
})
```

- [ ] **步骤 5：验证并提交**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/pages/share/components/mobile-list
```

暂不提交。继续执行任务 7，完成共享 Settings/Delete overlay 后统一提交。

---

### 任务 7：Settings/Delete Dialog 直接消费 Store

**文件：**

- 修改：`src/pages/share/components/settings-dialog/index.tsx`
- 创建：`src/pages/share/components/delete-dialog/index.tsx`
- 修改：`src/pages/share/index.tsx`

- [ ] **步骤 1：SettingsDialog 无业务 props**

直接读取 Store，使用 `findShareById` 解析目标。`Dialog`：

```tsx
<Dialog open={settingsDialogOpen} onOpenChange={open => !open && closeSettingsDialog()}>
```

`handleSave` 调用 `updateSettings`，成功 toast 后 `closeSettingsDialog()`，失败保持打开。

- [ ] **步骤 2：SettingsDialog 迁移 Field 与错误语义**

使用 `FieldGroup/Field/FieldLabel/FieldDescription/FieldError`。

校验失败的 Field：

```tsx
<Field data-invalid={Boolean(validationError)}>
  <Input aria-invalid={Boolean(validationError)} />
  {validationError && <FieldError>{validationError}</FieldError>}
</Field>
```

- [ ] **步骤 3：创建 DeleteDialog**

`AlertDialog` 使用：

```tsx
<AlertDialog
  open={deleteDialogOpen}
  onOpenChange={open => !open && closeDeleteDialog()}
>
```

确认按钮 disabled 取当前 ID pending。删除成功由 Store 关闭 overlay，失败保持打开。

- [ ] **步骤 4：清理页面本地 settings/delete 编排**

从 `Management` 删除：

```text
settingsShare
deleteShare
handleOpenSettings
handleSaveSettings
handleDelete
内联 AlertDialog
```

页面底部改为：

```tsx
<SettingsDialog />
<DeleteDialog />
```

- [ ] **步骤 5：验证并统一提交任务 5–7**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/pages/share/index.tsx \
  src/pages/share/components/grid \
  src/pages/share/components/card \
  src/pages/share/components/mobile-list \
  src/pages/share/components/create-dialog \
  src/pages/share/components/settings-dialog \
  src/pages/share/components/delete-dialog
git add \
  src/pages/share/index.tsx \
  src/pages/share/components/grid \
  src/pages/share/components/card \
  src/pages/share/components/mobile-list \
  src/pages/share/components/settings-dialog \
  src/pages/share/components/delete-dialog
git diff --cached --name-status
git commit -m "refactor(share): 下沉桌面移动与共享弹窗动作"
```

---

### 任务 8：重构 QuickDialog 与 LinkRow

**文件：**

- 修改：`src/pages/share/components/quick-dialog/index.tsx`
- 修改：`src/pages/share/components/quick-dialog/create-form.tsx`
- 修改：`src/pages/share/components/quick-dialog/link-row.tsx`
- 修改：`src/pages/resume/index.tsx`
- 修改：`src/pages/resume/editor/index.tsx`

- [ ] **步骤 1：QuickDialog 保留唯一能力 prop**

定义：

```ts
interface QuickDialogProps {
  getSnapshot: SnapshotProvider
}
```

直接读取：

```ts
const {
  openForResumeId,
  openForResumeName,
  shares,
  dialogLoading,
  dialogError,
  pendingShareIds,
  closeDialog,
  create,
} = useShareStore()
```

删除 `settingsShare/deleteShare` 本地状态与重复 save/delete handler。

- [ ] **步骤 2：CreateForm 保留直接 onCreate**

`handleCreate` 在 QuickDialog：

1. 调 `getSnapshot()`
2. 调 `create(openForResumeId, ...)`
3. 成功 toast，返回 true
4. 失败 toast，返回 false

`CreateForm` 继续根据 boolean 决定 reset，并把名称、密码和日期字段迁移到
`FieldGroup/Field/FieldLabel`。密码按钮继续使用 `VisibilityIcon`。

- [ ] **步骤 3：LinkRow 直接消费 Store**

Props：

```ts
interface LinkRowProps {
  ref?: Ref<HTMLDivElement>
  share: ResumeShareRecord
  busy: boolean
  getSnapshot: SnapshotProvider
}
```

LinkRow 直接读取：

```text
setActive
pushSnapshot
openSettingsDialog
openDeleteDialog
```

本地执行：

- copy
- toggle active + toast
- push snapshot + toast

按钮设置/删除直接打开共享 overlay。

- [ ] **步骤 4：挂载共享 overlay**

QuickDialog JSX 末尾保留：

```tsx
<SettingsDialog />
<DeleteDialog />
```

关闭 QuickDialog 时只调用 `closeDialog()`，不得清理正在退出的共享 overlay target。

- [ ] **步骤 5：更新宿主导入**

`src/pages/resume/index.tsx` 与 `src/pages/resume/editor/index.tsx` 使用：

```ts
import QuickDialog from '@/pages/share/components/quick-dialog'
```

现有 `getSnapshot` 实现保持不变。

- [ ] **步骤 6：验证并提交**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/pages/share/components/quick-dialog \
  src/pages/resume/index.tsx \
  src/pages/resume/editor/index.tsx
git add \
  src/pages/share/components/quick-dialog \
  src/pages/resume/index.tsx \
  src/pages/resume/editor/index.tsx
git commit -m "refactor(share): 简化快速分享弹窗链路"
```

---

### 任务 9：创建 Content、薄化页面并删除兼容字段

**文件：**

- 创建：`src/pages/share/components/content/index.tsx`
- 修改：`src/pages/share/index.tsx`
- 修改：`src/pages/share/components/empty-state/index.tsx`
- 修改：`src/pages/share/store/types.ts`
- 修改：`src/pages/share/store/data.ts`
- 修改：`src/pages/share/store/ui.ts`

- [ ] **步骤 1：创建 Content**

直接读取：

```ts
const {
  allShares,
  pageLoading,
  pageError,
  searchKeyword,
  resumeFilters,
  statusFilter,
  reloadPage,
} = useShareStore()
```

一次性派生：

```ts
const filteredShares = useMemo(
  () => filterShares(allShares, {
    keyword: searchKeyword,
    resumeIds: resumeFilters,
    status: statusFilter,
  }),
  [allShares, resumeFilters, searchKeyword, statusFilter],
)
```

把管理页初始 Loading、初始化 Error、Empty、Grid、MobileList 与 AnimatePresence 全部迁入。

- [ ] **步骤 2：薄化 Management**

页面最终结构：

```tsx
export default function Management() {
  useSharePageBootstrap()
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : SHARE_MOTION.page.initial}
      animate={SHARE_MOTION.page.animate}
      transition={{
        ...SHARE_MOTION.page.transition,
        duration: reduceMotion ? 0 : SHARE_MOTION.page.transition.duration,
      }}
      className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8"
    >
      <Header />
      <Toolbar />
      <Content />
      <SettingsDialog />
      <DeleteDialog />
    </motion.div>
  )
}
```

删除页面中所有 Store destructure、useMemo、CRUD handler 与业务 useState。

- [ ] **步骤 3：删除 Store 兼容字段**

从 Store 类型与实现删除：

```text
loading
error
mutatingId
actionShare
actionTrigger
setActionShare
loadShares 兼容别名
```

确认所有组件使用：

```text
pageLoading/pageError
dialogLoading/dialogError
pendingShareIds
settings/delete overlay
```

- [ ] **步骤 4：清理旧目录**

确认以下目录不存在：

```text
src/pages/share/components/action-drawer/
src/pages/share/components/mobile-item/
src/pages/share/components/share-dialog/
src/pages/share/components/animated-visibility-icon/
```

- [ ] **步骤 5：检查运输型 props**

运行：

```bash
rg -n "onPreview|onSettings|onPushLatest|onToggleActive|onDelete" \
  src/pages/share/components/grid \
  src/pages/share/components/card

rg -n "keyword:|resumeIds:|status:|onKeywordChange|onResumeChange|onStatusChange" \
  src/pages/share/components/toolbar
```

预期：无运输型 Props。

- [ ] **步骤 6：检查页面入口**

运行：

```bash
rg -n "useShareStore|useMemo|useState|getResumeSnapshotById|toast\\.|handle[A-Z]" \
  src/pages/share/index.tsx
```

预期：`Management` 只保留 bootstrap、reduced motion 与组件组装。

- [ ] **步骤 7：检查 Store 污染与兼容字段**

运行：

```bash
rg -n "getSnapshot|HTMLElement|filteredShares|navigator|window\\.|toast\\.|mutatingId|actionShare|actionTrigger" \
  src/pages/share/store
```

预期：0 处。

- [ ] **步骤 8：检查冗余组件命名**

运行：

```bash
rg -n "function Share|interface Share.*Props|const Share" \
  src/pages/share/components
```

预期：页面组件无冗余 `Share` 前缀；领域类型 import 不受影响。

- [ ] **步骤 9：检查 shadcn 组合**

运行：

```bash
rg -n "DropdownMenuItem" src/pages/share/components/card/index.tsx
rg -n "FieldGroup|FieldLabel|FieldError" \
  src/pages/share/components/create-dialog \
  src/pages/share/components/settings-dialog
```

人工确认 Item 位于 Group 内，表单已使用 Field。

- [ ] **步骤 10：验证并提交**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/pages/share/index.tsx \
  src/pages/share/components/content \
  src/pages/share/components/empty-state \
  src/pages/share/store
git add \
  src/pages/share/index.tsx \
  src/pages/share/components/content \
  src/pages/share/components/empty-state \
  src/pages/share/store
git diff --cached --name-status
git commit -m "refactor(share): 完成薄页面与兼容状态清理"
```

---

### 任务 10：最终验证与浏览器回归

**文件：**

- 验证：`src/pages/share/`
- 验证：`src/pages/resume/index.tsx`
- 验证：`src/pages/resume/editor/index.tsx`

- [ ] **步骤 1：TypeScript**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
```

预期：退出码 0。

- [ ] **步骤 2：目标 ESLint**

```bash
pnpm exec eslint \
  src/pages/share \
  src/pages/resume/index.tsx \
  src/pages/resume/editor/index.tsx
```

预期：0 error。

- [ ] **步骤 3：生产构建**

```bash
pnpm build
```

预期：Vite build 成功；既有 chunk-size warning 可记录，但不影响退出码。

- [ ] **步骤 4：Diff 检查**

```bash
git diff --check
git status --short
```

预期：无 whitespace error；不恢复用户原有删除或目录重命名。

- [ ] **步骤 5：桌面浏览器回归**

在 `/share` 验证：

```text
初始加载
失败重试
关键词/简历/状态筛选
新建无密码/有密码分享
复制
预览
设置
推送
启停
删除
不同记录并行操作
```

- [ ] **步骤 6：移动浏览器回归**

在 390px viewport 验证：

```text
列表无横向溢出
整卡打开 Drawer
复制不打开 Drawer
设置/删除能正确切换 overlay
关闭后焦点恢复
删除当前记录后 Drawer 关闭
```

- [ ] **步骤 7：快速弹窗回归**

在简历列表页与编辑器分别验证：

```text
打开 QuickDialog
创建链接
推送当前快照
设置
启停
删除
关闭后旧请求不回写
```

- [ ] **步骤 8：最终提交**

如任务 9/10 产生清理改动：

```bash
git add \
  src/pages/share \
  src/pages/resume/index.tsx \
  src/pages/resume/editor/index.tsx
git diff --cached --name-status
git commit -m "refactor(share): 完成组件与 Store 边界重构"
```
