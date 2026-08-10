# 简历编辑器桌面侧栏重构 实现计划

> **面向 AI 代理的工作者：** 用 superpowers:executing-plans 逐任务实现，步骤用 `- [ ]` 跟踪。
>
> **本仓库特例：** 「不需要写测试」——用 `tsc --noEmit` + `eslint` 验证，纯逻辑用一次性 node 脚本。**大文件编辑后立即 readback + tsc**（此仓库有静默损坏史）。用户可见文案轻量口语化。仅桌面端改动，移动端保持现有 Drawer。

**目标：** 桌面编辑栏改为右侧常驻侧栏；渲染区向左平移让位、可独立滚动/操作、不被遮黑；空间不足时自动收起左侧 App 导航；点章节 tab 让渲染区滚到该章节；竖向 tab + 保留拖拽；协作适配。

**架构：** `editor/index.tsx` 桌面分支改 flex 两栏（渲染区 + 右侧 `EditPanel`），移动端保留 Drawer；`EditPanel` 复用 `SidebarEditor` 表单、tab 改竖向 DnD；runtime 加 `data-section` 锚点；新 hook 管「滚到 section（换算 scale）」+「空间不足收左导航」；`collaboration-ui-sync` 停广播抽屉态、远端 activeTabId 触发本地滚动。

**技术栈：** React + Zustand + Tailwind + `@hello-pangea/dnd` + `useSidebar`（App 导航控制）+ react-to-print（不动）。

---

## 文件结构

- 改 `src/components/resume/runtime/ResumeTemplateRuntime.tsx` — `renderSection` 包 `data-section` 锚点。
- 新 `src/pages/resume/editor/hooks/use-scroll-to-section.ts` — 滚到 section（换算 scale）。
- 新 `src/pages/resume/editor/hooks/use-edit-panel.ts` — 桌面编辑面板状态（形态/开关 + 空间不足收左导航 + localStorage）。
- 新 `src/pages/resume/editor/components/edit-panel/index.tsx` — 右侧常驻侧栏容器。
- 新 `src/pages/resume/editor/components/edit-panel/vertical-tabs.tsx` — 竖向可拖拽 tab 列。
- 改 `src/pages/resume/editor/components/sidebar/index.tsx` — 加 `orientation` 支持复用（或抽出表单区）。
- 改 `src/pages/resume/editor/index.tsx` — 桌面 flex 两栏 + 形态切换；移动端 Drawer 分支保留。
- 改 `src/pages/resume/editor/components/collaboration/collaboration-ui-sync/index.tsx` — 停广播抽屉态；远端 activeTabId → 本地滚动。

---

## 任务 1：渲染区 section 锚点

**文件：** 修改 `src/components/resume/runtime/ResumeTemplateRuntime.tsx`

- [ ] **步骤 1：`renderSection` 用 `data-section` div 包裹**

把 `renderSection` 的返回改为（basics 也包，供「滚到顶部/basics」用）：

```tsx
function renderSection(section: ResolvedTemplateManifest['sections'][number], data: TemplateResumeData) {
  const Renderer = sectionRendererRegistry[section.renderer]
  const orderKey = sectionRendererOrderKeyMap[section.renderer]

  if (!Renderer || !section.visible) {
    return null
  }

  if (orderKey && !data.order.includes(orderKey)) {
    return null
  }

  return (
    <div key={`${section.sectionId}-${section.order}`} data-section={orderKey ?? section.renderer}>
      <Renderer />
    </div>
  )
}
```

- [ ] **步骤 2：验证布局未被 div 破坏**

运行：`npx tsc --noEmit && npx eslint src/components/resume/runtime/ResumeTemplateRuntime.tsx`
预期：exit 0。
**人工确认**（关键）：渲染区 section 间距/分栏未变形（wrapper div 成为 skeleton flex 子项，`gap` 仍作用于它）。若变形，改为给 wrapper 加 `className="contents"` 不可行（contents 无法 getBoundingClientRect），改为在 skeleton 层透传——但优先验证简单方案。

- [ ] **步骤 3：Commit**

```bash
git add src/components/resume/runtime/ResumeTemplateRuntime.tsx
git commit -m "feat(resume): 渲染区章节加 data-section 锚点"
```

---

## 任务 2：滚动到 section 的 hook

**文件：** 创建 `src/pages/resume/editor/hooks/use-scroll-to-section.ts`

前置事实：`previewScrollRef` 是渲染区滚动容器（`preview/index.tsx:119`）；渲染内容被 `transform: scale()` 缩放；锚点在 `[data-resume-content]` 内（多页克隆需取首个）。

- [ ] **步骤 1：写 hook**

```ts
import type { RefObject } from 'react'
import { useCallback } from 'react'
import type { ORDERType } from '@/lib/schema'

export function useScrollToSection(scrollContainerRef: RefObject<HTMLElement | null>) {
  return useCallback((sectionKey: ORDERType) => {
    const container = scrollContainerRef.current
    if (!container)
      return

    // 多页克隆：只定位首页内容容器内的第一个匹配 section
    const scope = container.querySelector('[data-resume-content]') ?? container
    const target = scope.querySelector(`[data-section="${sectionKey}"]`) as HTMLElement | null

    // basics 或找不到锚点 → 滚到顶部
    if (!target || sectionKey === 'basics') {
      container.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // 用相对 rect 差值换算，兼容 transform: scale()（不能用 scrollIntoView）
    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - 16 // 顶部留 16px
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
  }, [scrollContainerRef])
}
```

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit && npx eslint src/pages/resume/editor/hooks/use-scroll-to-section.ts`
预期：exit 0。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/resume/editor/hooks/use-scroll-to-section.ts
git commit -m "feat(editor): 新增滚动到简历章节的 hook"
```

---

## 任务 3：桌面编辑面板状态 hook

**文件：** 创建 `src/pages/resume/editor/hooks/use-edit-panel.ts`

前置事实：编辑器在 `SidebarProvider` 内，可用 `useSidebar()`（`@/components/ui/sidebar`）拿 `setOpen`（控制左侧 App 导航）。桌面阈值：容器可用宽度不足以并列渲染区(约 794px)+侧栏(420px)时收左导航。

- [ ] **步骤 1：写 hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSidebar } from '@/components/ui/sidebar'

export type EditPanelMode = 'sidebar' | 'drawer'
const MODE_KEY = 'gresume:editor:edit-panel-mode'
const PANEL_WIDTH = 420
const PREVIEW_MIN = 794 // A4 内容自然宽度

export function useEditPanel() {
  const { open: navOpen, setOpen: setNavOpen } = useSidebar()
  const [mode, setModeState] = useState<EditPanelMode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as EditPanelMode) || 'sidebar'
    }
    catch {
      return 'sidebar'
    }
  })
  const [open, setOpen] = useState(false)
  // 记录是否「由我们自动收起了左导航」，以便关闭面板时仅恢复我们收起的那次
  const autoCollapsedRef = useRef(false)

  const setMode = useCallback((next: EditPanelMode) => {
    setModeState(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    }
    catch {}
  }, [])

  // 侧栏模式打开时，空间不足则自动收起左导航；关闭时恢复我们收起的那次
  useEffect(() => {
    if (mode !== 'sidebar')
      return
    if (open) {
      const available = window.innerWidth
      // 左导航约 256px；粗略判断：可用宽度 - 侧栏 - 预览最小 < 左导航宽度则需收起
      if (navOpen && available - PANEL_WIDTH - PREVIEW_MIN < 256) {
        autoCollapsedRef.current = true
        setNavOpen(false)
      }
    }
    else if (autoCollapsedRef.current) {
      autoCollapsedRef.current = false
      setNavOpen(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  return { mode, setMode, open, setOpen }
}
```

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit && npx eslint src/pages/resume/editor/hooks/use-edit-panel.ts`
预期：exit 0（若 `catch {}` 空块报 lint，改 `catch { /* ignore */ }`）。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/resume/editor/hooks/use-edit-panel.ts
git commit -m "feat(editor): 新增桌面编辑面板状态与左导航自动让位 hook"
```

---

## 任务 4：竖向可拖拽 tab 列

**文件：** 创建 `src/pages/resume/editor/components/edit-panel/vertical-tabs.tsx`

前置事实：现有横向 tab 用 `@hello-pangea/dnd` 的 `DragDropContext`/`Droppable`/`Draggable`（`sidebar/index.tsx:90-129`），`基本信息` 固定置顶，其余来自 `orderDraggable`。tab 元信息来自 `const.ts` 的 `ITEMS`（id/label/icon）。改为纵向：`Droppable direction="vertical"`。

- [ ] **步骤 1：写竖向 tab 组件**

（复刻现有横向 DnD 逻辑，`direction="vertical"`，样式改为纵向列表；点 tab 调 `onActivate(id)`；拖拽结束调 `onReorder`。完整代码按现有 `sidebar/index.tsx` 的 DnD 结构迁移，保留 `基本信息` 固定项 + 可拖项。）

关键结构：

```tsx
<DragDropContext onDragEnd={handleDragEnd}>
  {/* 固定：基本信息 */}
  <button data-active={activeTabId === 'basics'} onClick={() => onActivate('basics')}>基本信息</button>
  <Droppable droppableId="edit-tabs" direction="vertical">
    {provided => (
      <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1">
        {draggableItems.map((item, index) => (
          <Draggable key={item.id} draggableId={item.id} index={index}>
            {p => (
              <button ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                data-active={activeTabId === item.id} onClick={() => onActivate(item.id)}>
                <item.icon /> {item.label}
              </button>
            )}
          </Draggable>
        ))}
        {provided.placeholder}
      </div>
    )}
  </Droppable>
</DragDropContext>
```

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit && npx eslint src/pages/resume/editor/components/edit-panel/vertical-tabs.tsx`
预期：exit 0。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/resume/editor/components/edit-panel/vertical-tabs.tsx
git commit -m "feat(editor): 新增竖向可拖拽章节 tab 列"
```

---

## 任务 5：EditPanel 侧栏容器

**文件：** 创建 `src/pages/resume/editor/components/edit-panel/index.tsx`；按需微调 `sidebar/index.tsx` 复用表单区。

前置事实：表单区渲染核心是 `ViewPort`（按 activeTabId 显示对应 `ITEMS.content`）。协作控制条 `CollaborationControls` 现用 `DrawerHeader` 原语，侧栏里要换普通元素（给它加 `plain` 分支或新建轻量头部）。

- [ ] **步骤 1：写 EditPanel**

固定宽度 `w-[420px]`，`flex flex-col`，顶部协作控制条（普通元素），下面竖向 tab + 当前章节表单（复用 `ViewPort`/表单）。onActivate 同时 `onUpdateActiveTabId(id)` 并触发 `onScrollToSection(id)`（由父传入）。

- [ ] **步骤 2：协作控制条去 Drawer 依赖**

`CollaborationControls` 加一个 `plain?: boolean`（或新组件），为 true 时不用 `DrawerHeader/DrawerTitle/DrawerDescription`，改用 `<div>/<h*>`。侧栏传 `plain`。

- [ ] **步骤 3：验证**

运行：`npx tsc --noEmit && npx eslint src/pages/resume/editor/components/edit-panel src/pages/resume/editor/components/collaboration/collaboration-controls`
预期：exit 0。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/resume/editor/components/edit-panel src/pages/resume/editor/components/collaboration/collaboration-controls
git commit -m "feat(editor): 新增右侧编辑侧栏容器，协作控制条支持无 Drawer 形态"
```

---

## 任务 6：editor/index.tsx 桌面 flex 两栏 + 形态切换

**文件：** 修改 `src/pages/resume/editor/index.tsx`

前置事实：现结构见 `:79-124`。移动端（`isMobile`）保留 Drawer；桌面改为 `渲染区 + 右侧 EditPanel` flex 并列，渲染区 `flex-1`（侧栏占位后自然让位、ResizeObserver 重算 scale）。

- [ ] **步骤 1：引入 hooks + 组织桌面/移动分支**

用 `useEditPanel()` 拿 `mode/open/setOpen/setMode`；`useScrollToSection(previewScrollRef)` 拿 `scrollToSection`。桌面（`!isMobile && mode==='sidebar'`）渲染：

```tsx
<div className="flex min-h-screen">
  <div className="min-w-0 flex-1">
    <ResumePreview resumeRef={resumeRef} scrollContainerRef={previewScrollRef} />
  </div>
  <EditPanel
    open={open}
    activeTabId={activeTabId}
    order={order} visibilityState={visibilityState} fill={fill} stroke={stroke}
    onActivate={(id) => { updateActiveTabId(id); scrollToSection(id) }}
    onUpdateOrder={updateOrder} onToggleVisibility={toggleVisibility}
    onClose={() => setOpen(false)}
  />
</div>
```

- [ ] **步骤 2：浮动开关按钮 + 形态切换**

保留一个「编辑简历」浮动按钮 `setOpen(true)`；侧栏内提供关闭 + 切换到抽屉的入口（`setMode('drawer')`）。桌面 `mode==='drawer'` 或移动端 → 走现有 Drawer 分支。

- [ ] **步骤 3：立即 readback + 验证（大文件）**

Read 回 `editor/index.tsx` 确认无损坏；运行 `npx tsc --noEmit && npx eslint src/pages/resume/editor/index.tsx`。预期 exit 0。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/resume/editor/index.tsx src/pages/resume/editor/components/sidebar
git commit -m "feat(editor): 桌面编辑改右侧常驻侧栏，渲染区并列让位，保留抽屉备选"
```

---

## 任务 7：协作适配

**文件：** 修改 `src/pages/resume/editor/components/collaboration/collaboration-ui-sync/index.tsx`

前置事实：`useTabDrawerBroadcast` 现广播 `drawerOpen`；`useRemoteCollaborationAction` 收远端 activeTabId 调 `updateActiveTabId`（follow-mode）。

- [ ] **步骤 1：停止广播形态状态**

给 `useTabDrawerBroadcast` 的 drawerOpen 传常量（如 `false`）或移除该广播项，形态状态不再同步给协作者。

- [ ] **步骤 2：远端 activeTabId → 本地滚动**

远端 activeTabId 变更处，除 `updateActiveTabId` 外，调用 `scrollToSection(id)`（把 hook 的滚动函数经 props/context 传入，或在 runtime 内订阅 activeTabId 变化统一滚动——择一，保持单一职责）。

- [ ] **步骤 3：验证 + Commit**

运行：`npx tsc --noEmit && npx eslint src/pages/resume/editor/components/collaboration`
预期：exit 0。

```bash
git add src/pages/resume/editor/components/collaboration
git commit -m "feat(editor): 协作停止同步编辑栏形态，follow-mode 下渲染区跟随滚动"
```

---

## 任务 8：整体验证

- [ ] **步骤 1：全量 tsc + eslint**

运行：`npx tsc --noEmit && npx eslint src/pages/resume/editor src/components/resume/runtime`
预期：exit 0。

- [ ] **步骤 2：人工自检清单**
  - 桌面：开编辑侧栏 → 渲染区左移、可滚动可操作、不被遮黑；空间不足 → 左导航自动收起，关闭侧栏 → 恢复。
  - 点各 tab → 渲染区平滑滚到对应章节；basics → 滚到顶。
  - 竖向 tab 可拖拽排序，基本信息固定置顶。
  - 抽屉↔侧栏切换生效并记住（刷新后保持）。
  - 移动端：仍是底部抽屉 + 遮罩，无回归。
  - 协作：A 改富文本、B 侧栏开着 → 实时更新；follow-mode A 切 tab → B 渲染区跟随滚动；形态状态互不同步。

---

## 自检记录（作者已核对）

- **规格覆盖：** 去遮黑/独立滚动+平移让位(任务6)、锚点(任务1)+滚动(任务2)+接入(任务6/7)、侧栏形态(任务3/4/5/6)、协作(任务7)。移动端不动。
- **锚点方案** 采用「renderSection 包 div」单点改动，避免改 ~10 个 renderer；已标注需人工确认布局不变形。
- **左导航让位** 用 `useSidebar().setOpen`（编辑器在 SidebarProvider 内，已核实），仅恢复「我们收起的那次」。
- **类型一致：** `data-section` 值 = `orderKey`(ORDERType) = `activeTabId`；`useScrollToSection(sectionKey: ORDERType)`、`useEditPanel` 的 `mode`/`open` 贯穿一致。
- **大文件（editor/index.tsx、runtime）** 每次编辑后 readback+tsc。
- **无占位符**（任务4 竖向 tab 给了关键结构 + 明确「按现有 DnD 迁移」；任务5 协作控制条 plain 分支有明确做法）。
