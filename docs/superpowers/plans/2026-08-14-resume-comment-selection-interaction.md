# 简历评论划词交互优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 直接使用 Shadcn Button 完成划词评论动作样式与进出动画，并让同一富文本描述字段支持跨段落、跨列表项的稳定评论锚点。

**架构：** 新增一个只负责 DOM 评论块投影的纯前端模块，让选区解析和高亮重建共享完全一致的块顺序、规范化文本与字段级字素偏移。持久化 `CommentAnchor` 结构保持不变，`blockOrdinal` 继续表示起始块；共享重定位逻辑改为分别解析起止块，重叠判断只依赖字段级 `nodeKey` 与全局偏移。

**技术栈：** React 19、TypeScript、Shadcn/Radix UI、Motion、Zustand、DOM Range、Intl.Segmenter、Node 纯逻辑验证脚本。

**数据库补充：** 保持 `CommentAnchor` JSON 结构不变，通过增量迁移让 SQL 校验分别验证起始块与结束块；服务端重定位时同步刷新锚点文档哈希，确保数据库触发器与共享重定位语义一致。

---

## 文件结构

- 创建 `src/features/resume-comments/anchors/dom-projection.ts`：收集同一评论节点的直属富文本块，建立字段投影文本、块元素与全局字素偏移映射。
- 修改 `src/features/resume-comments/anchors/selection.ts`：复用 DOM 投影解析跨块 Range，放宽同一 `nodeKey` 的边界兼容性和重叠判断。
- 修改 `src/features/resume-comments/hooks/use-highlight-geometry.ts`：按全局偏移找到起止块并重建跨块 DOM Range。
- 修改 `supabase/functions/shared/resume-comment-core.ts`：让已有锚点重定位接受同一 node 内跨块范围，并把 `blockOrdinal` 更新为起始块。
- 修改 `scripts/verify-resume-comment-anchors.ts`：覆盖跨块边界、重定位和重叠判断。
- 修改 `src/features/resume-comments/components/selection-action.tsx`：保留已确认的 Shadcn Button 与不可交互退出态。
- 修改 `src/features/resume-comments/components/comment-surface.tsx`：保留已确认的 AnimatePresence、Drawer 隐藏和关闭后清理选区行为。
- 创建 `src/features/resume-comments/components/relink-status-alert.tsx`：使用 Shadcn Alert/Button 呈现页面级重新关联状态和取消入口。
- 修改 `src/features/resume-comments/components/comments-panel.tsx`：开始重新关联后在桌面和移动端都关闭 Drawer。

本计划默认在当前分支执行，不创建 worktree、不自动提交或推送；只有用户明确要求时才进行 Git 提交或远端操作。

### 任务 1：建立统一的 DOM 评论块投影

**文件：**
- 创建：`src/features/resume-comments/anchors/dom-projection.ts`
- 修改：`src/features/resume-comments/anchors/selection.ts`
- 修改：`src/features/resume-comments/anchors/projection.ts`
- 修改：`src/components/resume/runtime/renderers/shared.tsx`
- 修改：`supabase/functions/shared/resume-comment-core.ts`
- 验证：`scripts/verify-resume-comment-anchors.ts`

实现时必须从共享核心导出 `normalizeCommentRichTextBlock()`，DOM 投影和运行时渲染共同复用；DOM 序列化显式把 `<br>` 映射为换行。point→offset 与 offset→point 不能只拼接 Text node，必须保留 `<br>` 和折叠空白的规范化位置，否则浏览器锚点会与服务端投影漂移。

- [ ] **步骤 1：创建 DOM 投影类型与块收集函数**

在 `dom-projection.ts` 中定义字段级投影，不把 React、store 或评论线程传入该模块：

```ts
import { countCommentGraphemes, normalizeCommentText } from './graphemes.ts'

export interface CommentDomBlockProjection {
  element: HTMLElement
  ordinal: number
  text: string
  startGraphemeOffset: number
  endGraphemeOffset: number
}

export interface CommentDomNodeProjection {
  text: string
  blocks: CommentDomBlockProjection[]
}

export function projectCommentDomNode(nodeElement: HTMLElement): CommentDomNodeProjection {
  const elements = [
    ...(nodeElement.matches('[data-comment-block-ordinal]') ? [nodeElement] : []),
    ...Array.from(nodeElement.querySelectorAll<HTMLElement>('[data-comment-block-ordinal]')),
  ].filter(element => element.closest('[data-comment-node-key]') === nodeElement)

  const ordered = elements
    .map(element => ({
      element,
      ordinal: Number(element.dataset.commentBlockOrdinal),
      text: normalizeCommentText(element.textContent ?? ''),
    }))
    .filter(item => Number.isInteger(item.ordinal) && item.ordinal >= 0)
    .sort((left, right) => left.ordinal - right.ordinal)

  let cursor = 0
  const blocks = ordered.map((item, index) => {
    if (index > 0)
      cursor += 1
    const startGraphemeOffset = cursor
    cursor += countCommentGraphemes(item.text)
    return {
      ...item,
      startGraphemeOffset,
      endGraphemeOffset: cursor,
    }
  })

  return {
    text: blocks.map(block => block.text).join('\n'),
    blocks,
  }
}
```

- [ ] **步骤 2：提供按 ordinal 和全局偏移寻找块的函数**

同一文件继续导出：

```ts
export function findCommentDomBlockByOrdinal(
  projection: CommentDomNodeProjection,
  ordinal: number,
) {
  return projection.blocks.find(block => block.ordinal === ordinal) ?? null
}

export function findCommentDomBlockAtOffset(
  projection: CommentDomNodeProjection,
  offset: number,
) {
  return projection.blocks.find(block => (
    offset >= block.startGraphemeOffset
    && offset <= block.endGraphemeOffset
  )) ?? null
}

export function collectCommentBlockTextNodes(block: HTMLElement) {
  const nodes: Text[] = []
  const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if ((current.parentElement?.closest('[data-comment-block-ordinal]') ?? null) === block)
      nodes.push(current as Text)
    current = walker.nextNode()
  }
  return nodes
}
```

`findCommentDomBlockAtOffset()` 的闭区间语义保留“从上一块末尾划到下一块开头”的 Range 边界；正常文本偏移不会同时命中两个块，因为块之间有一个投影换行偏移。

- [ ] **步骤 3：让选区解析分别计算起点与终点偏移**

在 `selection.ts` 删除本地 `collectNodeText()`，改为调用 `projectCommentDomNode()`。边界兼容函数只比较 `nodeKey`：

```ts
export function areCommentSelectionBoundariesCompatible(
  start: CommentSelectionBoundaryIdentity,
  end: CommentSelectionBoundaryIdentity,
): boolean {
  return start.nodeKey === end.nodeKey
}
```

`resolveCommentSelection()` 保留 `start.nodeElement === end.nodeElement`，移除 `start.blockElement === end.blockElement`，并使用两个块的字段级起点：

```ts
const projection = projectCommentDomNode(start.nodeElement)
const startBlock = findCommentDomBlockByOrdinal(projection, start.blockOrdinal)
const endBlock = findCommentDomBlockByOrdinal(projection, end.blockOrdinal)
if (!startBlock || !endBlock)
  return null

const startOffset = startBlock.startGraphemeOffset + countCommentGraphemes(
  textBeforePoint(start.blockElement, range.startContainer, range.startOffset),
)
const endOffset = endBlock.startGraphemeOffset + countCommentGraphemes(
  textBeforePoint(end.blockElement, range.endContainer, range.endOffset),
)
const exactQuote = graphemeSlice(projection.text, startOffset, endOffset)
```

锚点继续写入 `blockOrdinal: start.blockOrdinal`，prefix、suffix 和 `nodeTextHash` 全部基于 `projection.text`。

- [ ] **步骤 4：放宽同一字段的重叠判断**

把 `compareAnchorOverlap()` 的提前返回改成只比较 `nodeKey`：

```ts
if (left.nodeKey !== right.nodeKey)
  return 'none'
```

其余 exact、contains、contained_by 和 partial 偏移判断保持原样。

- [ ] **步骤 5：运行定向检查**

运行：

```bash
pnpm exec eslint \
  src/features/resume-comments/anchors/dom-projection.ts \
  src/features/resume-comments/anchors/selection.ts
pnpm exec tsc --noEmit
```

预期：两个命令退出码均为 0。

### 任务 2：让共享锚点重定位支持跨块范围

**文件：**
- 修改：`supabase/functions/shared/resume-comment-core.ts`
- 修改：`scripts/verify-resume-comment-anchors.ts`

- [ ] **步骤 1：先补充跨块纯逻辑断言**

在现有 boundary 断言中，把同 node、不同 block 的期望改为 `true`，并补充不同 node 仍为 `false`：

```ts
assert.equal(
  areCommentSelectionBoundariesCompatible(
    { nodeKey: 'same', blockOrdinal: 0 },
    { nodeKey: 'same', blockOrdinal: 1 },
  ),
  true,
)
assert.equal(
  areCommentSelectionBoundariesCompatible(
    { nodeKey: 'left', blockOrdinal: 0 },
    { nodeKey: 'right', blockOrdinal: 0 },
  ),
  false,
)
```

构造包含两个投影块的 node 和跨块 anchor：

```ts
const crossBlockText = 'alpha\nbeta'
const crossBlockAnchor = createAnchor(crossBlockText, 'pha\nbe')
const crossBlockNode: CommentAnchorDocumentNode = {
  ...createNode(crossBlockText),
  blocks: [
    { ordinal: 0, startGraphemeOffset: 0, endGraphemeOffset: 5 },
    { ordinal: 1, startGraphemeOffset: 6, endGraphemeOffset: 10 },
  ],
}
const crossBlockResult = relocateAnchor(crossBlockAnchor, crossBlockNode)
assert.equal(crossBlockResult.status, 'anchored')
assert.equal(
  crossBlockResult.status === 'anchored' && crossBlockResult.anchor.blockOrdinal,
  0,
)
```

为重叠判断补充一个 `blockOrdinal: 1` 但全局偏移与 source 重叠的 anchor，并断言结果不是 `none`。

- [ ] **步骤 2：运行验证脚本确认旧逻辑拒绝跨块**

运行：

```bash
pnpm verify:comments
```

预期：在跨块 relocation 或 boundary compatibility 新断言处失败；这证明断言覆盖了旧限制。

- [ ] **步骤 3：修改 `moveResumeCommentAnchor()`**

把“一个块包含整个范围”替换为分别查找起点块和终点块：

```ts
const startBlock = node.blocks.find(item => (
  start >= item.startGraphemeOffset
  && start <= item.endGraphemeOffset
))
const endBlock = node.blocks.find(item => (
  end >= item.startGraphemeOffset
  && end <= item.endGraphemeOffset
))
if (!startBlock || !endBlock)
  return null
```

返回锚点时设置 `blockOrdinal: startBlock.ordinal`。quote、prefix、suffix、hash 和其余重定位顺序保持不变。

- [ ] **步骤 4：运行纯逻辑验证**

运行：

```bash
pnpm verify:comments
```

预期输出包含 `resume comment anchor verification passed`，退出码为 0。

### 任务 3：重建跨块高亮 Range

**文件：**
- 修改：`src/features/resume-comments/hooks/use-highlight-geometry.ts`
- 复用：`src/features/resume-comments/anchors/dom-projection.ts`

- [ ] **步骤 1：删除高亮模块的重复块扫描函数**

删除本地 `findBlock()`、`getBlockStart()` 和 `collectTextNodes()`，改为导入：

```ts
import {
  commentDomGraphemeOffsetToPoint,
  findCommentDomBlockAtOffset,
  findCommentDomBlockByOrdinal,
  projectCommentDomNode,
} from '../anchors/dom-projection.ts'
import { graphemeSlice } from '../anchors/graphemes.ts'
```

- [ ] **步骤 2：根据字段级偏移解析起止块**

`anchorToRange()` 使用已存的起始 ordinal 优先解析起点，并用全局结束偏移解析终点：

```ts
const projection = projectCommentDomNode(node)
const startBlock = findCommentDomBlockByOrdinal(projection, thread.anchor.blockOrdinal)
  ?? findCommentDomBlockAtOffset(projection, thread.anchor.startGraphemeOffset)
const endBlock = findCommentDomBlockAtOffset(
  projection,
  thread.anchor.endGraphemeOffset,
)
if (!startBlock || !endBlock)
  return null
```

校验起点确实位于 startBlock 的闭区间；否则使用 offset fallback，避免 stale ordinal 把 Range 建到错误块。

- [ ] **步骤 3：在不同块的文本节点上设置 Range**

```ts
const localStart = thread.anchor.startGraphemeOffset - startBlock.startGraphemeOffset
const localEnd = thread.anchor.endGraphemeOffset - endBlock.startGraphemeOffset
const start = commentDomGraphemeOffsetToPoint(startBlock.element, localStart, 'start')
const end = commentDomGraphemeOffsetToPoint(endBlock.element, localEnd, 'end')
if (!start || !end)
  return null
const range = node.ownerDocument.createRange()
range.setStart(start.container, start.offset)
range.setEnd(end.container, end.offset)
```

不要使用 `Range.toString()` 校验跨块 quote，因为 DOM 块之间未必暴露与字段投影相同的换行文本。改为：

```ts
return graphemeSlice(
  projection.text,
  thread.anchor.startGraphemeOffset,
  thread.anchor.endGraphemeOffset,
) === thread.anchor.exactQuote
  ? range
  : null
```

- [ ] **步骤 4：运行定向静态检查**

运行：

```bash
pnpm exec eslint \
  src/features/resume-comments/anchors/dom-projection.ts \
  src/features/resume-comments/anchors/selection.ts \
  src/features/resume-comments/hooks/use-highlight-geometry.ts
pnpm exec tsc --noEmit
```

预期：两个命令退出码均为 0。

### 任务 4：收口动作按钮、重新关联提示与 Drawer 生命周期

**文件：**
- 修改：`src/features/resume-comments/components/selection-action.tsx`
- 修改：`src/features/resume-comments/components/comment-surface.tsx`
- 修改：`src/features/resume-comments/components/comments-panel.tsx`
- 创建：`src/features/resume-comments/components/relink-status-alert.tsx`

- [ ] **步骤 1：核对 Shadcn Button 边界**

桌面按钮必须保持：

```tsx
<Button
  variant="outline"
  size="sm"
  disabled={disabled || !isPresent}
  onClick={onComment}
>
  <Icon />
  {label}
</Button>
```

移动按钮必须保持 `variant="outline"`、`size="lg"`，自定义 class 只有 `w-full`。不得恢复深色胶囊、手写 border、shadow、radius 或 hover 视觉。

- [ ] **步骤 2：核对退出态不可交互**

两个 Motion 容器都使用 `useIsPresent()`；退出时 `aria-hidden=true`，内部 Shadcn Button 立即 disabled。`AnimatePresence` 继续位于 `CommentSurface` 的 selection 条件外层。

- [ ] **步骤 3：核对 Drawer 与 picker 可见性**

动作按钮条件必须是：

```tsx
selection && !open && !picker
```

`setOpen(false)` 必须调用 `clearSelection()`，再清理 creating、active thread 和 hovered thread。`setOpen(true)` 不得清除 selection，因为新建评论表单提交仍依赖它。

- [ ] **步骤 4：运行组件定向检查**

重新关联开始后，桌面和移动端都关闭评论 Drawer；`relinkThreadId && !open` 时通过 `AnimatePresence` 显示顶部居中的 Shadcn Alert。取消、Escape 和成功关联都必须清理重新关联状态、store selection 与浏览器原生选区。

- [ ] **步骤 5：运行组件定向检查**

运行：

```bash
pnpm exec eslint \
  src/features/resume-comments/components/selection-action.tsx \
  src/features/resume-comments/components/comment-surface.tsx \
  src/features/resume-comments/components/comments-panel.tsx \
  src/features/resume-comments/components/relink-status-alert.tsx
pnpm exec tsc --noEmit
```

预期：两个命令退出码均为 0。

### 任务 5：完整验证与交付边界

**文件：**
- 检查：所有本计划修改文件
- 对照：`docs/superpowers/specs/2026-08-14-resume-comment-selection-interaction-design.md`

- [ ] **步骤 1：运行全部相关静态与纯逻辑验证**

运行：

```bash
pnpm verify:comments
pnpm exec tsc --noEmit
pnpm exec eslint \
  src/features/resume-comments/anchors/dom-projection.ts \
  src/features/resume-comments/anchors/selection.ts \
  src/features/resume-comments/hooks/use-highlight-geometry.ts \
  src/features/resume-comments/components/selection-action.tsx \
  src/features/resume-comments/components/comment-surface.tsx \
  src/features/resume-comments/components/comments-panel.tsx \
  src/features/resume-comments/components/relink-status-alert.tsx \
  src/components/resume/runtime/renderers/shared.tsx \
  supabase/functions/shared/resume-comment-core.ts \
  scripts/verify-resume-comment-anchors.ts
pnpm build
git diff --check
```

预期：所有命令退出码为 0；构建可以保留仓库既有 chunk-size warning，但不能出现新增 error。

- [ ] **步骤 2：检查最终 diff**

运行：

```bash
git diff -- \
  src/features/resume-comments/anchors \
  src/features/resume-comments/hooks/use-highlight-geometry.ts \
  src/features/resume-comments/components/selection-action.tsx \
  src/features/resume-comments/components/comment-surface.tsx \
  src/features/resume-comments/components/comments-panel.tsx \
  src/features/resume-comments/components/relink-status-alert.tsx \
  supabase/functions/shared/resume-comment-core.ts \
  scripts/verify-resume-comment-anchors.ts \
  docs/superpowers/specs/2026-08-14-resume-comment-selection-interaction-design.md \
  docs/superpowers/plans/2026-08-14-resume-comment-selection-interaction.md
```

逐项确认：没有 API/schema 变更、没有跨 nodeKey 放宽、没有恢复自定义按钮视觉、没有覆盖用户无关修改。

- [ ] **步骤 3：执行可用的浏览器交互验证**

在具有评论权限的在线简历或公开分享页执行：

1. 单块划词，确认 outline 按钮进入。
2. 同一描述字段跨两个列表项划词，确认按钮出现。
3. 从项目名称跨到描述，确认按钮不出现。
4. 点击评论，确认按钮退出且 Drawer 显示完整 quote。
5. 关闭 Drawer，确认按钮不再次出现且浏览器选区清除。
6. 再次划词，确认新按钮正常出现。
7. 在 767px 与 769px 分别确认只有一个动作入口。

若当前浏览器没有登录态、在线简历或评论权限，记录为“浏览器交互未验证”，不得用 typecheck、构建或截图替代。

- [ ] **步骤 4：按证据汇报结果**

最终回复分别列出：已实现行为、通过的命令、浏览器实际覆盖范围、仍未验证的设备或身份边界。未经用户要求不执行 `git commit` 或 `git push`。
