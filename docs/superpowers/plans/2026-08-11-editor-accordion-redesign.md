# 桌面简历编辑区折叠列表改版 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。
> **本仓库约定：** 默认无测试；用 `npx tsc --noEmit` + `npx eslint <文件>` 代替单测；大文件编辑后立即回读确认无静默损坏；代码保持未提交待用户审阅，仅文档 commit；commit 结尾附 `Co-authored-by: TRAE CLI <noreply@bytedance.com>`。

**目标：** 桌面简历编辑区从横向标签（SideTabs）改为单开可折叠列表（Accordion）+ 竖向拖拽排序，删除桌面底部抽屉，表单按面板宽度自适应列数；手机端完全不变。

**架构：** 新增 `AccordionEditor`（受控 Accordion + `@hello-pangea/dnd` 竖向拖拽）与 `SectionRow`（单行：拖拽柄+图标+label+显隐 Switch+展开区承载 `ITEMS[i].content`）。`EditPanel` 外壳保留宽度拖拽/顶部条/滚动容器，滚动容器加 `@container/panel`。`use-edit-panel` 删除 mode。`editor/index.tsx` 桌面恒侧栏、删抽屉分支。12 个表单栅格类由视口断点改容器断点。

**技术栈：** React + TypeScript、Tailwind v4 容器查询、radix-ui Accordion（`@/components/ui/accordion`）、`@hello-pangea/dnd`、motion、zustand（`useResumeStore`）。

---

## 文件结构

新增：
- `src/pages/resume/editor/components/edit-panel/section-row.tsx` — 单个可折叠行（拖拽柄 + 图标 + label + Switch + AccordionTrigger/Content）。
- `src/pages/resume/editor/components/edit-panel/accordion-editor.tsx` — 受控 Accordion + 竖向 DragDropContext，组织 basics 固定行 + 可拖行。

修改：
- `src/pages/resume/editor/components/edit-panel/index.tsx` — 用 `AccordionEditor` 替换 `SidebarEditor`；删「抽屉」按钮；滚动容器加 `@container/panel`；透传 activeTabId/order/visibility/回调。
- `src/pages/resume/editor/hooks/use-edit-panel.ts` — 删除 mode（sidebar/drawer）及持久化，仅保留 `open` + 窄屏自动收起左导航。
- `src/pages/resume/editor/index.tsx` — 桌面恒为侧栏形态；删除桌面抽屉分支、`setMode`、「切换为侧栏」；手机分支保留 `Drawer`，其滚动容器加 `@container/panel`。
- 12 个表单：栅格类视口断点 → 容器断点（basic-resume、job-intent、application-info、edu-background、work-experience、internship-experience、campus-experience、project-experience、skill-specialty、honors-certificates、hobbies、basic-fields/custom-fields）。

保留不动：`src/components/ui/side-tabs/*`（手机端用）、`src/components/ui/accordion.tsx`、preview、use-scroll-to-section。

---

## 任务 1：SectionRow 单行组件

**文件：**
- 创建：`src/pages/resume/editor/components/edit-panel/section-row.tsx`

- [ ] **步骤 1：编写组件**

```tsx
import type { DraggableProvidedDraggableProps, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import type { ReactNode, Ref } from 'react'
import type { ORDERType, VisibilityItemsType } from '@/lib/schema'
import { GripVertical } from 'lucide-react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SectionRowProps {
  id: ORDERType
  label: string
  icon: ReactNode
  content: ReactNode
  visible: boolean
  /** basics 固定置顶：无拖拽柄、无显隐开关 */
  fixed?: boolean
  isDragging?: boolean
  innerRef?: Ref<HTMLDivElement>
  draggableProps?: DraggableProvidedDraggableProps
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  onToggleVisibility?: () => void
}

export function SectionRow({
  id,
  label,
  icon,
  content,
  visible,
  fixed = false,
  isDragging = false,
  innerRef,
  draggableProps,
  dragHandleProps,
  onToggleVisibility,
}: SectionRowProps) {
  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className={cn(
        'rounded-lg border bg-card transition-shadow',
        isDragging && 'shadow-lg',
        !visible && 'opacity-60',
      )}
    >
      <AccordionItem value={id} className="border-b-0">
        <div className="flex items-center gap-2 px-3">
          {!fixed
            ? (
                <span
                  {...dragHandleProps}
                  onPointerDownCapture={e => e.stopPropagation()}
                  className="shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                  aria-label={`拖动 ${label} 模块`}
                >
                  <GripVertical className="size-4" />
                </span>
              )
            : <span className="w-4 shrink-0" aria-hidden="true" />}

          <AccordionTrigger
            disabled={!visible}
            className="flex-1 py-3 hover:no-underline"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
              {label}
            </span>
          </AccordionTrigger>

          {!fixed && onToggleVisibility && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div onPointerDownCapture={e => e.stopPropagation()} className="shrink-0">
                  <Switch checked={visible} onCheckedChange={onToggleVisibility} aria-label={`显示或隐藏 ${label}`} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">{visible ? '点击隐藏该模块' : '点击显示该模块'}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <AccordionContent className="px-3 pb-4">
          {content}
        </AccordionContent>
      </AccordionItem>
    </div>
  )
}
```

- [ ] **步骤 2：类型/词法校验**

运行：`cd /Users/bytedance/Downloads/Github/resume && npx eslint src/pages/resume/editor/components/edit-panel/section-row.tsx`
预期：exit 0（`tsc` 在任务 3 接线后统一跑；此处仅 lint）。

> 说明：`AccordionTrigger` 的箭头图标由 `@/components/ui/accordion` 自带，无需额外加。默认 trigger 是 `items-start`，此处用 `items-center` 外层包裹已满足对齐。

---

## 任务 2：AccordionEditor 列表 + 竖向拖拽

**文件：**
- 创建：`src/pages/resume/editor/components/edit-panel/accordion-editor.tsx`

- [ ] **步骤 1：编写组件**

```tsx
import type { DropResult } from '@hello-pangea/dnd'
import type { ORDERType, VisibilityItemsType } from '@/lib/schema'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { useCallback } from 'react'
import { Accordion } from '@/components/ui/accordion'
import { ITEMS } from '../../const'
import { SectionRow } from './section-row'

interface AccordionEditorProps {
  activeTabId: ORDERType
  order: ORDERType[]
  visibilityState: Record<string, boolean>
  onActivate: (id: ORDERType) => void
  onUpdateOrder: (order: ORDERType[]) => void
  onToggleVisibility: (id: VisibilityItemsType) => void
}

const DROPPABLE_ID = 'resume-edit-panel-sections'

export function AccordionEditor({
  activeTabId,
  order,
  visibilityState,
  onActivate,
  onUpdateOrder,
  onToggleVisibility,
}: AccordionEditorProps) {
  const orderDraggable = order.filter(id => id !== 'basics')
  const basicsItem = ITEMS.find(item => item.id === 'basics')!

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result
    if (!destination || source.index === destination.index)
      return
    const next = [...orderDraggable]
    const [moved] = next.splice(source.index, 1)
    next.splice(destination.index, 0, moved)
    onUpdateOrder(['basics', ...next])
  }, [orderDraggable, onUpdateOrder])

  // 受控单开：展开非空项才切换 activeTab 并滚动；收起（空串）不改 activeTab
  const handleValueChange = useCallback((value: string) => {
    if (value)
      onActivate(value as ORDERType)
  }, [onActivate])

  return (
    <Accordion
      type="single"
      collapsible
      value={activeTabId}
      onValueChange={handleValueChange}
      className="flex flex-col gap-2"
    >
      <SectionRow
        id="basics"
        label={basicsItem.label}
        icon={basicsItem.icon}
        content={basicsItem.content}
        visible={!visibilityState.basics}
        fixed
      />

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={DROPPABLE_ID} direction="vertical">
          {droppable => (
            <div
              ref={droppable.innerRef}
              {...droppable.droppableProps}
              className="flex flex-col gap-2"
            >
              {orderDraggable.map((id, index) => {
                const item = ITEMS.find(it => it.id === id)!
                const visibilityKey = item.id as VisibilityItemsType
                return (
                  <Draggable key={id} draggableId={id} index={index}>
                    {(draggable, snapshot) => (
                      <SectionRow
                        id={item.id}
                        label={item.label}
                        icon={item.icon}
                        content={item.content}
                        visible={!visibilityState[visibilityKey]}
                        isDragging={snapshot.isDragging}
                        innerRef={draggable.innerRef}
                        draggableProps={draggable.draggableProps}
                        dragHandleProps={draggable.dragHandleProps}
                        onToggleVisibility={() => onToggleVisibility(visibilityKey)}
                      />
                    )}
                  </Draggable>
                )
              })}
              {droppable.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </Accordion>
  )
}
```

- [ ] **步骤 2：lint**

运行：`npx eslint src/pages/resume/editor/components/edit-panel/accordion-editor.tsx`
预期：exit 0。

> 注意：`Draggable` 拖动时会 `position: fixed` 脱离文档流，被包在 `Accordion` 内部通常可用；如拖拽视觉异常，回退方案是在 SectionRow 拖拽态用 portal（复用 sortable-tab 的 `createPortal` 思路）。首轮先不加 portal，验证阶段确认。

---

## 任务 3：EditPanel 接入 AccordionEditor + 去抽屉按钮 + 容器查询

**文件：**
- 修改：`src/pages/resume/editor/components/edit-panel/index.tsx`

- [ ] **步骤 1：改 props 接口**（删 `onSwitchToDrawer`）

将 `EditPanelProps` 中的 `onSwitchToDrawer: () => void` 删除；`fill`/`stroke` 不再需要（Accordion 不用 SVG outline），一并从 props 删除。保留 `open/activeTabId/order/visibilityState/onActivate/onUpdateOrder/onToggleVisibility/onClose`。

- [ ] **步骤 2：替换 import 与顶部条**

- 删除 `import SidebarEditor from '../sidebar'`，改 `import { AccordionEditor } from './accordion-editor'`。
- 删除顶部条里「抽屉」那个 `Tooltip/Button`（`onClick={onSwitchToDrawer}`）整块，只留收起按钮。

- [ ] **步骤 3：滚动区加容器查询 + 换列表**

将原滚动容器与 `SidebarEditor` 用法替换为：

```tsx
{/* 仅此区域滚动；@container/panel 让内部表单按面板宽度自适应列数 */}
<div className="@container/panel min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
  <AccordionEditor
    activeTabId={activeTabId}
    order={order}
    visibilityState={visibilityState}
    onActivate={onActivate}
    onUpdateOrder={onUpdateOrder}
    onToggleVisibility={onToggleVisibility}
  />
</div>
```

- [ ] **步骤 4：回读确认**

运行：`Read` 整个 `edit-panel/index.tsx`，确认无重复/残留 `SidebarEditor`、`fill`、`stroke`、`onSwitchToDrawer`、「抽屉」按钮，且 motion.aside 外壳与宽度拖拽逻辑完好。

- [ ] **步骤 5：lint**

运行：`npx eslint src/pages/resume/editor/components/edit-panel/index.tsx`
预期：exit 0。

---

## 任务 4：use-edit-panel 删除 mode

**文件：**
- 修改：`src/pages/resume/editor/hooks/use-edit-panel.ts`

- [ ] **步骤 1：重写 hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSidebar } from '@/components/ui/sidebar'

const PANEL_WIDTH = 420 // 编辑侧栏参考宽度（用于让位判断）
const PREVIEW_MIN = 794 // A4 内容自然宽度（缩放前）
const NAV_WIDTH = 256 // 左侧 App 导航展开宽度

/**
 * 桌面编辑面板状态：仅开关 + 窄屏自动收起左侧 App 导航让位。
 * 打开且横向空间不足时自动收起左导航，关闭时仅恢复「我们收起的那次」。
 * 均为本地 UI 态，不参与协作同步。
 */
export function useEditPanel() {
  const { open: navOpen, setOpen: setNavOpen } = useSidebar()
  const [open, setOpen] = useState(false)
  const autoCollapsedRef = useRef(false)

  const evaluate = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      if (navOpen && window.innerWidth - PANEL_WIDTH - PREVIEW_MIN < NAV_WIDTH) {
        autoCollapsedRef.current = true
        setNavOpen(false)
      }
    }
    else if (autoCollapsedRef.current) {
      autoCollapsedRef.current = false
      setNavOpen(true)
    }
  }, [navOpen, setNavOpen])

  useEffect(() => {
    evaluate(open)
  // 仅在 open 变化时评估让位
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return { open, setOpen }
}
```

- [ ] **步骤 2：lint**

运行：`npx eslint src/pages/resume/editor/hooks/use-edit-panel.ts`
预期：exit 0。

---

## 任务 5：editor/index.tsx 桌面恒侧栏、删抽屉分支

**文件：**
- 修改：`src/pages/resume/editor/index.tsx`

- [ ] **步骤 1：改 useEditPanel 解构与 useSidebarMode**

- `const { open: panelOpen, setOpen: setPanelOpen } = useEditPanel()`（删 `mode/setMode`）。
- `const useSidebarMode = !isMobile`（桌面恒侧栏）。

- [ ] **步骤 2：EditPanel 用法去掉 onSwitchToDrawer/fill/stroke**

```tsx
<EditPanel
  open={panelOpen}
  activeTabId={activeTabId}
  order={order}
  visibilityState={visibilityState}
  onActivate={handleActivateWithScroll}
  onUpdateOrder={updateOrder}
  onToggleVisibility={toggleVisibility}
  onClose={() => setPanelOpen(false)}
/>
```

- [ ] **步骤 3：三元分支改为「桌面侧栏 / 手机抽屉」**

`useSidebarMode ? (桌面侧栏块，原样保留) : (手机抽屉块)`。手机抽屉块中：
- 删除底部「切换为侧栏」按钮（`!isMobile && ...setMode('sidebar')` 整块）——因为该分支现在只可能是手机。
- 抽屉滚动容器加容器查询：`<div className="@container/panel p-4 overflow-y-auto overflow-x-hidden">`。
- 由于桌面恒侧栏，`Drawer` 的 `DrawerTrigger` 浮动按钮 `size` 恒为 `icon`，`{!isMobile && '编辑简历'}` 可简化为不显示文字（该分支仅手机）——保留现状也可，但删除无效的 `!isMobile` 判断更干净：`size="icon"`，仅图标。

- [ ] **步骤 4：清理未用 import**

若 `fill`/`stroke` 计算（`theme` 相关）在文件内已无其他使用，删除对应变量与 `useTheme`（先 grep 确认 `fill`/`stroke`/`theme` 是否仅服务旧用法）。`SidebarEditor` import 若仅手机抽屉分支仍用则保留（手机抽屉块仍渲染 `SidebarEditor`）——确认后再决定。

- [ ] **步骤 5：回读确认**

`Read` 整个 `editor/index.tsx`，确认无 `mode`/`setMode`/`onSwitchToDrawer`/「切换为侧栏」，桌面走 EditPanel、手机走 Drawer+SidebarEditor，无重复 JSX。

- [ ] **步骤 6：lint**

运行：`npx eslint src/pages/resume/editor/index.tsx`
预期：exit 0。

---

## 任务 6：12 个表单栅格改容器查询

**文件（修改）：**
- `src/pages/resume/editor/components/forms/basic-resume/index.tsx:42`
- `src/pages/resume/editor/components/forms/job-intent/index.tsx:33`
- `src/pages/resume/editor/components/forms/application-info/index.tsx:27`
- `src/pages/resume/editor/components/forms/edu-background/index.tsx:50`
- `src/pages/resume/editor/components/forms/work-experience/index.tsx:46`
- `src/pages/resume/editor/components/forms/internship-experience/index.tsx:46`
- `src/pages/resume/editor/components/forms/campus-experience/index.tsx:46`
- `src/pages/resume/editor/components/forms/project-experience/index.tsx:46`
- `src/pages/resume/editor/components/forms/skill-specialty/index.tsx:161`
- `src/pages/resume/editor/components/forms/honors-certificates/index.tsx:143`
- `src/pages/resume/editor/components/forms/hobbies/index.tsx:144`
- `src/pages/resume/editor/components/forms/basic-fields/custom-fields/index.tsx:30`

- [ ] **步骤 1：按映射逐个替换栅格类**（保留 `grid gap-* justify-items-start` 等其余类不变，仅替换列断点）

映射规则（视口断点 → 容器 `/panel` 断点；语义：面板越宽列越多，窄面板单列）：

| 原类（列部分） | 新类（列部分） |
| --- | --- |
| `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` | `@md/panel:grid-cols-2 @2xl/panel:grid-cols-3 @4xl/panel:grid-cols-4` |
| `sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4` | `@md/panel:grid-cols-2 @4xl/panel:grid-cols-4` |
| `sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | `@md/panel:grid-cols-2 @2xl/panel:grid-cols-3` |
| `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | `grid-cols-1 @md/panel:grid-cols-2 @2xl/panel:grid-cols-3` |
| `grid-cols-2 md:grid-cols-4 lg:grid-cols-6` | `grid-cols-2 @xl/panel:grid-cols-4 @3xl/panel:grid-cols-6` |
| `sm:grid-cols-2 md:grid-cols-3`（custom-fields） | `@md/panel:grid-cols-2 @2xl/panel:grid-cols-3` |

逐文件对应：
- basic-resume:42 `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` → `@md/panel:grid-cols-2 @2xl/panel:grid-cols-3 @4xl/panel:grid-cols-4`
- job-intent:33 `sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4` → `@md/panel:grid-cols-2 @4xl/panel:grid-cols-4`
- application-info:27 `sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4` → `@md/panel:grid-cols-2 @4xl/panel:grid-cols-4`
- edu-background:50 `sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4` → `@md/panel:grid-cols-2 @4xl/panel:grid-cols-4`
- work-experience:46 `sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3` → `@md/panel:grid-cols-2 @2xl/panel:grid-cols-3`
- internship-experience:46 同上 → `@md/panel:grid-cols-2 @2xl/panel:grid-cols-3`
- campus-experience:46 同上 → `@md/panel:grid-cols-2 @2xl/panel:grid-cols-3`
- project-experience:46 同上 → `@md/panel:grid-cols-2 @2xl/panel:grid-cols-3`
- skill-specialty:161 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` → `grid-cols-1 @md/panel:grid-cols-2 @2xl/panel:grid-cols-3`
- honors-certificates:143 `grid-cols-2 md:grid-cols-4 lg:grid-cols-6` → `grid-cols-2 @xl/panel:grid-cols-4 @3xl/panel:grid-cols-6`
- hobbies:144 `grid-cols-2 md:grid-cols-4 lg:grid-cols-6` → `grid-cols-2 @xl/panel:grid-cols-4 @3xl/panel:grid-cols-6`
- custom-fields:30 `sm:grid-cols-2 md:grid-cols-3` → `@md/panel:grid-cols-2 @2xl/panel:grid-cols-3`

- [ ] **步骤 2：确认容器上下文存在**

容器名 `panel` 由任务 3（EditPanel 滚动区）与任务 5（手机抽屉滚动区）的 `@container/panel` 提供。表单本身不需再声明容器。

- [ ] **步骤 3：grep 校验无遗漏**

运行：`grep -rn "md:grid-cols-\|lg:grid-cols-\|sm:grid-cols-" src/pages/resume/editor/components/forms`
预期：无输出（全部已改为 `@*/panel:`）。

---

## 任务 7：整体验证

- [ ] **步骤 1：类型检查**

运行：`cd /Users/bytedance/Downloads/Github/resume && npx tsc --noEmit`
预期：exit 0。

- [ ] **步骤 2：lint 全部改动文件**

运行：`npx eslint src/pages/resume/editor/index.tsx src/pages/resume/editor/hooks/use-edit-panel.ts src/pages/resume/editor/components/edit-panel/index.tsx src/pages/resume/editor/components/edit-panel/accordion-editor.tsx src/pages/resume/editor/components/edit-panel/section-row.tsx $(grep -rl "@md/panel\|@xl/panel" src/pages/resume/editor/components/forms)`
预期：exit 0（不含既存无关告警，如 self-evaluation 的 import 排序，若报到则不属本次范围）。

- [ ] **步骤 3：孤儿引用检查**

运行：`grep -rn "onSwitchToDrawer\|EditPanelMode\|setMode\|edit-panel-mode" src/pages/resume/editor`
预期：无输出。

- [ ] **步骤 4：人工核对清单（用户浏览器）**

- 桌面：无横向标签 / 无 SVG 连接条；折叠列表从上到下单列。
- 点表头展开对应模块，渲染区同步滚动到该章节。
- 抓 `⋮⋮` 竖向拖拽排序生效，且不误触发展开/开关。
- 显隐 Switch 生效；隐藏项表头置灰、不可展开。
- 面板拖窄 → 表单单列；拖宽 → 多列。
- 无第二滚动条；收起后右下角浮动「编辑简历」。
- 手机端：仍是底部抽屉 + 原横向标签，行为不变。

---

## 自检结论

- **规格覆盖度：** 单开折叠(任务2)、展开滚动(任务2 handleValueChange + editor 的 handleActivateWithScroll)、拖拽(任务1/2)、显隐(任务1/2)、删抽屉(任务4/5)、容器查询表单(任务3/5/6)、外壳保留(任务3)、协作不变(activeTab/visibility/order 仍走 store，未改 store)——均有对应任务。
- **占位符扫描：** 无 TODO/待定；代码块完整。
- **类型一致性：** `SectionRow` props 与 `AccordionEditor` 调用一致；`ORDERType`/`VisibilityItemsType` 来自 `@/lib/schema`；`ITEMS[i].content` 为 `ReactNode`（见 const.ts）。
