# 全仓库 Motion 拖拽统一实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将仓库内所有列表排序和跨容器移动从 `@hello-pangea/dnd` 统一迁移到可靠、可滚动、首次即可拖动的 Motion 方案。

**架构：** 简单单列表使用共享的 Motion Reorder 草稿/提交原语；模板结构和求职看板使用共享的跨列表指针传感器、碰撞计算与 Motion 浮层。页面只保留业务数据提交，拖动过程不反复写 Zustand、Automerge 或服务端。

**技术栈：** React 19、TypeScript、motion/react、Tailwind CSS、Zustand、Base UI Drawer

---

## 文件结构

- 创建 `src/lib/motion-drag.ts`：无 DOM 的重排、目标容器和插入位置计算。
- 创建 `src/components/ui/motion-reorder.tsx`：单列表草稿、键盘移动、统一动画与边缘滚动。
- 创建 `src/components/ui/cross-list-drag.tsx`：跨列表注册、指针生命周期、Motion 浮层和清理。
- 创建 `scripts/verify-motion-drag.ts`：验证纯函数、入口迁移和旧依赖清理。
- 修改 `src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx`：复用共享单列表行为。
- 修改 `src/pages/resume/editor/components/sidebar/index.tsx`：桌面横向标签迁移到 Motion。
- 修改 `src/pages/resume/editor/components/sidebar/sortable-tab.tsx`：移除第三方拖拽 props/Portal，保留手柄。
- 修改 `src/pages/resume/editor/components/edit-panel/accordion-editor.tsx`：纵向折叠模块迁移到 Motion。
- 修改 `src/pages/resume/editor/components/edit-panel/section-row.tsx`：接入 Motion 控制器，保留紧凑拖动态。
- 修改 `src/pages/template/components/editor/structure-panel.tsx`：栏内排序和跨栏移动迁移到共享跨列表控制器。
- 修改 `src/pages/tracker/components/board/index.tsx`：职位卡片跨列状态变更迁移到共享跨列表控制器。
- 修改 `package.json`、`pnpm-lock.yaml`：删除 `@hello-pangea/dnd`，增加验证命令。
- 修改 `docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md`：记录上一批评论/Drawer 修复的最终验证。
- 创建 `docs/superpowers/verification/2026-08-14-unified-motion-drag.md`：记录本次静态和交互证据。

### 任务 0：固化评论与 Drawer 修复基线

**文件：**
- 修改：当前工作区中尚未提交的评论、Drawer、移动排序和分享管理文件
- 修改：`docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md`

- [ ] **步骤 1：运行现有评论验证**

运行：

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
pnpm exec tsc -b --pretty false
pnpm build
git diff --check
```

预期：全部命令退出码为 0；构建无 TypeScript 或 Vite 错误。

- [ ] **步骤 2：记录已完成的浏览器交互证据**

在验证文档中记录：评论 Drawer、分享 Drawer、嵌套排序 Drawer 均可滚动；移动端排序第一次拖动生效；控制台无触摸取消、ARIA 或 React 警告。

- [ ] **步骤 3：提交基线**

```bash
git add docs/superpowers/plans/2026-08-14-comment-read-and-mobile-nested-drawer.md \
  docs/superpowers/specs/2026-08-14-comment-read-and-mobile-nested-drawer-design.md \
  docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md \
  scripts/verify-resume-comment-client.ts src/components/ui/drawer.tsx \
  src/features/resume-comments src/pages/resume/editor src/pages/share
git commit -m "fix(comments): 收口已读状态与移动端抽屉交互"
```

### 任务 1：实现共享 Motion 拖拽基础能力

**文件：**
- 创建：`src/lib/motion-drag.ts`
- 创建：`src/components/ui/motion-reorder.tsx`
- 创建：`src/components/ui/cross-list-drag.tsx`
- 创建：`scripts/verify-motion-drag.ts`

- [ ] **步骤 1：实现无 DOM 的顺序与碰撞函数**

核心接口：

```ts
export interface DragPoint { x: number, y: number }
export interface DragRect { id: string, top: number, right: number, bottom: number, left: number }
export interface DropDestination { containerId: string, index: number }

export function moveArrayItem<T>(items: T[], from: number, to: number): T[]
export function findDropContainer(point: DragPoint, containers: DragRect[]): string | null
export function findDropIndex(point: DragPoint, items: DragRect[], axis: 'x' | 'y'): number
```

`findDropContainer` 只接受点落入的已注册容器；`findDropIndex` 按目标主轴中心点返回 `0..items.length`。

- [ ] **步骤 2：实现单列表共享 Hook 和边缘滚动**

核心接口：

```ts
export function useMotionReorder<T>({
  values,
  axis,
  onCommit,
}: {
  values: T[]
  axis: 'x' | 'y'
  onCommit: (values: T[]) => void
}): {
  draft: T[]
  setDraft: React.Dispatch<React.SetStateAction<T[]>>
  dragging: boolean
  startDragging: () => void
  finishDragging: () => void
  moveByKeyboard: (value: T, direction: -1 | 1) => void
}
```

拖动过程中只更新 `draft`，`finishDragging` 比较初始快照后最多提交一次。共享 `autoScrollAtEdge(container, point, axis)` 只滚动对应轴。

- [ ] **步骤 3：实现跨列表 Provider**

核心接口：

```ts
export interface CrossListDropResult {
  itemId: string
  sourceId: string
  sourceIndex: number
  destinationId: string
  destinationIndex: number
}

export function CrossListDragProvider(props: {
  onDrop: (result: CrossListDropResult) => void
  renderOverlay: (itemId: string) => React.ReactNode
  children: React.ReactNode
}): React.ReactNode

export function useCrossListContainer(options: {
  id: string
  itemIds: string[]
  axis?: 'x' | 'y'
  scrollRef?: React.RefObject<HTMLElement | null>
}): { ref: React.RefCallback<HTMLElement>, active: boolean, destinationIndex: number | null }

export function useCrossListItem(options: {
  id: string
  containerId: string
  index: number
}): { dragging: boolean, getDragProps: () => React.HTMLAttributes<HTMLElement> }
```

Provider 使用 Pointer Events 管理单一活动拖拽；浮层通过 Portal 渲染到 `document.body`，使用 Motion 位移，`pointer-events: none`。交互控件后代不启动拖拽；`pointercancel`、`blur`、卸载都执行同一清理函数。

- [ ] **步骤 4：添加验证脚本**

验证至少覆盖：

```ts
assert.deepEqual(moveArrayItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a'])
assert.equal(findDropContainer({ x: 20, y: 20 }, rects), 'main')
assert.equal(findDropIndex({ x: 20, y: 75 }, itemRects, 'y'), 1)
```

并读取源码断言 Provider 处理 `pointercancel`、`cancelable` 和清理逻辑。

- [ ] **步骤 5：运行基础验证并提交**

```bash
node --experimental-strip-types scripts/verify-motion-drag.ts
pnpm exec tsc -b --pretty false
git diff --check
git add src/lib/motion-drag.ts src/components/ui/motion-reorder.tsx \
  src/components/ui/cross-list-drag.tsx scripts/verify-motion-drag.ts
git commit -m "feat(drag): 添加 Motion 拖拽基础能力"
```

### 任务 2：迁移简历编辑器单列表排序

**文件：**
- 修改：`src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx`
- 修改：`src/pages/resume/editor/components/sidebar/index.tsx`
- 修改：`src/pages/resume/editor/components/sidebar/sortable-tab.tsx`
- 修改：`src/pages/resume/editor/components/edit-panel/accordion-editor.tsx`
- 修改：`src/pages/resume/editor/components/edit-panel/section-row.tsx`
- 修改：`scripts/verify-motion-drag.ts`

- [ ] **步骤 1：迁移桌面横向标签**

使用：

```tsx
<Reorder.Group axis="x" values={draft} onReorder={setDraft} as="div">
  {draft.map(id => (
    <Reorder.Item key={id} value={id} dragListener={false} dragControls={controls}>
      <SortableTab />
    </Reorder.Item>
  ))}
</Reorder.Group>
```

拖动只从原有 `GripVertical` 手柄启动；Switch 和 Tab 点击继续工作；结束时提交 `['basics', ...draft]`。

- [ ] **步骤 2：迁移纵向 Accordion**

使用同一草稿 Hook 和 `Reorder.Group axis="y"`。开始拖动时记录 `draggingId`，`SectionRow` 只渲染紧凑表头；结束后恢复内容并提交一次顺序。

- [ ] **步骤 3：让移动 Drawer 复用共享行为**

保留当前默认 Drawer、拖拽手柄、`data-base-ui-swipe-ignore` 和滚动布局，仅删除重复的草稿、键盘移动和边缘滚动代码。

- [ ] **步骤 4：验证并提交**

```bash
node --experimental-strip-types scripts/verify-motion-drag.ts
pnpm exec tsc -b --pretty false
pnpm exec eslint \
  src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx \
  src/pages/resume/editor/components/sidebar/index.tsx \
  src/pages/resume/editor/components/sidebar/sortable-tab.tsx \
  src/pages/resume/editor/components/edit-panel/accordion-editor.tsx \
  src/pages/resume/editor/components/edit-panel/section-row.tsx
git diff --check
git add src/pages/resume/editor/components scripts/verify-motion-drag.ts
git commit -m "refactor(editor): 统一模块排序为 Motion"
```

### 任务 3：迁移模板结构面板跨栏拖拽

**文件：**
- 修改：`src/pages/template/components/editor/structure-panel.tsx`
- 修改：`scripts/verify-motion-drag.ts`

- [ ] **步骤 1：接入跨列表 Provider**

`main` 和 `sidebar` 分别注册容器及当前 `sectionId` 列表；卡片整行接入 `getDragProps()`，Switch 继续停止传播并被交互控件过滤器排除。

- [ ] **步骤 2：提交栏内与跨栏结果**

```ts
if (sourceId === destinationId) {
  applyManifest(reorderSections(manifest, sourceId, moveArrayItem(ids, sourceIndex, destinationIndex)))
}
else {
  applyManifest(moveSectionRegion(manifest, itemId, destinationId, destinationIndex))
}
```

空栏也必须注册为有效目标；无效落点不更新 manifest。

- [ ] **步骤 3：添加浮层、目标高亮和插入提示**

浮层复用卡片的标题与 sectionId，但不渲染可交互 Switch；拖动源卡片降为 `opacity-40`，目标栏使用现有 `border-primary bg-primary/5` 视觉。

- [ ] **步骤 4：验证并提交**

```bash
node --experimental-strip-types scripts/verify-motion-drag.ts
pnpm exec tsc -b --pretty false
pnpm exec eslint src/pages/template/components/editor/structure-panel.tsx
git diff --check
git add src/pages/template/components/editor/structure-panel.tsx scripts/verify-motion-drag.ts
git commit -m "refactor(template): 迁移结构面板 Motion 拖拽"
```

### 任务 4：迁移求职看板跨列拖拽

**文件：**
- 修改：`src/pages/tracker/components/board/index.tsx`
- 修改：`scripts/verify-motion-drag.ts`

- [ ] **步骤 1：注册看板列和整卡拖拽**

每个展开列注册为跨列表容器；折叠的“已终止”列不接受落点。职位卡片保持无手柄，Provider 自动排除卡片内部按钮、链接和表单控件。

- [ ] **步骤 2：复用业务提交和确认**

`onDrop` 只在 `sourceId !== destinationId` 时处理。普通列调用 `commitMove`；`offer` 和 `rejected` 继续写入 `pendingMove` 并显示原有 `AlertDialog`。

- [ ] **步骤 3：统一边缘自动滚动**

注册看板横向滚动容器和每列纵向滚动容器；拖动点进入左右 120px 区域时滚动看板，进入列上下边缘时滚动当前列。删除旧的全局 `mousemove` 和 `isDraggingRef`。

- [ ] **步骤 4：验证并提交**

```bash
node --experimental-strip-types scripts/verify-motion-drag.ts
pnpm exec tsc -b --pretty false
pnpm exec eslint src/pages/tracker/components/board/index.tsx
git diff --check
git add src/pages/tracker/components/board/index.tsx scripts/verify-motion-drag.ts
git commit -m "refactor(tracker): 迁移看板 Motion 跨列拖拽"
```

### 任务 5：删除旧依赖并完成全量验证

**文件：**
- 修改：`package.json`
- 修改：`pnpm-lock.yaml`
- 修改：`scripts/verify-motion-drag.ts`
- 创建：`docs/superpowers/verification/2026-08-14-unified-motion-drag.md`

- [ ] **步骤 1：移除旧依赖**

运行：

```bash
pnpm remove @hello-pangea/dnd
```

确认 `package.json` 和 `pnpm-lock.yaml` 不再包含该包。

- [ ] **步骤 2：运行全量静态验证**

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
node --experimental-strip-types scripts/verify-motion-drag.ts
pnpm exec tsc -b --pretty false
pnpm lint
pnpm build
git diff --check
```

预期：全部退出码为 0；源码扫描没有旧拖拽 API。

- [ ] **步骤 3：浏览器交互验证**

逐项验证：

1. 移动端排序 Drawer 第一次从手柄拖动成功，同时列表可滚动；
2. 桌面横向标签第一次拖动成功，Switch 和 Tab 点击不误触；
3. Accordion 展开项拖动时紧凑展示，落下后内容恢复；
4. 模板主栏内排序、跨到侧栏、空栏落点均成功；
5. 看板卡片跨普通列成功，跨终态列显示确认，取消不更新；
6. 所有页面控制台无触摸取消、ARIA、React 更新深度错误。

- [ ] **步骤 4：记录证据并提交**

```bash
git add package.json pnpm-lock.yaml scripts/verify-motion-drag.ts \
  docs/superpowers/verification/2026-08-14-unified-motion-drag.md
git commit -m "chore(drag): 移除旧拖拽依赖并补齐验证"
```

### 任务 6：代码审查与最终收口

**文件：**
- 修改：审查发现需要修复的对应文件

- [ ] **步骤 1：请求代码审查**

审查范围从规格提交 `16b2e19` 到当前 HEAD，并要求重点检查：指针监听清理、滚动竞争、交互控件误触、跨列表索引、业务状态提交次数和 reduced-motion。

- [ ] **步骤 2：修复 Critical/Important 反馈**

每一项反馈都以源码和交互验证复核；Minor 只在不扩大范围时处理。

- [ ] **步骤 3：重新运行最终门禁**

```bash
node --experimental-strip-types scripts/verify-motion-drag.ts
pnpm exec tsc -b --pretty false
pnpm lint
pnpm build
git diff --check
git status --short
```

预期：所有命令退出码为 0，仅存在明确准备提交的文件。

- [ ] **步骤 4：提交审查修复**

```bash
git add src scripts docs package.json pnpm-lock.yaml
git commit -m "fix(drag): 收口 Motion 拖拽交互边界"
```
