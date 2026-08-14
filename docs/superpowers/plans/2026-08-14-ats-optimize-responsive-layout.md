# ATS 优化页响应式布局与样式重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在不改变 ATS 业务数据流的前提下，将 `/optimize` 重构为保留五维雷达图、桌面主次分栏、移动单列且高级工具弹层可稳定滚动的简约响应式工作台。

**架构：** 继续以 `useAtsStore` 为唯一页面领域状态源，把当前 Dashboard 重组为“综合结论 + 雷达图 + 折叠评分依据”，再由页面壳组织问题主列和自然高度修复侧栏。高级工具继续复用现有工具状态和工具组件，只统一入口密度与共享 Dialog/Drawer Shell；移动 Drawer 外观沿用基础组件，仅设置高度并把滚动职责下沉到 Body。

**技术栈：** React 19、TypeScript、Zustand、Tailwind CSS 4、shadcn/Radix UI、Base UI Drawer、Recharts、Vite、ESLint。

---

## 文件结构

### 创建

- `src/pages/optimize/components/dashboard/overview-summary-card.tsx`：组合综合评分、评分结论、可读性和优化完成度。

### 修改

- `src/pages/optimize/index.tsx`：页面最大宽度、纵向节奏、主列/侧栏和移动端顺序。
- `src/pages/optimize/components/header/index.tsx`：桌面/移动头部排列与控件宽度。
- `src/pages/optimize/components/pro-tips/index.tsx`：稳定的单行提示条样式。
- `src/pages/optimize/components/dashboard/index.tsx`：用综合结论卡与雷达卡取代四张等权指标卡。
- `src/pages/optimize/components/dashboard/scores-radar-chart.tsx`：保留雷达图并增加五维文字分数和更稳定的响应式尺寸。
- `src/pages/optimize/components/dashboard/assessment-basis-card.tsx`：改为紧凑 Accordion，完整保留评分上下文字段。
- `src/pages/optimize/components/analysis/index.tsx`：压缩标题、列表和空状态的垂直密度。
- `src/pages/optimize/components/repair-checklist/index.tsx`：移除固定高度 ScrollArea，使用自然高度清单。
- `src/pages/optimize/components/advanced-tools/index.tsx`：压缩工具箱标题、工具入口和加载空状态。
- `src/pages/optimize/components/advanced-tools/shared/tool-card.tsx`：将大展示卡改为紧凑整行可点击工具项。
- `src/pages/optimize/components/advanced-tools/shared/primitives.tsx`：统一工具内部 Card、Header、统计卡和空状态的响应式密度。
- `src/pages/optimize/components/advanced-tools/shared/modal.tsx`：统一桌面 Dialog 与移动 Drawer 的结构和滚动职责。
- `src/pages/optimize/components/analysis/Issue-fix/index.tsx`：使问题修复 Dialog/Drawer 遵循相同滚动原则。
- `src/pages/optimize/components/analysis/Issue-fix/content.tsx`：由父容器 Body 负责滚动，避免嵌套滚动冲突。
- `src/pages/optimize/components/advanced-tools/ats-preview/index.tsx`：移动端单列统计和预览区尺寸。
- `src/pages/optimize/components/advanced-tools/benchmark/index.tsx`：移动端统计、基准项和总结区域单列。
- `src/pages/optimize/components/advanced-tools/formatter/index.tsx`：移动端统计和执行区单列。
- `src/pages/optimize/components/advanced-tools/job-description/index.tsx`：输入与操作区适配小屏。
- `src/pages/optimize/components/advanced-tools/job-description/comparison-result.tsx`：比对结果移动端单列，避免过早多栏。

### 保留但不扩展职责

- `src/pages/optimize/store.ts`：现有页面领域状态不变。
- `src/components/ui/dialog.tsx`、`src/components/ui/drawer.tsx`：不重做全局基础组件；页面只通过公开 props 使用它们。
- `src/pages/optimize/components/dashboard/metric-card.tsx`：不再被 Dashboard 使用时移除文件，避免遗留死代码。

---

### 任务 1：建立响应式页面壳与头部节奏

**文件：**
- 修改：`src/pages/optimize/index.tsx`
- 修改：`src/pages/optimize/components/header/index.tsx`
- 修改：`src/pages/optimize/components/pro-tips/index.tsx`

- [ ] **步骤 1：重构页面容器和主工作区栅格**

将页面从固定补偿加 `space-y-8` 改为稳定的纵向结构：

```tsx
<div className="relative min-w-0">
  <div className="sticky top-13 z-10">
    <ProTips />
  </div>
  <main className="mx-auto w-full max-w-[90rem] space-y-4 px-4 py-5 sm:px-6 md:space-y-6 md:py-8 lg:px-8">
    <Header />
    <OptimizeDashboard />
    <div className="grid min-w-0 items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-4 md:space-y-6">
        <IssueAnalysis />
        <AssessmentBasisCard />
      </div>
      <div className="min-w-0 xl:sticky xl:top-26">
        <RepairChecklist />
      </div>
    </div>
    <AdvancedTools />
  </main>
</div>
```

为实现移动端“修复清单先于评分理由”，由 `OptimizeDashboard` 只渲染总览，`AssessmentBasisCard` 提升到页面主列并按 CSS/组件顺序组织；如果同一 JSX 顺序无法兼顾桌面主列，使用两个明确的网格区域而不是复制组件实例。

- [ ] **步骤 2：压缩并响应式排列 Header**

```tsx
<div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
  <div className="min-w-0 space-y-1.5">...</div>
  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">...</div>
</div>
```

删除当前 `pl-11`，让移动端标题、说明和操作对齐；保持 `AnalysisDialog` 的现有状态与事件不变。

- [ ] **步骤 3：让 Pro Tips 自带背景且不依赖父级模糊**

提示条保留现有 amber 语义色和 Marquee，只收紧高度、添加稳定的 `backdrop-blur`/背景到组件自身，并确保父级不遮挡正文。

- [ ] **步骤 4：运行针对性静态检查**

运行：

```bash
pnpm exec eslint src/pages/optimize/index.tsx src/pages/optimize/components/header/index.tsx src/pages/optimize/components/pro-tips/index.tsx
git diff --check
```

预期：两个命令退出码均为 0。

- [ ] **步骤 5：提交任务 1**

```bash
git add src/pages/optimize/index.tsx src/pages/optimize/components/header/index.tsx src/pages/optimize/components/pro-tips/index.tsx
git commit -m "refactor: 重组 ATS 优化页响应式页面壳（任务 1/6）"
```

### 任务 2：重组综合结论、雷达图和评分依据

**文件：**
- 创建：`src/pages/optimize/components/dashboard/overview-summary-card.tsx`
- 修改：`src/pages/optimize/components/dashboard/index.tsx`
- 修改：`src/pages/optimize/components/dashboard/scores-radar-chart.tsx`
- 修改：`src/pages/optimize/components/dashboard/assessment-basis-card.tsx`
- 删除：`src/pages/optimize/components/dashboard/metric-card.tsx`（仅在确认无其他引用时）

- [ ] **步骤 1：创建综合结论卡**

组件接收当前配置派生值而非自己复制 store 状态：

```tsx
interface OverviewSummaryCardProps {
  completedTasks: number
  loading: boolean
  progress: number
  totalTasks: number
}

export default function OverviewSummaryCard(props: OverviewSummaryCardProps) {
  const { currentAtsConfig } = useAtsStore()
  const { meta, readabilityIndex, summary } = currentAtsConfig ?? {}
  const assessment = meta?.rubricVersion === '2.0' ? meta.assessment : undefined

  return (
    <Card className="min-w-0 border-primary/15 shadow-sm">
      <CardContent className="grid gap-5 p-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center md:p-6">
        {/* 综合评分与进度 */}
        {/* basisSummary、candidateProfile、inferredTarget、可读性、完成度 */}
      </CardContent>
    </Card>
  )
}
```

空报告时展示“生成 ATS 报告后显示综合结论”，不伪造 0 分结论。

- [ ] **步骤 2：把 Dashboard 改为两张主卡**

```tsx
<div className="grid min-w-0 gap-4 md:gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
  <OverviewSummaryCard ... />
  <ScoresRadarChart scores={scores} loading={loading} />
</div>
```

移除四张等权卡的渲染；确认 `MetricCard` 无引用后删除。

- [ ] **步骤 3：增强雷达图的文字等价信息**

保留 `RadarChart`、`Radar`、`PolarGrid` 和 `var(--chart-1)`，将布局改为图表加文字分数：

```tsx
<CardContent className="flex min-h-0 flex-col p-4 md:p-5">
  <div className="flex items-center justify-between">...</div>
  <ChartContainer className="mx-auto aspect-square w-full max-w-[18rem]">...</ChartContainer>
  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3 xl:grid-cols-2">
    {chartData.map(item => <div key={item.category}>{item.category} {item.raw}/{item.max}</div>)}
  </div>
</CardContent>
```

加载和无数据状态使用自然最小高度，移动端图表不可裁切。

- [ ] **步骤 4：把评分依据改为 Accordion**

复用 `src/components/ui/accordion.tsx`：

```tsx
<Card>
  <CardHeader>各维度判断理由</CardHeader>
  <CardContent className="p-0">
    <Accordion type="single" collapsible>
      {scoreRationales.map(([key, score]) => (
        <AccordionItem key={key} value={key}>
          <AccordionTrigger className="px-4 py-3 md:px-5">
            <span>{SCORE_LABELS[key]}</span>
            <Badge variant="secondary">{score.score}/{score.max}</Badge>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground md:px-5">
            {score.rationale}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
    {/* evaluatedSections 与 evidenceSignals 紧凑补充区 */}
  </CardContent>
</Card>
```

确保 `candidateProfile`、`inferredTarget`、`basisSummary`、`evaluatedSections`、`evidenceSignals` 均至少在总览或详情中出现一次。

- [ ] **步骤 5：运行针对性静态检查**

```bash
pnpm exec eslint src/pages/optimize/components/dashboard src/pages/optimize/index.tsx
pnpm build
git diff --check
```

预期：ESLint、Vite build、diff check 均退出 0。

- [ ] **步骤 6：提交任务 2**

```bash
git add src/pages/optimize/components/dashboard src/pages/optimize/index.tsx
git commit -m "refactor: 重构 ATS 评分总览与雷达图（任务 2/6）"
```

### 任务 3：压缩问题分析与修复清单并消除固定空白

**文件：**
- 修改：`src/pages/optimize/components/analysis/index.tsx`
- 修改：`src/pages/optimize/components/repair-checklist/index.tsx`

- [ ] **步骤 1：压缩问题分析密度**

CardHeader 使用 `p-4 md:p-5`，CardContent 使用 `space-y-4 p-4 md:p-5`；严重程度分组和问题列表间距分别收紧到 `space-y-2.5`，保留所有 Badge、状态判断和 `FindingItem`。

- [ ] **步骤 2：移除修复清单固定 ScrollArea**

删除 `ScrollArea` 导入以及 `h-100`、`h-75`：

```tsx
<CardContent className="min-h-0 p-0">
  {loading ? <CompactLoading /> : fixList.length === 0 ? <CompactEmpty /> : (
    <div className="space-y-1 p-3 md:p-4">
      {fixList.map(item => <ChecklistItem key={item.id} ... />)}
    </div>
  )}
</CardContent>
```

加载/空状态用 `px-5 py-8`，清单不设固定高度；继续调用 `revertFixChecklist(item.id)`。

- [ ] **步骤 3：运行针对性静态检查**

```bash
pnpm exec eslint src/pages/optimize/components/analysis/index.tsx src/pages/optimize/components/repair-checklist/index.tsx
git diff --check
```

预期：命令退出码为 0，且 `rg -n "h-100|h-75|ScrollArea" src/pages/optimize/components/repair-checklist/index.tsx` 无输出。

- [ ] **步骤 4：提交任务 3**

```bash
git add src/pages/optimize/components/analysis/index.tsx src/pages/optimize/components/repair-checklist/index.tsx
git commit -m "refactor: 压缩 ATS 问题与修复清单布局（任务 3/6）"
```

### 任务 4：简化高级工具入口与共享内容原语

**文件：**
- 修改：`src/pages/optimize/components/advanced-tools/index.tsx`
- 修改：`src/pages/optimize/components/advanced-tools/shared/tool-card.tsx`
- 修改：`src/pages/optimize/components/advanced-tools/shared/primitives.tsx`

- [ ] **步骤 1：把 ToolCard 改为紧凑工具项**

```tsx
<Button
  variant="outline"
  className="group h-auto min-h-0 w-full justify-start whitespace-normal p-4 text-left"
>
  <div className="flex min-w-0 flex-1 items-start gap-3">
    <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tool.iconClassName)}>...</div>
    <div className="min-w-0 flex-1 space-y-1">...</div>
    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
  </div>
</Button>
```

移除 `min-h-[180px]`、悬浮位移和过大的图标/标题，保留 disabled 与 Badge。

- [ ] **步骤 2：压缩高级工具箱容器**

标题区只保留“高级工具箱”、一句说明、四工具数量和简历连接状态；CardContent 桌面四列、中屏两列、移动单列。加载与无上下文状态从固定 `h-[360px]`/`h-[280px]` 改为 `min-h-48 py-10`。

- [ ] **步骤 3：统一内部 Tool primitives 的移动密度**

- `ToolPanelHeader` 在移动端使用较小 icon 与 `p-4`，操作按钮自然换到下一行。
- `ToolStatCard` 使用 `p-3.5 md:p-4`、移动端较小数值字号。
- `ToolEmptyState` 使用 `min-h-40 px-4 py-8`。
- 不改变 tone 映射或业务语义色。

- [ ] **步骤 4：运行针对性静态检查**

```bash
pnpm exec eslint src/pages/optimize/components/advanced-tools/index.tsx src/pages/optimize/components/advanced-tools/shared/tool-card.tsx src/pages/optimize/components/advanced-tools/shared/primitives.tsx
git diff --check
```

预期：命令退出码为 0，且 `rg -n "min-h-\[180px\]|h-\[360px\]|h-\[280px\]" src/pages/optimize/components/advanced-tools` 无上述入口/空状态命中。

- [ ] **步骤 5：提交任务 4**

```bash
git add src/pages/optimize/components/advanced-tools/index.tsx src/pages/optimize/components/advanced-tools/shared/tool-card.tsx src/pages/optimize/components/advanced-tools/shared/primitives.tsx
git commit -m "refactor: 简化 ATS 高级工具入口（任务 4/6）"
```

### 任务 5：统一 Dialog/Drawer 结构并修复移动滚动

**文件：**
- 修改：`src/pages/optimize/components/advanced-tools/shared/modal.tsx`
- 修改：`src/pages/optimize/components/analysis/Issue-fix/index.tsx`
- 修改：`src/pages/optimize/components/analysis/Issue-fix/content.tsx`

- [ ] **步骤 1：拆分共享可见 Header、Body、Footer 结构**

桌面和移动端分别使用真实 `DialogHeader`/`DrawerHeader`，共享 Body：

```tsx
function ModalBody({ children }: PropsWithChildren) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-5">
      {children}
    </div>
  )
}
```

Header 与 Footer 均为 `shrink-0`；Body 是唯一纵向滚动区域。

- [ ] **步骤 2：移动端只给 DrawerContent 设置高度**

```tsx
<DrawerContent
  className="h-[92dvh]"
  overlayClassName="supports-backdrop-filter:backdrop-blur-none"
>
  <DrawerHeader>...</DrawerHeader>
  <ModalBody>{children}</ModalBody>
  {footer}
</DrawerContent>
```

删除当前 `border-border/70 bg-background/95 p-0 backdrop-blur overflow-hidden` 等 DrawerContent 覆盖类；保留 `showSwipeHandle` 和基础组件动画。

- [ ] **步骤 3：桌面 Dialog 只定制布局尺寸**

```tsx
<DialogContent
  className="flex h-[min(88dvh,56rem)] min-h-0 w-[min(70rem,calc(100vw-3rem))] max-w-none flex-col gap-0 overflow-hidden p-0"
  showCloseButton={false}
>
  <DialogHeader>...</DialogHeader>
  <ModalBody>{children}</ModalBody>
  {footer}
</DialogContent>
```

不覆盖默认背景、边框、圆角、阴影或遮罩。

- [ ] **步骤 4：修复问题详情相同滚动边界**

- 桌面 `DialogContent` 使用 `min-h-0` 和统一最大尺寸。
- 移动 `DrawerContent` 仅传高度与无模糊遮罩覆盖。
- `Issue-fix/content.tsx` 根节点改为 `min-h-0 flex-1 overflow-y-auto overscroll-contain`，删除 `h-full overflow-auto` 造成的双滚动组合。
- Header/Footer 保持可见，确认和取消按钮行为不变。

- [ ] **步骤 5：运行针对性静态检查**

```bash
pnpm exec eslint src/pages/optimize/components/advanced-tools/shared/modal.tsx src/pages/optimize/components/analysis/Issue-fix/index.tsx src/pages/optimize/components/analysis/Issue-fix/content.tsx
pnpm build
git diff --check
```

预期：所有命令退出 0；以下检查只显示高度和遮罩无模糊覆盖，不再出现自定义 Drawer 外观类：

```bash
rg -n "DrawerContent|bg-background/95|backdrop-blur|border-border/70" src/pages/optimize/components/advanced-tools/shared/modal.tsx src/pages/optimize/components/analysis/Issue-fix/index.tsx
```

- [ ] **步骤 6：提交任务 5**

```bash
git add src/pages/optimize/components/advanced-tools/shared/modal.tsx src/pages/optimize/components/analysis/Issue-fix/index.tsx src/pages/optimize/components/analysis/Issue-fix/content.tsx
git commit -m "fix: 统一 ATS 弹层与移动 Drawer 滚动（任务 5/6）"
```

### 任务 6：适配四个高级工具并完成全量验证

**文件：**
- 修改：`src/pages/optimize/components/advanced-tools/ats-preview/index.tsx`
- 修改：`src/pages/optimize/components/advanced-tools/benchmark/index.tsx`
- 修改：`src/pages/optimize/components/advanced-tools/formatter/index.tsx`
- 修改：`src/pages/optimize/components/advanced-tools/job-description/index.tsx`
- 修改：`src/pages/optimize/components/advanced-tools/job-description/comparison-result.tsx`

- [ ] **步骤 1：统一移动端栅格断点**

将会在 390px 形成拥挤双栏的 `grid-cols-2` 改为移动单列，在 `sm`/`md` 后再进入两列：

```tsx
className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
```

桌面输入/结果双栏保留在 `lg` 或 `xl` 断点，所有网格子项增加必要的 `min-w-0`。

- [ ] **步骤 2：让操作与长内容在 Drawer Body 内稳定换行**

- JD 输入按钮组移动端使用纵向或满宽按钮，`sm` 后恢复横排。
- Formatter 的主操作按钮移动端满宽，统计区移动端单列。
- ATS 预览的复制按钮和 badges 允许换行；纯文本内部仅保留必要的局部滚动。
- Benchmark 的统计卡、指标卡和总结区在移动端单列。
- ComparisonResult 的 summary、sections、advice 只在足够宽的断点进入多列。

- [ ] **步骤 3：扫描并消除非必要的小屏固定尺寸**

运行：

```bash
rg -n "grid-cols-2|w-\[|min-w-\[|h-\[|min-h-\[" src/pages/optimize/components/advanced-tools
```

逐项确认：保留文本预览等有明确边界的内部 `max-h`，删除会让 Drawer Body 失去主滚动权或制造空白的固定 `h-*`。

- [ ] **步骤 4：运行全量静态验证**

```bash
pnpm exec eslint src/pages/optimize
pnpm verify:ats
pnpm build
git diff --check
```

预期：

- ESLint 退出 0；
- ATS 验证脚本输出全部断言通过；
- Vite 生产构建退出 0；
- diff check 无输出且退出 0。

- [ ] **步骤 5：运行浏览器桌面端验收**

使用本地开发服务器打开 `/optimize`，在 1440×900 检查：

1. 综合结论与完整雷达图同屏；
2. 问题区、修复清单无固定高度空白；
3. 五个评分理由可单项展开与收起；
4. 四个高级工具均能打开 Dialog；
5. 每个 Dialog 的 Header/Footer 保持可见，Body 可滚至末尾；
6. 无水平滚动条，浅色与深色主题均沿用现有配色。

- [ ] **步骤 6：运行浏览器移动端验收**

在 390×844 检查：

1. 页面按综合结论→雷达图→问题→修复→理由→工具排列；
2. 雷达图文字与图形完整、不裁切；
3. 页面无横向溢出；
4. 四个工具均打开默认样式 Drawer；
5. Drawer 只有高度定制，遮罩无模糊，滑动手柄和进出动画存在；
6. Drawer Body 可滚至末尾且 Footer 始终可见；
7. JD 输入框聚焦后软键盘不会让操作区永久不可达；
8. 问题修复 Drawer 同样可以完整滚动并提交或取消。

- [ ] **步骤 7：检查需求覆盖和工作树**

```bash
git status --short
git diff --check
git diff --stat HEAD~1
```

逐项对照设计规格中的页面头部、评分总览、主工作区、理由 Accordion、高级工具、Dialog/Drawer、主题、无障碍和状态要求；记录任何无法在无登录环境交互验证的项目，不将静态检查描述成真实移动设备验证。

- [ ] **步骤 8：提交任务 6**

```bash
git add src/pages/optimize/components/advanced-tools
git commit -m "refactor: 完成 ATS 高级工具响应式适配（任务 6/6）"
```

---

## 完成定义

- 6 个任务全部执行并分别提交。
- `/optimize` 数据与行为未回归，所有原有 ATS v2 字段仍可访问。
- 雷达图在桌面与移动端均保留并可读。
- 修复清单不存在固定高度空白。
- 高级工具和问题修复的 Dialog/Drawer 均使用单一 Body 滚动区。
- 移动 Drawer 外观来自默认组件，页面只设置高度并关闭遮罩模糊。
- ESLint、ATS 验证、生产构建和 `git diff --check` 均以最新代码运行且退出 0。
- 浏览器桌面与移动视口验收结果有明确证据；无法验证的登录态/软键盘行为必须如实列出。
