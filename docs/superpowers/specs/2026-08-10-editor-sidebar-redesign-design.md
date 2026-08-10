# 简历编辑器桌面侧栏重构 设计

- 日期：2026-08-10
- 范围：**仅桌面端**（`md` 及以上）。移动端保持现有底部抽屉 + 遮罩不变。
- 目标：编辑栏不再遮黑/锁死渲染区；编辑与渲染互不干扰、各自可滚动可操作；点章节 tab 让渲染区滚到对应章节；桌面新增「右侧常驻侧栏」形态且不遮挡渲染区。

---

## 一、问题（已核实）

- 桌面编辑栏 = vaul 底部抽屉，带 `DrawerOverlay`（`fixed inset-0 z-50 bg-black/50`）→ 渲染区被黑化 + 捕获指针 → 打开编辑栏后渲染区无法滚动/操作。
- 抽屉关闭时表单**卸载**；连带一个潜在 bug：协作者改富文本时，本地抽屉若关闭，富文本编辑器未挂载 → Yjs→store 镜像不触发 → **预览不实时更新**（结构化字段走 Automerge 不受影响）。
- 章节 tab 与渲染区无任何滚动联动。

---

## 二、目标形态（桌面）

三栏协同：`左侧 App 导航 | 中间渲染区 | 右侧编辑侧栏`。

```
默认（侧栏关）:            侧栏开、空间充足:          侧栏开、空间不足:
┌──┬──────────────┐     ┌──┬───────────┬─────┐    ┌───────────┬─────┐
│导│   渲染区      │     │导│  渲染区    │编辑 │    │  渲染区    │编辑 │
│航│  (居中)       │  →  │航│ (左移)     │侧栏 │ 或 │ (左移)     │侧栏 │
│  │              │     │  │           │     │    │(左导航已收)│     │
└──┴──────────────┘     └──┴───────────┴─────┘    └───────────┴─────┘
```

**让位机制（关键，按用户明确要求）：**
- 右侧编辑侧栏为**固定宽度**（建议 `420px`，可后续微调），从右侧滑入。
- 中间渲染区**整体向左平移让位**，保持自身缩放比例，不重新压窄。渲染区用现有 `flex-1 overflow-auto` 容器，侧栏占位后其可用宽度自然减少、`ResumePreview` 的 `ResizeObserver` 会重算 scale——即渲染内容可能略微缩放以适应，但布局上是「并列、互不遮挡」，不是「盖在上面」。
- **空间不足时自动收起左侧 App 导航**：编辑侧栏打开时，若剩余宽度不足以容纳渲染区（阈值判断），调用 `useSidebar().setOpen(false)` 收起左侧 dashboard 导航腾出空间；关闭编辑侧栏时恢复到用户原来的左导航状态。

**形态切换：**
- 桌面默认 = 右侧常驻侧栏（本次主形态）。
- 保留「抽屉」作为可切换的备选形态（一个切换按钮，记住选择）。移动端强制抽屉。
- **形态状态（侧栏/抽屉、开/关、左导航是否被自动收起）均为本地 UI 态，不参与协作同步。**

---

## 三、编辑侧栏内部布局

- **竖向 tab 列**（左窄条）+ 右侧当前章节表单。tab 从上到下排列，适配窄高侧栏。
- **拖拽排序必须保留**：竖向 tab 列用 `@hello-pangea/dnd` 竖向 `Droppable`（现有横向 DnD 逻辑迁移为纵向）。`基本信息` 固定置顶不可拖，其余可拖（沿用现有 `orderDraggable` 规则）。
- 顶部保留协作控制条（手动保存 / 开启协作 / 同步状态）——从 `DrawerHeader` 原语换成普通元素（侧栏里没有 Drawer 上下文）。
- 章节可见性开关（toggle）沿用现有。

---

## 四、tab → 渲染区锚点滚动（跟随视角）

- **加章节锚点**：`RuntimeSection`（`src/components/resume/runtime/renderers/shared.tsx`）给 `<section>` 加 `data-section={orderKey}`；`orderKey` 从 `ResumeTemplateRuntime.renderSection` 透传（它已有 section→orderKey 映射，与 store 的 `activeTabId`/`ORDERType` 对齐）。
- **多页去重**：`PagedResumeShell` 跨页克隆 children，锚点会重复 → 滚动时只定位 `[data-resume-content]`（首页内容容器）内的**第一个**匹配 section。
- **滚动**：点 tab → `updateActiveTabId(id)`（现有）后，在 `previewScrollRef` 容器内 `scrollInto-view` 到该 section 锚点。需换算 scale transform（渲染内容被 `transform: scale()` 缩放，用 `getBoundingClientRect` 相对容器计算目标 scrollTop 而非直接 `scrollIntoView`，避免缩放导致偏移）。
- 单向：仅「点 tab → 滚渲染区」。不做反向（渲染区滚动高亮 tab）。
- `基本信息` 无独立 section 锚点时，滚到顶部。

---

## 五、协作适配

- **常驻侧栏 = 编辑器一直挂载** → 顺带修复富文本实时性 bug：Yjs→store 镜像持续运行，协作者改富文本时本地预览实时更新。（净收益）
- **停止广播抽屉状态**：`CollaborationUISync` 的 `useTabDrawerBroadcast` 目前广播 `drawerOpen`；形态状态不再同步 → 给它传常量或移除该广播，避免把无意义的本地形态状态发给协作者。
- **tab 跟随（activeTabId）**：现有协作已同步 `activeTabId`（follow-mode）。新增的「tab→滚渲染区」在收到**远端** activeTabId 变更时也应触发本地滚动（复用同一滚动函数），使 follow-mode 下渲染区也跟随。
- **awareness/光标**：屏幕级光标（`RealtimeCursors`，fixed 定位）不受形态影响；编辑器内协作光标（`CollaborationCaret`）现在因侧栏常驻而**更稳定**（编辑器不再频繁卸载重建，减少 ghost 光标）。
- **不改**：Automerge 文档同步、Yjs 富文本 session、startSharing 流程、字段级 `useResumeFormSync`。

---

## 六、组件结构（面向隔离）

- **新增** `editor/components/edit-panel/`：桌面右侧侧栏容器（固定宽度、可展开/收起、滑入动画、内部竖向 tab + 表单 + 协作控制条）。
- **复用** `SidebarEditor` 的表单渲染与 `ViewPort`；tab 列由横向改竖向（可能新增 `edit-panel/vertical-tabs.tsx`，或给 `SidebarEditor` 加 `orientation` 参数）。
- **改** `editor/index.tsx`：桌面用 flex 三栏布局（左导航由 DashboardShell 提供，编辑器内部只管「渲染区 + 右侧编辑侧栏」并列）；移动端保留 Drawer 分支。加「形态切换」按钮 + 形态本地状态（`localStorage` 记住）。
- **改** runtime renderer：加 section 锚点。
- **新增** `editor/hooks/use-scroll-to-section.ts`：封装「滚到某 section（换算 scale）」+ 「空间不足自动收左导航」逻辑。
- **改** `collaboration-ui-sync`：停止广播抽屉状态；远端 activeTabId 变更触发本地滚动。

---

## 七、边界 / 风险 / 验证

### 边界
- 移动端（`useIsMobile`）：完全走现有 Drawer 分支，本设计不触碰。
- 阈值判断「空间不足」：用容器实际宽度 vs 渲染内容自然宽度（A4 缩放前约 794px）+ 侧栏宽度做判断。
- 关闭编辑侧栏恢复左导航：记录打开前左导航的 open 状态，关闭时还原（若期间用户手动改过则以用户最后操作为准——简单起见，仅在「是我们自动收起的」情况下才自动恢复）。

### 风险
- 渲染区 `ResizeObserver` scale 重算 + 侧栏动画同时进行可能有布局抖动 → 侧栏用 CSS transform/width 过渡，动画结束再触发一次 measure。
- scale 换算滚动定位容易算错 → 用相对 `getBoundingClientRect` 差值，不用 `scrollIntoView`。
- 大文件编辑（`editor/index.tsx`、runtime renderer）—— 本仓库有静默损坏史，每次编辑后立即 `tsc` readback。

### 验证
- `tsc --noEmit` + `eslint` 改动文件全绿。
- 人工（桌面）：打开编辑侧栏→渲染区左移且可滚动可操作、不被遮黑；空间不足时左导航自动收起、关闭后恢复；点各 tab→渲染区滚到对应章节；抽屉↔侧栏切换记住；移动端仍是底部抽屉。
- 人工（协作）：两端开启协作，A 改富文本 B 的侧栏开着→实时；follow-mode 下 A 切 tab→B 渲染区跟随滚动；形态状态不互相同步。
- 本仓库默认不写持久化测试；纯逻辑（scale 滚动换算）可用一次性脚本验证。

### 非目标
- 反向锚点（渲染滚动高亮 tab）、渲染区平移的像素级动画曲线打磨、抽屉形态的二次美化——不在本轮。
