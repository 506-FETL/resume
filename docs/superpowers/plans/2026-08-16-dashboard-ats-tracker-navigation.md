# 首页 ATS 趋势与求职看板指标导航实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 保留每次 ATS 检测历史，并让求职看板顶部指标执行列定位与高亮而不是过滤卡片。

**架构：** ATS 写入改为追加记录，优化页在加载边界归一化为每份简历的最新报告，首页则同时保留“最新报告聚合”和“最近 8 次趋势”两种视图。求职跟进继续用 `metricFilter` 表示用户选择，但列表将它解释为过滤器，看板将它解释为目标列。

**技术栈：** React、Zustand、TypeScript、Supabase PostgREST、Recharts、Tailwind CSS。

---

### 任务 1：把 ATS 检测改为追加写入

**文件：**
- 修改：`src/lib/supabase/resume/ats.ts`
- 修改：`src/pages/optimize/store.ts`

- [ ] **步骤 1：稳定排序 ATS 查询结果**

在 `getAtsFromUserId` 的查询末尾增加双重倒序：

```ts
.order('created_at', { ascending: false })
.order('id', { ascending: false })
```

- [ ] **步骤 2：加载时只保留每份简历最新报告**

将查询结果按已排序顺序归一化：

```ts
const latestByResume = new Map<string, AtsEvaluationResult>()
for (const config of rawData ?? []) {
  if (!latestByResume.has(config.resume_id))
    latestByResume.set(config.resume_id, config)
}
const data = [...latestByResume.values()].map(config => ({
  ...config,
  findings: ensureAtsFindingsHaveSuggestions(config.findings),
}))
```

- [ ] **步骤 3：分析完成后始终创建新报告**

删除 `existingAts` 分支与 `updateAtsConfig` 导入，统一执行：

```ts
await createAtsConfig(payload)
updateLog('save', '报告已生成', true)
toast.success('ATS 分析报告已生成')
```

- [ ] **步骤 4：执行 ATS 与类型验证**

运行：

```bash
pnpm verify:ats
pnpm exec tsc --noEmit
```

预期：ATS verifier 通过；类型检查不新增与 ATS 变更有关的错误。

### 任务 2：首页拆分最新报告聚合与历史趋势

**文件：**
- 修改：`src/pages/index/insights.ts`
- 修改：`src/pages/index/components/insight-cards/index.tsx`

- [ ] **步骤 1：用稳定顺序构建每份简历最新报告**

比较 `created_at` 后再以 `id` 打破同一时间戳平局，`avgAtsScore`、待修复项和未检测简历继续使用最新报告集合。

- [ ] **步骤 2：趋势直接消费所有有效历史记录**

在 `useDashboardWorkspace` 中从所有在线简历 ATS 记录构建趋势：

```ts
const atsTrend = atsSummaries
  .filter(item => onlineIds.has(item.resume_id))
  .filter(item => typeof item.summary?.overall_score === 'number')
  .sort(compareAtsSummaryChronologically)
  .slice(-8)
  .map(item => ({
    id: String(item.id),
    score: item.summary!.overall_score,
    createdAt: item.created_at,
  }))
```

- [ ] **步骤 3：更新趋势说明文字**

把卡片说明从“各简历最近一次检测得分”改为“最近 8 次检测得分”。

- [ ] **步骤 4：验证首页构建**

运行：

```bash
pnpm exec eslint src/pages/index/insights.ts src/pages/index/components/insight-cards/index.tsx
pnpm build
```

预期：目标文件 lint 通过，生产构建成功。

### 任务 3：将看板指标解释为目标列

**文件：**
- 修改：`src/pages/tracker/utils.ts`
- 修改：`src/pages/tracker/store.ts`
- 修改：`src/pages/tracker/components/board/index.tsx`

- [ ] **步骤 1：增加指标目标列解析函数**

实现固定映射与待跟进优先级：

```ts
export function resolveTrackerMetricStatus(
  jobs: JobApplication[],
  metric: TrackerMetricKey | null,
): ApplicationStatus | null {
  if (!metric)
    return null
  if (metric !== 'pending')
    return metric
  return jobs
    .filter(isJobPendingFollowUp)
    .sort(comparePendingFollowUpUrgency)[0]?.status ?? null
}
```

排序先比较是否存在 `next_action_date`，有日期按日期升序；都没有日期时按 `updated_at` 升序。

- [ ] **步骤 2：批量选择根据视图使用不同集合**

`selectAllVisibleJobs` 在 `viewMode === 'board'` 时向 `filterJobs` 传 `null` 的指标筛选，在列表视图继续传 `metricFilter`。

- [ ] **步骤 3：看板保留全部卡片并计算目标列**

看板构建列数据时执行：

```ts
const filteredJobs = filterJobs(jobs, null, searchKeyword, showArchived, null)
const metricStatus = resolveTrackerMetricStatus(jobs, metricFilter)
const highlightedStatus = filterStatus ?? metricStatus
```

- [ ] **步骤 4：滚动遵循减少动态效果设置**

目标列不可见时滚动，行为由媒体查询决定：

```ts
const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ? 'auto'
  : 'smooth'
container.scrollTo({ left: scrollLeft, behavior })
```

点击同一指标取消后 `highlightedStatus` 变为空，不再高亮。

- [ ] **步骤 5：验证列表与看板语义**

运行：

```bash
pnpm exec eslint src/pages/tracker/utils.ts src/pages/tracker/store.ts src/pages/tracker/components/board/index.tsx
pnpm build
git diff --check
```

预期：目标 lint 与构建通过；看板不再将 `metricFilter` 传入 `filterJobs`。

