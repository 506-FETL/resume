# 桌面简历编辑区改版：折叠列表 + 拖拽排序

- 日期：2026-08-11
- 主题：resume 编辑页桌面端编辑区从「横向标签栏（SideTabs）」改为「可折叠列表（Accordion）+ 拖拽排序」；删除桌面底部抽屉；表单响应式改为按面板宽度自适应；手机端完全不变。
- 状态：已获用户口头批准（形态=折叠列表 Accordion + 拖拽排序；表单按面板宽度；手机端不动）

## 背景与问题

当前桌面右侧编辑面板（`EditPanel`）复用了移动端的 `SidebarEditor`，其内部是 `SideTabs` 体系：

1. **顶部横向可滚动标签 + SVG 曲线连接框**（`side-tabs-provider.tsx` 的 `computeOutline`）。塞进右侧窄面板后非常违和——就是截图里那条灰色圆角连接条和横滑标签。
2. **表单栅格按浏览器视口宽度断点**（`md:grid-cols-3 lg:grid-cols-4`）。大显示器上即使面板仅 ~400px，仍强行排 3–4 列，字段被挤扁错位。
3. 桌面仍保留「抽屉/侧栏」双形态与切换按钮，属历史包袱。

## 目标

- 桌面编辑区改为从上到下单列的**可折叠列表**：每个模块一行，点表头就地展开该模块表单。
- 保留两个既有能力：**拖拽排序**（现 `handleDragEnd` → `updateOrder`）、**每模块显隐开关**（`toggleVisibility`）。
- **彻底删除桌面底部抽屉**及 sidebar/drawer 双形态切换。
- 表单响应式改为**按编辑面板自身宽度**（容器查询）决定列数，而非视口宽度。
- **手机端完全不变**：仍是底部抽屉 + 现有 `SideTabs` 横向标签。
- 协作行为不变：展开项(activeTab)、显隐、排序继续走 store 广播天然同步；面板开合/宽度为本地态、不同步。

## 非目标（YAGNI）

- 不做多开折叠（采用单开 `type="single"`，可全部收起）。
- 不改 `SideTabs` 组件本身（手机端继续用，保留）。
- 不改简历渲染区（preview）的缩放/滚动逻辑，仅继续复用现有「跟随编辑视角」锚点。
- 不加测试（仓库默认无测试）。

## 设计

### 形态：单开 Accordion + 拖拽排序

每一行（一个模块）结构：

```
┌───────────────────────────────────────┐
│ ⋮⋮  👤 基本信息              [开/关] ▲ │   表头：拖拽柄 + 图标 + 名称 + 显隐 Switch + 展开箭头
│    ┌─────────────────────────────────┐ │
│    │ 该模块表单（就地展开）            │ │   展开内容
│    └─────────────────────────────────┘ │
├───────────────────────────────────────┤
│ ⋮⋮  🎓 教育背景              [开/关] ▼ │   收起态仅一行
└───────────────────────────────────────┘
```

行为约定：

- **单开**：`type="single" collapsible`，同一时刻至多展开一个；允许全部收起（快速扫列表）。
- **展开即滚动**：展开某模块时，同时 `updateActiveTabId(id)` 并把渲染区滚动到对应章节（复用 `useScrollToSection` 锚点，单向）。
- **基本信息固定置顶**：不可拖、无显隐开关（与现状一致）。
- **拖拽排序**：抓表头左侧 `⋮⋮` 柄上下拖动；复用 `@hello-pangea/dnd`，方向改为 `vertical`；`onDragEnd` → `updateOrder(['basics', ...next])`。拖拽柄要 `onPointerDownCapture` 阻止冒泡，避免触发展开/开关。
- **显隐开关**：表头右侧 `Switch`；关掉的模块表头置灰，`AccordionTrigger disabled`（不可展开），与 store 语义 `visibility[key]===true` 表示隐藏一致（现代码 `visible = !visibilityState[key]`）。
- 去掉 SVG 曲线连接框，改规整分隔线（复用 `AccordionItem` 的 `border-b`）。

### activeTab 与展开值同步

- Accordion 的 `value` = 当前 activeTabId（受控）。
- `onValueChange(next)`：
  - `next` 为空串（用户收起当前项）→ 不改 activeTabId（保持渲染区定位），仅 UI 收起。
  - `next` 非空 → `updateActiveTabId(next)` + 滚动到该章节。
- 协作方改了 activeTabId → 本地 `value` 跟随展开（受控天然生效）。

### 表单响应式：容器查询

- 编辑面板滚动容器加 `@container/panel`（Tailwind v4 原生容器查询，仓库已在用）。
- 12 个表单的栅格类由「视口断点」改为「容器断点」：
  - `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` → `@md/panel:grid-cols-2 @xl/panel:grid-cols-3 @3xl/panel:grid-cols-4`（按各表单原列数等比映射，窄面板回落单列）。
  - 涉及文件：basic-resume、job-intent、application-info、edu-background、work-experience、internship-experience、campus-experience、project-experience、skill-specialty、honors-certificates、hobbies、basic-fields/custom-fields。
- 移动端底部抽屉的滚动容器同样加 `@container/panel`，令同一套容器断点在抽屉宽度下自然回落（手机窄 → 单列），行为与现状一致或更好。

### 面板外壳（EditPanel）

- 保留：右侧常驻、左边缘拖拽调宽（比例记忆 `gresume:editor:edit-panel-ratio`）、`absolute inset-0` 填充（避免第二滚动条）、收起后右下角浮动「编辑简历」。
- 顶部条：**去掉「抽屉」切换按钮**，仅留「简历信息 + 同步状态 + 手动保存 + 开启协作 + 收起」，重排间距。
- 内部：表头协作条固定不滚动；折叠列表区 `@container/panel` + 仅此区域纵向滚动。

### 组件划分

- `edit-panel/index.tsx`：外壳（宽度拖拽、顶部条、滚动容器 `@container/panel`），内部渲染 `AccordionEditor`。
- 新增 `edit-panel/accordion-editor.tsx`：`Accordion` 受控 + `DragDropContext`(vertical) + 列表；basics 固定行 + 可拖行。
- 新增 `edit-panel/section-row.tsx`：单行（拖拽柄 + 图标 + label + Switch + `AccordionTrigger`/`AccordionContent` 承载 `ITEMS[i].content`）。
- `hooks/use-edit-panel.ts`：**删除 mode（sidebar/drawer）**，仅保留 `open` + 窄屏自动收起左导航逻辑。
- `editor/index.tsx`：桌面恒为侧栏；**删除桌面抽屉分支**与 `setMode('drawer')`/「切换为侧栏」；手机分支保留 `Drawer`。

### 错误与边界

- 拖拽与展开/开关的手势冲突：拖拽柄、Switch 均 `onPointerDownCapture={e=>e.stopPropagation()}`。
- 隐藏模块被展开：`disabled` 阻止；若当前 activeTab 恰被隐藏，仍允许显示其表头（置灰），不强制切换（与现状一致，避免破坏协作定位）。
- Accordion 展开动画与渲染区滚动同帧：滚动放 `requestAnimationFrame`，避免测量到动画中间高度。

## 影响文件

新增：
- `src/pages/resume/editor/components/edit-panel/accordion-editor.tsx`
- `src/pages/resume/editor/components/edit-panel/section-row.tsx`

修改：
- `src/pages/resume/editor/index.tsx`（删桌面抽屉分支）
- `src/pages/resume/editor/hooks/use-edit-panel.ts`（删 mode）
- `src/pages/resume/editor/components/edit-panel/index.tsx`（换 AccordionEditor、删抽屉按钮、加 `@container/panel`）
- 12 个表单栅格类（容器查询）
- 手机抽屉滚动容器加 `@container/panel`（`editor/index.tsx` 内）

保留不动：
- `src/components/ui/side-tabs/*`（手机端继续用）
- `src/components/ui/accordion.tsx`（复用；如需 disabled 置灰样式，仅在使用处加类，不改原语）
- preview / use-scroll-to-section

## 验证

- `npx tsc --noEmit` 通过。
- `npx eslint <改动文件>` 通过（不含既存无关告警）。
- 大文件编辑后立即回读确认无静默损坏。
- 人工核对（用户浏览器）：桌面无横向标签/无 SVG 连接条；点表头展开+渲染区跟随滚动；拖拽排序生效且不误触发展开；显隐开关生效且隐藏项置灰；窄面板单列、拖宽后多列；无第二滚动条；手机端仍是底部抽屉且不变。
