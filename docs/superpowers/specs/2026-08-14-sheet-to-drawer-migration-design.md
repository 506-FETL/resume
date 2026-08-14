# 全项目 Sheet 到 Drawer 迁移设计

## 1. 背景与目标

项目已经使用基于 `@base-ui/react` 的 shadcn Drawer，但仍残留 Radix Sheet。当前求职跟进详情同时维护移动端 Drawer 与桌面端 Sheet 两棵组件树，其中公共标题错误地固定为 `SheetTitle`，放入移动端 Drawer 后会触发 ``DialogTitle must be used within Dialog`` 并中断面板渲染。

本次迁移的目标是彻底淘汰 Sheet：所有现有 Sheet 调用统一改为项目现有 shadcn Drawer，覆盖桌面端和移动端；删除公共 `sheet.tsx`；同时用一致的内部滚动结构避免 Drawer 打开后内容无法滚动。

## 2. 迁移范围

全项目现有 Sheet 调用点共四处：

1. `src/pages/tracker/components/drawer/index.tsx`：求职跟进职位详情。桌面端当前为右侧 Sheet，移动端当前为底部 Drawer。
2. `src/pages/assistant/components/assistant-sidebar/index.tsx`：AI 助手移动端会话侧栏，当前为左侧 Sheet。
3. `src/pages/assistant/components/assistant-canvas/index.tsx`：AI 助手移动端画布，当前为右侧 Sheet。
4. `src/components/ui/sidebar/sidebar.tsx`：全局 Sidebar 的移动端承载层，当前按 `side` 使用左右 Sheet。

迁移完成后删除 `src/components/ui/sheet.tsx`，并保证 `src` 中不存在 `@/components/ui/sheet`、`<Sheet`、`SheetContent`、`SheetTitle` 等遗留引用。

以下内容不在本次迁移范围：

- 不把普通 Dialog、AlertDialog 或 ResponsiveDialog 全部改为 Drawer；它们不是 Sheet 遗留。
- 不改变桌面端已有的固定侧栏和可调整宽度画布，只迁移其移动端 Sheet 承载层。
- 不修改业务数据、Zustand store、Supabase 请求或表单结构。

## 3. 统一 Drawer 结构

所有调用点直接组合 `@/components/ui/drawer` 已提供的 shadcn 原语，不新增另一套 Sheet 兼容层，也不创建伪装成 Sheet 的别名。

基本结构为：

```tsx
<Drawer open={open} onOpenChange={setOpen} swipeDirection="right">
  <DrawerContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] flex-col overflow-hidden p-0">
    <DrawerHeader className="shrink-0">...</DrawerHeader>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">...</div>
  </DrawerContent>
</Drawer>
```

方向映射：

- 求职详情：桌面端 `swipeDirection="right"`，从右侧进入；移动端 `swipeDirection="down"`，从底部进入并显示滑动把手。
- AI 助手会话侧栏：`swipeDirection="left"`，从左侧进入。
- AI 助手移动画布：`swipeDirection="right"`，从右侧进入。
- 全局移动 Sidebar：根据既有 `side` 映射为 `left` 或 `right`。

求职详情只保留一棵 Drawer 组件树。响应式状态只改变 `swipeDirection`、`showSwipeHandle`、宽高和内边距，不再切换 Sheet/Drawer 标题原语，因此不会出现根组件和 Title 上下文不一致。

## 4. 强制滚动约束

Drawer 的 Popup、Viewport 和最外层 Content 不承担业务长内容滚动。所有迁移点必须满足以下约束：

1. `DrawerContent` 使用 `flex`、`min-h-0`、明确的视口内高度或最大高度，并保持 `overflow-hidden`。
2. Header、Footer、标签栏和固定动作区使用 `shrink-0`。
3. 真正需要滚动的正文层使用 `min-h-0 flex-1 overflow-y-auto overscroll-contain`。
4. 若子组件已经拥有内部滚动区（例如画布 Tab、简历预览、ConversationList），其直接父级使用 `min-h-0 flex-1 overflow-hidden`，把高度继续传递给子滚动区，避免双滚动。
5. 横向 Drawer 使用 `h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)]`；底部求职详情使用 `h-[94dvh] max-h-[94dvh]`，为遮罩关闭和手势留出可见空间。
6. 不给 `DrawerPrimitive.Popup` 或 `DrawerPrimitive.Viewport` 添加 `overflow-y-auto`，避免滑动手势与内容滚动竞争。

## 5. 各调用点设计

### 5.1 求职详情

- 用同一组 `DrawerTitle`、`DrawerDescription` 和 `DrawerHeader` 渲染两端。
- 桌面宽度保持接近原 Sheet：最大约 `56rem`，并限制在当前视口内。
- 移动端保持 94dvh 底部 Drawer 和滑动把手。
- 已有正文 `min-h-0 flex-1 overflow-y-auto` 继续作为唯一业务滚动区。
- 增加明确的关闭按钮；遮罩、Escape、横向/纵向滑动均仍可关闭。

### 5.2 AI 助手会话侧栏

- 保留 `320px / 88vw` 宽度和左侧进入。
- Header 与底部账户区固定；`ConversationList` 继续作为中间唯一滚动区。
- 移动端选择对话或执行导航后，现有 store 行为继续关闭 Drawer。

### 5.3 AI 助手画布

- 保持移动端全宽、从右侧进入。
- Header 固定；`CanvasInner` 使用 `min-h-0 flex-1 overflow-hidden`，各 Tab 内现有滚动区继续负责内容滚动。
- 桌面可调整宽度画布不变。

### 5.4 全局移动 Sidebar

- 按现有 `side` 决定左右方向并保留 `--sidebar-width`。
- Drawer Content 固定在视口内且 `overflow-hidden`；已有 `SidebarContent` 继续作为内部滚动区。
- 保留 `data-sidebar`、`data-slot` 和 `data-mobile`，不破坏现有 Sidebar 样式与上下文。

## 6. 动画、可访问性与生命周期

- 使用 Base UI Drawer 自带的进入、退出和拖拽动画，不叠加第二套 Sheet 动画。
- `DrawerTitle` 和 `DrawerDescription` 必须位于同一个 Drawer Root 内。
- 可见面板提供明确的关闭按钮及中文 `aria-label`；全局 Sidebar 保留原交互语义。
- 受控 `open` 状态继续来自原有 store；不在退出动画开始时提前卸载业务内容。
- 保留遮罩点击、Escape 关闭和关闭后的焦点恢复。
- `prefers-reduced-motion` 继续由 Base UI / 全局样式处理，不额外制造 Motion 动画。

## 7. 验证标准

### 7.1 静态验证

- `pnpm exec tsc --noEmit`
- 迁移文件定向 ESLint
- `pnpm build`
- `git diff --check`
- `rg` 确认 `src` 内 Sheet 业务引用为 0，且 `src/components/ui/sheet.tsx` 已删除。

### 7.2 浏览器验证

桌面端：

- 求职卡片点击后右侧 Drawer 打开，Title 不报上下文错误。
- 正文、阶段详情、活动记录和联系人长内容可以滚动到底。
- 关闭按钮、遮罩和 Escape 均可关闭，关闭后再次点击其他卡片可正常打开。

移动端（390×844）：

- 求职详情从底部打开，可滚动、可滑动关闭。
- AI 助手会话侧栏从左侧打开，对话列表可滚动。
- AI 助手画布从右侧打开，简历预览及其他 Tab 可滚动。
- 全局 Sidebar 从配置方向打开，菜单内容可滚动。
- 控制台不再出现 ``DialogTitle must be used within Dialog``。

若当前浏览器缺少登录态和职位数据，应明确区分：类型/构建/遗留引用检查可以确认迁移完整性，但不能替代带真实数据的滚动与点击验证。
