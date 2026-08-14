# 全项目 Sheet 到 Drawer 迁移实施计划

> **面向 AI 代理的工作者：** 按 `executing-plans` 执行，完成每个任务后运行定向检查；不得重新引入 Sheet 兼容别名。

**目标：** 将项目中所有 Radix Sheet 调用迁移到现有 shadcn Base UI Drawer，删除 `sheet.tsx`，并保证桌面端与移动端的长内容滚动、关闭与焦点行为稳定。

**架构：** 所有业务直接组合 `Drawer`、`DrawerContent`、`DrawerHeader`、`DrawerTitle`、`DrawerDescription` 和 `DrawerClose`。响应式差异仅通过 `swipeDirection`、`showSwipeHandle` 和样式控制；业务正文使用独立的 `min-h-0 flex-1` 滚动层，Drawer Popup 本身保持 `overflow-hidden`。

**技术栈：** React 19、TypeScript、shadcn/ui、`@base-ui/react` Drawer、Tailwind CSS、Zustand、Vite。

本计划在当前分支执行，不创建 worktree，不自动提交或推送。

## 任务 1：统一求职详情为单棵 Drawer

**文件：**

- 修改：`src/pages/tracker/components/drawer/index.tsx`

- [ ] 删除 Sheet import 和桌面 Sheet 分支。
- [ ] 把公共职位标题改为 `DrawerTitle`，描述统一使用 `DrawerDescription`。
- [ ] 用单个受控 Drawer 渲染桌面和移动端：桌面 `right`、移动端 `down`。
- [ ] 桌面保持右侧大宽度面板；移动端保持 94dvh 和滑动把手。
- [ ] Header 固定、正文沿用唯一的 `min-h-0 flex-1 overflow-y-auto` 滚动层。
- [ ] 增加 shadcn `DrawerClose` 关闭按钮，并保证标题不重复、可访问名称完整。
- [ ] 运行该文件定向 ESLint 和 `tsc --noEmit`。

## 任务 2：迁移 AI 助手的两个移动 Sheet

**文件：**

- 修改：`src/pages/assistant/components/assistant-sidebar/index.tsx`
- 修改：`src/pages/assistant/components/assistant-canvas/index.tsx`

- [ ] 会话侧栏改为左侧 Drawer，保留 88vw/320px 宽度。
- [ ] Header、动作区和账户 Footer 固定；ConversationList 保持唯一滚动区。
- [ ] 移动画布改为右侧 Drawer并保持全宽。
- [ ] `CanvasInner` 外层使用 `min-h-0 flex-1 overflow-hidden`，把高度传递给各 Tab 的内部滚动区。
- [ ] 两个 Drawer 都使用 `DrawerTitle`、`DrawerDescription` 和明确的关闭按钮。
- [ ] 验证移动端打开、关闭和内部滚动结构的 DOM 类名。

## 任务 3：迁移公共移动 Sidebar 并删除 Sheet

**文件：**

- 修改：`src/components/ui/sidebar/sidebar.tsx`
- 删除：`src/components/ui/sheet.tsx`

- [ ] 用 Drawer 替换移动端 Sidebar 的 Sheet Root/Content/Header/Title/Description。
- [ ] 根据 `side` 映射 `swipeDirection`，保留 `--sidebar-width` 与全部 `data-*` 属性。
- [ ] Drawer Content 使用视口内高度和 `overflow-hidden`；内部 Sidebar 内容继续负责滚动。
- [ ] 删除 `sheet.tsx`。
- [ ] 运行 `rg`，确认 `src` 中不存在 Sheet import、JSX 标识符或公共文件引用。

## 任务 4：验证桌面与移动端行为

- [ ] 运行 `pnpm exec tsc --noEmit`。
- [ ] 运行迁移文件定向 ESLint。
- [ ] 运行 `pnpm build`。
- [ ] 运行 `git diff --check`。
- [ ] 运行 Sheet 遗留词扫描，预期业务引用为 0。
- [ ] 在桌面宽度验证求职详情右侧 Drawer 打开、滚动、关闭和再次打开。
- [ ] 在 390×844 验证求职详情底部 Drawer、助手左侧会话 Drawer、右侧画布 Drawer、全局 Sidebar Drawer。
- [ ] 检查控制台无 `DialogTitle` 上下文错误。
- [ ] 如果登录态或真实数据不可用，明确记录未验证的交互，不用静态检查替代真实滚动结论。

## 任务 5：完成代码审查

- [ ] 检查所有 Drawer 的 Root、Title、Description 是否同树。
- [ ] 检查所有长内容是否遵守 `overflow-hidden` 外壳 + `min-h-0` 内滚动区。
- [ ] 检查退出动画期间内容未提前卸载，关闭后焦点可恢复。
- [ ] 修复审查问题后重跑相关验证。
