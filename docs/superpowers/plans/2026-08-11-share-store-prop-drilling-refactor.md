# 分享模块 Store 与 Props 链路重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将分享管理页与快速分享弹窗的共享状态和业务动作收敛到分片页面 Store，消除多层运输型 props，同时保留表单、移动 Drawer 和快照能力等局部状态。

**架构：** 将根级 `store.ts` 拆为 `store/index.ts`、`data.ts`、`ui.ts`、`commands.ts` 和 `types.ts`。组件直接消费 Store commands；管理页新建弹窗、表单草稿和移动 Drawer 仍由对应页面或组件子树本地管理。管理页快照从 Supabase 读取，快速弹窗的 `getSnapshot` 只作为函数参数传给 command，不写入 Store。

**技术栈：** React 19、TypeScript 5.9、Zustand 5、Motion、Sonner、Vite 7、ESLint

**验证约束：** 用户明确要求本仓库当前不写测试。本计划不新增测试框架或测试文件，使用静态接口检查、TypeScript、ESLint 和生产构建验证。

---

## 文件结构与职责

### 创建

- `src/pages/share/store/index.ts`：组装 Zustand slices，默认导出 `useShareStore`。
- `src/pages/share/store/types.ts`：Store 数据、UI、command 分片类型。
- `src/pages/share/store/data.ts`：加载、CRUD、请求隔离、双列表同步和 pending 状态。
- `src/pages/share/store/ui.ts`：筛选、快速弹窗和设置/删除目标 ID。
- `src/pages/share/store/commands.ts`：快照来源、业务反馈与高层命令。
- `src/pages/share/components/content/index.tsx`：集中派生筛选结果并组装空态、桌面和移动内容。
- `src/pages/share/components/delete-dialog/index.tsx`：管理页与快速弹窗共用的删除确认。
- `src/pages/share/components/mobile-list/mobile-item.tsx`：移动列表私有渲染项。
- `src/pages/share/components/mobile-list/action-drawer.tsx`：移动列表私有操作 Drawer。

### 修改

- `src/pages/share/types.ts`：仅保留页面领域类型并新增快照 provider 类型。
- `src/pages/share/index.tsx`：收敛为页面骨架与新建弹窗本地状态。
- `src/pages/share/hooks/use-share-page-bootstrap.ts`：保持入口不变，消费新的 Store 目录导出。
- `src/pages/share/components/header/index.tsx`：直接读取统计与可创建状态。
- `src/pages/share/components/toolbar/index.tsx`：直接读取筛选状态和简历摘要。
- `src/pages/share/components/grid/index.tsx`：只向 Card 传渲染输入。
- `src/pages/share/components/card/index.tsx`：直接调用 Store commands。
- `src/pages/share/components/mobile-list/index.tsx`：本地管理 Drawer 项与焦点。
- `src/pages/share/components/create-dialog/index.tsx`：只保留 `open/onOpenChange`，直接创建管理页分享。
- `src/pages/share/components/settings-dialog/index.tsx`：直接消费设置目标与保存命令。
- `src/pages/share/components/share-dialog/index.tsx`：移除设置/删除本地目标和重复 CRUD 编排。
- `src/pages/share/components/share-dialog/share-link-row.tsx`：直接消费通用 Store commands。
- `src/pages/share/components/share-dialog/create-share-form.tsx`：保留直接 `onCreate` 协议。

### 删除

- `src/pages/share/store.ts`：由 `store/` 目录替代。
- `src/pages/share/components/action-drawer/`：实现并入 `mobile-list/`。
- `src/pages/share/components/mobile-item/`：实现并入 `mobile-list/`。
- Git 当前已标记删除的旧 `share-*` 组件目录继续保持删除，不恢复。

### 不修改

- `src/pages/share/view/[token].tsx`：匿名页状态保持本地。
- Supabase migration、Edge Function 和数据访问协议。
- `package.json` 与锁文件：不新增测试依赖或脚本。

## 执行前保护

- 当前工作区已有用户完成的组件目录重命名。实现必须以现有 `card/`、`grid/`、`header/`、`toolbar/` 等目录为基础。
- 不得恢复已删除的 `share-card/`、`share-grid/` 等旧目录。
- 每次暂存前运行 `git diff --cached --name-status`，只提交当前任务列出的路径。
- 不执行 `git push`。

---

### 任务 1：将现有 Store 无行为迁移到目录分片

**文件：**

- 创建：`src/pages/share/store/index.ts`
- 创建：`src/pages/share/store/types.ts`
- 创建：`src/pages/share/store/data.ts`
- 创建：`src/pages/share/store/ui.ts`
- 修改：`src/pages/share/types.ts`
- 删除：`src/pages/share/store.ts`

- [ ] **步骤 1：把 Store 契约从页面类型中分离**

`src/pages/share/types.ts` 只保留领域类型，并增加快速弹窗快照 provider：

```ts
import type { ResumeShareSnapshotSource } from '@/lib/supabase/resume/share.types'
import type { ResumeType } from '@/lib/schema'

export interface ShareResumeSummary {
  resumeId: string
  displayName: string
  type: ResumeType
}

export type ShareSnapshotProvider = () => Promise<ResumeShareSnapshotSource>
```

`src/pages/share/store/types.ts` 定义当前 Store 的完整契约。第一阶段保持现有字段和方法签名，确保只改变文件结构、不改变行为：

```ts
import type { ShareResumeSummary } from '../types'
import type { ShareStatusFilter } from '../utils'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { CreateShareOptions, ResumeShareRecord } from '@/lib/supabase/resume/share.types'

export interface ShareDataSlice {
  ownerUserId: string | null
  pageRequestId: number
  shares: ResumeShareRecord[]
  allShares: ResumeShareRecord[]
  resumeMap: Record<string, ShareResumeSummary>
  loading: boolean
  pageLoading: boolean
  mutatingId: string | null
  error: string | null
  loadShares: (resumeId: string) => Promise<void>
  bootstrapPage: () => Promise<void>
  reloadPage: () => Promise<void>
  create: (
    resumeId: string,
    snapshot: PersistedResumeSnapshot,
    templateManifest: TemplateManifest,
    displayName: string | null,
    options?: CreateShareOptions,
  ) => Promise<void>
  setActive: (shareId: string, isActive: boolean) => Promise<void>
  updateSettings: (
    shareId: string,
    settings: {
      label: string | null
      expiresAt: string | null
      password: string | null | undefined
    },
  ) => Promise<void>
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
  setActionShare: (share: ResumeShareRecord | null, trigger?: HTMLElement | null) => void
}

export type ShareStoreState = ShareDataSlice & ShareUiSlice
```

- [ ] **步骤 2：迁移现有数据动作到 `store/data.ts`**

创建以下完整文件；此阶段只移动现有逻辑，不改变行为：

```ts
import type { StoreApi } from 'zustand'
import type { ShareDataSlice, ShareStoreState } from './types'
import { getAllResumesFromUser } from '@/lib/supabase/resume/form'
import {
  createResumeShare,
  deleteResumeShare,
  listAllResumeShares,
  listResumeShares,
  pushResumeShareSnapshot,
  setResumeShareActive,
  updateResumeShareSettings,
} from '@/lib/supabase/resume/share'
import { getCurrentUser } from '@/lib/supabase/user'

type Set = StoreApi<ShareStoreState>['setState']
type Get = StoreApi<ShareStoreState>['getState']

export function createShareDataSlice(
  set: Set,
  get: Get,
): ShareDataSlice {
  return {
    ownerUserId: null,
    pageRequestId: 0,
    shares: [],
    allShares: [],
    resumeMap: {},
    loading: false,
    pageLoading: false,
    mutatingId: null,
    error: null,

    async loadShares(resumeId) {
      set({ loading: true, error: null })
      try {
        const shares = await listResumeShares(resumeId)
        if (get().openForResumeId === resumeId)
          set({ shares, loading: false })
      }
      catch (error) {
        if (get().openForResumeId === resumeId) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : '加载失败',
          })
        }
      }
    },

    async bootstrapPage() {
      const requestId = get().pageRequestId + 1
      set({
        pageRequestId: requestId,
        pageLoading: true,
        error: null,
        allShares: [],
        resumeMap: {},
        actionShare: null,
      })
      try {
        const user = await getCurrentUser()
        if (!user)
          throw new Error('用户未登录')

        if (get().pageRequestId !== requestId)
          return
        if (get().ownerUserId && get().ownerUserId !== user.id) {
          set({
            shares: [],
            openForResumeId: null,
            openForResumeName: null,
            searchKeyword: '',
            resumeFilters: [],
            statusFilter: 'all',
          })
        }

        const [allShares, resumes] = await Promise.all([
          listAllResumeShares(),
          getAllResumesFromUser(),
        ])
        if (get().pageRequestId !== requestId)
          return
        const currentUser = await getCurrentUser()
        if (!currentUser || currentUser.id !== user.id)
          return

        const resumeMap = Object.fromEntries(
          resumes.map(resume => [
            resume.resume_id,
            {
              resumeId: resume.resume_id,
              displayName: resume.display_name || '未命名简历',
              type: resume.type,
            },
          ]),
        )
        set({
          ownerUserId: user.id,
          allShares,
          resumeMap,
          pageLoading: false,
        })
      }
      catch (error) {
        if (get().pageRequestId !== requestId)
          return
        set({
          ownerUserId: null,
          allShares: [],
          resumeMap: {},
          pageLoading: false,
          error: error instanceof Error ? error.message : '加载分享链接失败',
        })
      }
    },

    reloadPage: async () => get().bootstrapPage(),

    async create(resumeId, snapshot, templateManifest, displayName, options) {
      set({ error: null })
      try {
        const record = await createResumeShare(
          resumeId,
          snapshot,
          templateManifest,
          displayName,
          options,
        )
        set(state => ({
          shares: state.openForResumeId === resumeId
            ? [record, ...state.shares]
            : state.shares,
          allShares: [record, ...state.allShares],
        }))
      }
      catch (error) {
        if (get().openForResumeId === resumeId) {
          set({
            error: error instanceof Error ? error.message : '创建失败',
          })
        }
        throw error
      }
    },

    async setActive(shareId, isActive) {
      set({ mutatingId: shareId, error: null })
      try {
        await setResumeShareActive(shareId, isActive)
        set(state => ({
          shares: state.shares.map(share => (
            share.id === shareId ? { ...share, is_active: isActive } : share
          )),
          allShares: state.allShares.map(share => (
            share.id === shareId ? { ...share, is_active: isActive } : share
          )),
          mutatingId: null,
        }))
      }
      catch (error) {
        set({
          mutatingId: null,
          error: error instanceof Error ? error.message : '操作失败',
        })
        throw error
      }
    },

    async updateSettings(shareId, settings) {
      set({ mutatingId: shareId, error: null })
      try {
        await updateResumeShareSettings(shareId, settings)
        set(state => ({
          shares: state.shares.map(share => (
            share.id === shareId
              ? {
                  ...share,
                  label: settings.label,
                  expires_at: settings.expiresAt,
                  has_password: settings.password === undefined
                    ? share.has_password
                    : Boolean(settings.password),
                }
              : share
          )),
          allShares: state.allShares.map(share => (
            share.id === shareId
              ? {
                  ...share,
                  label: settings.label,
                  expires_at: settings.expiresAt,
                  has_password: settings.password === undefined
                    ? share.has_password
                    : Boolean(settings.password),
                }
              : share
          )),
          mutatingId: null,
        }))
      }
      catch (error) {
        set({
          mutatingId: null,
          error: error instanceof Error ? error.message : '操作失败',
        })
        throw error
      }
    },

    async pushSnapshot(shareId, snapshot, templateManifest, displayName) {
      set({ mutatingId: shareId, error: null })
      try {
        await pushResumeShareSnapshot(
          shareId,
          snapshot,
          templateManifest,
          displayName,
        )
        set(state => ({
          shares: state.shares.map(share => (
            share.id === shareId ? { ...share, display_name: displayName } : share
          )),
          allShares: state.allShares.map(share => (
            share.id === shareId ? { ...share, display_name: displayName } : share
          )),
          mutatingId: null,
        }))
      }
      catch (error) {
        set({
          mutatingId: null,
          error: error instanceof Error ? error.message : '操作失败',
        })
        throw error
      }
    },

    async remove(shareId) {
      set({ mutatingId: shareId, error: null })
      try {
        await deleteResumeShare(shareId)
        set(state => ({
          shares: state.shares.filter(share => share.id !== shareId),
          allShares: state.allShares.filter(share => share.id !== shareId),
          actionShare: state.actionShare?.id === shareId ? null : state.actionShare,
          actionTrigger: state.actionShare?.id === shareId ? null : state.actionTrigger,
          mutatingId: null,
        }))
      }
      catch (error) {
        set({
          mutatingId: null,
          error: error instanceof Error ? error.message : '删除失败',
        })
        throw error
      }
    },
  }
}
```

- [ ] **步骤 3：迁移现有 UI 状态到 `store/ui.ts`**

```ts
export function createShareUiSlice(
  set: StoreApi<ShareStoreState>['setState'],
  get: StoreApi<ShareStoreState>['getState'],
): ShareUiSlice {
  return {
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
    setActionShare: (actionShare, actionTrigger = null) => set({ actionShare, actionTrigger }),
  }
}
```

- [ ] **步骤 4：创建 Store 目录入口并删除根级文件**

```ts
import type { ShareStoreState } from './types'
import { create } from 'zustand'
import { createShareDataSlice } from './data'
import { createShareUiSlice } from './ui'

const useShareStore = create<ShareStoreState>()((set, get) => ({
  ...createShareDataSlice(set, get),
  ...createShareUiSlice(set, get),
}))

export default useShareStore
export type { ShareStoreState } from './types'
```

删除 `src/pages/share/store.ts`。现有 `./store` 和 `@/pages/share/store` import 不修改。

- [ ] **步骤 5：验证纯结构迁移**

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/pages/share/store src/pages/share/types.ts
```

预期：两个命令退出码均为 `0`，页面行为未改变。

- [ ] **步骤 6：提交 Store 目录迁移**

```bash
git add src/pages/share/store.ts src/pages/share/store src/pages/share/types.ts
git diff --cached --name-status
git commit -m "refactor(share): 拆分页面 Store 目录"
```

预期暂存内容只包含 Store 目录、旧 `store.ts` 删除和根级 `types.ts`。

---

### 任务 2：建立最终 Store 状态模型与业务 Commands

**文件：**

- 修改：`src/pages/share/store/types.ts`
- 修改：`src/pages/share/store/data.ts`
- 修改：`src/pages/share/store/ui.ts`
- 创建：`src/pages/share/store/commands.ts`
- 修改：`src/pages/share/store/index.ts`
- 修改：`src/pages/share/utils.ts`

- [ ] **步骤 1：增加列表同步与记录查找纯函数**

在 `src/pages/share/utils.ts` 增加：

```ts
export function findShareById(
  shareId: string | null,
  allShares: ResumeShareRecord[],
  dialogShares: ResumeShareRecord[],
) {
  if (!shareId)
    return null
  return allShares.find(share => share.id === shareId)
    ?? dialogShares.find(share => share.id === shareId)
    ?? null
}

export function updateShareById(
  shares: ResumeShareRecord[],
  shareId: string,
  update: (share: ResumeShareRecord) => ResumeShareRecord,
) {
  return shares.map(share => share.id === shareId ? update(share) : share)
}
```

- [ ] **步骤 2：扩展最终 Store 类型，同时保留旧字段到任务 5**

先把 `store/types.ts` 的页面类型 import 改为：

```ts
import type { ShareResumeSummary, ShareSnapshotProvider } from '../types'
```

再把以下最终字段和签名合并进现有接口：

```ts
export type ShareSettingsDraft = {
  label: string | null
  expiresAt: string | null
  password: string | null | undefined
}

export interface ShareDataSlice {
  // 保留现有字段，任务 5 删除 loading/error/mutatingId
  dialogRequestId: number
  pageError: string | null
  dialogError: string | null
  dialogLoading: boolean
  pendingShareIds: string[]
  loadDialogShares: (resumeId: string) => Promise<void>
  createRecord: (
    resumeId: string,
    snapshot: PersistedResumeSnapshot,
    templateManifest: TemplateManifest,
    displayName: string | null,
    options?: CreateShareOptions,
  ) => Promise<void>
  setRecordActive: (shareId: string, isActive: boolean) => Promise<boolean>
  updateRecordSettings: (shareId: string, settings: ShareSettingsDraft) => Promise<boolean>
  pushRecordSnapshot: (
    shareId: string,
    snapshot: PersistedResumeSnapshot,
    templateManifest: TemplateManifest,
    displayName: string | null,
  ) => Promise<boolean>
  deleteRecord: (shareId: string) => Promise<boolean>
}

export interface ShareUiSlice {
  // 保留现有字段，任务 5 删除 actionShare/actionTrigger
  settingsShareId: string | null
  deleteShareId: string | null
  openSettings: (shareId: string) => void
  closeSettings: () => void
  requestDelete: (shareId: string) => void
  cancelDelete: () => void
}

export interface ShareCommandSlice {
  createManagementShare: (resumeId: string, options: CreateShareOptions) => Promise<boolean>
  createDialogShare: (options: CreateShareOptions, snapshotProvider: ShareSnapshotProvider) => Promise<boolean>
  previewShare: (shareId: string) => void
  copyShareUrl: (shareId: string) => Promise<boolean>
  saveShareSettings: (settings: ShareSettingsDraft) => Promise<boolean>
  pushManagementShare: (shareId: string) => Promise<boolean>
  pushDialogShare: (shareId: string, snapshotProvider: ShareSnapshotProvider) => Promise<boolean>
  toggleShareActive: (shareId: string) => Promise<boolean>
  confirmDeleteShare: () => Promise<boolean>
}

export type ShareStoreState = ShareDataSlice & ShareUiSlice & ShareCommandSlice
```

不要用重复声明覆盖原接口；执行时应把新增字段合并进现有接口。

- [ ] **步骤 3：实现请求隔离和 pending helper**

在 `createShareDataSlice` 返回对象中初始化：

```ts
dialogRequestId: 0,
pageError: null,
dialogError: null,
dialogLoading: false,
pendingShareIds: [],
```

在 `store/data.ts` 顶部增加不可变 helper：

```ts
function beginPending(
  set: StoreApi<ShareStoreState>['setState'],
  get: StoreApi<ShareStoreState>['getState'],
  shareId: string,
) {
  if (get().pendingShareIds.includes(shareId))
    return false
  set(state => ({ pendingShareIds: [...state.pendingShareIds, shareId] }))
  return true
}

function endPending(
  set: StoreApi<ShareStoreState>['setState'],
  shareId: string,
) {
  set(state => ({
    pendingShareIds: state.pendingShareIds.filter(id => id !== shareId),
  }))
}
```

`bootstrapPage` 只写 `pageLoading/pageError`；`loadDialogShares` 使用独立 `dialogRequestId/dialogLoading/dialogError`：

```ts
loadDialogShares: async (resumeId) => {
  const requestId = get().dialogRequestId + 1
  set({
    dialogRequestId: requestId,
    dialogLoading: true,
    dialogError: null,
    shares: [],
  })
  try {
    const shares = await listResumeShares(resumeId)
    if (
      get().dialogRequestId === requestId
      && get().openForResumeId === resumeId
    ) {
      set({ shares, dialogLoading: false })
    }
  }
  catch (error) {
    if (
      get().dialogRequestId === requestId
      && get().openForResumeId === resumeId
    ) {
      set({
        dialogLoading: false,
        dialogError: error instanceof Error ? error.message : '加载失败',
      })
    }
  }
}
```

CRUD 数据动作使用 `beginPending/endPending`，并通过 `updateShareById` 同步两份列表。删除成功时同时清理目标：

```ts
set(state => ({
  shares: state.shares.filter(share => share.id !== shareId),
  allShares: state.allShares.filter(share => share.id !== shareId),
  settingsShareId: state.settingsShareId === shareId ? null : state.settingsShareId,
  deleteShareId: state.deleteShareId === shareId ? null : state.deleteShareId,
}))
```

- [ ] **步骤 4：实现最终 UI 状态**

`store/ui.ts` 增加：

```ts
settingsShareId: null,
deleteShareId: null,
openSettings: settingsShareId => set({ settingsShareId }),
closeSettings: () => set({ settingsShareId: null }),
requestDelete: deleteShareId => set({ deleteShareId }),
cancelDelete: () => set({ deleteShareId: null }),
```

`openDialog` 调用 `loadDialogShares`；`closeDialog` 递增 `dialogRequestId` 并清理快速弹窗状态：

```ts
closeDialog: () => set(state => ({
  openForResumeId: null,
  openForResumeName: null,
  shares: [],
  dialogLoading: false,
  dialogError: null,
  dialogRequestId: state.dialogRequestId + 1,
  settingsShareId: null,
  deleteShareId: null,
}))
```

- [ ] **步骤 5：实现 `store/commands.ts`**

命令先用 `findShareById` 解析最新记录。所有失败返回 `false` 并展示固定文案，成功返回 `true`：

| 命令 | 成功文案 | 失败文案 |
|---|---|---|
| `createManagementShare` | 分享链接已生成 | 创建失败 |
| `createDialogShare` | 分享链接已生成 | 生成失败，请重试 |
| `copyShareUrl` | 链接已复制 | 复制失败，请手动复制 |
| `saveShareSettings` | 分享设置已更新 | 保存设置失败 |
| `pushManagementShare` | 已推送最新版 | 推送失败 |
| `pushDialogShare` | 已推送最新简历到该链接 | 推送失败 |
| `toggleShareActive` | 链接已启用/链接已关闭 | 操作失败 |
| `confirmDeleteShare` | 分享链接已永久删除 | 删除失败 |

统一模式：

```ts
import type { StoreApi } from 'zustand'
import type { ShareCommandSlice, ShareStoreState } from './types'
import { toast } from 'sonner'
import { getResumeSnapshotById } from '@/lib/supabase/resume/share'
import { buildShareUrl, findShareById } from '../utils'

export function createShareCommandSlice(
  _set: StoreApi<ShareStoreState>['setState'],
  get: StoreApi<ShareStoreState>['getState'],
): ShareCommandSlice {
  const findShare = (shareId: string | null) => {
    const state = get()
    return findShareById(shareId, state.allShares, state.shares)
  }

  return {
    async createManagementShare(resumeId, options) {
      try {
        const source = await getResumeSnapshotById(resumeId)
        await get().createRecord(
          resumeId,
          source.snapshot,
          source.templateManifest,
          source.displayName,
          options,
        )
        toast.success('分享链接已生成')
        return true
      }
      catch {
        toast.error('创建失败')
        return false
      }
    },
    async createDialogShare(options, snapshotProvider) {
      const resumeId = get().openForResumeId
      if (!resumeId)
        return false
      try {
        const source = await snapshotProvider()
        await get().createRecord(
          resumeId,
          source.snapshot,
          source.templateManifest,
          source.displayName,
          options,
        )
        toast.success('分享链接已生成')
        return true
      }
      catch {
        toast.error('生成失败，请重试')
        return false
      }
    },
    previewShare(shareId) {
      const share = findShare(shareId)
      if (share)
        window.open(buildShareUrl(share.token), '_blank', 'noopener,noreferrer')
    },
    async copyShareUrl(shareId) {
      const share = findShare(shareId)
      if (!share)
        return false
      try {
        await navigator.clipboard.writeText(buildShareUrl(share.token))
        toast.success('链接已复制')
        return true
      }
      catch {
        toast.error('复制失败，请手动复制')
        return false
      }
    },
    async saveShareSettings(settings) {
      const shareId = get().settingsShareId
      if (!shareId)
        return false
      try {
        const updated = await get().updateRecordSettings(shareId, settings)
        if (!updated)
          return false
        toast.success('分享设置已更新')
        return true
      }
      catch {
        toast.error('保存设置失败')
        return false
      }
    },
    async pushManagementShare(shareId) {
      const share = findShare(shareId)
      if (!share)
        return false
      try {
        const source = await getResumeSnapshotById(share.resume_id)
        const pushed = await get().pushRecordSnapshot(
          share.id,
          source.snapshot,
          source.templateManifest,
          source.displayName,
        )
        if (!pushed)
          return false
        toast.success('已推送最新版')
        return true
      }
      catch {
        toast.error('推送失败')
        return false
      }
    },
    async pushDialogShare(shareId, snapshotProvider) {
      if (!findShare(shareId))
        return false
      try {
        const source = await snapshotProvider()
        const pushed = await get().pushRecordSnapshot(
          shareId,
          source.snapshot,
          source.templateManifest,
          source.displayName,
        )
        if (!pushed)
          return false
        toast.success('已推送最新简历到该链接')
        return true
      }
      catch {
        toast.error('推送失败')
        return false
      }
    },
    async toggleShareActive(shareId) {
      const share = findShare(shareId)
      if (!share)
        return false
      const nextActive = !share.is_active
      try {
        const updated = await get().setRecordActive(shareId, nextActive)
        if (!updated)
          return false
        toast.success(nextActive ? '链接已启用' : '链接已关闭')
        return true
      }
      catch {
        toast.error('操作失败')
        return false
      }
    },
    async confirmDeleteShare() {
      const shareId = get().deleteShareId
      if (!shareId)
        return false
      try {
        const deleted = await get().deleteRecord(shareId)
        if (!deleted)
          return false
        toast.success('分享链接已永久删除')
        return true
      }
      catch {
        toast.error('删除失败')
        return false
      }
    },
  }
}
```

- [ ] **步骤 6：组装 command slice 并做局部验证**

`store/index.ts`：

```ts
const useShareStore = create<ShareStoreState>()((set, get) => ({
  ...createShareDataSlice(set, get),
  ...createShareUiSlice(set, get),
  ...createShareCommandSlice(set, get),
}))
```

运行：

```bash
pnpm exec eslint src/pages/share/store src/pages/share/utils.ts
```

预期：退出码为 `0`。本任务暂时保留旧兼容字段，因此全量 TypeScript 仍应通过：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
```

- [ ] **步骤 7：提交最终 Store API 的兼容阶段**

```bash
git add src/pages/share/store src/pages/share/utils.ts
git diff --cached --name-status
git commit -m "refactor(share): 增加共享业务 commands"
```

---

### 任务 3：共享设置/删除弹窗并简化快速 ShareDialog

**文件：**

- 修改：`src/pages/share/components/settings-dialog/index.tsx`
- 创建：`src/pages/share/components/delete-dialog/index.tsx`
- 修改：`src/pages/share/components/share-dialog/index.tsx`
- 修改：`src/pages/share/components/share-dialog/share-link-row.tsx`
- 修改：`src/pages/share/index.tsx`

- [ ] **步骤 1：将设置弹窗改成零业务 props**

删除 `ShareSettingsDialogProps`。组件直接读取：

```ts
const {
  allShares,
  shares,
  settingsShareId,
  pendingShareIds,
  closeSettings,
  saveShareSettings,
} = useShareStore()
const share = findShareById(settingsShareId, allShares, shares)
const busy = Boolean(share && pendingShareIds.includes(share.id))
```

保存：

```ts
const saved = await saveShareSettings({
  label: label.trim() || null,
  expiresAt: dateToExpiryIso(expiresAt),
  password: passwordEnabled
    ? (nextPassword || undefined)
    : null,
})
if (saved)
  closeSettings()
```

Dialog 使用 `open={Boolean(share)}`，关闭时调用 `closeSettings`。表单字段、密码显隐和校验继续保留本地。

- [ ] **步骤 2：创建共享删除确认弹窗**

`src/pages/share/components/delete-dialog/index.tsx`：

```tsx
export default function ShareDeleteDialog() {
  const {
    allShares,
    shares,
    deleteShareId,
    pendingShareIds,
    cancelDelete,
    confirmDeleteShare,
  } = useShareStore()
  const share = findShareById(deleteShareId, allShares, shares)
  const busy = Boolean(share && pendingShareIds.includes(share.id))

  return (
    <AlertDialog open={Boolean(share)} onOpenChange={open => !open && cancelDelete()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>永久删除分享链接？</AlertDialogTitle>
          <AlertDialogDescription>
            删除后链接立即失效，访问记录无法恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={() => void confirmDeleteShare()}
          >
            永久删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **步骤 3：简化快速 ShareDialog**

删除 `settingsShare`、`deleteShare`、设置保存、开关和删除 handler。使用：

```ts
const {
  openForResumeId,
  openForResumeName,
  shares,
  dialogLoading,
  dialogError,
  pendingShareIds,
  closeDialog,
  createDialogShare,
  pushDialogShare,
} = useShareStore()
```

创建与推送：

```ts
const handleCreate = (options: CreateShareOptions) =>
  createDialogShare(options, getSnapshot)

const handlePush = (shareId: string) =>
  pushDialogShare(shareId, getSnapshot)
```

列表行只传：

```tsx
<ShareLinkRow
  key={share.id}
  share={share}
  busy={pendingShareIds.includes(share.id)}
  onPushLatest={() => handlePush(share.id)}
/>
```

弹窗尾部挂载：

```tsx
<ShareSettingsDialog />
<ShareDeleteDialog />
```

- [ ] **步骤 4：让 ShareLinkRow 直接消费 Store**

Props 收敛为：

```ts
interface ShareLinkRowProps {
  ref?: Ref<HTMLDivElement>
  share: ResumeShareRecord
  busy: boolean
  onPushLatest: () => Promise<boolean>
}
```

组件读取：

```ts
const {
  copyShareUrl,
  toggleShareActive,
  openSettings,
  requestDelete,
} = useShareStore()
```

按钮分别调用 `copyShareUrl(share.id)`、`toggleShareActive(share.id)`、`openSettings(share.id)`、`requestDelete(share.id)`。复制成功的 1.5 秒图标计时器继续留在组件本地。

- [ ] **步骤 5：管理页先切换到共享设置/删除目标**

`src/pages/share/index.tsx` 删除 `settingsShare`、`deleteShare` 和保存/删除 handler。现有 Grid/Drawer 回调暂时改为：

```ts
const { openSettings, requestDelete } = useShareStore()

const handleOpenSettings = (share: ResumeShareRecord) => {
  setActionShare(null)
  openSettings(share.id)
}
```

用 `<ShareDeleteDialog />` 替代内联 AlertDialog；`<ShareSettingsDialog />` 改为零 props。

- [ ] **步骤 6：验证共享弹窗改造**

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/pages/share/components/settings-dialog \
  src/pages/share/components/delete-dialog \
  src/pages/share/components/share-dialog \
  src/pages/share/index.tsx
```

预期：退出码均为 `0`。

- [ ] **步骤 7：提交共享弹窗改造**

```bash
git add \
  src/pages/share/components/settings-dialog \
  src/pages/share/components/delete-dialog \
  src/pages/share/components/share-dialog \
  src/pages/share/index.tsx
git diff --cached --name-status
git commit -m "refactor(share): 统一设置与删除弹窗状态"
```

---

### 任务 4：移除桌面管理链路的运输型 Props

**文件：**

- 修改：`src/pages/share/components/header/index.tsx`
- 修改：`src/pages/share/components/toolbar/index.tsx`
- 修改：`src/pages/share/components/create-dialog/index.tsx`
- 修改：`src/pages/share/components/grid/index.tsx`
- 修改：`src/pages/share/components/card/index.tsx`
- 修改：`src/pages/share/index.tsx`

- [ ] **步骤 1：Header 直接消费统计状态**

Props 只保留：

```ts
interface ShareHeaderProps {
  onCreate: () => void
}
```

组件读取并派生：

```ts
const { allShares, resumeMap } = useShareStore()
const active = allShares.filter(share => deriveShareStatus(share) === 'active').length
const canCreate = Object.keys(resumeMap).length > 0
```

渲染中的 `total` 改为 `allShares.length`。

- [ ] **步骤 2：Toolbar 删除全部业务 props**

组件直接读取：

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
const resumes = useMemo(
  () => Object.values(resumeMap).sort(
    (left, right) => left.displayName.localeCompare(right.displayName),
  ),
  [resumeMap],
)
```

保留 `resumeOpen` 本地状态。原 `keyword/resumeIds/status` 全部替换为 Store 字段。

- [ ] **步骤 3：CreateDialog 只保留开关 props**

Props：

```ts
interface ShareCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}
```

组件读取：

```ts
const { resumeMap, createManagementShare } = useShareStore()
const resumes = useMemo(
  () => Object.values(resumeMap).sort(
    (left, right) => left.displayName.localeCompare(right.displayName),
  ),
  [resumeMap],
)
```

提交调用：

```ts
const created = await createManagementShare(resumeId, {
  label: label.trim() || null,
  password: password.trim() || null,
  expiresAt: dateToExpiryIso(expiresAt),
})
if (created) {
  reset()
  onOpenChange(false)
}
```

删除组件内重复 toast。

- [ ] **步骤 4：Grid 只传 Card 渲染输入**

```ts
interface ShareGridProps {
  shares: ResumeShareRecord[]
}
```

Card 调用改为：

```tsx
<ShareCard
  key={share.id}
  share={share}
  index={index}
/>
```

- [ ] **步骤 5：Card 直接调用 Store commands**

Props 只保留 `ref/share/index`。读取：

```ts
const {
  pendingShareIds,
  previewShare,
  copyShareUrl,
  openSettings,
  pushManagementShare,
  toggleShareActive,
  requestDelete,
} = useShareStore()
const busy = pendingShareIds.includes(share.id)
```

替换动作：

```tsx
onClick={() => previewShare(share.id)}
onClick={() => void copyShareUrl(share.id)}
onClick={() => openSettings(share.id)}
onClick={() => void pushManagementShare(share.id)}
onClick={() => void toggleShareActive(share.id)}
onClick={() => requestDelete(share.id)}
```

推送、开关和删除按钮增加 `disabled={busy}`。删除 Card 内重复 clipboard/toast 代码。

- [ ] **步骤 6：更新管理页直接调用接口**

Header、Toolbar、Grid、CreateDialog 改为：

```tsx
<ShareHeader onCreate={() => setCreateDialogOpen(true)} />
<ShareToolbar />
<ShareGrid shares={filteredShares} />
<ShareCreateDialog
  open={createDialogOpen}
  onOpenChange={setCreateDialogOpen}
/>
```

页面暂时保留移动列表需要的 handler，任务 5 删除。

- [ ] **步骤 7：验证桌面链路**

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/pages/share/components/header \
  src/pages/share/components/toolbar \
  src/pages/share/components/create-dialog \
  src/pages/share/components/grid \
  src/pages/share/components/card \
  src/pages/share/index.tsx
```

静态检查：

```bash
rg -n "onPreview|onSettings|onPushLatest|onToggleActive|onDelete" \
  src/pages/share/components/grid \
  src/pages/share/components/card
```

预期：`rg` 无输出并以退出码 `1` 结束；这表示运输型动作 props 已删除。

- [ ] **步骤 8：提交桌面管理链路改造**

```bash
git add \
  src/pages/share/components/header \
  src/pages/share/components/toolbar \
  src/pages/share/components/create-dialog \
  src/pages/share/components/grid \
  src/pages/share/components/card \
  src/pages/share/index.tsx
git diff --cached --name-status
git commit -m "refactor(share): 移除桌面管理动作透传"
```

---

### 任务 5：收敛移动列表并清理兼容状态

**文件：**

- 创建：`src/pages/share/components/content/index.tsx`
- 创建：`src/pages/share/components/mobile-list/mobile-item.tsx`
- 创建：`src/pages/share/components/mobile-list/action-drawer.tsx`
- 修改：`src/pages/share/components/mobile-list/index.tsx`
- 修改：`src/pages/share/index.tsx`
- 修改：`src/pages/share/store/types.ts`
- 修改：`src/pages/share/store/data.ts`
- 修改：`src/pages/share/store/ui.ts`
- 删除：`src/pages/share/components/mobile-item/`
- 删除：`src/pages/share/components/action-drawer/`

- [ ] **步骤 1：把 MobileItem 移入 MobileList 目录**

以现有 `components/mobile-item/index.tsx` 为基础创建 `mobile-list/mobile-item.tsx`。Props 保留直接父子协议：

```ts
interface ShareMobileItemProps {
  ref?: Ref<HTMLDivElement>
  share: ResumeShareRecord
  index: number
  onOpen: (shareId: string, trigger: HTMLElement) => void
}
```

复制按钮改为调用 `copyShareUrl(share.id)`，删除本地 clipboard/toast。卡片打开时调用：

```ts
const handleOpen = (trigger: HTMLElement) => {
  trigger.blur()
  requestAnimationFrame(() => onOpen(share.id, trigger))
}
```

- [ ] **步骤 2：把 ActionDrawer 移入 MobileList 目录**

Props 只表达本地 UI：

```ts
interface ShareActionDrawerProps {
  share: ResumeShareRecord | null
  restoreFocusTo: HTMLElement | null
  onClose: () => void
}
```

组件直接读取 `pendingShareIds` 与管理页 commands。设置和删除：

```ts
const handleSettings = () => {
  if (!share)
    return
  openSettings(share.id)
  onClose()
}

const handleDelete = () => {
  if (!share)
    return
  requestDelete(share.id)
  onClose()
}
```

预览立即关闭；推送和开关等待 command 完成后关闭。保留现有关闭后的焦点恢复逻辑。

- [ ] **步骤 3：让 MobileList 本地拥有 Drawer 状态**

Props 只保留：

```ts
interface ShareMobileListProps {
  shares: ResumeShareRecord[]
}
```

本地状态：

```ts
const [actionTarget, setActionTarget] = useState<{
  shareId: string
  trigger: HTMLElement
} | null>(null)
const actionShare = shares.find(
  share => share.id === actionTarget?.shareId,
) ?? null
```

当筛选或删除使记录消失时关闭：

```ts
useEffect(() => {
  if (actionTarget && !actionShare)
    setActionTarget(null)
}, [actionShare, actionTarget])
```

`index.tsx` 同时组装列表项和私有 Drawer。

- [ ] **步骤 4：创建 ShareContent**

`components/content/index.tsx`：

```tsx
export default function ShareContent() {
  const {
    allShares,
    searchKeyword,
    resumeFilters,
    statusFilter,
  } = useShareStore()
  const filteredShares = useMemo(
    () => filterShares(allShares, {
      keyword: searchKeyword,
      resumeIds: resumeFilters,
      status: statusFilter,
    }),
    [allShares, resumeFilters, searchKeyword, statusFilter],
  )
  const hasFilter = Boolean(searchKeyword.trim())
    || resumeFilters.length > 0
    || statusFilter !== 'all'

  return (
    <AnimatePresence mode="wait" initial={false}>
      {filteredShares.length === 0
        ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ShareEmptyState filtered={hasFilter} />
            </motion.div>
          )
        : (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ShareGrid shares={filteredShares} />
              <ShareMobileList shares={filteredShares} />
            </motion.div>
          )}
    </AnimatePresence>
  )
}
```

- [ ] **步骤 5：把管理页收敛为页面骨架**

`src/pages/share/index.tsx` 删除：

- `ResumeShareRecord` 类型 import。
- `AnimatePresence`、`useMemo`、`toast`。
- `getResumeSnapshotById` 和快速 `ShareDialog`。
- `actionShare/actionTrigger`。
- 筛选派生值。
- 预览、设置、推送、开关和删除 handler。

保留：

```ts
const { allShares, pageLoading, pageError, reloadPage } = useShareStore()
const [createDialogOpen, setCreateDialogOpen] = useState(false)
```

页面主体：

```tsx
<ShareHeader onCreate={() => setCreateDialogOpen(true)} />
<ShareToolbar />
<ShareContent />
<ShareCreateDialog
  open={createDialogOpen}
  onOpenChange={setCreateDialogOpen}
/>
<ShareSettingsDialog />
<ShareDeleteDialog />
```

- [ ] **步骤 6：删除 Store 兼容字段**

从 Store 类型和实现中删除：

```text
loading
error
mutatingId
actionShare
actionTrigger
setActionShare
loadShares
create
setActive
updateSettings
pushSnapshot
remove
```

保留最终命名的 `dialogLoading/dialogError`、record actions、target IDs 和 commands。确认 `openDialog` 只调用 `loadDialogShares`。

删除 `components/mobile-item/` 和 `components/action-drawer/` 目录。

- [ ] **步骤 7：验证最终组件和 Store 契约**

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/pages/share
```

静态检查：

```bash
rg -n "actionShare|actionTrigger|setActionShare|mutatingId|settingsShare|deleteShare" \
  src/pages/share/index.tsx \
  src/pages/share/store \
  src/pages/share/components/grid \
  src/pages/share/components/card
```

预期：无输出。

```bash
rg -n "getSnapshot|HTMLElement|showPassword|resumeOpen|validationError" \
  src/pages/share/store
```

预期：无输出。Store 不保存 snapshot provider、DOM 元素或表单 UI 状态。

- [ ] **步骤 8：提交移动链路与兼容清理**

```bash
git add \
  src/pages/share/components/content \
  src/pages/share/components/mobile-list \
  src/pages/share/components/mobile-item \
  src/pages/share/components/action-drawer \
  src/pages/share/index.tsx \
  src/pages/share/store
git diff --cached --name-status
git commit -m "refactor(share): 收敛移动操作与页面骨架"
```

---

### 任务 6：全量验证与文档核对

**文件：**

- 核对：`src/pages/resume/index.tsx`
- 核对：`src/pages/resume/editor/index.tsx`
- 核对：`src/pages/resume/editor/components/collaboration/collaboration-controls/index.tsx`
- 核对：`docs/superpowers/specs/2026-08-11-share-store-prop-drilling-refactor-design.md`

- [ ] **步骤 1：核对快速弹窗宿主接口**

运行：

```bash
rg -n "<ShareDialog|getSnapshot=|openDialog" \
  src/pages/resume/index.tsx \
  src/pages/resume/editor/index.tsx \
  src/pages/resume/editor/components/collaboration/collaboration-controls/index.tsx
```

预期：

- 简历列表页仍通过 `getResumeSnapshotById` 提供持久化快照。
- 编辑器仍通过 `buildResumeShareSnapshotSource(useResumeStore.getState().getPersistedSnapshot(), ...)` 提供内存快照。
- 两个入口仍通过 `openDialog(resumeId, resumeName)` 打开快速弹窗。

- [ ] **步骤 2：运行类型检查**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
```

预期：退出码 `0`，无 TypeScript 诊断。

- [ ] **步骤 3：运行目标 ESLint**

```bash
pnpm exec eslint \
  src/pages/share \
  src/pages/resume/index.tsx \
  src/pages/resume/editor/index.tsx \
  src/pages/resume/editor/components/collaboration/collaboration-controls/index.tsx
```

预期：退出码 `0`，无 lint 错误。

- [ ] **步骤 4：运行生产构建**

```bash
pnpm build
```

预期：Vite 构建成功并输出 `dist/`，无构建错误。

- [ ] **步骤 5：运行最终静态验收**

```bash
test -d src/pages/share/store
test ! -f src/pages/share/store.ts
test -f src/pages/share/store/index.ts
test -f src/pages/share/components/content/index.tsx
test -f src/pages/share/components/delete-dialog/index.tsx
test ! -d src/pages/share/components/action-drawer
test ! -d src/pages/share/components/mobile-item
```

预期：命令退出码 `0`。

```bash
rg -n "interface Share(Grid|Card|Toolbar).*Props|onPreview|onSettings|onToggleActive|onDelete" \
  src/pages/share/components/grid \
  src/pages/share/components/card \
  src/pages/share/components/toolbar
```

预期：无运输型业务 props。

- [ ] **步骤 6：检查工作区与提交范围**

```bash
git status --short
git log --oneline -6
```

预期：

- 不存在本计划产生但未提交的源码改动。
- 用户原有且未纳入计划的改动保持原状。
- 最近提交依次覆盖 Store 迁移、commands、共享弹窗、桌面链路和移动链路。
