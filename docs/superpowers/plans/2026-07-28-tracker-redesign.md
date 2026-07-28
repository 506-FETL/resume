# 求职看板 2.0 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把 `/tracker` 重构为「概览漏斗 + 看板为主 + 带日期跟进提醒」的成品级体验，分 P1–P5 交付。

**架构：** 前端 React + Zustand（page-level store）+ Supabase（`company` 单表 + JSON 列）。派生统计走 store selector / 纯函数；看板用 `@hello-pangea/dnd`；抽屉复用现有 Sheet/Drawer。P1 零 schema，P2–P4 逐步加向后兼容列。

**技术栈：** React 19、TypeScript、Zustand、Tailwind、shadcn/ui（已有 collapsible/dropdown-menu/popover/calendar/badge/tooltip/select/scroll-area）、`@hello-pangea/dnd`、dayjs、sonner。

**对应规格：** `docs/superpowers/specs/2026-07-28-tracker-redesign-design.md`

---

## 仓库级约定（贯穿所有任务，务必遵守）

1. **不写测试**：本仓库明确「不写测试，删除现有测试文件」。因此本计划**不含单测/集测步骤**，验证一律用 `tsc` + `build` + 手工走查。
2. **未经用户主动提示不 commit**：所有任务**不含 `git commit` 步骤**。每个任务末尾只做「验证」；是否 commit 由用户主动发起。
3. **验证命令**（已确认可用，基线干净）：
   - 类型检查：`pnpm exec tsc -p tsconfig.app.json --noEmit`（期望：无输出，exit 0）
   - 构建：`pnpm build`（期望：Vite 构建成功）
   - 本机浏览器自动化不可用，手工走查需在可用环境执行 `pnpm dev` 后访问 `/tracker`。
4. **page-organization**：组件用文件夹 + `index.tsx` 导出；kebab-case；共享状态进 `store.ts`；派生逻辑进 `utils.ts` 纯函数，不在组件里堆分支。
5. **颜色/语义单套 token**：新代码统一用「已完成=绿、进行中=蓝、待处理=灰、拒绝=红」，不要沿用 `STAGE_STATUS_COLORS` 的旧反直觉配色（P5 统一收敛）。

---

## 文件结构（P1 范围）

- 修改 `src/pages/tracker/store.ts`：新增 `showArchived`（预留）、`sortBy`/`sortDir`（预留给 P2，本期先加类型不接线）、`rejectedCollapsed`；把 `filterStatus` 的消费方式保留但 UI 入口迁移。
- 修改 `src/pages/tracker/const.ts`：`BOARD_COLUMNS` 增加 `rejected`；新增概览指标标签常量。
- 修改 `src/pages/tracker/utils.ts`：新增纯函数 `getTrackerOverviewStats(jobs)`、`getDaysInStage(job)`。
- 新建 `src/pages/tracker/components/overview-bar/index.tsx`：概览漏斗条。
- 新建 `src/pages/tracker/components/toolbar/filter-menu.tsx`：把状态 pill 收进下拉筛选。
- 修改 `src/pages/tracker/components/header/index.tsx`：接入筛选下拉（替换独立 pill 行的入口语义）。
- 修改 `src/pages/tracker/index.tsx`：装配 OverviewBar；默认视图改 board；移除独立 `<StatusFilter />` 行（其能力迁入 filter-menu）。
- 修改 `src/pages/tracker/components/board/index.tsx`：新增可折叠 rejected 列 + 终态拖拽确认。
- 修改 `src/pages/tracker/components/board/column-card.tsx`：显示停留天数。

> 保留 `src/pages/tracker/components/status-filter/` 暂不删除，P1 先让 `index.tsx` 不再渲染它，确认 filter-menu 覆盖全部能力后于 P5 删除，避免中途丢功能。

---

# 阶段 P1：布局骨架（零 schema）

### 任务 1：概览统计纯函数

**文件：**
- 修改：`src/pages/tracker/utils.ts`（在文件末尾追加）
- 修改：`src/pages/tracker/const.ts`

- [ ] **步骤 1：在 `const.ts` 增加概览标签常量**

在 `src/pages/tracker/const.ts` 末尾追加：

```ts
// 概览漏斗指标 key
export const TRACKER_OVERVIEW_METRICS = [
  { key: 'applied', label: '已投递' },
  { key: 'interview', label: '面试中' },
  { key: 'offer', label: 'Offer' },
  { key: 'pending', label: '待跟进' },
] as const

export type TrackerOverviewMetricKey = (typeof TRACKER_OVERVIEW_METRICS)[number]['key']
```

- [ ] **步骤 2：在 `utils.ts` 增加派生函数**

在 `src/pages/tracker/utils.ts` 末尾追加（`FOLLOW_UP_STALE_DAYS` 与首页保持一致，取 7）：

```ts
export const TRACKER_FOLLOW_UP_STALE_DAYS = 7

export interface TrackerOverviewStats {
  total: number
  applied: number // applied 及以后（screen/interview/offer）累计已投递
  interview: number
  offer: number
  pending: number // 待跟进（P1：陈旧度回退口径，P3 接入 next_action_date）
  responseRate: number // 进入过 screen 及以后 / 已投递
}

// 停留天数：距上次更新的自然天数
export function getDaysInStage(job: JobApplication): number {
  const last = new Date(job.updated_at).getTime()
  return Math.max(0, Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24)))
}

// P1 待跟进口径：非终态且超过陈旧阈值。P3 会替换为 isJobPendingFollowUp。
function isPendingByStaleness(job: JobApplication): boolean {
  if (job.status === 'offer' || job.status === 'rejected')
    return false
  return getDaysInStage(job) >= TRACKER_FOLLOW_UP_STALE_DAYS
}

export function getTrackerOverviewStats(jobs: JobApplication[]): TrackerOverviewStats {
  const total = jobs.length
  const appliedPlus = jobs.filter(j => j.status === 'applied' || j.status === 'screen' || j.status === 'interview' || j.status === 'offer').length
  const screenPlus = jobs.filter(j => j.status === 'screen' || j.status === 'interview' || j.status === 'offer').length
  const interview = jobs.filter(j => j.status === 'interview').length
  const offer = jobs.filter(j => j.status === 'offer').length
  const pending = jobs.filter(isPendingByStaleness).length
  const responseRate = appliedPlus === 0 ? 0 : Math.round((screenPlus / appliedPlus) * 100)
  return { total, applied: appliedPlus, interview, offer, pending, responseRate }
}
```

> 注意：`utils.ts` 顶部已 `import type { ... JobApplication ... }`，无需重复导入。

- [ ] **步骤 3：验证**

运行：`pnpm exec tsc -p tsconfig.app.json --noEmit`
预期：无输出，exit 0。

---

### 任务 2：OverviewBar 组件

**文件：**
- 创建：`src/pages/tracker/components/overview-bar/index.tsx`

- [ ] **步骤 1：创建 OverviewBar**

创建 `src/pages/tracker/components/overview-bar/index.tsx`：

```tsx
import type { ApplicationStatus } from '../../types'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import useTrackerStore from '../../store'
import { getTrackerOverviewStats } from '../../utils'

interface MetricItem {
  key: string
  label: string
  value: string | number
  filterStatus?: ApplicationStatus | null
}

export default function OverviewBar() {
  const { jobs, loading, setFilterStatus } = useTrackerStore()

  if (loading) {
    return <Skeleton className="h-16 w-full rounded-xl" />
  }

  if (jobs.length === 0)
    return null

  const stats = getTrackerOverviewStats(jobs)

  const metrics: MetricItem[] = [
    { key: 'applied', label: '已投递', value: stats.applied, filterStatus: 'applied' },
    { key: 'interview', label: '面试中', value: stats.interview, filterStatus: 'interview' },
    { key: 'offer', label: 'Offer', value: stats.offer, filterStatus: 'offer' },
    { key: 'pending', label: '待跟进', value: stats.pending },
    { key: 'rate', label: '响应率', value: `${stats.responseRate}%` },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card/60 p-3 sm:grid-cols-3 md:grid-cols-5">
      {metrics.map(m => (
        <button
          key={m.key}
          type="button"
          disabled={m.filterStatus === undefined}
          onClick={() => m.filterStatus !== undefined && setFilterStatus(m.filterStatus)}
          className={cn(
            'flex flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors',
            m.filterStatus !== undefined ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default',
          )}
        >
          <span className="text-xs text-muted-foreground">{m.label}</span>
          <span className="text-xl font-semibold tabular-nums">{m.value}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **步骤 2：验证**

运行：`pnpm exec tsc -p tsconfig.app.json --noEmit`
预期：无输出，exit 0。（此时组件尚未挂载，仅验证类型）

---

### 任务 3：筛选下拉（合并状态 pill）

**文件：**
- 创建：`src/pages/tracker/components/toolbar/filter-menu.tsx`

- [ ] **步骤 1：创建 FilterMenu**

创建 `src/pages/tracker/components/toolbar/filter-menu.tsx`：

```tsx
import { ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APPLICATION_STATUS_CONFIG } from '../../const'
import { ALL_FILTER_STATUSES } from '../status-filter/const'
import useTrackerStore from '../../store'

const ALL_VALUE = '__all__'

export default function FilterMenu() {
  const { jobs, filterStatus, setFilterStatus } = useTrackerStore()

  const current = filterStatus ?? ALL_VALUE
  const activeLabel = filterStatus ? APPLICATION_STATUS_CONFIG[filterStatus].label : '全部'

  const getCount = (status: typeof ALL_FILTER_STATUSES[number]) =>
    status === null ? jobs.length : jobs.filter(j => j.status === status).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ListFilter className="size-4" />
          {activeLabel}
          {filterStatus && <Badge variant="secondary" className="ml-0.5 rounded-full px-1.5">{getCount(filterStatus)}</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>按状态筛选</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={value => setFilterStatus(value === ALL_VALUE ? null : value as NonNullable<typeof filterStatus>)}
        >
          {ALL_FILTER_STATUSES.map((status) => {
            const value = status ?? ALL_VALUE
            const label = status === null ? '全部' : APPLICATION_STATUS_CONFIG[status].label
            return (
              <DropdownMenuRadioItem key={value} value={value} className="justify-between">
                <span>{label}</span>
                <span className="text-xs text-muted-foreground">{getCount(status)}</span>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

> 复用了现有 `src/pages/tracker/components/status-filter/const.ts` 的 `ALL_FILTER_STATUSES`（含 `null` 全部 + 5 阶段 + `rejected`）。

- [ ] **步骤 2：验证**

运行：`pnpm exec tsc -p tsconfig.app.json --noEmit`
预期：无输出，exit 0。

---

### 任务 4：Header 接入筛选下拉

**文件：**
- 修改：`src/pages/tracker/components/header/index.tsx`

- [ ] **步骤 1：引入 FilterMenu 到工具栏**

在 `src/pages/tracker/components/header/index.tsx` 顶部 import 区加入：

```tsx
import FilterMenu from '../toolbar/filter-menu'
```

在 `<ViewToggle />` 之前插入 `<FilterMenu />`。定位：找到这段（约 76-77 行）：

```tsx
          <ViewToggle />
          <Button
            variant={isSelectMode ? 'secondary' : 'outline'}
```

改为：

```tsx
          <FilterMenu />
          <ViewToggle />
          <Button
            variant={isSelectMode ? 'secondary' : 'outline'}
```

- [ ] **步骤 2：验证**

运行：`pnpm exec tsc -p tsconfig.app.json --noEmit`
预期：无输出，exit 0。

---

### 任务 5：页面装配 — 默认看板 + OverviewBar + 移除独立 pill 行

**文件：**
- 修改：`src/pages/tracker/index.tsx`
- 修改：`src/pages/tracker/store.ts`

- [ ] **步骤 1：store 默认视图改为 board**

在 `src/pages/tracker/store.ts` 找到：

```ts
  viewMode: 'list',
```

改为：

```ts
  viewMode: 'board',
```

- [ ] **步骤 2：index.tsx 挂 OverviewBar、移除独立 StatusFilter 行**

编辑 `src/pages/tracker/index.tsx`：

移除 import：

```tsx
import StatusFilter from './components/status-filter'
```

新增 import：

```tsx
import OverviewBar from './components/overview-bar'
```

把 return 中的这段：

```tsx
        <TrackerHeader />
        <StatusFilter />
        <main className="w-full min-w-0">
```

改为：

```tsx
        <TrackerHeader />
        <OverviewBar />
        <main className="w-full min-w-0">
```

- [ ] **步骤 3：验证类型 + 构建**

运行：`pnpm exec tsc -p tsconfig.app.json --noEmit`
预期：无输出，exit 0。

运行：`pnpm build`
预期：构建成功（`✓ built in ...`）。

- [ ] **步骤 4：手工走查（在浏览器可用环境）**

`pnpm dev` → 访问 `/tracker`：
- 默认进入看板视图。
- 顶部出现概览条（有数据时）。
- Header 里出现「筛选」下拉，点选状态能过滤；原独立 pill 行已消失。
- 点概览「面试中」→ 列表/看板按 interview 过滤。

---

### 任务 6：看板 — 停留天数徽标

**文件：**
- 修改：`src/pages/tracker/components/board/column-card.tsx`

- [ ] **步骤 1：显示停留天数**

在 `src/pages/tracker/components/board/column-card.tsx` 顶部 import 区加入：

```tsx
import { getDaysInStage } from '../../utils'
```

在组件内 `const meta = getTrackerMetaSummary(job)` 之后加：

```tsx
  const daysInStage = getDaysInStage(job)
```

在标签区（`meta.activeSubStageLabel || meta.hasJobUrl` 那个 flex-wrap 块）内，最前面加入一个停留天数徽标：

```tsx
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {daysInStage === 0 ? '今天' : `${daysInStage}天`}
              </span>
```

并把外层条件从 `{(meta.activeSubStageLabel || meta.hasJobUrl) && (` 改为始终渲染（因为停留天数总有值）：

```tsx
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
```

（即去掉该行的 `{(...) && (` 包裹与对应结尾 `)}`，保留内部 `{meta.activeSubStageLabel && ...}` 与 `{meta.hasJobUrl && ...}` 的条件。）

- [ ] **步骤 2：验证**

运行：`pnpm exec tsc -p tsconfig.app.json --noEmit`
预期：无输出，exit 0。

---

### 任务 7：看板 — Rejected 可折叠列 + 终态拖拽确认

**文件：**
- 修改：`src/pages/tracker/const.ts`
- 修改：`src/pages/tracker/store.ts`
- 修改：`src/pages/tracker/components/board/index.tsx`

- [ ] **步骤 1：const.ts 增加 rejected 列定义**

在 `src/pages/tracker/const.ts` 的 `BOARD_COLUMNS` 追加 rejected（保持数组顺序在末尾）：

```ts
export const BOARD_COLUMNS = [
  { status: 'saved' as ApplicationStatus, label: '已保存' },
  { status: 'applied' as ApplicationStatus, label: '已投递' },
  { status: 'screen' as ApplicationStatus, label: '筛选中' },
  { status: 'interview' as ApplicationStatus, label: '面试中' },
  { status: 'offer' as ApplicationStatus, label: '已录用' },
  { status: 'rejected' as ApplicationStatus, label: '已终止' },
]
```

- [ ] **步骤 2：store 增加 rejectedCollapsed 状态**

在 `src/pages/tracker/store.ts` 的 `TrackerStore` 接口内（`viewMode` 附近）加：

```ts
  rejectedCollapsed: boolean
  toggleRejectedCollapsed: () => void
```

在初始 state（`viewMode: 'board',` 附近）加：

```ts
  rejectedCollapsed: true,
```

在 action 区（`setViewMode` 附近）加：

```ts
  toggleRejectedCollapsed: () => set(state => ({ rejectedCollapsed: !state.rejectedCollapsed })),
```

- [ ] **步骤 3：board/index.tsx 渲染 rejected 折叠列 + 终态确认**

在 `src/pages/tracker/components/board/index.tsx`：

顶部 import 增加：

```tsx
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
```

（若已从 react import 了其他 hook，把 `useState` 合并进已有的 import 行。）

从 store 取 `rejectedCollapsed`, `toggleRejectedCollapsed`：

```tsx
  const { jobs, filterStatus, searchKeyword, syncJob, restoreJobsSnapshot, rejectedCollapsed, toggleRejectedCollapsed } = useTrackerStore()
```

新增待确认拖拽 state 与执行函数（放在 `handleDragEnd` 之上）：

```tsx
  const [pendingMove, setPendingMove] = useState<{ jobId: string, newStatus: ApplicationStatus } | null>(null)

  const commitMove = (jobId: string, newStatus: ApplicationStatus) => {
    const previousState = useTrackerStore.getState()
    const currentJob = previousState.jobs.find(job => job.id === jobId)
    if (!currentJob || currentJob.status === newStatus)
      return

    const updatedStageDetails = autoCompleteStages(currentJob.status, newStatus, currentJob.stage_details, true)
    const optimisticJob = { ...currentJob, status: newStatus, stage_details: updatedStageDetails }
    syncJob(optimisticJob)

    updateCompany(jobId, optimisticJob)
      .then((savedJob) => {
        syncJob(savedJob)
        if (newStatus === 'offer')
          toast.success('Offer🎉')
        else if (newStatus === 'rejected')
          toast.error('终止流程')
      })
      .catch((error) => {
        restoreJobsSnapshot({ jobs: previousState.jobs, selectedJob: previousState.selectedJob })
        toast.error('更新状态失败', { description: getTrackerErrorMessage(error) })
      })
  }
```

把现有 `handleDragEnd` 内的落库逻辑改为：终态弹确认，其余直接提交。定位现有：

```tsx
    const newStatus = destination.droppableId as ApplicationStatus
    const previousState = useTrackerStore.getState()
    const currentJob = previousState.jobs.find(job => job.id === draggableId)

    if (!currentJob || currentJob.status === newStatus)
      return

    const updatedStageDetails = autoCompleteStages(currentJob.status, newStatus, currentJob.stage_details, true)
    const optimisticJob = { ...currentJob, status: newStatus, stage_details: updatedStageDetails }

    syncJob(optimisticJob)

    updateCompany(draggableId, optimisticJob)
      .then((savedJob) => {
        syncJob(savedJob)
        if (newStatus === 'offer')
          toast.success('Offer🎉')
        else if (newStatus === 'rejected')
          toast.error('终止流程')
      })
      .catch((error) => {
        restoreJobsSnapshot({
          jobs: previousState.jobs,
          selectedJob: previousState.selectedJob,
        })
        toast.error('更新状态失败', { description: getTrackerErrorMessage(error) })
      })
```

替换为：

```tsx
    const newStatus = destination.droppableId as ApplicationStatus
    const currentJob = useTrackerStore.getState().jobs.find(job => job.id === draggableId)
    if (!currentJob || currentJob.status === newStatus)
      return

    if (newStatus === 'offer' || newStatus === 'rejected') {
      setPendingMove({ jobId: draggableId, newStatus })
      return
    }

    commitMove(draggableId, newStatus)
```

在组件 return 的最外层（`<DragDropContext>` 同级，用 Fragment 包裹）追加确认弹窗：

```tsx
      <AlertDialog open={pendingMove !== null} onOpenChange={open => !open && setPendingMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingMove?.newStatus === 'offer' ? '确认移动到「已录用」？' : '确认移动到「已终止」？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMove?.newStatus === 'offer'
                ? '将把该职位标记为已录用。'
                : '将把该职位标记为终止流程，可在「已终止」列或筛选下查看。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingMove(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMove)
                  commitMove(pendingMove.jobId, pendingMove.newStatus)
                setPendingMove(null)
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

> 记得把原本 `return ( <DragDropContext>...</DragDropContext> )` 用 `<> ... </>` 包裹，把弹窗放在 DragDropContext 之后。

- [ ] **步骤 4：rejected 列折叠渲染**

在 `BOARD_COLUMNS.map` 内，对 `column.status === 'rejected'` 做窄列 + 折叠处理。最小实现：当 `rejectedCollapsed` 为真时，该列只渲染列头（可点击展开），不渲染 Droppable 卡片区；点击列头 `toggleRejectedCollapsed`。

在列头 `<div className="flex items-center gap-2 min-w-0">` 内，对 rejected 列的标题按钮加 onClick：

```tsx
                  <div
                    className="flex items-center gap-2 min-w-0"
                    onClick={column.status === 'rejected' ? toggleRejectedCollapsed : undefined}
                    role={column.status === 'rejected' ? 'button' : undefined}
                  >
```

在 `<Droppable>` 外层包一层条件：rejected 且折叠时不渲染卡片区（仍需渲染一个占位以保证 DnD 结构稳定——保留 Droppable 但高度收窄）：

```tsx
                {column.status === 'rejected' && rejectedCollapsed
                  ? (
                      <div className="rounded-b-lg border border-t-0 bg-muted/20 p-2 text-center text-xs text-muted-foreground">
                        已折叠 · 点击列头展开（{columnJobs.length}）
                      </div>
                    )
                  : (
                      <Droppable droppableId={column.status}>
                        {/* ……原有 Droppable 内容保持不变…… */}
                      </Droppable>
                    )}
```

> 保留原 `<Droppable>...</Droppable>` 整段作为上面三元的第二分支，不改内部。

- [ ] **步骤 5：验证**

运行：`pnpm exec tsc -p tsconfig.app.json --noEmit`
预期：无输出，exit 0。

运行：`pnpm build`
预期：构建成功。

- [ ] **步骤 6：手工走查**

`/tracker` 看板：
- 出现「已终止」列，默认折叠，点列头可展开/收起。
- 把卡片拖到「已录用」或「已终止」→ 弹确认框；确认后状态更新，取消则不变。
- 拖到中间列（applied/screen/interview）→ 直接更新，无弹窗。
- 被拒岗位不再从看板消失。

---

## P1 完成标准

- [ ] `pnpm exec tsc -p tsconfig.app.json --noEmit` 干净
- [ ] `pnpm build` 成功
- [ ] 手工走查任务 5/7 的验收点全过
- [ ] **未 commit**（等待用户主动发起）

---

# 阶段 P2–P5（任务大纲）

> P2 起部分任务需要 Supabase schema 迁移（由用户执行）。以下为结构化大纲，进入对应阶段时再展开为 2–5 分钟粒度的完整步骤（含代码）。每阶段同样遵守「不写测试 / 不主动 commit / tsc+build 验证」。

### P2：列表排序 + 归档（+`archived` 列）

- **迁移（用户执行）：** `alter table company add column if not exists archived boolean not null default false;`
- **T2.1** `types.ts`：`JobApplication` 增可选 `archived?: boolean`；`company.ts` 的 `getCompanies` 映射兜底 `archived: item.archived ?? false`。
- **T2.2** `store.ts`：新增 `sortBy: 'updated' | 'applied' | 'days' | 'company' | 'status'`、`sortDir: 'asc'|'desc'`、`showArchived: boolean` 及对应 setter。
- **T2.3** `utils.ts`：新增 `sortJobs(jobs, sortBy, sortDir)` 纯函数比较器；`filterJobs` 增加 `showArchived` 过滤参数（默认排除 archived）。
- **T2.4** `toolbar/sort-menu.tsx`：新建排序下拉；接入 Header。
- **T2.5** `list/job-table.tsx`：表头可点击切换排序（点击调用 store setSort）；新增「停留天数」列。
- **T2.6** `company.ts`：新增 `archiveCompany(id, archived)`；卡片/抽屉菜单加「归档/取消归档」。
- **T2.7** Header：加「显示归档」开关（切换 `showArchived`）。

### P3：跟进提醒 / 下一步（+`next_action`,`next_action_date` 列）

- **迁移（用户执行）：** `add column next_action text; add column next_action_date date;`
- **T3.1** `types.ts` 增字段；`getCompanies` 映射兜底。
- **T3.2** `utils.ts`：新增 `isJobPendingFollowUp(job)`（有 `next_action_date` 时以到期/逾期为准，否则回退陈旧度）；替换 `getTrackerOverviewStats` 的 `pending` 口径为此函数。
- **T3.3** `utils.ts`：`getNextActionBadge(job)` 返回 `{ label, tone: 'overdue'|'today'|'upcoming' }`。
- **T3.4** 抽屉「跟进」区：下一步动作输入 + 日期选择（复用 `Popover`+`Calendar`），保存走 `updateCompany`。
- **T3.5** `column-card.tsx` / `job-table.tsx`：渲染下一步日期徽标（逾期红/今日橙/未来灰）。
- **T3.6** 首页 `use-resume-spotlights.ts`：把 `pendingCount` 改为调用共享的 `isJobPendingFollowUp`，消除两套口径。

### P4：活动时间线 + 联系人 CRM（+`activities`,`contacts` jsonb 列）

- **迁移（用户执行）：** `add column activities jsonb not null default '[]'::jsonb; add column contacts jsonb not null default '[]'::jsonb;`
- **T4.1** `types.ts`：`TrackerActivity`、`TrackerContact` 接口；`JobApplication` 增可选数组字段；映射兜底 `?? []`。
- **T4.2** `company.ts`：`addActivity(id, activity)`；状态变更处自动追加一条活动。
- **T4.3** `drawer/activity-timeline/index.tsx`：时间线展示 + 手动加活动。
- **T4.4** `drawer/contacts/index.tsx`：联系人增删改。
- **T4.5** `drawer/index.tsx`：重组为三 Tab（跟进 / 面试记录 / 简历&联系人）。

### P5：颜色统一 + 批量改状态 + 收尾

- **T5.1** `const.ts`：收敛 `STAGE_STATUS_COLORS` 到单套语义（完成=绿/进行=蓝/待处理=灰/拒绝=红）；同步引用处。
- **T5.2** `header/index.tsx`：批量模式增「批量改状态 / 批量归档」。
- **T5.3** 新增/编辑表单补可选 `company_logo` URL 输入（修复规格问题 12）。
- **T5.4** 删除已被 filter-menu 取代的 `components/status-filter/`（确认无引用后）。
- **T5.5** 空态、文案、响应式打磨；全量 `tsc` + `build` + 手工走查回归。

---

## 自检记录

- **规格覆盖度：** 规格 9 个模块 → P1（概览/看板 rejected/pill合并）、P2（排序/归档）、P3（提醒）、P4（时间线/CRM/抽屉重组）、P5（颜色/批量/logo/清理）全覆盖。数据层 5 列分散在 P2/P3/P4 迁移步骤。
- **占位符扫描：** P1 全部步骤含实际代码与命令；P2–P5 明确标注为「大纲，进入阶段再展开」，非隐藏占位符。
- **类型一致性：** `getDaysInStage`/`getTrackerOverviewStats`/`isPendingByStaleness` 命名在 P1 内一致；P3 的 `isJobPendingFollowUp` 明确会替换 P1 的 `pending` 口径（已注明），无签名冲突。
- **与 TDD 模板的偏差：** 因仓库「不写测试 + 不主动 commit」约定，已用 tsc/build/手工走查替代测试步骤，用「等待用户发起」替代 commit 步骤——此为有意偏离，非遗漏。
