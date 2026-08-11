# 分享模块动效与打印一致性 实现计划

> **面向 AI 代理的工作者：** 按任务顺序执行。当前代码保持未提交、未推送。

**目标：** 分享模块使用统一 Motion 动效，并让预览与 PDF 复用同一分页 DOM。

---

## 任务 1：分页就绪状态

**文件：**

- 修改：`src/components/resume/paged-resume-shell.tsx`

- [ ] 增加 `onReadyChange?: (ready: boolean) => void`
- [ ] 内容或外观变化时先上报 false
- [ ] ResizeObserver 计算页数并等待下一帧后上报 true
- [ ] 卸载时上报 false

## 任务 2：预览暴露打印节点

**文件：**

- 修改：`src/components/resume/scaled-readonly-preview.tsx`

- [ ] 增加 `documentRef?: Ref<HTMLDivElement>`
- [ ] 增加 `onDocumentReadyChange?`
- [ ] `documentRef` 直接传入内部 `PagedResumeShell`
- [ ] 不在打印节点内部添加 Motion

## 任务 3：PDF 复用预览 DOM

**文件：**

- 修改：`src/pages/share/components/share-pdf-export/index.tsx`
- 修改：`src/pages/share/view/[token].tsx`

- [ ] 删除 PDF 组件内部 snapshot / manifest 渲染
- [ ] PDF 组件改为接收 `contentRef`、`ready`、`documentTitle`
- [ ] 分享页创建 `documentRef`
- [ ] 预览把 ref / ready 回调传给 `ScaledReadonlyPreview`
- [ ] 下载按钮在 ready=false 时禁用

## 任务 4：共享动效常量

**文件：**

- 修改：`src/pages/share/const.ts`

- [ ] 增加页面、列表、卡片、stagger 规范

## 任务 5：管理页与列表 Motion

**文件：**

- 修改：`src/pages/share/index.tsx`
- 修改：`share-grid`
- 修改：`share-card`
- 修改：`share-mobile-list`
- 修改：`share-mobile-item`
- 修改：`share-empty-state`

- [ ] 页面进入 motion
- [ ] 内容与空状态 AnimatePresence
- [ ] 桌面 / 移动列表 popLayout
- [ ] 卡片 motion layout + enter / exit
- [ ] reduced motion

## 任务 6：快速 Dialog 与 Drawer Motion

**文件：**

- 修改：`share-dialog/index.tsx`
- 修改：`share-dialog/share-link-row.tsx`
- 修改：`share-action-drawer/index.tsx`
- 修改：`share-settings-dialog/index.tsx`
- 修改：`share-create-dialog/index.tsx`

- [ ] 链接列表 AnimatePresence
- [ ] row motion layout
- [ ] Drawer 操作 stagger
- [ ] Eye/EyeOff 图标切换

## 任务 7：验证

- [ ] `pnpm exec tsc --noEmit`
- [ ] 目标 ESLint
- [ ] `pnpm build`
- [ ] `git diff --check`
- [ ] 确认 `SharePdfExport` 不再渲染 `PagedResumeShell`
- [ ] 确认 Motion 不在 `documentRef` 内部

