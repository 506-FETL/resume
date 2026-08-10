# 求职看板（Tracker）体验打磨 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 打磨求职看板模块——补齐 motion 动效、修复归档逻辑与视觉、重构概览统计条（全计数可点 + 响应率主视觉 KPI）、重构 Drawer 产品形态（常用操作外移 / 阶段时间线可点跳转 / 弱化校验 / 联系人按行解耦）。

**架构：** 引入前端统一筛选模型（`filterStatus` 与新 `metricFilter` 互斥）支撑概览可点击；纯谓词收敛在 `utils`；动效统一用 `motion/react` + `useReducedMotion` 降级；落库全部复用既有 `updateCompany` / `archiveCompany` 乐观更新链路，不改 Supabase schema。

**技术栈：** React 19 · TypeScript · Zustand · motion/react · @hello-pangea/dnd · shadcn/ui · Tailwind 4

**验证约定：** 本仓库不写测试。每阶段以 `pnpm lint` 与（末阶段）`pnpm build` 为验证门槛。按用户偏好，实现期间**不 commit**，最终验证通过后由用户决定提交。规格：`docs/superpowers/specs/2026-08-03-tracker-polish-design.md`。

---

## 文件结构

**修改：**

- `src/pages/tracker/store.ts` — 新增 `metricFilter` 状态与 `setMetricFilter` / `clearFilters`，`setFilterStatus` 互斥清空
- `src/pages/tracker/types.ts` — 新增 `TrackerMetricKey` 类型
- `src/pages/tracker/utils.ts` — 新增 `matchesMetric`，`filterJobs` 增加 `metricFilter` 参数
- `src/pages/tracker/components/overview-bar/index.tsx` — 重构为 Hero KPI + 可点指标卡
- `src/pages/tracker/components/header/index.tsx` — 归档按钮文案化 + 数量徽标 + 空态禁用
- `src/pages/tracker/index.tsx` — 归档信息条 + metric 传参链路
- `src/pages/tracker/components/board/index.tsx` — metric 卡片级过滤 + 卡片入场动效 + 归档视觉
- `src/pages/tracker/components/board/column-card.tsx` — 归档弱化 + hover 微交互
- `src/pages/tracker/components/list/index.tsx` — metric 过滤 + 空态文案兼容
- `src/pages/tracker/components/list/job-table.tsx` — 行入场动效 + 归档弱化
- `src/pages/tracker/components/list/job-card.tsx` — 归档弱化
- `src/pages/tracker/components/drawer/index.tsx` — 头部推进主按钮 + 时间线跳转确认流 + Tab 动效
- `src/pages/tracker/components/drawer/progress-timeline.tsx` — 节点点击语义改为跳转 + 推进动画
- `src/pages/tracker/components/drawer/use-stage-detail.ts` — 弱化「完成前必须填日期」硬拦截
- `src/pages/tracker/components/drawer/stage-detail.tsx` — 文案调整（去「一步一步」提示）
- `src/pages/tracker/components/drawer/contacts/index.tsx` — 按行解耦保存
- `src/pages/tracker/components/drawer/activity-timeline/index.tsx` — 列表项动效
- `src/pages/tracker/components/drawer/next-action/index.tsx` — 徽标/保存微交互（轻）

**新建：**

- `src/pages/tracker/components/overview-bar/metric-card.tsx` — 单个可点指标卡（含数字滚动）
- `src/pages/tracker/hooks/use-count-up.ts` — 轻量数字滚动 hook（遵循 reduced-motion）

---

## P1：统一筛选模型 + 动效基建

### 任务 1：新增 `TrackerMetricKey` 类型

**文件：**

- 修改：`src/pages/tracker/types.ts`

- [ ] **步骤 1：追加类型**

在 `types.ts` 末尾（`DrawerTab` 之后）追加：

```ts
// 概览聚合指标筛选键（与 filterStatus 互斥）
export type TrackerMetricKey = 'applied' | 'interview' | 'offer' | 'pending'
```

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：PASS（无类型/风格报错）

---

### 任务 2：store 引入互斥筛选模型

**文件：**

- 修改：`src/pages/tracker/store.ts`

- [ ] **步骤 1：扩展类型导入与接口**

将顶部导入行改为包含 `TrackerMetricKey`：

```ts
import type { ApplicationStatus, JobApplication, TrackerMetricKey, TrackerSortBy, TrackerSortDir, ViewMode } from './types'
```

在 `interface TrackerStore` 的 `// 筛选` 区块（`filterStatus` 附近）增加字段：

```ts
  filterStatus: ApplicationStatus | null
  metricFilter: TrackerMetricKey | null
  searchKeyword: string
  showArchived: boolean
```

在操作签名区（`setFilterStatus` 附近）增加：

```ts
  setFilterStatus: (status: ApplicationStatus | null) => void
  setMetricFilter: (key: TrackerMetricKey | null) => void
  clearFilters: () => void
```

- [ ] **步骤 2：初始状态与实现**

在初始状态 `filterStatus: null,` 下一行加 `metricFilter: null,`。

将 `setFilterStatus` 实现替换为互斥版本，并在其后新增两个 action：

```ts
  setFilterStatus: status => set({ filterStatus: status, metricFilter: null }),
  setMetricFilter: key => set(state => ({
    metricFilter: state.metricFilter === key ? null : key,
    filterStatus: null,
  })),
  clearFilters: () => set({ filterStatus: null, metricFilter: null }),
```

- [ ] **步骤 3：selectAll 纳入 metric**

将 `selectAll` 内的 `filterJobs(...)` 调用改为传入 metric（保持"全选当前筛选"语义）：

```ts
      const selectableJobs = filterJobs(state.jobs, state.filterStatus, state.searchKeyword, state.showArchived, state.metricFilter)
```

- [ ] **步骤 4：验证**

运行：`pnpm lint`
预期：PASS（此时 `filterJobs` 第 5 参数将在任务 3 定义；若先行报错，先做任务 3 再回验）

---

### 任务 3：utils 新增 `matchesMetric` 与 `filterJobs` 扩展

**文件：**

- 修改：`src/pages/tracker/utils.ts`

- [ ] **步骤 1：导入 metric 类型**

将 `import type { ApplicationStatus, JobApplication, StageDetail, TrackerActivity, TrackerSortBy, TrackerSortDir } from './types'` 改为追加 `TrackerMetricKey`：

```ts
import type { ApplicationStatus, JobApplication, StageDetail, TrackerActivity, TrackerMetricKey, TrackerSortBy, TrackerSortDir } from './types'
```

- [ ] **步骤 2：新增 `matchesMetric`（放在 `filterJobs` 之前）**

```ts
// 概览聚合指标谓词。口径必须与 getTrackerOverviewStats 同源：
// applied=历史漏斗(投过就算)、interview/offer=未归档+当前状态、pending=待跟进口径
export function matchesMetric(job: JobApplication, key: TrackerMetricKey): boolean {
  switch (key) {
    case 'applied':
      return getFurthestStageIndex(job) >= APPLICATION_STATUS_ORDER.indexOf('applied')
    case 'interview':
      return !job.archived && job.status === 'interview'
    case 'offer':
      return !job.archived && job.status === 'offer'
    case 'pending':
      return isJobPendingFollowUp(job)
    default:
      return true
  }
}
```

- [ ] **步骤 3：`filterJobs` 增加 metric 参数**

将 `filterJobs` 签名与实现改为：

```ts
export function filterJobs(
  jobs: JobApplication[],
  filterStatus: ApplicationStatus | null,
  keyword: string,
  showArchived = true,
  metricFilter: TrackerMetricKey | null = null,
): JobApplication[] {
  const trimmed = keyword.trim().toLowerCase()
  return jobs.filter((job) => {
    if (!showArchived && job.archived)
      return false
    if (filterStatus && job.status !== filterStatus)
      return false
    if (metricFilter && !matchesMetric(job, metricFilter))
      return false
    if (!trimmed)
      return true
    return [job.company, job.position, job.location, job.salary ?? '']
      .some(field => field.toLowerCase().includes(trimmed))
  })
}
```

> 注意：`matchesMetric` 引用了文件后半部的 `getFurthestStageIndex` / `isJobPendingFollowUp` / `APPLICATION_STATUS_ORDER`（已在本文件 import），函数提升保证可用。

- [ ] **步骤 4：验证**

运行：`pnpm lint`
预期：PASS

---

### 任务 4：轻量数字滚动 hook

**文件：**

- 创建：`src/pages/tracker/hooks/use-count-up.ts`

- [ ] **步骤 1：实现 hook**

```ts
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

// 数字滚动到目标值。reduced-motion 或首帧直接落终值，避免无障碍下的动画。
export function useCountUp(target: number, duration = 500): number {
  const reduce = useReducedMotion()
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (reduce) {
      setValue(target)
      return
    }
    const from = fromRef.current
    if (from === target) {
      setValue(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1)
        rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current)
        cancelAnimationFrame(rafRef.current)
      fromRef.current = target
    }
  }, [target, duration, reduce])

  return value
}
```

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：PASS

---

## P2：概览条重构

### 任务 5：可点指标卡组件

**文件：**

- 创建：`src/pages/tracker/components/overview-bar/metric-card.tsx`

- [ ] **步骤 1：实现 MetricCard**

```tsx
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useCountUp } from '../../hooks/use-count-up'

interface MetricCardProps {
  label: string
  value: number
  active: boolean
  accent?: boolean // 待跟进 >0 时高亮
  onClick: () => void
  index: number
}

export function MetricCard({ label, value, active, accent, onClick, index }: MetricCardProps) {
  const reduce = useReducedMotion()
  const display = useCountUp(value)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      className={cn(
        'relative flex flex-col items-start gap-0.5 overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors',
        active
          ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/30'
          : 'border-transparent hover:bg-muted/60',
      )}
    >
      {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        'text-xl font-semibold tabular-nums',
        accent && value > 0 && 'text-amber-600',
      )}
      >
        {display}
      </span>
    </motion.button>
  )
}
```

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：PASS

---

### 任务 6：概览条主体重构（Hero KPI + 指标区）

**文件：**

- 修改：`src/pages/tracker/components/overview-bar/index.tsx`

- [ ] **步骤 1：整体替换实现**

```tsx
import type { TrackerMetricKey } from '../../types'
import { motion, useReducedMotion } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCountUp } from '../../hooks/use-count-up'
import useTrackerStore from '../../store'
import { getTrackerOverviewStats } from '../../utils'
import { MetricCard } from './metric-card'

interface MetricDef {
  key: TrackerMetricKey
  label: string
  value: number
  accent?: boolean
}

export default function OverviewBar() {
  const { jobs, loading, metricFilter, setMetricFilter } = useTrackerStore()
  const reduce = useReducedMotion()
  const stats = getTrackerOverviewStats(jobs)
  const rate = useCountUp(stats.responseRate)

  if (loading)
    return <Skeleton className="h-20 w-full rounded-xl" />

  if (jobs.length === 0)
    return null

  const hasAppliedData = stats.applied > 0

  const metrics: MetricDef[] = [
    { key: 'applied', label: '已投递', value: stats.applied },
    { key: 'interview', label: '面试中', value: stats.interview },
    { key: 'offer', label: 'Offer', value: stats.offer },
    { key: 'pending', label: '待跟进', value: stats.pending, accent: true },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-stretch">
      {/* Hero：响应率 KPI（不可点） */}
      <div className="flex flex-col justify-center gap-1.5 sm:w-44 sm:shrink-0">
        <span className="text-xs font-medium text-muted-foreground">响应率</span>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums leading-none">
            {hasAppliedData ? rate : '—'}
          </span>
          {hasAppliedData && <span className="text-lg font-semibold text-muted-foreground">%</span>}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${hasAppliedData ? stats.responseRate : 0}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground">
          {hasAppliedData
            ? `进入筛选及以后的岗位占投递总数 ${stats.applied} 的比例`
            : '还没有投递数据'}
        </span>
      </div>

      {/* 竖分隔线 */}
      <div className="hidden w-px shrink-0 bg-border sm:block" />

      {/* 指标区：全部可点 */}
      <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <MetricCard
            key={m.key}
            index={i}
            label={m.label}
            value={m.value}
            accent={m.accent}
            active={metricFilter === m.key}
            onClick={() => setMetricFilter(m.key)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：PASS

---

### 任务 7：list/board 消费 metricFilter

**文件：**

- 修改：`src/pages/tracker/components/list/index.tsx`
- 修改：`src/pages/tracker/components/board/index.tsx`

- [ ] **步骤 1：list 传入 metric + 空态文案**

在 `list/index.tsx` 解构处增加 `metricFilter, clearFilters`：

```tsx
  const { jobs, loading, filterStatus, metricFilter, searchKeyword, showArchived, sortBy, sortDir, setFilterStatus, setSearchKeyword, clearFilters, openAddDrawer } = useTrackerStore()
```

将过滤与 `hasFilter` 改为：

```tsx
  const filteredJobs = sortJobs(filterJobs(jobs, filterStatus, searchKeyword, showArchived, metricFilter), sortBy, sortDir)
  const hasFilter = filterStatus !== null || metricFilter !== null || searchKeyword.trim() !== ''
```

在空筛选态标题增加 metric 文案（`METRIC_LABELS` 局部常量），替换现有 `<h2>`：

```tsx
          <h2 className="text-base font-semibold tracking-tight">
            当前
            {filterStatus ? `「${APPLICATION_STATUS_CONFIG[filterStatus].label}」` : ''}
            {metricFilter ? `「${METRIC_LABELS[metricFilter]}」` : ''}
            筛选下没有匹配的职位
          </h2>
```

在文件顶部（组件外）加：

```tsx
const METRIC_LABELS: Record<'applied' | 'interview' | 'offer' | 'pending', string> = {
  applied: '已投递',
  interview: '面试中',
  offer: 'Offer',
  pending: '待跟进',
}
```

将「清除筛选」按钮的 onClick 改为：

```tsx
                onClick={() => {
                  clearFilters()
                  setSearchKeyword('')
                }}
```

（可移除现已未用的 `setFilterStatus` 解构以免 lint 报未使用；若他处仍用则保留。）

- [ ] **步骤 2：board 卡片级 metric 过滤**

在 `board/index.tsx` 解构增加 `metricFilter`：

```tsx
  const { jobs, filterStatus, metricFilter, searchKeyword, showArchived, syncJob, restoreJobsSnapshot, rejectedCollapsed, toggleRejectedCollapsed } = useTrackerStore()
```

将 `filteredJobs` 计算改为纳入 metric（仍不按 filterStatus 隐藏列）：

```tsx
  const filteredJobs = filterJobs(jobs, null, searchKeyword, showArchived, metricFilter)
```

- [ ] **步骤 3：验证**

运行：`pnpm lint`
预期：PASS

---

## P3：归档 UX

### 任务 8：Header 归档按钮文案化 + 空态禁用

**文件：**

- 修改：`src/pages/tracker/components/header/index.tsx`

- [ ] **步骤 1：计算归档数量**

在 `jobCount` 附近增加：

```tsx
  const archivedCount = jobs.filter(job => job.archived).length
```

- [ ] **步骤 2：替换归档按钮**

将现有归档 `<Button ... ><Archive /></Button>` 替换为文案化按钮：

```tsx
            <Button
              variant={showArchived ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              disabled={!showArchived && archivedCount === 0}
              title={archivedCount === 0 ? '还没有已归档的职位' : (showArchived ? '隐藏已归档' : '显示已归档')}
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="size-4" />
              已归档
              {archivedCount > 0 && (
                <span className={cn(
                  'ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium',
                  showArchived ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
                >
                  {archivedCount}
                </span>
              )}
            </Button>
```

（`cn` 已在本文件导入。）

- [ ] **步骤 3：验证**

运行：`pnpm lint`
预期：PASS

---

### 任务 9：归档信息条

**文件：**

- 修改：`src/pages/tracker/index.tsx`

- [ ] **步骤 1：新增信息条**

在 `index.tsx` 顶部导入：

```tsx
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Archive, X } from 'lucide-react'
```

在组件内解构 store 增加 `showArchived, setShowArchived`：

```tsx
  const { viewMode, loading, showArchived, setShowArchived } = useTrackerStore()
  const reduce = useReducedMotion()
```

在 `<OverviewBar />` 之后、`<main>` 之前插入：

```tsx
        <AnimatePresence initial={false}>
          {showArchived && (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span className="inline-flex items-center gap-1.5">
                  <Archive className="size-4" />
                  正在查看已归档职位
                </span>
                <button
                  type="button"
                  onClick={() => setShowArchived(false)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-amber-100"
                >
                  <X className="size-3.5" />
                  退出
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
```

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：PASS

---

### 任务 10：归档卡片/行视觉弱化

**文件：**

- 修改：`src/pages/tracker/components/board/column-card.tsx`
- 修改：`src/pages/tracker/components/list/job-card.tsx`
- 修改：`src/pages/tracker/components/list/job-table.tsx`

- [ ] **步骤 1：column-card 归档弱化 + hover 微交互**

在 `column-card.tsx` 的 `Card` className 中，追加归档弱化与 hover 提升：

```tsx
      className={cn(
        'group cursor-pointer rounded-lg border bg-card p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-sm',
        isSelected && 'border-primary bg-primary/5',
        job.archived && 'opacity-60',
      )}
```

在标签行（`nextActionBadge` 所在的 `flex flex-wrap` 内）最前面加归档 chip：

```tsx
            {job.archived && (
              <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">已归档</span>
            )}
```

- [ ] **步骤 2：job-card 归档弱化**

`job-card.tsx` 的 `Card` className 追加 `job.archived && 'opacity-60'`；在状态 `Badge` 前加归档 chip：

```tsx
              <Badge className={cn('shrink-0 rounded-full border-0 px-2 py-0.5 text-[11px]', statusConfig.bgColor, statusConfig.color)}>
                {statusConfig.label}
              </Badge>
```

改为其前插入：

```tsx
              {job.archived && (
                <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">已归档</span>
              )}
```

- [ ] **步骤 3：job-table 行归档弱化**

`job-table.tsx` `<tr>` className 追加：

```tsx
                  className={cn(
                    'group cursor-pointer border-t transition-colors hover:bg-muted/40',
                    isSelected && 'bg-primary/5',
                    job.archived && 'opacity-60',
                  )}
```

在公司名 `<span>` 后（`nextActionBadge` 附近）加归档 chip：

```tsx
                          {job.archived && (
                            <span className="shrink-0 rounded-full border px-1.5 py-0 text-[10px] font-medium text-muted-foreground">已归档</span>
                          )}
```

- [ ] **步骤 4：验证**

运行：`pnpm lint`
预期：PASS

---

## P4：Drawer 头部推进 + 时间线可点跳转 + 校验弱化

### 任务 11：进度时间线节点点击语义改为「跳转」

**文件：**

- 修改：`src/pages/tracker/components/drawer/progress-timeline.tsx`

- [ ] **步骤 1：新增 onStageJump 回调并放宽可点范围**

将 `ProgressTimelineProps` 改为：

```tsx
interface ProgressTimelineProps {
  viewingStage: ApplicationStatus | null
  onStageClick: (status: ApplicationStatus) => void
  onStageJump: (status: ApplicationStatus) => void
}
```

在组件签名解构 `onStageJump`。将「可点范围」放宽为全部正向阶段可点（非终态时）：

```tsx
          const isClickable = !isRejected
```

节点与标签的 `onClick` 改为：点当前阶段=查看（`onStageClick`），点其他阶段=跳转（`onStageJump`）。将两处 `onClick={() => isClickable && onStageClick(status)}` 改为：

```tsx
                  onClick={() => {
                    if (!isClickable)
                      return
                    if (status === currentStatus)
                      onStageClick(status)
                    else onStageJump(status)
                  }}
```

- [ ] **步骤 2：推进动画（圆点填充）**

给节点 `<button>` 外层或圆点增加 motion：将圆点 `<button className={dotClass}>` 包裹为 `motion.button`（顶部 `import { motion, useReducedMotion } from 'motion/react'`），加：

```tsx
                <motion.button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => { /* 同上跳转逻辑 */ }}
                  aria-label={config.label}
                  className={dotClass}
                  animate={reduce ? undefined : (isCompleted || isCurrent ? { scale: [1, 1.15, 1] } : { scale: 1 })}
                  transition={{ duration: 0.3 }}
                >
```

（`reduce = useReducedMotion()`；`whileHover` 可选 `scale:1.1` 替代原 `hover:scale-110`。保持 disabled 时无动画。）

- [ ] **步骤 3：验证**

运行：`pnpm lint`
预期：PASS

---

### 任务 12：Drawer 头部推进主按钮 + 跳转确认流 + 自动回填当天

**文件：**

- 修改：`src/pages/tracker/components/drawer/index.tsx`

- [ ] **步骤 1：handleProgressChange 自动回填当天**

将 `handleProgressChange` 内的 `autoCompleteStages(selectedJob.status, newStatus, selectedJob.stage_details)` 改为传 `true`（与看板拖拽一致，跳转后阶段有开始日期）：

```tsx
    const updatedStageDetails = autoCompleteStages(selectedJob.status, newStatus, selectedJob.stage_details, true)
```

- [ ] **步骤 2：新增跳转确认状态与处理**

将 `ConfirmKind` 扩展并新增跳转目标态：

```tsx
type ConfirmKind = 'reject' | 'delete' | 'jump-offer' | null
```

新增 state：

```tsx
  const [pendingJump, setPendingJump] = useState<ApplicationStatus | null>(null)
```

新增跳转入口（终态需确认，其余直接推进）：

```tsx
  const handleStageJump = (target: ApplicationStatus) => {
    if (!selectedJob || target === selectedJob.status)
      return
    if (target === 'offer') {
      setPendingJump('offer')
      setConfirmKind('jump-offer')
      return
    }
    handleProgressChange(target)
  }
```

> `rejected` 不会从时间线跳转（时间线只含正向阶段），终止仍走 `⋯` 菜单的 reject 确认。

- [ ] **步骤 3：头部推进主按钮**

在 `toolbar` 内、`编辑信息` 按钮之前，增加主推进按钮（复用 `getTrackerNextAction`）。先在顶部导入：

```tsx
import { getTrackerNextAction } from '../../utils'
import { ArrowRight } from 'lucide-react'
```

在 `toolbar` 定义处计算并渲染：

```tsx
  const nextAction = getTrackerNextAction(selectedJob)
  const toolbar = !isEditing && (
    <div className="flex items-center gap-1">
      {nextAction.targetStatus && (
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => handleStageJump(nextAction.targetStatus!)}
        >
          {nextAction.label}
          <ArrowRight className="size-3.5" />
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsEditing(true)}>
        <Pencil className="size-3.5" />
        编辑信息
      </Button>
      {/* ...existing DropdownMenu 保持不变... */}
```

（`nextAction` 需在 `toolbar` 之前定义；注意 `toolbar` 当前是 JSX 常量，把 `const nextAction = ...` 提到 `const toolbar =` 上一行。）

- [ ] **步骤 4：ProgressTimeline 传入 onStageJump**

将 follow-up Tab 内的 `<ProgressTimeline .../>` 改为：

```tsx
                  <ProgressTimeline
                    viewingStage={viewingStage}
                    onStageClick={stage => setViewingStage(stage === selectedJob.status ? null : stage)}
                    onStageJump={handleStageJump}
                  />
```

- [ ] **步骤 5：确认弹窗支持 jump-offer**

在 `confirmDialog` 的标题/描述/动作三处增加 `jump-offer` 分支（标题「确认移动到「已录用」？」、描述「将把该职位标记为已录用。」、动作调用 `handleProgressChange('offer')`）。修改 `AlertDialogAction` 的 onClick：

```tsx
            onClick={() => {
              if (confirmKind === 'delete')
                handleDelete()
              else if (confirmKind === 'reject')
                handleReject()
              else if (confirmKind === 'jump-offer')
                handleProgressChange('offer')
              setPendingJump(null)
            }}
```

标题：

```tsx
          <AlertDialogTitle>
            {confirmKind === 'delete'
              ? '确认删除该记录？'
              : confirmKind === 'jump-offer'
                ? '确认移动到「已录用」？'
                : '确认终止该流程？'}
          </AlertDialogTitle>
```

描述：

```tsx
          <AlertDialogDescription>
            {confirmKind === 'delete'
              ? `「${selectedJob.company} - ${selectedJob.position}」将被永久删除，无法恢复。`
              : confirmKind === 'jump-offer'
                ? '将把该职位标记为已录用。'
                : '该操作会把状态标记为「终止流程」，可在「已终止」筛选下查看。'}
          </AlertDialogDescription>
```

动作按钮文案与危险样式仅在 delete/reject 时用红色；jump-offer 用默认样式：

```tsx
          <AlertDialogAction
            className={cn(confirmKind !== 'jump-offer' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            onClick={/* 上面的 onClick */}
          >
            {confirmKind === 'delete' ? '删除' : confirmKind === 'jump-offer' ? '确认' : '终止'}
          </AlertDialogAction>
```

（顶部导入 `cn`：`import { cn } from '@/lib/utils'` 已存在。）

- [ ] **步骤 6：验证**

运行：`pnpm lint`
预期：PASS

---

### 任务 13：弱化阶段「完成前必须先填日期」硬拦截

**文件：**

- 修改：`src/pages/tracker/components/drawer/use-stage-detail.ts`
- 修改：`src/pages/tracker/components/drawer/stage-detail.tsx`

- [ ] **步骤 1：去掉非面试阶段的日期硬拦截，改为自动回填当天**

在 `use-stage-detail.ts` 的 `handleStatusChange` 中，`newStatus === '已完成'` 的 `else` 分支（非面试）当前会 `toast.warning` 并 return。改为不拦截、若无 start_date 则自动补当天：

```tsx
      else {
        // 非面试阶段：不再强制先填日期；若为空则自动补当天，保留时间轨迹
        const detail = localDetails.find(s => s.stage === displayStage)
        if (!detail?.start_date) {
          const today = dayjs().format('YYYY-MM-DD')
          updateStageDetail({ start_date: today, status: newStatus })
          setIsStatusOpen(false)
          return
        }
      }
```

（`dayjs` 已在文件导入。此分支后续原有 `updateStageDetail({ status: newStatus })` 仍会对"已有日期"情况生效。）

- [ ] **步骤 2：canCompleteStage 放宽（非面试阶段不再要求日期）**

将 `canCompleteStage` 非面试分支由「必须有 start_date」改为始终可完成（完成时若无日期由步骤 1/推进链路补当天）：

```tsx
    if (isInterviewStatus) {
      const savedSubStages = job.interview_sub_stages || []
      return savedSubStages.length > 0 && savedSubStages.every(s => s.status === '已完成')
    }
    return true
```

在 `markCurrentStageComplete` 内，为当前阶段补当天日期（若空）：把 `nextDetails` 生成处对 `displayStage` 的项加 `start_date` 兜底：

```tsx
    const today = dayjs().format('YYYY-MM-DD')
    const nextDetails = (() => {
      const existing = localDetails.find(s => s.stage === displayStage)
      if (existing) {
        return localDetails.map(s => s.stage === displayStage
          ? { ...s, status: '已完成' as const, start_date: s.start_date ?? today }
          : s)
      }
      return [...localDetails, { stage: displayStage, status: '已完成' as const, start_date: today, notes: '' }]
    })()
```

- [ ] **步骤 3：更新 stage-detail 提示文案（去「一步一步」感）**

`stage-detail.tsx` 的提示段替换为更轻的说明：

```tsx
        <p className="text-xs text-muted-foreground">
          提示：可直接在上方进度条点击任意阶段快速切换；把本阶段改为「已完成」并保存会自动推进到下一阶段。
        </p>
```

- [ ] **步骤 4：验证**

运行：`pnpm lint`
预期：PASS

---

## P5：联系人按行解耦

### 任务 14：联系人保存按行拆分

**文件：**

- 修改：`src/pages/tracker/components/drawer/contacts/index.tsx`

- [ ] **步骤 1：新增按 id 的相等判断 + baseline 索引**

在 `areContactsEqual` 下新增单行比较：

```tsx
function contactEqual(a: TrackerContact | undefined, b: TrackerContact | undefined) {
  if (!a || !b)
    return false
  return a.id === b.id && a.name === b.name && a.role === b.role && a.channel === b.channel && a.note === b.note
}
```

- [ ] **步骤 2：按行保存逻辑（合并策略：仅替换该行，其余取服务端 baseline）**

替换 `handleSave` 为按行版本 `handleSaveRow`（保留 `persist` 的 stale-response 防护）：

```tsx
  const handleSaveRow = async (id: string) => {
    if (saving)
      return
    const edited = contactsRef.current.find(c => c.id === id)
    if (!edited)
      return
    // 合并：以服务端 baseline 为基，仅插入/替换该行，避免把其他行的未保存草稿一并写入
    const base = baselineRef.current
    const exists = base.some(c => c.id === id)
    const next = exists
      ? base.map(c => (c.id === id ? edited : c))
      : [...base, edited]
    await persist(next, { rollbackOnFailure: false, successText: '已保存联系人' })
  }
```

> `persist` 成功后会用服务端返回整体刷新 `contacts`/`baseline`。为不丢其他行草稿，改 `persist` 成功分支：仅把"本次保存行 + 服务端其余行"合并回编辑态。见步骤 3。

- [ ] **步骤 3：persist 成功不覆盖其他行草稿**

修改 `persist`，新增可选入参 `savedRowId`，成功回写时保留其它行的本地编辑：

将 `persist` 签名与成功分支改为：

```tsx
  const persist = async (
    next: TrackerContact[],
    options: { rollbackOnFailure: boolean, successText?: string, savedRowId?: string },
  ) => {
    // ...前置 requestGeneration 逻辑不变...
    setSaving(true)
    try {
      const savedJob = await updateCompany(job.id, { contacts: next })
      const shouldUpdateLocalUi = isCurrentRequest()
      const isStillShowingRequestJob = jobIdRef.current === requestJobId
      if (shouldUpdateLocalUi) {
        syncJob(savedJob)
        setBaseline(savedJob.contacts)
        setContacts((prev) => {
          // 保留其它行的本地草稿，仅把已保存行对齐服务端
          if (!options.savedRowId)
            return savedJob.contacts
          const localById = new Map(prev.map(c => [c.id, c]))
          const merged = savedJob.contacts.map(c =>
            c.id === options.savedRowId ? c : (localById.get(c.id) ?? c),
          )
          // 服务端不存在但本地仍在编辑的新行（未保存）保留在末尾
          const serverIds = new Set(savedJob.contacts.map(c => c.id))
          const localOnly = prev.filter(c => !serverIds.has(c.id) && c.id !== options.savedRowId)
          return [...merged, ...localOnly]
        })
      }
      else if (!isStillShowingRequestJob) {
        syncJob(savedJob)
      }
      if (options.successText)
        toast.success(options.successText)
    }
    catch (error) {
      if (isCurrentRequest() && options.rollbackOnFailure)
        setContacts(requestBaseline)
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
    finally {
      if (isCurrentRequest())
        setSaving(false)
    }
  }
```

`handleSaveRow` 调用改为带 `savedRowId`：

```tsx
    await persist(next, { rollbackOnFailure: false, successText: '已保存联系人', savedRowId: id })
```

`handleAdd` 改为不落库、仅追加本地草稿行（由该行自身保存）：

```tsx
  const handleAdd = () => {
    if (saving)
      return
    const contact: TrackerContact = { id: crypto.randomUUID(), name: '', role: '', channel: '', note: '' }
    setContacts(prev => [...prev, contact])
  }
```

`handleDelete` 的 next 仍基于服务端 baseline 过滤该行（保持删除只影响该行）：

```tsx
    await persist(baselineRef.current.filter(c => c.id !== deleteId), { rollbackOnFailure: true, successText: '已删除联系人', savedRowId: deleteId })
```

- [ ] **步骤 4：UI——移除全局「保存修改」，每行加行内「保存」**

移除头部的全局「保存修改」按钮，「添加联系人」始终可用：

```tsx
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" size="sm" className="h-8 w-full sm:w-auto" disabled={saving} onClick={handleAdd}>
            <Plus className="size-3.5" />
            添加联系人
          </Button>
        </div>
```

在每行 `<li>` 内，删除按钮**前方**加行内保存按钮（仅该行 dirty 时出现）。计算行 dirty：

```tsx
              {contacts.map((contact) => {
                const baselineRow = baseline.find(c => c.id === contact.id)
                const rowDirty = !contactEqual(contact, baselineRow)
                return (
                  <li key={contact.id} className="flex items-start gap-2 rounded-lg border bg-card p-3">
                    {/* ...inputs grid 不变... */}
                    {rowDirty && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        disabled={saving}
                        onClick={() => handleSaveRow(contact.id)}
                      >
                        保存
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="删除联系人"
                      disabled={saving}
                      onClick={() => setPendingDeleteId(contact.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                )
              })}
```

（行内 input 的 `disabled={saving}` 保留；删除按钮不再依赖全局 `dirty`。移除组件级 `dirty` 变量与 `areContactsEqual` 若不再使用则删除以过 lint。）

- [ ] **步骤 5：验证**

运行：`pnpm lint`
预期：PASS

---

## P6：全局动效打磨 + 验证

### 任务 15：看板卡片 / 列表行 / 跟进记录入场动效

**文件：**

- 修改：`src/pages/tracker/components/board/index.tsx`
- 修改：`src/pages/tracker/components/list/job-table.tsx`
- 修改：`src/pages/tracker/components/drawer/activity-timeline/index.tsx`

- [ ] **步骤 1：看板列内卡片入场（不与 dnd transform 冲突）**

在 `board/index.tsx`，仅对 `Draggable` **内层**（非拖拽中）加淡入。将内层包裹 div 保持 dnd props，内部再包一层 `motion.div` 仅做 opacity（顶部导入 `motion, useReducedMotion`）：

```tsx
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={dragSnapshot.isDragging ? 'opacity-90 shadow-lg' : ''}
                            >
                              <motion.div
                                initial={reduce || dragSnapshot.isDragging ? false : { opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.03 }}
                              >
                                <ColumnCard job={job} />
                              </motion.div>
                            </div>
                          )}
```

（`reduce = useReducedMotion()`。仅 opacity/y，非 layout，避免与库 transform 抢占。）

- [ ] **步骤 2：列表行入场**

`job-table.tsx` 将 `<tr>` 换为 `motion.tr`（顶部导入 `motion, useReducedMotion`）：

```tsx
                <motion.tr
                  key={job.id}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: Math.min(index, 12) * 0.02 }}
                  onClick={handleRowClick}
                  className={/* 现有 className */}
                >
```

`jobs.map((job) => {` 改为 `jobs.map((job, index) => {`；`reduce = useReducedMotion()` 于组件内。结束标签改 `</motion.tr>`。

- [ ] **步骤 3：跟进记录列表项入场**

`activity-timeline/index.tsx` 将 `sorted.map` 的 `<li>` 换为 `motion.li`（`import { motion, useReducedMotion } from 'motion/react'`）：

```tsx
              {sorted.map((activity, index) => {
                // ...
                return (
                  <motion.li
                    key={activity.id}
                    initial={reduce ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.03 }}
                    className="group flex gap-3"
                  >
```

结束 `</motion.li>`；`reduce = useReducedMotion()`。

- [ ] **步骤 4：验证**

运行：`pnpm lint`
预期：PASS

---

### 任务 16：Drawer 内容 / Tab 切换淡入

**文件：**

- 修改：`src/pages/tracker/components/drawer/index.tsx`

- [ ] **步骤 1：Tab 内容 AnimatePresence 淡入**

顶部导入 `import { AnimatePresence, motion, useReducedMotion } from 'motion/react'`；组件内 `const reduce = useReducedMotion()`。

将三个 `<TabsContent>` 的内容包一层 keyed motion（以 `activeTab` 为 key 做切换淡入）。最小改动方案：在 `Tabs` 外层保留，给每个 `TabsContent` 内层根 div 加 `motion.div`：

```tsx
                <TabsContent value="follow-up" className="mt-5">
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {selectedJob.status !== 'rejected' && <NextActionSection key={selectedJob.id} job={selectedJob} />}
                    {/* ...其余不变... */}
                  </motion.div>
                </TabsContent>
```

对 `interview`、`documents` 两个 Tab 做同样包裹（把原 `className="mt-5 space-y-6"` 的 `space-y-6` 移到内层 motion.div）。

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：PASS

---

### 任务 17：最终验证

- [ ] **步骤 1：lint 全量**

运行：`pnpm lint`
预期：PASS，无 error（warning 若有需为既有基线）

- [ ] **步骤 2：生产构建**

运行：`pnpm build`
预期：构建成功，无类型错误

- [ ] **步骤 3：手动验证清单**（`pnpm dev` 自查，逐条确认）

- [ ] 概览：点「已投递/面试中/Offer/待跟进」均切换筛选，选中态明显，再点取消；响应率大号 KPI + 进度条，无投递时显示 `—`
- [ ] 归档：无归档时按钮禁用并有 tooltip；有归档时显示数量徽标；开启后顶部信息条出现，归档卡片/行弱化且带「已归档」chip
- [ ] Drawer：头部出现「推进到「X」」主按钮；点进度时间线任意正向阶段可直接跳转；跳到 Offer 有二次确认；跳转后阶段自动带当天日期
- [ ] 阶段详情：非面试阶段选「已完成」不再被"先填日期"拦截
- [ ] 联系人：每行独立「保存」（在删除按钮前），改一行不影响其他行草稿；「添加联系人」始终可用
- [ ] 动效：卡片/行/记录入场、数字滚动、Tab 淡入均生效；系统开启「减少动态效果」时降级为静态
- [ ] filterStatus 与 metricFilter 互斥（点 FilterMenu 状态后概览指标取消高亮，反之亦然）

---

## 自检记录

- **规格覆盖度：** 统一筛选模型(任务1-3,7)、动效基建(任务4)、概览重构(任务5-6)、归档UX(任务8-10)、Drawer头部+时间线跳转+校验弱化(任务11-13)、联系人解耦(任务14)、全局动效+验证(任务15-17)——规格全部章节均有对应任务。
- **占位符扫描：** 无 TODO/待定；代码步骤均含实际代码。
- **类型一致性：** `TrackerMetricKey` 在 types 定义，store/utils/overview 一致引用；`matchesMetric`/`filterJobs(5参)`/`onStageJump`/`handleSaveRow`/`persist(savedRowId)` 命名前后一致。
- **兼容性：** `filterJobs` 第 5 参默认 null，旧调用兼容；motion 均含 `useReducedMotion` 降级；dnd 内层 motion 仅 opacity/y，不与库 transform 冲突。
