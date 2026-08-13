# 简历评论视觉与交互精修实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复评论双端 Drawer、书签、历史版本审阅态、高亮和三层评论树的视觉与交互问题。

**架构：** 评论面板使用领域专用媒体查询决定底部或右侧 Drawer；历史审阅态由编辑页显式渲染；评论树采用三层有界递归和路径栈钻取。通用 Drawer 只增加可选遮罩样式接口，不改变默认行为。

**技术栈：** React 19、TypeScript、Zustand、Base UI Drawer、Tailwind CSS、Motion、shadcn 组件。

---

### 任务 1：固定双端 Drawer 与评论遮罩

**文件：**
- 创建：`src/features/resume-comments/hooks/use-comment-mobile-layout.ts`
- 修改：`src/features/resume-comments/components/comments-panel.tsx`
- 修改：`src/components/ui/drawer.tsx`
- 修改：`scripts/verify-resume-comment-client.ts`

- [x] 实现评论专用媒体查询：窄屏或 1024px 内粗指针无 Hover 设备返回移动布局。
- [x] 将 `CommentsPanel` 从通用 `useIsMobile` 切换到评论专用 Hook。
- [x] 为 `DrawerContent` 增加 `overlayClassName`，评论遮罩禁用背景模糊。
- [x] 扩展静态验证，确认移动端使用向下手势、Overlay 无模糊且 Provider 位于 Drawer 内。

### 任务 2：缩小书签并增加历史版本审阅条

**文件：**
- 修改：`src/features/resume-comments/components/comment-bookmark.tsx`
- 创建：`src/pages/resume/editor/components/comment-review-banner/index.tsx`
- 修改：`src/pages/resume/editor/index.tsx`
- 修改：`src/pages/resume/editor/hooks/use-comment-review-mode.ts`
- 修改：`scripts/verify-resume-comment-client.ts`

- [x] 将书签缩小到约 36×40px，图标 16px并降低阴影。
- [x] 复用审阅模式已暴露的当前历史来源标签。
- [x] 在桌面与移动预览上方渲染持续可见的只读审阅条。
- [x] “返回当前版本”复用 `handleCommentSourceChange('working')` 恢复编辑状态。

### 任务 3：重构三层连接线评论树

**文件：**
- 修改：`src/features/resume-comments/components/comment-tree.tsx`
- 修改：`scripts/verify-resume-comment-client.ts`

- [x] 将主树可见递归深度调整为根节点加两层回复。
- [x] 为有子节点的头像添加向下竖线，为每个子节点添加圆角折线。
- [x] 第 3 层仍有后代时显示消息图标和“继续查看 N 条回复”。
- [x] 使用 `detailPath: string[]` 替代单一详情 ID；进入时压栈，返回时只弹出一层。
- [x] 使用 Motion 为逐层进入/返回提供短距离横向过渡，并尊重 Reduced Motion。

### 任务 4：修复关闭后的强高亮反弹

**文件：**
- 修改：`src/features/resume-comments/components/comment-surface.tsx`
- 修改：`scripts/verify-resume-comment-client.ts`

- [x] 仅在 Drawer 打开时向高亮层传入 active/hovered ID。
- [x] Drawer 关闭状态忽略锚点 Hover 写入，保留弱高亮。
- [x] 增加源码断言，防止状态边界回归。

### 任务 5：回归验证与提交

**文件：**
- 修改：`docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md`

- [x] 运行 `pnpm verify:comment-client` 与 `pnpm verify:comment-service`。
- [x] 运行目标 ESLint 与 `pnpm exec tsc --noEmit`。
- [x] 运行 `pnpm build` 和 `git diff --check`。
- [x] 记录自动验证结果与仍需用户完成的真机交互验收项。
- [x] 提交本轮实现，不推送远端。
