# AI Rewrite Bubble 动画设计

## 背景

`ai-rewrite` 的划词菜单由 Tiptap `BubbleMenuPlugin` 控制外层 DOM 的定位、显示和隐藏。当前菜单出现和消失都是瞬时变化，缺少用户请求的入场和出场动画。

## 目标

- 使用项目已安装的 `motion` 为划词菜单增加入场和出场动画。
- 动画只作用于菜单内容，不改变 Tiptap BubbleMenu 的选区判断和定位逻辑。
- 入场轻微上浮、缩放、淡入；出场更快淡出缩小。
- 保持菜单按钮点击、阻止编辑器失焦、AI 改写触发逻辑不变。

## 关键约束

Tiptap `BubbleMenuPlugin.hide()` 会立即把外层 element 设置为隐藏并从 DOM 中移除。如果只在 `RewriteBubbleMenu` 根节点上加 `motion.div`，出场动画不会可靠播放。

因此实现需要：

- 通过 `BubbleMenuPlugin` 的 `options.onShow/onHide` 同步 React 的 `bubbleVisible` 状态。
- 保留 Tiptap 默认挂载上下文，也就是 editor 父节点，避免改变 Floating UI 的坐标系。
- 在 `onHide` 后短暂把外层 element 重新挂回 editor 父节点，恢复 visibility/opacity，让 React 内容层执行 exit 动画。
- 在 `AnimatePresence.onExitComplete` 里移除外层 element，避免残留 DOM。

## 方案

在 `ai-rewrite-bubble.tsx` 中新增 `bubbleVisible` 状态。portal 始终挂载到 `bubbleEl`，但内容由 `AnimatePresence` 控制：

```tsx
<AnimatePresence>
  {bubbleVisible && <RewriteBubbleMenu onAction={handleAction} />}
</AnimatePresence>
```

在 `components/bubble-menu.tsx` 中把根节点改为 `motion.div`：

- `initial`: `{ opacity: 0, y: 6, scale: 0.96 }`
- `animate`: `{ opacity: 1, y: 0, scale: 1 }`
- `exit`: `{ opacity: 0, y: 4, scale: 0.97 }`
- `transition`: 入场约 `0.16s`，出场约 `0.1s`

## 验证

- `rg -n "AnimatePresence|motion\\.div|onShow|onHide" src/components/ai-rewrite`
- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/eslint src/components/ai-rewrite --max-warnings=0`
- `./node_modules/.bin/prettier --check src/components/ai-rewrite docs/superpowers/specs/2026-05-31-ai-rewrite-bubble-motion-design.md docs/superpowers/plans/2026-05-31-ai-rewrite-bubble-motion.md`
