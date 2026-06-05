# JD 派生界面规范化重构设计

- 状态：已确认
- 日期：2026-06-06
- 范围：JD 派生生成流程、派生任务、血缘关系，以及简历列表和 Optimize 页面中的相关入口

## 1. 背景

JD 派生功能已经具备完整的数据流和跨页面入口，但当前展示层存在以下问题：

- 生成弹窗的步骤内容直接切换，主体高度和信息密度变化明显，产生跳动感。
- 输入、任务列表、空状态、加载状态和结果对比大量使用手写结构，没有充分复用现有 shadcn 组件。
- 任务弹窗在窄屏下容易出现标题、状态和操作按钮互相挤压。
- 血缘树依赖递归 `marginLeft` 缩进，层级增加后可用宽度持续减少，连接关系也不清晰。
- 简历列表使用按索引累积延迟、缩放和大幅位移，筛选与重新排序时显得迟滞。
- 简历卡片删除按钮使用旋转、缩放和绝对定位，视觉突兀且移动端长期悬浮。
- 多处存在 `space-y-*`、按钮内图标手动尺寸、原始颜色、原生 `label`/`button`/`details` 等不符合当前 shadcn 规范的写法。
- 同一 JD 派生状态在生成弹窗、任务弹窗、简历卡片和编辑器血缘入口中的视觉语言不一致。

本次重构只处理 UI 结构、布局、样式、响应式和动效，不修改业务行为。

## 2. 目标与非目标

### 2.1 目标

- 统一 JD 派生相关界面的层级、间距、状态表达和操作位置。
- 使用项目已有 shadcn 组件替换可替换的手写 UI。
- 让生成弹窗在不同阶段切换时保持稳定尺寸和操作区位置。
- 改善任务弹窗、血缘树和简历卡片在桌面与移动端的布局。
- 减少无意义的缩放、旋转、弹跳和累积延迟，保留克制的反馈动效。
- 保持简历列表页与 Optimize 页面中的派生入口视觉一致。
- 遵循 `prefers-reduced-motion`，避免动效成为使用阻碍。

### 2.2 非目标

- 不修改 JD 解析、改写、重试、取消、丢弃和后台保活逻辑。
- 不修改 Zustand store、Supabase、IndexedDB、LLM prompt 或响应解析。
- 不新增页面、入口、按钮或业务状态。
- 不改变现有点击路径、按钮文案和主要操作顺序。
- 不引入新的 UI 库或动画库。
- 不重做全站设计系统。

## 3. 设计原则

### 3.1 shadcn 组合优先

- 表单使用 `FieldGroup`、`Field`、`FieldLabel` 和 `FieldDescription`。
- 空状态使用 `Empty` 组合。
- 加载占位使用 `Skeleton`。
- 状态提示使用 `Alert`。
- 可滚动内容使用 `ScrollArea`。
- 分组内容使用完整 `Card` 组合或 `Accordion`，不使用自定义边框容器模拟组件。
- 分隔关系使用 `Separator`，不使用手写边框分隔。
- 状态、数量和关键词使用 `Badge`。
- 操作统一使用 `Button`，按钮图标使用 `data-icon`，不手动设置图标尺寸和外边距。

### 3.2 语义令牌优先

- 使用 `primary`、`secondary`、`muted`、`destructive`、`accent` 等语义颜色。
- 不增加原始 `blue-*`、`red-*`、`green-*` 或手写暗色模式颜色。
- `className` 主要负责布局和响应式，不覆盖组件已提供的颜色与排版变体。

### 3.3 稳定布局优先

- 弹窗头部、主体和底部操作区职责分离。
- 长内容只在主体内滚动，标题和主要操作不随内容滚出。
- 状态切换不改变弹窗总体宽度，尽量保持主体最小高度。
- 移动端操作区允许换行或纵向排列，不压缩主要文案。

### 3.4 克制动效

- 页面和步骤切换只使用轻微透明度与短距离位移。
- 不使用旋转删除按钮、卡片大幅缩放或按项目数量不断累积的延迟。
- 列表重排保留 `layout` 动画，但持续时间缩短并取消索引延迟。
- 新状态出现可使用 160–200ms 的 `easeOut` 动效。
- 通过 `motion-reduce` 或 Motion 的 reduced-motion 能力禁用非必要位移。

## 4. 生成弹窗

### 4.1 总体骨架

生成弹窗保持现有 `ResponsiveDialog`，内部改为稳定的三段结构：

1. 固定头部：标题、说明、当前步骤和四步进度。
2. 可滚动主体：输入、解析、改写、成功、失败或取消内容。
3. 固定底部：当前阶段对应的主要和次要操作。

桌面端使用固定最大宽度和合理的最小高度；移动端继续使用 Drawer，但主体可滚动，底部操作保持可见。

现有回调仍由各步骤触发，不改变 `generate`、`abort`、`reset`、`discardDraft` 和 `onOpenResume` 的调用语义。

### 4.2 步骤状态

新增纯展示组件表达四步状态：

- 输入 JD
- 解析岗位
- 针对性改写
- 完成

步骤条只根据现有 `phase` 派生，不新增 store 状态。当前步骤使用主色，已完成步骤使用弱化完成态，后续步骤使用 muted 状态。

步骤主体使用 `AnimatePresence mode="wait"`，以 `phase` 为 key：

- 进入：`opacity: 0 → 1`、`y: 6 → 0`
- 退出：`opacity: 1 → 0`、`y: 0 → -4`
- 时长：约 180ms
- 不使用 scale，避免文字和表单发虚

### 4.3 输入阶段

- 使用 `FieldGroup` 和 `Field` 包裹 JD 输入。
- `FieldLabel` 显示输入要求。
- `FieldDescription` 显示字符计数和不足提示。
- `Textarea` 在不足时设置 `aria-invalid`，对应 `Field` 设置 `data-invalid`。
- 最近使用的 JD 使用 `Button variant="outline" size="xs"`，保留最多三个。
- 示例 JD 继续使用 `Accordion`，示例内容使用语义化 muted 容器。
- 提交按钮移动到弹窗底部操作区。

### 4.4 解析与改写阶段

解析和改写阶段复用统一的“运行状态面板”：

- 顶部显示阶段标题、`Spinner` 和进度描述。
- Reasoning 使用 `ScrollArea`，设置稳定高度，避免流式文本撑高弹窗。
- 关键词和改写项使用 Badge 与 Card/列表组合。
- 改写阶段保留 `Progress`，进度数字使用 tabular numerals。
- 取消操作移动到固定底部。

不改变 reasoning、keywords、changes 和 completedSections 的数据来源。

### 4.5 成功、失败与取消

- 成功摘要使用 `Alert` 显示匹配度。
- 修改结果使用 `Accordion` 按 section 分组。
- 每项 Before/After 使用两个 `Card` 区域，移除原生 `details`。
- 桌面端 Before/After 两列展示，移动端单列展示。
- 失败和取消使用 `Alert`，操作移动到固定底部。
- “打开新简历”“重试”“丢弃”“放弃草稿”的现有行为保持不变。

## 5. 派生任务弹窗

### 5.1 信息结构

保持同一个弹窗和现有数据源，使用 `Tabs` 区分：

- 生成中
- 失败

每个 Tab 的数量使用 Badge 表示。Tabs 只控制展示，不改变任务状态。

### 5.2 任务项

每个任务使用紧凑的完整 Card 组合：

- `CardHeader`：简历名、状态 Badge。
- `CardDescription`：JD 摘要或阶段说明。
- `CardFooter`：查看进度、重试、丢弃等现有操作。

移动端 Footer 允许换行，主要内容不会被按钮压缩。危险操作使用 `destructive` 或明确的次要按钮层级，不再全部使用 ghost。

### 5.3 空状态

生成中和失败列表为空时使用 `Empty`，分别说明“暂无进行中的派生任务”和“暂无失败任务”。不再显示孤立的“暂无”文本。

## 6. 血缘关系

### 6.1 血缘弹窗

- 保持 `ResponsiveDialog`。
- 加载状态使用多行 `Skeleton`。
- 错误状态使用 destructive `Alert`。
- 无数据状态使用 `Empty`。
- 树区域使用 `ScrollArea`，同时支持纵向和必要的横向浏览。

### 6.2 树节点

树节点改为“连接线 + 节点卡片”：

- 递归层级由容器 padding 和左侧边框表达，不再给节点设置不断增长的内联 `marginLeft`。
- 节点 Card 展示名称、状态、匹配度和 JD 摘要。
- 当前简历使用语义化强调边框与背景。
- 非当前简历保留打开按钮，使用 `Button size="icon-sm"`。
- 深层级时节点保持最小宽度，必要时由 ScrollArea 横向滚动，而不是压缩到不可读。

### 6.3 编辑器血缘入口

- Popover 内部使用 `flex flex-col gap-*`。
- 标题、路径和完整树按钮之间使用 `Separator`。
- 从 Popover 打开 Dialog 时保持显式关闭父层再打开子层的现有行为。
- 血缘路径使用清晰的连续层级标识，不改变路径计算逻辑。

## 7. 简历列表与卡片

### 7.1 页面布局

- 页面容器使用响应式 padding，避免移动端固定 `p-8`。
- Header、筛选 Tabs 和卡片网格之间使用一致的纵向 gap。
- 网格 class 顺序和断点保持项目惯例。
- Skeleton 结构与真实卡片结构一致，使用 `size-*` 和 flex gap。

### 7.2 列表动效

- 首次进入只做整体轻微淡入。
- 卡片进入使用 `opacity` 与 `y: 8`，不使用 scale。
- 卡片退出使用短淡出与 `y: -4`。
- 移除 `index * 0.05` 累积延迟，筛选大量卡片时立即响应。
- 保留 `layout`，持续时间约 180–220ms。
- 同步状态只调整 opacity，不同时缩放卡片。

### 7.3 简历卡片

- Card 使用完整 `CardHeader`、`CardContent`、`CardFooter` 结构。
- 删除操作移动到 Header 的 `CardAction`，使用 `Button variant="ghost" size="icon-sm"`。
- 桌面端可在 hover/focus-within 时增强可见度，但不使用旋转、scale 或负偏移悬浮。
- 移动端删除按钮正常显示在 Card 内，不再悬浮卡片外。
- 云端、本地、生成中、失败和派生状态统一使用 Badge 变体与语义颜色。
- Badge 内图标不设置手动尺寸和 margin。
- 父简历跳转使用 `Button variant="link"` 或可访问的轻量按钮组合，保持原点击行为。
- Footer 两个操作在窄卡片中保持等宽，不改变“编辑信息”和“派生”的入口。

## 8. 页面入口一致性

### 8.1 简历列表页

- HeadBars 使用统一响应式 flex 布局，不通过 JS 条件拼出两套排版。
- 在线状态使用语义化 Badge 或 muted 文本，不使用原始绿色和暗色覆盖。
- 去掉 `animate-pulse` 和 `animate-bounce`，状态变化使用颜色/图标即可。
- “派生任务”和“同步本地简历”按钮图标使用 `data-icon`。

### 8.2 Optimize 职位描述工具

- 外层和 `ToolPanelBody` 使用 flex gap，移除 `space-y-*`。
- JD 输入使用 `Field` 组合补齐标签、说明和字符状态。
- 分析按钮使用 `Spinner`，图标使用 `data-icon`。
- 派生按钮保持现有启用条件和点击行为。
- 不调整分析结果、session store 或大模型调用。

## 9. 文件边界

### 9.1 计划修改

- `src/components/jd-variant/components/generator-dialog.tsx`
- `src/components/jd-variant/components/tasks-dialog.tsx`
- `src/components/jd-variant/components/lineage-dialog.tsx`
- `src/components/jd-variant/components/lineage-tree.tsx`
- `src/components/jd-variant/components/steps/step-input.tsx`
- `src/components/jd-variant/components/steps/step-parsing.tsx`
- `src/components/jd-variant/components/steps/step-rewriting.tsx`
- `src/components/jd-variant/components/steps/step-result.tsx`
- `src/pages/resume/index.tsx`
- `src/pages/resume/components/head-bars/index.tsx`
- `src/pages/resume/components/resume-card/index.tsx`
- `src/pages/resume/components/resume-card/variant-badge.tsx`
- `src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx`
- `src/pages/optimize/components/advanced-tools/job-description/index.tsx`

必要时可在 `src/components/jd-variant/components/` 内新增仅负责展示的局部组件，例如步骤指示器和运行状态容器。不得把业务状态迁入这些组件。

### 9.2 明确不修改

- `src/store/jd-variant/`
- `src/components/jd-variant/hooks/`
- `src/components/jd-variant/utils/`
- `src/lib/llm/`
- `src/lib/supabase/`
- `src/lib/offline-resume-manager.ts`
- Resume/Optimize store 的业务字段与 action

若静态检查要求调整 import 顺序或纯类型引用，可做无行为变化的最小修复。

## 10. 可访问性

- Dialog、Drawer 保持 Title 和 Description。
- Textarea 有显式 Label 和错误状态。
- 流式状态使用 `aria-live="polite"`，避免频繁打断。
- Icon-only Button 必须有 `aria-label`。
- 装饰图标使用 `aria-hidden`。
- 不使用只能 hover 才能访问的操作。
- 键盘可展开 Accordion、切换 Tabs、打开 Popover 和 Dialog。
- 动画遵循 reduced-motion。

## 11. 验证标准

### 11.1 静态验证

- TypeScript 检查通过。
- ESLint 通过。
- Vite 构建通过。
- JD 派生相关文件不再新增以下写法：
  - `space-x-*` / `space-y-*`
  - 按钮或 Badge 内图标手动尺寸和 margin
  - 原始状态颜色与手动 `dark:` 覆盖
  - 手写空状态
  - 原生 `details` / `summary`
  - 等宽高分别写成 `w-* h-*`

### 11.2 交互冒烟

- 从简历卡片打开派生弹窗。
- 输入不足与满足最小字符数时的表单状态。
- 解析、改写、成功、失败、取消六种视图。
- 生成中关闭弹窗后任务继续运行。
- 派生任务弹窗查看进度、重试和丢弃。
- 从 Optimize 结果打开预填并自动开始的派生弹窗。
- 编辑器 Popover 和完整血缘树 Dialog。
- 简历列表筛选、重排、同步状态和卡片操作。

### 11.3 响应式冒烟

- 桌面宽度约 1440px。
- 平板宽度约 768px。
- 手机宽度约 390px。
- 验证弹窗主体滚动、底部操作、任务卡片按钮、血缘深层节点和简历卡片 Footer 不溢出。

## 12. 完成定义

- 所有现有 JD 派生入口、文案和业务回调保持可用。
- 生成弹窗阶段切换不再明显跳动。
- 任务和血缘弹窗具备规范的加载、错误和空状态。
- 简历列表筛选和重排动效即时、克制。
- 相关组件符合本项目 shadcn 规范。
- 没有引入新的业务状态或数据逻辑变更。
