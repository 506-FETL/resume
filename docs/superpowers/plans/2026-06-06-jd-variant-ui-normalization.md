# JD 派生界面规范化重构实施计划

> **给代理执行者：** 必须使用 superpowers:executing-plans 在当前会话按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 在不改变 JD 派生业务逻辑、状态流和入口路径的前提下，全面规范生成弹窗、派生任务、血缘关系、简历列表卡片和 Optimize 入口的 shadcn 组合、响应式布局与动效。

**架构：** 保留现有 Zustand store、hooks、LLM 调用和持久化层，仅重构 React 展示组件。生成弹窗由父组件统一管理固定头部、可滚动主体和固定底部操作；任务、血缘和列表页面使用项目已有的 Field、Empty、Card、Tabs、ScrollArea、Skeleton、Separator、Spinner 等组件完成组合。验证采用定向源码规则检查、TypeScript、ESLint、Vite 构建和桌面/移动端浏览器冒烟。

**技术栈：** React 19、TypeScript 5.9、Vite 7、Tailwind CSS 4、shadcn/ui（Radix）、Motion 12、Zustand 5。

---

## 执行约束

- 工作目录：`/Users/shemingcong/Downloads/resume`
- 保持当前 `main` 分支；用户已明确要求直接修改，不创建或切换分支。
- 不运行 `git push`。
- 当前工作区已有用户改动：
  - `src/components/ai-rewrite/components/dialog-shell.tsx`
  - `src/components/ai-rewrite/utils/parse-rewrite-response.ts`
  - `src/components/jd-variant/utils/apply-changes.ts`
  - `src/pages/resume/index.tsx`
- 不覆盖或回退这些改动。修改 `src/pages/resume/index.tsx` 时必须以当前工作树内容为基础合并。
- 不修改：
  - `src/store/jd-variant/`
  - `src/components/jd-variant/hooks/`
  - `src/components/jd-variant/utils/`
  - `src/lib/llm/`
  - `src/lib/supabase/`
  - `src/lib/offline-resume-manager.ts`
- 不新增 npm 依赖，不更新 shadcn 组件源码。
- 本仓库没有组件测试框架。本次是纯展示层重构，不引入测试框架；以定向静态规则检查、编译、Lint、构建和浏览器冒烟作为可重复验收。
- 每完成一个任务都立即更新本计划的复选框与执行记录。

## 文件结构

### 可能新建

- `src/components/jd-variant/components/generator-step-indicator.tsx`
  - 只根据当前 `GeneratorPhase` 渲染四步进度，不持有业务状态。

### 修改

- `src/components/jd-variant/components/generator-dialog.tsx`
  - 统一生成弹窗的固定头部、动画主体和固定底部操作。
- `src/components/jd-variant/components/steps/step-input.tsx`
  - 使用 Field 组合规范 JD 输入、最近 JD 和示例。
- `src/components/jd-variant/components/steps/step-parsing.tsx`
  - 规范解析中状态、reasoning 滚动和关键词。
- `src/components/jd-variant/components/steps/step-rewriting.tsx`
  - 规范改写进度、reasoning 和变化列表。
- `src/components/jd-variant/components/steps/step-result.tsx`
  - 使用 Accordion 与 Card 展示结果对比。
- `src/components/jd-variant/components/tasks-dialog.tsx`
  - 使用 Tabs、Card 和 Empty 规范任务管理。
- `src/components/jd-variant/components/lineage-dialog.tsx`
  - 使用 Skeleton、Alert、Empty 和 ScrollArea 规范状态。
- `src/components/jd-variant/components/lineage-tree.tsx`
  - 使用连接线与节点卡片替代内联递增缩进。
- `src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx`
  - 规范 Popover 结构和父子 overlay 切换。
- `src/pages/resume/index.tsx`
  - 规范页面间距、Skeleton 和卡片列表动效。
- `src/pages/resume/components/head-bars/index.tsx`
  - 规范响应式布局、在线状态和按钮图标。
- `src/pages/resume/components/resume-card/index.tsx`
  - 使用 CardAction、语义 Badge 和稳定操作布局。
- `src/pages/resume/components/resume-card/variant-badge.tsx`
  - 规范 Tooltip 内部布局和图标。
- `src/pages/optimize/components/advanced-tools/job-description/index.tsx`
  - 使用 Field、Spinner 和 flex gap 规范入口。
- `docs/superpowers/plans/2026-06-06-jd-variant-ui-normalization.md`
  - 持续记录真实执行状态。

## 任务 1：记录基线并规范生成弹窗

**文件：**
- 新建：`src/components/jd-variant/components/generator-step-indicator.tsx`
- 修改：`src/components/jd-variant/components/generator-dialog.tsx`
- 修改：`src/components/jd-variant/components/steps/step-input.tsx`
- 修改：`src/components/jd-variant/components/steps/step-parsing.tsx`
- 修改：`src/components/jd-variant/components/steps/step-rewriting.tsx`
- 修改：`src/components/jd-variant/components/steps/step-result.tsx`

- [x] **步骤 1：运行生成弹窗规则基线并确认存在违规**

运行：

```bash
rg -n 'space-[xy]-|<label|<button|<details|<summary|className="size-[0-9.]+.*animate-spin|className=".*text-\[10px\]' \
  src/components/jd-variant/components/generator-dialog.tsx \
  src/components/jd-variant/components/steps
```

预期：命中当前 `space-y-*`、原生 `label`/`button`/`details`、手动 Spinner 尺寸等写法，作为重构前失败基线。

执行记录：2026-06-06 已运行，命中 `generator-dialog.tsx` 的 `space-y-*`、`step-input.tsx` 的原生 `label`/`button`、解析与改写步骤的手写 Spinner 尺寸，以及结果步骤的原生 `details`/`summary`，失败基线成立。

- [x] **步骤 2：新增纯展示步骤指示器**

实现 `GeneratorStepIndicator`：

- 接收 `phase: GeneratorPhase`。
- 将现有 phase 映射为四步：输入、解析、改写、完成。
- 使用语义颜色、Badge 或紧凑圆点表达完成/当前/未开始状态。
- 桌面端显示步骤名，窄屏允许隐藏次要文字但保留可访问标签。
- 只做展示，不读取 store，不触发 action。

执行记录：新增 `generator-step-indicator.tsx`，仅接收 `GeneratorPhase` 并映射四步展示，没有读取 store 或新增 action。

- [x] **步骤 3：重构生成弹窗骨架**

在 `generator-dialog.tsx`：

- 使用 `ResponsiveDialogFooter`。
- Header 中加入说明与 `GeneratorStepIndicator`。
- 主体使用 `ScrollArea` 或稳定的 `min-h-0 flex-1 overflow-hidden` 容器。
- 使用 `AnimatePresence mode="wait" initial={false}` 和 `motion.div` 按 `state.phase` 切换主体。
- 动效只使用 opacity 与 4–6px 纵向位移，约 180ms，使用 `useReducedMotion` 禁用非必要位移。
- 将 idle、parsing、rewriting、success、error、aborted 的操作按钮统一放到底部。
- 保持现有 `startGenerate`、`abort`、`reset`、`discardDraft` 和 `onOpenResume` 调用顺序与语义。
- 不改变关闭生成中弹窗后后台继续的 toast 行为。

执行记录：生成弹窗已改为固定 Header、ScrollArea 主体和 ResponsiveDialogFooter；阶段内容使用 `AnimatePresence`，并通过 `useReducedMotion` 关闭非必要位移。原有生成、取消、丢弃、打开和后台 toast 回调保持原调用语义。

- [x] **步骤 4：规范输入步骤**

在 `step-input.tsx`：

- 使用 `FieldGroup`、`Field`、`FieldLabel`、`FieldDescription`。
- `Field` 根据字符不足设置 `data-invalid`；`Textarea` 设置 `aria-invalid`。
- 最近 JD 使用 `Button variant="outline" size="xs"`，不使用原生 button。
- 保留最近三条与示例 Accordion。
- 移除步骤内部提交按钮，由 Dialog Footer 渲染。
- 不改变字符计算、最近 JD 回填和示例内容。

执行记录：输入区已使用 Field 组合与 `aria-invalid`，最近 JD 改为 Button，提交操作移至弹窗 Footer。

- [x] **步骤 5：规范解析与改写步骤**

在 `step-parsing.tsx` 和 `step-rewriting.tsx`：

- 使用 `Spinner` 替代 `Loader2 animate-spin`。
- reasoning 使用固定高度的 `ScrollArea`。
- 使用 flex gap，不使用 `space-y-*`。
- 关键词继续使用 Badge，但移除手动字号覆盖。
- 改写变化项使用紧凑 Card 组合或语义列表。
- 移除步骤内部取消按钮，由 Dialog Footer 渲染。
- 保持 progress、completedSections、changes、reasoning 的展示语义。

执行记录：解析与改写步骤已改用 Spinner、ScrollArea、Skeleton、Progress、Card 和 Badge，取消操作移至弹窗 Footer。

- [x] **步骤 6：规范成功结果**

在 `step-result.tsx`：

- 保留按 section 分组的 Accordion。
- 移除原生 `details` / `summary`。
- 每条变化直接在 AccordionContent 中用两个 Card 展示 Before/After。
- 桌面两列、移动单列。
- 保留 HTML 安全解析 `parseSanitizedHtml`。
- 移除步骤内部操作按钮，由 Dialog Footer 渲染。

执行记录：结果按 section 使用 Accordion，Before/After 使用响应式双 Card 展示，已移除原生 details/summary，安全 HTML 解析保持不变。

- [x] **步骤 7：运行定向检查、类型检查和 Lint**

运行：

```bash
rg -n 'space-[xy]-|<label|<button|<details|<summary|className="size-[0-9.]+.*animate-spin|className=".*text-\[10px\]' \
  src/components/jd-variant/components/generator-dialog.tsx \
  src/components/jd-variant/components/steps
npx tsc --noEmit
npx eslint \
  src/components/jd-variant/components/generator-step-indicator.tsx \
  src/components/jd-variant/components/generator-dialog.tsx \
  src/components/jd-variant/components/steps/*.tsx
```

预期：

- `rg` 无匹配。
- TypeScript 退出码 0。
- ESLint 退出码 0。

执行记录：定向 `rg` 无匹配；`npx tsc --noEmit` 退出码 0；修复两处数组索引 key 后，目标文件 ESLint 使用 `--max-warnings 0` 退出码 0；`git diff --check` 退出码 0。

- [ ] **步骤 8：提交生成弹窗改动**

仅暂存本任务文件和计划文件：

```bash
git add \
  src/components/jd-variant/components/generator-step-indicator.tsx \
  src/components/jd-variant/components/generator-dialog.tsx \
  src/components/jd-variant/components/steps/step-input.tsx \
  src/components/jd-variant/components/steps/step-parsing.tsx \
  src/components/jd-variant/components/steps/step-rewriting.tsx \
  src/components/jd-variant/components/steps/step-result.tsx \
  docs/superpowers/plans/2026-06-06-jd-variant-ui-normalization.md
git commit -m "refactor(jd-variant): normalize generator dialog UI"
```

## 任务 2：规范派生任务与血缘关系

**文件：**
- 修改：`src/components/jd-variant/components/tasks-dialog.tsx`
- 修改：`src/components/jd-variant/components/lineage-dialog.tsx`
- 修改：`src/components/jd-variant/components/lineage-tree.tsx`
- 修改：`src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx`

- [ ] **步骤 1：运行任务与血缘规则基线并确认存在违规**

运行：

```bash
rg -n 'space-[xy]-|style=\{\{ marginLeft|>暂无<|className="size-[0-9.]+|className=".*text-xs"' \
  src/components/jd-variant/components/tasks-dialog.tsx \
  src/components/jd-variant/components/lineage-dialog.tsx \
  src/components/jd-variant/components/lineage-tree.tsx \
  src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx
```

预期：命中手写空状态、`space-y-*`、递增 margin 和组件内图标手动尺寸等写法。

- [ ] **步骤 2：重构派生任务弹窗**

在 `tasks-dialog.tsx`：

- 使用 `Tabs`、`TabsList`、`TabsTrigger`、`TabsContent` 区分生成中和失败。
- Tabs 数量使用 Badge。
- 每个任务使用完整 Card 组合。
- 生成中任务保留“查看进度”和“丢弃”。
- 失败任务保留“重试”和“丢弃”。
- 空列表使用 `Empty`。
- 主体使用 `ScrollArea`。
- 移动端 Footer 使用 wrap 或纵向布局，不压缩标题。
- 不改 runningItems、failed、discardRunning、retry 的数据与回调。

- [ ] **步骤 3：重构血缘弹窗状态**

在 `lineage-dialog.tsx`：

- 加载使用多行 Skeleton。
- 错误使用 destructive Alert。
- 无数据使用 Empty。
- 树放入可纵向滚动的 ScrollArea，并允许树内部最小宽度。
- 保留现有加载 hook 与打开简历回调。

- [ ] **步骤 4：重构血缘树节点**

在 `lineage-tree.tsx`：

- 删除节点和 JD 摘要的内联 `marginLeft`。
- 用递归容器 `border-l`、padding 和相对连接线表达层级。
- 节点使用 Card 组合，展示名称、状态、匹配度和 JD 摘要。
- 当前节点使用语义化强调，不使用原始颜色。
- 打开按钮使用 `size="icon-sm"`，图标不手动尺寸。
- `findPath` 算法保持不变。
- 路径展示改用 flex gap 和清晰的层级连接符，不使用 `space-y-*`。

- [ ] **步骤 5：规范编辑器血缘 Popover**

在 `variant-lineage-button.tsx`：

- PopoverContent 使用 `flex flex-col gap-*`。
- 使用 Separator 分隔路径与完整树按钮。
- 保持先 `setPopoverOpen(false)` 再 `setTreeOpen(true)`。
- Button 内图标继续使用 `data-icon`。

- [ ] **步骤 6：运行定向检查、类型检查和 Lint**

运行：

```bash
rg -n 'space-[xy]-|style=\{\{ marginLeft|>暂无<|className="size-[0-9.]+"' \
  src/components/jd-variant/components/tasks-dialog.tsx \
  src/components/jd-variant/components/lineage-dialog.tsx \
  src/components/jd-variant/components/lineage-tree.tsx \
  src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx
npx tsc --noEmit
npx eslint \
  src/components/jd-variant/components/tasks-dialog.tsx \
  src/components/jd-variant/components/lineage-dialog.tsx \
  src/components/jd-variant/components/lineage-tree.tsx \
  src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx
```

预期：

- `rg` 无不允许的匹配；如果 Skeleton 的显式尺寸被命中，记录为允许项。
- TypeScript 和 ESLint 退出码 0。

- [ ] **步骤 7：提交任务与血缘改动**

```bash
git add \
  src/components/jd-variant/components/tasks-dialog.tsx \
  src/components/jd-variant/components/lineage-dialog.tsx \
  src/components/jd-variant/components/lineage-tree.tsx \
  src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx \
  docs/superpowers/plans/2026-06-06-jd-variant-ui-normalization.md
git commit -m "refactor(jd-variant): normalize task and lineage UI"
```

## 任务 3：规范简历列表、Header 与卡片动效

**文件：**
- 修改：`src/pages/resume/index.tsx`
- 修改：`src/pages/resume/components/head-bars/index.tsx`
- 修改：`src/pages/resume/components/resume-card/index.tsx`
- 修改：`src/pages/resume/components/resume-card/variant-badge.tsx`

- [ ] **步骤 1：保存并检查 `src/pages/resume/index.tsx` 当前用户改动**

运行：

```bash
git diff -- src/pages/resume/index.tsx
```

记录当前工作树中的 store 解构格式和 Tabs `className="my-3"`，后续修改必须基于当前内容，不回退用户改动。

- [ ] **步骤 2：运行列表与卡片规则基线并确认存在违规**

运行：

```bash
rg -n 'space-[xy]-|dark:|bg-(red|blue|green)-|text-(red|blue|green)-|animate-(pulse|bounce)|\bh-[0-9.]+ w-[0-9.]+|\bw-[0-9.]+ h-[0-9.]+|z-[0-9]|rotate-|scale-|delay: index|index \* 0\.05' \
  src/pages/resume/index.tsx \
  src/pages/resume/components/head-bars/index.tsx \
  src/pages/resume/components/resume-card/index.tsx \
  src/pages/resume/components/resume-card/variant-badge.tsx
```

预期：命中当前原始颜色、手动图标尺寸、在线状态动画、删除按钮旋转缩放和列表累积延迟。

- [ ] **步骤 3：重构简历页面布局与列表动效**

在 `src/pages/resume/index.tsx`：

- 页面容器使用 `flex flex-col gap-*` 和响应式 padding。
- 保留用户当前 Tabs 间距意图，但用整体 gap 统一布局，删除孤立 margin。
- 使用 `useReducedMotion`。
- 列表整体只做轻微淡入。
- 卡片进入使用 opacity + `y: 8`，退出使用 opacity + `y: -4`。
- 删除 scale 和 `index * 0.05` 延迟。
- 同步状态只改变 opacity。
- 保留 `layout` 和 `AnimatePresence mode="popLayout"`。
- Skeleton 使用与真实卡片一致的 Card 结构、flex gap 和 `size-*`。
- 不改变过滤、同步、弹窗和导航逻辑。

- [ ] **步骤 4：重构 Header**

在 `head-bars/index.tsx`：

- 移除基于 `useIsMobile` 的两套 class 分支，使用响应式 Tailwind。
- 在线/离线状态使用 Badge 或语义 muted 状态。
- 删除原始绿色、`dark:`、pulse 和 bounce。
- Button 内图标使用 `data-icon`，不手动尺寸与 margin。
- 移动端按钮可全宽，桌面端恢复自适应。
- 不改变 pendingCount 和同步按钮启用条件。

- [ ] **步骤 5：重构简历卡片**

在 `resume-card/index.tsx`：

- 使用 `CardAction` 放置删除按钮。
- 移除 `isHovered`、旋转、scale、负偏移、z-index 和原始红色渐变。
- 删除按钮使用 `variant="ghost" size="icon-sm"`，保持始终可访问。
- Card 本身只保留轻微 shadow/border transition。
- 状态 Badge 使用内置变体和语义 token。
- 删除云端 Badge 的 `bg-blue-400`。
- Badge 内图标不设置尺寸和 margin。
- CardContent 使用 flex gap。
- 父简历入口使用 Button link/ghost 组合并保持 `stopPropagation`。
- Footer 保持两个等宽按钮与原有行为。

- [ ] **步骤 6：规范派生 Badge Tooltip**

在 `variant-badge.tsx`：

- TooltipContent 使用 `flex flex-col gap-*`。
- Badge 内图标不手动尺寸。
- 保持 parentName、jdSnippet 和 matchRate 文案。

- [ ] **步骤 7：运行定向检查、类型检查和 Lint**

运行：

```bash
rg -n 'space-[xy]-|dark:|bg-(red|blue|green)-|text-(red|blue|green)-|animate-(pulse|bounce)|\bh-[0-9.]+ w-[0-9.]+|\bw-[0-9.]+ h-[0-9.]+|z-[0-9]|rotate-|scale-|delay: index|index \* 0\.05' \
  src/pages/resume/index.tsx \
  src/pages/resume/components/head-bars/index.tsx \
  src/pages/resume/components/resume-card/index.tsx \
  src/pages/resume/components/resume-card/variant-badge.tsx
npx tsc --noEmit
npx eslint \
  src/pages/resume/index.tsx \
  src/pages/resume/components/head-bars/index.tsx \
  src/pages/resume/components/resume-card/index.tsx \
  src/pages/resume/components/resume-card/variant-badge.tsx
```

预期：

- `rg` 不再命中目标违规。
- TypeScript 和 ESLint 退出码 0。

- [ ] **步骤 8：暂存前确认没有覆盖用户的其他文件**

运行：

```bash
git status --short
git diff -- src/pages/resume/index.tsx
```

确认：

- `src/components/ai-rewrite/components/dialog-shell.tsx`
- `src/components/ai-rewrite/utils/parse-rewrite-response.ts`
- `src/components/jd-variant/utils/apply-changes.ts`

仍保持未暂存，且未被本任务修改。

- [ ] **步骤 9：提交不含既有改动的列表组件**

`src/pages/resume/index.tsx` 在本任务前已经存在用户改动，因此本步骤不得暂存该文件。只提交其余原本干净的组件与计划记录，页面文件保留在工作树中。

```bash
git add \
  src/pages/resume/components/head-bars/index.tsx \
  src/pages/resume/components/resume-card/index.tsx \
  src/pages/resume/components/resume-card/variant-badge.tsx \
  docs/superpowers/plans/2026-06-06-jd-variant-ui-normalization.md
git commit -m "refactor(resume): normalize JD variant list UI"
git status --short src/pages/resume/index.tsx
```

预期：`src/pages/resume/index.tsx` 仍显示为未暂存修改。

## 任务 4：规范 Optimize JD 派生入口

**文件：**
- 修改：`src/pages/optimize/components/advanced-tools/job-description/index.tsx`

- [ ] **步骤 1：运行 Optimize 入口规则基线并确认存在违规**

运行：

```bash
rg -n 'space-[xy]-|Loader2|className="size-[0-9.]+|<Textarea' \
  src/pages/optimize/components/advanced-tools/job-description/index.tsx
```

预期：命中 `space-y-*`、Loader2 手动 spinner 和未使用 Field 的 Textarea。

- [ ] **步骤 2：规范职位描述输入区**

在 `job-description/index.tsx`：

- 外层和 ToolPanelBody 使用 `flex flex-col gap-*`。
- 使用 `FieldGroup`、`Field`、`FieldLabel`、`FieldDescription` 包裹 Textarea。
- 显示当前字符数和最小派生字符要求，不改变 `canDerive`。
- 分析中使用 `Spinner`。
- Search、Target、GitBranch 图标在 Button 中使用 `data-icon`，不手动尺寸。
- 保留 jobDescription session、分析请求、结果和派生打开逻辑。

- [ ] **步骤 3：运行定向检查、类型检查和 Lint**

运行：

```bash
rg -n 'space-[xy]-|Loader2|className="size-[0-9.]+"' \
  src/pages/optimize/components/advanced-tools/job-description/index.tsx
npx tsc --noEmit
npx eslint src/pages/optimize/components/advanced-tools/job-description/index.tsx
```

预期：`rg` 无匹配，TypeScript 和 ESLint 退出码 0。

- [ ] **步骤 4：提交 Optimize 入口改动**

```bash
git add \
  src/pages/optimize/components/advanced-tools/job-description/index.tsx \
  docs/superpowers/plans/2026-06-06-jd-variant-ui-normalization.md
git commit -m "refactor(optimize): normalize JD derive entry UI"
```

## 任务 5：全量验证与视觉冒烟

**文件：**
- 修改：`docs/superpowers/plans/2026-06-06-jd-variant-ui-normalization.md`
- 按验证结果修复上述任务中的文件

- [ ] **步骤 1：运行全范围 shadcn 规则审计**

运行：

```bash
rg -n 'space-[xy]-|dark:|bg-(red|blue|green|yellow|emerald|orange|purple|pink)-|text-(red|blue|green|yellow|emerald|orange|purple|pink)-|<label|<button|<details|<summary|\bh-[0-9.]+ w-[0-9.]+|\bw-[0-9.]+ h-[0-9.]+' \
  src/components/jd-variant \
  src/pages/resume/index.tsx \
  src/pages/resume/components/head-bars \
  src/pages/resume/components/resume-card \
  src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx \
  src/pages/optimize/components/advanced-tools/job-description/index.tsx
```

预期：没有本次范围内的违规。若现有 UI 基础组件 API 要求保留个别写法，逐项人工确认并在计划记录原因。

- [ ] **步骤 2：运行完整静态验证**

运行：

```bash
npx tsc --noEmit
npx eslint \
  src/components/jd-variant \
  src/pages/resume/index.tsx \
  src/pages/resume/components/head-bars \
  src/pages/resume/components/resume-card \
  src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx \
  src/pages/optimize/components/advanced-tools/job-description/index.tsx
npm run build
```

预期：全部退出码 0。

- [ ] **步骤 3：启动开发服务器**

运行：

```bash
npm run dev -- --host 127.0.0.1
```

保持会话运行，记录实际端口。

- [ ] **步骤 4：使用 Browser 插件做桌面冒烟**

按 `browser:browser` 和 `build-web-apps:frontend-testing-debugging` 技能执行：

- 打开简历列表页。
- 验证 Header、Tabs、卡片网格、删除按钮、Badge 和 Footer。
- 切换“全部 / 原版 / 派生版本”，观察重排无累积延迟和大幅缩放。
- 打开 JD 派生弹窗，验证输入布局、步骤条和固定 Footer。
- 若本地数据允许，检查任务弹窗和血缘 Popover/Dialog。
- 打开 Optimize 的职位描述工具，验证 Field 和派生按钮。
- 检查控制台无新增错误。

- [ ] **步骤 5：使用 Browser 插件做移动端冒烟**

将 viewport 调整到约 390px 宽：

- 简历 Header 操作按钮不溢出。
- 卡片 Badge、标题和 Footer 不互相挤压。
- 生成 Drawer 主体可滚动、Footer 可见。
- 任务 Card 操作可换行。
- 血缘树可滚动，深层节点不被压缩到不可读。
- Optimize 输入区按钮可换行。

- [ ] **步骤 6：检查业务边界与工作树**

运行：

```bash
git diff --name-only 68f6e5f..HEAD
git status --short
git diff -- src/store/jd-variant src/components/jd-variant/hooks src/components/jd-variant/utils src/lib/llm src/lib/supabase src/lib/offline-resume-manager.ts
```

确认：

- 没有修改明确禁止的业务文件。
- 用户原有三个非页面文件改动仍保留且未提交。
- 没有新增依赖或 lockfile 变动。

- [ ] **步骤 7：完成最终计划记录**

在每个验证步骤下追加真实命令结果、浏览器可见问题和修复记录。若某个需要真实 LLM/账号数据的状态无法触发，保持该项未勾选并记录限制，不得宣称已验证。

- [ ] **步骤 8：提交验证记录和不含既有改动的必要修复**

仅暂存本计划和本次 UI 文件；继续排除 `src/pages/resume/index.tsx`，避免把任务前的用户改动并入自动提交：

```bash
git add \
  docs/superpowers/plans/2026-06-06-jd-variant-ui-normalization.md \
  src/components/jd-variant/components \
  src/pages/resume/components/head-bars/index.tsx \
  src/pages/resume/components/resume-card \
  src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx \
  src/pages/optimize/components/advanced-tools/job-description/index.tsx
git commit -m "chore(jd-variant): record UI verification"
```

如果没有代码修复且计划记录已包含在前一个提交中，可跳过空提交，并在本计划记录“无额外提交”。最终报告必须明确说明 `src/pages/resume/index.tsx` 同时包含用户原有改动和本次 UI 修改，仍留在工作树中。
