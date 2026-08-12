# TipTap 划词改写气泡定位优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 TipTap 划词改写气泡的首次定位、编辑器边界裁剪和滚动失步问题，并在完整工具条横向放不下时切换为 shadcn 省略号菜单。

**架构：** 保留 TipTap `BubbleMenuPlugin` 管理显示生命周期，宿主固定 Portal 到 `document.body`，通过真实 Range 行矩形和 Floating UI middleware 完成编辑器内定位。几何规则提取为纯函数并使用 Node test runner 做 TDD；完整菜单使用独立隐藏测量宿主获得固有宽度，渲染层根据编辑器可用宽度在完整工具条和 shadcn `DropdownMenu` 之间切换。

**技术栈：** React 19、TypeScript 5.9、TipTap 3.22.3、Floating UI DOM、Motion、shadcn/ui Radix、Node 22 test runner、Vite 7

**规格：** `docs/superpowers/specs/2026-08-12-tiptap-rewrite-bubble-positioning-design.md`

---

## 文件结构与职责

### 创建

- `src/components/ai-rewrite/utils/bubble-positioning.ts`
  - 保存不依赖浏览器 DOM 的矩形裁剪、合并和完整/紧凑/隐藏模式判定。
- `src/components/ai-rewrite/utils/bubble-positioning.test.ts`
  - 使用 Node 内置 test runner 覆盖几何和模式边界。
- `src/components/ai-rewrite/utils/create-selection-virtual-element.ts`
  - 把 TipTap selection 转换成基于真实文本行的 Floating UI virtual element。

### 修改

- `src/components/ai-rewrite/ai-rewrite-bubble.tsx`
  - 创建可见宿主与隐藏测量宿主，注册 BubbleMenuPlugin，监听滚动/resize，驱动模式和位置更新。
- `src/components/ai-rewrite/components/bubble-menu.tsx`
  - 复用动作描述，渲染完整工具条、隐藏测量工具条或 shadcn 省略号菜单。
- `src/components/ai-rewrite/ai-rewrite.scss`
  - 定义 body 级固定宿主和隐藏测量宿主的最小布局样式。
- `src/components/ai-rewrite/README.md`
  - 更新定位、边界、紧凑模式和维护说明。

### 不修改

- AI 改写请求、候选解析、session 状态机和写回逻辑。
- `SimpleEditor` 的高度、滚动和 overflow 结构。
- `package.json` 与锁文件。

## 工作区保护

- 默认继续在当前 `main` 分支。
- 不执行 `git push`。
- 每个任务提交前运行 `git diff --check`。
- 不恢复或覆盖用户在其他模块中的改动。

---

### 任务 1：以 TDD 建立几何与模式判定

**文件：**

- 创建：`src/components/ai-rewrite/utils/bubble-positioning.test.ts`
- 创建：`src/components/ai-rewrite/utils/bubble-positioning.ts`

- [ ] **步骤 1：先创建失败的几何测试**

测试文件定义本任务需要的公共 API：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clipRect,
  combineRects,
  getBubbleDisplayMode,
  getVisibleSelectionRects,
} from './bubble-positioning.ts'

test('clipRect 将部分可见矩形裁剪到编辑器边界', () => {
  assert.deepEqual(
    clipRect(
      { left: -5, top: 10, right: 30, bottom: 30, width: 35, height: 20 },
      { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
    ),
    { left: 0, top: 10, right: 30, bottom: 30, width: 30, height: 20 },
  )
})

test('getVisibleSelectionRects 丢弃零尺寸和完全不可见文本行', () => {
  assert.deepEqual(
    getVisibleSelectionRects(
      [
        { left: 5, top: 5, right: 5, bottom: 20, width: 0, height: 15 },
        { left: 10, top: -30, right: 40, bottom: -10, width: 30, height: 20 },
        { left: 10, top: 10, right: 40, bottom: 30, width: 30, height: 20 },
      ],
      { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
    ),
    [{ left: 10, top: 10, right: 40, bottom: 30, width: 30, height: 20 }],
  )
})

test('combineRects 合并多行选区边界', () => {
  assert.deepEqual(
    combineRects([
      { left: 40, top: 10, right: 90, bottom: 30, width: 50, height: 20 },
      { left: 10, top: 30, right: 70, bottom: 50, width: 60, height: 20 },
    ]),
    { left: 10, top: 10, right: 90, bottom: 50, width: 80, height: 40 },
  )
})

test('getBubbleDisplayMode 在完整菜单刚好可容纳时保持 full', () => {
  assert.equal(
    getBubbleDisplayMode({
      availableWidth: 420,
      fullWidth: 420,
      compactWidth: 32,
    }),
    'full',
  )
})

test('getBubbleDisplayMode 在完整菜单超宽时切换 compact', () => {
  assert.equal(
    getBubbleDisplayMode({
      availableWidth: 419,
      fullWidth: 420,
      compactWidth: 32,
    }),
    'compact',
  )
})

test('getBubbleDisplayMode 在省略号按钮也放不下时隐藏', () => {
  assert.equal(
    getBubbleDisplayMode({
      availableWidth: 31,
      fullWidth: 420,
      compactWidth: 32,
    }),
    'hidden',
  )
})
```

- [ ] **步骤 2：运行测试确认红灯**

运行：

```bash
node --test src/components/ai-rewrite/utils/bubble-positioning.test.ts
```

预期：FAIL，错误为无法找到 `bubble-positioning.ts` 或导出函数不存在。

- [ ] **步骤 3：实现最小纯函数**

创建：

```ts
export interface BubbleRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export type BubbleDisplayMode = 'full' | 'compact' | 'hidden'

export function clipRect(
  rect: BubbleRect,
  boundary: BubbleRect,
): BubbleRect | null {
  if (rect.width <= 0 || rect.height <= 0)
    return null

  const left = Math.max(rect.left, boundary.left)
  const top = Math.max(rect.top, boundary.top)
  const right = Math.min(rect.right, boundary.right)
  const bottom = Math.min(rect.bottom, boundary.bottom)

  if (right <= left || bottom <= top)
    return null

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  }
}

export function getVisibleSelectionRects(
  rects: BubbleRect[],
  boundary: BubbleRect,
) {
  return rects
    .map(rect => clipRect(rect, boundary))
    .filter((rect): rect is BubbleRect => rect !== null)
}

export function combineRects(rects: BubbleRect[]): BubbleRect | null {
  if (rects.length === 0)
    return null

  const left = Math.min(...rects.map(rect => rect.left))
  const top = Math.min(...rects.map(rect => rect.top))
  const right = Math.max(...rects.map(rect => rect.right))
  const bottom = Math.max(...rects.map(rect => rect.bottom))

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  }
}

export function getBubbleDisplayMode({
  availableWidth,
  fullWidth,
  compactWidth,
}: {
  availableWidth: number
  fullWidth: number
  compactWidth: number
}): BubbleDisplayMode {
  if (availableWidth < compactWidth)
    return 'hidden'
  return fullWidth <= availableWidth ? 'full' : 'compact'
}
```

- [ ] **步骤 4：运行测试确认绿灯**

运行：

```bash
node --test src/components/ai-rewrite/utils/bubble-positioning.test.ts
pnpm exec tsc -p tsconfig.json --noEmit
```

预期：6 个测试通过，TypeScript 退出码 0。

- [ ] **步骤 5：提交几何核心**

```bash
git add \
  src/components/ai-rewrite/utils/bubble-positioning.ts \
  src/components/ai-rewrite/utils/bubble-positioning.test.ts
git diff --cached --check
git commit -m "test(ai-rewrite): 覆盖气泡定位边界"
```

---

### 任务 2：创建可见文本行虚拟参考元素

**文件：**

- 创建：`src/components/ai-rewrite/utils/create-selection-virtual-element.ts`
- 修改：`src/components/ai-rewrite/utils/bubble-positioning.test.ts`

- [ ] **步骤 1：补充纯函数边界测试**

增加测试，证明部分滚出的文本行会被裁剪且保留顺序：

```ts
test('getVisibleSelectionRects 保留多行顺序并裁剪首尾行', () => {
  assert.deepEqual(
    getVisibleSelectionRects(
      [
        { left: 20, top: -5, right: 80, bottom: 10, width: 60, height: 15 },
        { left: 10, top: 10, right: 90, bottom: 30, width: 80, height: 20 },
        { left: 30, top: 30, right: 70, bottom: 45, width: 40, height: 15 },
      ],
      { left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 },
    ),
    [
      { left: 20, top: 0, right: 80, bottom: 10, width: 60, height: 10 },
      { left: 10, top: 10, right: 90, bottom: 30, width: 80, height: 20 },
      { left: 30, top: 30, right: 70, bottom: 40, width: 40, height: 10 },
    ],
  )
})
```

- [ ] **步骤 2：运行新增测试确认红灯或现有实现契约**

运行：

```bash
node --test src/components/ai-rewrite/utils/bubble-positioning.test.ts
```

如果测试已通过，说明任务 1 的纯函数已满足该契约；继续用该契约实现 DOM 适配层，不修改断言。

- [ ] **步骤 3：实现 TipTap selection 适配层**

新文件导出：

```ts
import type { Editor } from '@tiptap/react'
import type { BubbleRect } from './bubble-positioning'
import {
  combineRects,
  getVisibleSelectionRects,
} from './bubble-positioning'

function toBubbleRect(rect: DOMRect): BubbleRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

export function createSelectionVirtualElement(
  editor: Editor,
  boundary: HTMLElement,
) {
  const { from, to } = editor.state.selection
  if (from === to)
    return null

  try {
    const start = editor.view.domAtPos(from)
    const end = editor.view.domAtPos(to)
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)

    const getRawRects = () => Array.from(
      range.getClientRects(),
      toBubbleRect,
    ).filter(rect => rect.width > 0 && rect.height > 0)
    const getPositionRects = () => {
      const rawRects = getRawRects()
      const visibleRects = getVisibleSelectionRects(
        rawRects,
        toBubbleRect(boundary.getBoundingClientRect()),
      )
      return visibleRects.length > 0 ? visibleRects : rawRects
    }
    if (getRawRects().length === 0)
      return null

    return {
      contextElement: editor.view.dom,
      getClientRects: getPositionRects,
      getBoundingClientRect: () => {
        const combined = combineRects(getPositionRects())
        return combined
          ? new DOMRect(
              combined.left,
              combined.top,
              combined.width,
              combined.height,
            )
          : new DOMRect()
      },
    }
  }
  catch {
    return null
  }
}
```

实现时保持 import 排序符合项目 ESLint。

- [ ] **步骤 4：验证适配层**

运行：

```bash
node --test src/components/ai-rewrite/utils/bubble-positioning.test.ts
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/components/ai-rewrite/utils
```

预期：测试、类型和 ESLint 全部通过。

- [ ] **步骤 5：提交选区适配**

```bash
git add \
  src/components/ai-rewrite/utils/create-selection-virtual-element.ts \
  src/components/ai-rewrite/utils/bubble-positioning.test.ts
git diff --cached --check
git commit -m "feat(ai-rewrite): 建立可见选区定位参考"
```

---

### 任务 3：实现完整工具条与 shadcn 紧凑菜单

**文件：**

- 修改：`src/components/ai-rewrite/components/bubble-menu.tsx`

- [ ] **步骤 1：定义菜单模式和测量接口**

将 Props 收敛为：

```ts
import type { BubbleDisplayMode } from '../utils/bubble-positioning'

interface RewriteBubbleMenuProps {
  mode: Exclude<BubbleDisplayMode, 'hidden'>
  measuring?: boolean
  onAction: (action: RewriteAction) => void
  onFullWidthChange?: (width: number) => void
}
```

- [ ] **步骤 2：提取动作按钮内容**

同一份动作元数据同时服务完整工具条、隐藏测量工具条和下拉菜单。完整按钮继续使用：

```tsx
<Button
  type="button"
  size="sm"
  variant="ghost"
  title={meta.description}
  onPointerDown={...}
  onClick={...}
>
  <Icon data-icon="inline-start" />
  <span>{meta.label}</span>
</Button>
```

移除按钮图标的手动 `size-4`，避免违反 shadcn icon 约定。

- [ ] **步骤 3：实现隐藏宽度测量**

`measuring=true` 时只渲染完整工具条，并使用 `ResizeObserver` 把
`getBoundingClientRect().width` 传给 `onFullWidthChange`。测量节点：

```tsx
<div
  ref={measureRef}
  aria-hidden
  className="ai-rewrite-bubble-measure-content"
>
  {renderActionButtons()}
</div>
```

测量节点不接收事件，不参与可见浮层布局。

- [ ] **步骤 4：实现紧凑 shadcn DropdownMenu**

紧凑模式使用：

```tsx
<DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
  <DropdownMenuTrigger asChild>
    <Button
      type="button"
      size="icon-sm"
      variant="outline"
      aria-label="更多 AI 改写操作"
    >
      <Ellipsis data-icon="inline-start" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="center" sideOffset={6}>
    <DropdownMenuGroup>
      {REWRITE_ACTION_LIST.map(action => (
        <DropdownMenuItem
          key={action}
          onSelect={() => {
            onAction(action)
            setMenuOpen(false)
          }}
        >
          <Icon data-icon="inline-start" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span>{meta.label}</span>
            <span className="text-xs text-muted-foreground">
              {meta.description}
            </span>
          </span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>
```

`DropdownMenuItem` 必须位于 `DropdownMenuGroup` 内。不得新增自定义弹层。

- [ ] **步骤 5：验证菜单组件**

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/components/ai-rewrite/components/bubble-menu.tsx
git diff --check
```

预期：全部通过。

- [ ] **步骤 6：提交紧凑菜单**

```bash
git add src/components/ai-rewrite/components/bubble-menu.tsx
git diff --cached --check
git commit -m "feat(ai-rewrite): 增加紧凑改写菜单"
```

---

### 任务 4：接入 body 级 Floating UI 定位

**文件：**

- 修改：`src/components/ai-rewrite/ai-rewrite-bubble.tsx`
- 修改：`src/components/ai-rewrite/ai-rewrite.scss`

- [ ] **步骤 1：创建可见宿主和独立测量宿主**

组件 state：

```ts
const [bubbleEl, setBubbleEl] = useState<HTMLDivElement | null>(null)
const [measureEl, setMeasureEl] = useState<HTMLDivElement | null>(null)
const [boundaryEl, setBoundaryEl] = useState<HTMLElement | null>(null)
const [fullMenuWidth, setFullMenuWidth] = useState(0)
const [availableWidth, setAvailableWidth] = useState(0)
```

挂载时创建两个 body 子节点：

```ts
const bubble = document.createElement('div')
bubble.className = 'ai-rewrite-bubble'
const measure = document.createElement('div')
measure.className = 'ai-rewrite-bubble-measure'
measure.ariaHidden = 'true'
measure.inert = true
document.body.append(bubble, measure)
```

卸载时移除两个节点。

- [ ] **步骤 2：计算所属编辑器边界和显示模式**

边界：

```ts
const boundary = editor.view.dom.closest<HTMLElement>(
  '.simple-editor-content',
) ?? editor.view.dom.parentElement
```

`ResizeObserver` 更新：

```ts
setAvailableWidth(Math.max(0, boundary.getBoundingClientRect().width - 16))
```

显示模式：

```ts
const bubbleMode = getBubbleDisplayMode({
  availableWidth,
  fullWidth: fullMenuWidth,
  compactWidth: 32,
})
```

`fullMenuWidth` 尚未测得时保持隐藏，避免完整菜单闪烁。

- [ ] **步骤 3：注册 BubbleMenuPlugin**

插件必须配置：

```ts
BubbleMenuPlugin({
  editor,
  element: bubbleEl,
  pluginKey: BUBBLE_MENU_PLUGIN_KEY,
  appendTo: () => document.body,
  getReferencedVirtualElement: () => (
    boundaryEl
      ? createSelectionVirtualElement(editor, boundaryEl)
      : null
  ),
  options: {
    strategy: 'fixed',
    placement: 'top',
    offset: 12,
    flip: {
      boundary: boundaryEl,
      padding: 8,
      fallbackPlacements: ['bottom'],
    },
    shift: {
      boundary: boundaryEl,
      padding: 8,
      crossAxis: true,
    },
    size: {
      boundary: boundaryEl,
      padding: 8,
      apply: ({ availableWidth: width, elements }) => {
        elements.floating.style.maxWidth = `${Math.max(0, width)}px`
      },
    },
    hide: {
      boundary: boundaryEl,
      padding: 0,
    },
    inline: true,
    scrollTarget: boundaryEl,
  },
  shouldShow: ({ editor: ed, from, to }) => (
    bubbleMode !== 'hidden'
    && from !== to
    && ed.state.doc.textBetween(from, to).trim().length
      >= SELECTION_MIN_CHARS
  ),
})
```

实现时先判断 `boundaryEl` 非空再注册，避免传入空边界。
注册 effect 依赖必须包含 `editor`、`bubbleEl`、`boundaryEl` 和 `bubbleMode`。
当隐藏测量完成、模式从 `hidden` 变为 `full/compact` 时重新注册插件，让当前有效选区
立即重新执行 `shouldShow` 和首次定位，不能等待用户再次移动选区。

- [ ] **步骤 4：消除空宿主首次定位**

删除 `bubbleVisible`、`AnimatePresence` 和当前 `onShow/onHide` 重挂载逻辑。
可见宿主始终 Portal 当前模式的 `RewriteBubbleMenu`，即使宿主暂时被 TipTap 从 DOM 移除，
其子内容也保持挂载：

```tsx
{bubbleEl && bubbleMode !== 'hidden' && createPortal(
  <RewriteBubbleMenu
    mode={bubbleMode}
    onAction={handleAction}
  />,
  bubbleEl,
)}
```

隐藏测量宿主始终 Portal：

```tsx
{measureEl && createPortal(
  <RewriteBubbleMenu
    mode="full"
    measuring
    onAction={handleAction}
    onFullWidthChange={setFullMenuWidth}
  />,
  measureEl,
)}
```

插件首次 `show()` 时可见宿主已经包含正确尺寸的菜单，不允许再对空宿主完成定位。

- [ ] **步骤 5：尺寸变化后触发位置更新**

增加稳定 helper：

```ts
function updateBubblePosition() {
  if (editor.isDestroyed)
    return
  editor.view.dispatch(
    editor.state.tr.setMeta(BUBBLE_MENU_PLUGIN_KEY, 'updatePosition'),
  )
}
```

以下变化后调用：

- `bubbleMode`
- `fullMenuWidth`
- `availableWidth`
- boundary `ResizeObserver`

使用 `requestAnimationFrame(updateBubblePosition)`，并在 effect cleanup 中取消帧。

- [ ] **步骤 6：补充最小样式**

`ai-rewrite.scss` 改为：

```scss
.ai-rewrite-bubble {
  z-index: 60;
  max-width: calc(100vw - 1rem);
}

.ai-rewrite-bubble-measure {
  position: fixed;
  top: 0;
  left: -10000px;
  z-index: -1;
  width: max-content;
  visibility: hidden;
  pointer-events: none;
}

.ai-rewrite-bubble-measure-content {
  width: max-content;
}
```

不得修改 `.simple-editor-wrapper` 或 `.simple-editor-content` 的 overflow。

- [ ] **步骤 7：验证插件接入**

运行：

```bash
node --test src/components/ai-rewrite/utils/bubble-positioning.test.ts
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/components/ai-rewrite/ai-rewrite-bubble.tsx \
  src/components/ai-rewrite/components/bubble-menu.tsx \
  src/components/ai-rewrite/utils
git diff --check
```

预期：全部通过。

- [ ] **步骤 8：提交定位接入**

```bash
git add \
  src/components/ai-rewrite/ai-rewrite-bubble.tsx \
  src/components/ai-rewrite/ai-rewrite.scss
git diff --cached --check
git commit -m "fix(ai-rewrite): 修复划词气泡边界定位"
```

---

### 任务 5：文档、全量验证与浏览器回归

**文件：**

- 修改：`src/components/ai-rewrite/README.md`
- 验证：`src/components/ai-rewrite/**`
- 验证：`src/components/tiptap-templates/simple/simple-editor.tsx`

- [ ] **步骤 1：更新模块文档**

README 必须明确：

- BubbleMenu 宿主固定挂载到 `body`。
- 当前编辑器可视区域是定位边界。
- 真实文本行矩形处理多行和部分滚出选区。
- 完整菜单横向放不下时切换 shadcn 省略号菜单。
- 内部滚动和 ResizeObserver 会触发位置更新。
- 定位问题优先检查 `ai-rewrite-bubble.tsx`、`bubble-positioning.ts` 和
  `create-selection-virtual-element.ts`。

- [ ] **步骤 2：运行自动化与静态验证**

```bash
node --test src/components/ai-rewrite/utils/bubble-positioning.test.ts
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/components/ai-rewrite
pnpm build
git diff --check
```

预期：

- Node 测试全部通过。
- TypeScript 和 ESLint 退出码 0。
- Vite build 成功；既有 chunk-size warning 可记录。
- 无 whitespace error。

- [ ] **步骤 3：桌面浏览器回归**

在真实 `SimpleEditor` 中验证：

```text
单行中部选区：完整菜单位于上方 12px
靠左/靠右选区：菜单不越过编辑器 8px 边界
顶部选区：上方不足时翻转到底部
底部选区：保持上方
多行选区：上方锚定第一条可见行
内部滚动：菜单跟随；完全滚出后隐藏
编辑面板 resize：位置和模式立即重算
```

- [ ] **步骤 4：窄宽度与紧凑菜单回归**

把编辑器宽度缩到完整菜单无法容纳：

```text
只显示省略号气泡按钮
按钮仍位于选区上方或下方回退位置
DropdownMenu 包含五个动作及说明
菜单不越过屏幕边缘
鼠标选择动作只执行一次
键盘打开和选择动作只执行一次
编辑器变宽后恢复完整工具条
```

在 `390px` 视口重复验证。

- [ ] **步骤 5：提交文档**

```bash
git add src/components/ai-rewrite/README.md
git diff --cached --check
git commit -m "docs(ai-rewrite): 更新划词气泡定位说明"
```

- [ ] **步骤 6：最终状态检查**

```bash
git status --short
git log -5 --oneline
```

预期：工作区干净，提交仅包含本计划相关文件，不执行 `git push`。
