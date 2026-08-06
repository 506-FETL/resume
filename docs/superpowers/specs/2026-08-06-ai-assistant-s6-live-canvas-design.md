# AI 助手 · S6 实时画布（预览 + 变更追踪） — 设计规格

- 日期：2026-08-06
- 子项目：S6（S1 数据层 ✓ → S2 对话骨架 ✓ → S3 Agent 引擎 ✓ → S4 内部工具与确认 ✓ → S5 沉浸式入口与历史搜索 ✓ → **S6 实时画布**）
- 目标：在 `/assistant` 对话右侧新增常驻可折叠的第三栏「画布」，实时预览用户在对话中正在编辑的简历，并按对象类型（简历 / 求职看板 / 历史版本）与统一「变更记录」展示本轮对话中 AI 的读取与增删改；同时把对话内的工具调用升级为带图标、可展开、可联动画布的读取/变更条目。
- 范围：`src/pages/assistant/**`、`src/lib/ai/tools/resume.ts`（仅修正字段写入落库路径），复用现有只读预览与数据层，不新增数据库表、不新增迁移。

## 背景与现状

S1–S5 已交付会话持久化、流式对话、Function Calling、内部信息读写与写操作确认、沉浸式外壳与历史搜索。当前对话区把工具调用折叠为一行 `Used N tools`，缺少 GPT 式的"边聊边看到每步改了什么 + 右侧实时产物预览"。用户希望：

1. 对话右侧常驻一个可折叠面板，实时展示"文件/对象变更"。
2. 可选择"当前对话中正在编辑的简历"随时预览。
3. 对话内展示每次读取/编辑的细节（对应 GPT 的 `Edited hero.tsx +16 -6` / `Read build.py`）。

### 已确认的关键技术约束

- **预览数据源**：`useCurrentResumeStore` 只是持久化的"当前简历指针"，`setCurrentResume` 不加载正文；真正的实时正文在 `useResumeStore`（Automerge），但它仅在简历编辑器页由 `useResumeLoader` 加载，助手页不加载。因此助手页的内存 `useResumeStore` 不能代表被编辑简历。→ **预览必须按 `previewResumeId` 从持久化 `getResumeById` 拉取，不读内存 store。**
- **字段写入落库**：`update_current_resume_field.apply()` 现走 `useResumeStore.updateForm` → `applyResumeChange`，在助手页 `docManager` 为 null，`docUpdate` 是 no-op，实际未落库。→ **本功能内改为 `updateResumeConfig(resumeId, { [sectionKey]: after })` 直接落库**（该列在简历下次打开时 seed 进 Automerge，为既有已验证机制）。

## 已确认决策

1. 画布为桌面常驻可折叠第三栏（`会话侧栏 | 对话区 | 画布`），窄屏改为全屏 Sheet，由 Chat Header 的「画布」按钮唤起；折叠状态持久化。
2. 画布 tab：**📄 简历预览（常驻）**、**📊 求职看板**、**🕑 历史版本**、**🧾 变更记录**；后三个仅在本轮对话触碰对应对象时出现。
3. 画布数据（除简历预览正文外）**会话级**，由当前会话 `messages` 的 `tool-call` parts 推导，不新增数据库表；刷新/切换会话可复现。
4. 对话内工具调用升级为逐条读取/变更条目（图标 + 标题 + 状态 + 可展开 diff/摘要 + 「在画布中查看」联动）。
5. 简历预览默认跟随全局「当前编辑简历」并随 AI `open_resume`/`create_resume` 联动，顶部下拉可临时切任意简历；预览始终按 id 从持久化拉取。
6. 修正 `update_current_resume_field` 写入路径为直接落库 `resume_config` 列。

## 非目标（YAGNI / 移交）

- 不做 GPT 式任意动态多 tab（每类产物一个新 tab）；tab 类型固定为四类。
- 不为变更历史新增快照表或迁移。
- 不在助手页引入 Automerge 文档生命周期/协作加载（S6 用持久化拉取即可）。
- 不改其他写工具的既有落库逻辑（`create_job`/`update_job`/版本类等已直接走数据层，无需改）。
- 不实现画布内的"就地编辑"（画布只读；编辑仍通过对话或编辑器）。

## 0. UI 组件复用约束（硬性）

任何场景优先复用现成组件，禁止自造已有能力的组件。S6 明确的组件映射：

| 场景 | 使用组件（来源） |
| --- | --- |
| 画布顶部 tab 条 | `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`（`@/components/ui/tabs`） |
| 简历下拉选择器 | `Select`（`@/components/ui/select`） |
| 看板只读表格 | `Table` 家族（**需先 `pnpm dlx shadcn@latest add table` 引入，不自造**） |
| 变更 / 版本条目卡片 | `Card` 家族（`@/components/ui/card`） |
| 状态徽标（已应用/已取消/失败/新增/修改/删除） | `Badge`（`@/components/ui/badge`，用 variant，不写裸色值） |
| 可展开明细 | `Collapsible` 或 `Accordion`（`@/components/ui`） |
| diff 展示 | 复用 S4 `resume-field-diff`（`components/confirm-card/resume-field-diff`） |
| 内容滚动 | `ScrollArea`（`@/components/ui/scroll-area`） |
| 空态 | `Empty` 家族（`@/components/ui/empty`） |
| 加载占位 | `Skeleton`（`@/components/ui/skeleton`） / `Spinner` |
| 移动端画布容器 | `Sheet`（`@/components/ui/sheet`，含 `SheetTitle`/`SheetDescription`） |
| 切换/操作按钮 | `Button`（variant，不写裸色值）；图标按钮配 `Tooltip` |
| 简历只读预览 | `ScaledReadonlyPreview`（`@/components/resume/scaled-readonly-preview`） |
| 分隔线 | `Separator`（不用裸 `border-t` div） |

`className` 仅用于布局（宽度/间距/对齐/截断），不覆盖组件配色与排版；语义色一律走组件 variant 或语义 token。若某场景确无现成组件，需在计划中显式说明再自造。

## 1. 布局与状态

### 1.1 页面布局

`src/pages/assistant/index.tsx` 布局改为三栏：`AssistantSidebar | 对话区 | AssistantCanvas`。

- 桌面：画布常驻右侧，宽度约 `420px`，可折叠为隐藏（保留 Chat Header 上的展开入口）。折叠状态用 `localStorage`，复用 `readStoredBoolean/writeStoredBoolean`（新增 key `gresume:assistant:canvas-open`）。
- 窄屏：画布不占列，改为全屏 `Sheet`（右侧滑入），必须含 `SheetTitle`/`SheetDescription`，无 Radix 无障碍告警。
- Chat Header 增加「画布」切换按钮：桌面切 `canvasOpen`，窄屏切 `canvasMobileOpen`。

### 1.2 Store 状态（`store.ts`）

新增纯 UI 状态（变更/看板/版本数据不入 store）：

```ts
canvasOpen: boolean            // 桌面画布展开（持久化种子 readStoredBoolean(CANVAS_KEY, true)）
canvasMobileOpen: boolean      // 窄屏 Sheet 开关
canvasActiveTab: CanvasTabKey  // 'resume' | 'board' | 'version' | 'changes'
previewResumeId: string | null // 预览下拉当前值（会话作用域）

setCanvasOpen: (v: boolean) => void
setCanvasMobileOpen: (v: boolean) => void
setCanvasActiveTab: (tab: CanvasTabKey) => void
setPreviewResumeId: (id: string | null) => void
```

- `canvasActiveTab` 默认 `'resume'`。
- `previewResumeId` 初始为 `null`；由 `use-canvas-preview` 用 `useCurrentResumeStore.resumeId` 种子并订阅其变化联动。

## 2. 变更模型 `deriveCanvasModel`

纯函数（`utils.ts`），把当前会话 `messages` 的所有 `tool-call` parts 解析为共享模型，供画布四个 tab 与对话内联条目共用。

```ts
type CanvasChangeCategory = 'resume' | 'board' | 'version' | 'read'
type CanvasChangeAction = 'read' | 'create' | 'update' | 'delete' | 'restore'

interface CanvasChange {
  id: string                 // = toolCallId
  toolName: string
  category: CanvasChangeCategory
  action: CanvasChangeAction
  title: string              // 「修改简历 · 工作经历」「新增职位 字节 · 前端」「读取求职看板」
  detail?:
    | { kind: 'diff', before: unknown, after: unknown }
    | { kind: 'summary', text: string }
  state: AiToolCallState     // result | error | cancelled | awaiting-confirm | call
  targetTab?: 'resume' | 'board' | 'version'
}

interface CanvasModel {
  changes: CanvasChange[]    // 读+写全部条目，按消息顺序
  writes: CanvasChange[]     // 仅写操作（供变更记录 tab）
  touchedBoard: boolean
  touchedVersion: boolean
  hasWrites: boolean
}
```

- **工具映射表** `TOOL_CANVAS_META`（`utils.ts`）：为每个工具定义 `category/action/标题模板/targetTab`，与 `tool-call-part.tsx` 现有 `TOOL_META` 合并为单一来源（图标类别复用现有 `tool-icons`）。
- **detail 提取**：
  - `update_current_resume_field`：从 part `args`（`sectionKey`）与既有 before/after 语义构造 `diff`；写工具 `apply` 的 before 值已存在于确认卡 preview，但 part 只存 `args/result`，因此 diff 的 before 取 `args` 无法覆盖时降级为 `summary`（如"修改了 工作经历"）。
  - `create_job`/`update_job`/`delete_job`/版本类：用 `args`+`result` 生成 `summary`。
- **状态**：`cancelled` 的写操作在变更记录标注"已取消"，不计入"已应用"；`error` 标注失败。
- **tab 显隐**：`touchedBoard` = 出现过 `list_jobs/get_job/create_job/update_job/delete_job` 中任一写或读；`touchedVersion` 同理版本类；`hasWrites` = `writes.length > 0`。简历预览 tab 始终显示。

`use-canvas-model.ts` 用 `useMemo(() => deriveCanvasModel(messages), [messages])` 封装，串联进行中的 `streamingParts`（把流式 tool-call 也纳入，边聊边更新）。

## 3. 四个 Tab 行为

### 3.1 📄 简历预览（常驻，默认）

- 顶部：简历下拉选择器（`list_resumes` 数据），当前值 = `previewResumeId`。
- 数据：`use-canvas-preview` 按 `previewResumeId` 调 `getResumeById(id, '*')` → `buildResumeSnapshot` → `buildTemplateResumeData` → `ScaledReadonlyPreview` 只读渲染。**不读内存 `useResumeStore`。**
- 联动刷新：订阅 `useCurrentResumeStore.resumeId`（AI open/create 会改它）→ 自动切换 `previewResumeId`；监听「本轮出现新的简历类写操作 / 写操作应用完成」→ 重新拉取当前 `previewResumeId` 的数据刷新预览（通过一个自增 `resumeRefreshKey` 或 `writes` 中简历类条目数量变化触发）。
- 空态：无任何简历 → 提示"还没有简历，让 AI 帮你新建一份"。
- 加载/失败：拉取中显示骨架；失败显示可重试提示，不影响对话。

### 3.2 📊 求职看板（`touchedBoard` 时出现）

- 只读表格快照（公司 / 岗位 / 状态 / 下一步 / 城市…），数据读实时看板（`getCompanies`）。
- 本轮变更高亮：`writes` 中 `create_job`（新增，绿点）、`update_job`（修改，蓝点）、`delete_job`（删除，灰条/划除）对应行加标记。删除的职位在实时数据里已不存在，用 `writes` 里的摘要单独列出"本轮已删除"。

### 3.3 🕑 历史版本（`touchedVersion` 时出现）

- 当前简历（`previewResumeId`）的版本时间线（版本号 / 时间 / 来源），读 `listResumeHistoryVersions`。
- 本轮 `save/restore/delete` 版本的条目加标注。

### 3.4 🧾 变更记录（`hasWrites` 时出现）

- 汇总 `writes` 全部条目（GPT "Code changes" 风格）：图标 + 标题 + 状态徽标（已应用 / 已取消 / 失败），点击展开 `diff`（复用 S4 的 `resume-field-diff` 样式）或 `summary`。
- 每条提供「在画布中查看」→ `setCanvasActiveTab(change.targetTab)`。

### 3.5 Tab 联动

- 对话内联条目与变更记录条目的「在画布中查看」→ `setCanvasOpen(true)` + `setCanvasActiveTab(targetTab)`（窄屏则 `setCanvasMobileOpen(true)`）。
- 未触碰的 tab 不渲染 tab 头，避免空 tab。

## 4. 对话内联工具条目

改造 `components/message-bubble/tool-call-part.tsx`（现为 `ToolCallsSection` 折叠）：

- 每个 `tool-call` part 渲染为一条：`图标 + 标题 + 状态`；写操作附增删摘要（如 `+3 -1` 或"新增/删除"），读操作显示"读取了 X"。
- 可展开：写操作展开 diff/摘要；读操作展开可选（默认收起）。
- 右侧「在画布中查看」按钮（仅当 `targetTab` 存在）联动画布。
- 标题/图标/分类统一取自 `TOOL_CANVAS_META`（与画布同源），删除 `tool-call-part.tsx` 内重复的 `TOOL_META`。
- 保留把连续 tool-call 分组的现有结构，但每项展示升级为上述条目。

## 5. 写入路径修正（`update_current_resume_field`）

`src/lib/ai/tools/resume.ts` 的 `apply`：

```ts
apply: async () => {
  await updateResumeConfig(currentId, { [sectionKey]: after })
  return { ok: true, sectionKey }
}
```

- 用闭包捕获 `execute` 时读到的 `currentId`（避免 apply 时指针已变）。
- `before` 仍取 `useResumeStore` 当前值用于确认卡展示；若助手页内存值不可靠，降级为从 `getResumeById` 读取该模块作为 before（保证 diff 有意义）。
- 落库成功后触发预览刷新（见 3.1）。

## 6. 组件与目录（page-organization）

```
src/pages/assistant/
├── const.ts                       # + CANVAS 相关 storage key、tab key 常量
├── types.ts                       # + CanvasTabKey / CanvasChange / CanvasModel
├── store.ts                       # + 画布 UI 状态与 setter
├── utils.ts                       # + deriveCanvasModel、TOOL_CANVAS_META、摘要/diff 提取
├── hooks/
│   ├── use-canvas-model.ts        # messages+streamingParts → CanvasModel（memo）
│   └── use-canvas-preview.ts      # previewResumeId 解析、拉取、刷新、下拉数据
└── components/
    ├── chat-header/               # + 画布切换按钮
    ├── message-bubble/
    │   └── tool-call-part.tsx     # 升级为内联条目 + 联动画布
    └── assistant-canvas/
        ├── index.tsx              # 画布壳：桌面列 / 移动 Sheet + tab 装配
        ├── canvas-tabs.tsx        # 顶部 tab 条（按 model 动态显示）
        ├── resume-preview/index.tsx
        ├── board-snapshot/index.tsx
        ├── version-timeline/index.tsx
        └── change-log/index.tsx
```

- 组件仅从 store / hooks 取共享状态，禁止跨两层 props 下钻。
- 画布各 tab 为独立 `index.tsx` 单一导出组件。

## 7. 错误处理与边界

- 预览按 id 拉取失败：tab 内显示重试，不影响对话与其它 tab。
- `previewResumeId` 指向的简历已被删除：预览显示"该简历已删除"，下拉回落到首个可用简历或空态。
- 变更模型解析容错：无法识别的工具归为 `read`/通用条目，不抛错。
- 画布数据全部会话级；切换/删除会话时随消息重建，无残留。
- 写入路径修正后，`update_current_resume_field` 对"未打开任何简历"仍返回既有错误提示。
- reduced-motion：画布展开/折叠与预览刷新过渡遵循系统设置。

## 8. 验证与验收

本仓库不新增测试文件。实现后依次运行：

```bash
pnpm exec eslint <S6 改动文件>
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

### 桌面验收

- 三栏布局；画布可折叠、刷新后保持折叠状态。
- 简历预览默认显示当前编辑简历；下拉可切任意简历；AI `open_resume`/`create_resume` 后预览联动切换。
- AI 改简历字段并确认后：字段真正落库（重进编辑器可见），画布预览刷新出新内容。
- AI 动看板/版本后，对应 tab 出现并高亮/标注本轮变更；变更记录 tab 汇总全部写操作，可展开 diff/摘要。
- 对话内每个工具调用显示为带图标条目，「在画布中查看」正确联动 tab。

### 窄屏验收

- 画布改为全屏 Sheet，由 Chat Header 按钮唤起；无 ARIA 告警。

### Agent 回归

- 切换会话 / 返回工作台 / 卸载页面时，进行中的 run 与画布状态正确清理，不串台。
- 读操作不弹确认；写操作仍走确认卡；取消的写操作在画布标注"已取消"。

## 9. 实施边界

S6 作为一个实现计划，按以下顺序分阶段验证：

1. Store/常量/类型 + 布局三栏骨架（画布空壳可折叠 / 移动 Sheet）。
2. `deriveCanvasModel` + `use-canvas-model` + 对话内联条目升级。
3. 简历预览 tab（含 `use-canvas-preview` 拉取/联动）+ 写入路径修正。
4. 看板快照 tab + 版本时间线 tab + 变更记录 tab + 联动。
5. 静态检查、构建与桌面/窄屏人工验收。

不得顺带重构其它页面，不得引入 Automerge 文档加载到助手页。
