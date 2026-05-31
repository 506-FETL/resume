# AI Rewrite Bubble 动画实施计划

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 为 `ai-rewrite` 划词 BubbleMenu 增加基于 `motion` 的入场和出场动画。

**架构：** Tiptap 继续负责外层 DOM 定位和显示判断；React 通过 `BubbleMenuPlugin` 的 `onShow/onHide` 同步内容层可见状态；`RewriteBubbleMenu` 使用 `motion.div` 承载视觉动画。

**技术栈：** React 19、Tiptap BubbleMenuPlugin、motion/react、TypeScript、ESLint、Prettier。

---

### 任务 1：建立动画静态检查基线

**文件：**

- 检查：`src/components/ai-rewrite`

- [x] **步骤 1：确认当前没有 motion 动画**

```bash
rg -n "AnimatePresence|motion\\.div|onShow|onHide" src/components/ai-rewrite
```

预期：当前没有命中动画相关实现。

执行记录：初始检查未命中 `AnimatePresence`、`motion.div`、`onShow`、`onHide`。

### 任务 2：接入 BubbleMenu 显隐状态

**文件：**

- 修改：`src/components/ai-rewrite/ai-rewrite-bubble.tsx`

- [x] **步骤 1：新增 `bubbleVisible` 状态**

让 `onShow` 设置 `true`，`onHide` 设置 `false`。

执行记录：已完成，`ai-rewrite-bubble.tsx` 通过 `BubbleMenuPlugin.options.onShow/onHide` 同步状态。

- [x] **步骤 2：保持出场动画可见**

在 `onHide` 中把 `bubbleEl` 重新挂回 editor 父节点，恢复 `visibility/opacity`，让内容层 exit 动画可见，同时保持 Floating UI 原有定位坐标系。

执行记录：已完成，并加入 `disposed` 保护，避免卸载阶段重挂 DOM 或 setState。

- [x] **步骤 3：退出完成后清理 DOM**

在 `AnimatePresence.onExitComplete` 中移除隐藏后的 `bubbleEl`。

执行记录：已完成，退出动画结束且无子节点时移除外层 element。

### 任务 3：实现 motion 菜单内容

**文件：**

- 修改：`src/components/ai-rewrite/components/bubble-menu.tsx`

- [x] **步骤 1：引入 `motion`**

从 `motion/react` 引入 `motion`。

执行记录：已完成。

- [x] **步骤 2：把根节点改为 `motion.div`**

设置入场 `opacity/y/scale` 和出场 `opacity/y/scale`，保持原有 `className` 和 `data-variant`。

执行记录：已完成，保留 `tiptap-toolbar` 和 `data-variant="floating"`。

### 任务 4：验证

**文件：**

- 检查：`src/components/ai-rewrite`

- [x] **步骤 1：确认动画代码存在**

```bash
rg -n "AnimatePresence|motion\\.div|onShow|onHide" src/components/ai-rewrite
```

执行记录：通过，命中 `AnimatePresence`、`motion.div`、`onShow`、`onHide`。

- [x] **步骤 2：运行类型检查**

```bash
./node_modules/.bin/tsc --noEmit
```

执行记录：通过，命令退出码为 0。

- [x] **步骤 3：运行 ai-rewrite lint**

```bash
./node_modules/.bin/eslint src/components/ai-rewrite --max-warnings=0
```

执行记录：通过，命令退出码为 0。

- [x] **步骤 4：运行格式检查**

```bash
./node_modules/.bin/prettier --check docs/superpowers/specs/2026-05-31-ai-rewrite-bubble-motion-design.md docs/superpowers/plans/2026-05-31-ai-rewrite-bubble-motion.md
```

执行记录：文档 Prettier 检查通过；TSX 格式以项目 ESLint 规则为准，已运行 `./node_modules/.bin/eslint src/components/ai-rewrite/ai-rewrite-bubble.tsx src/components/ai-rewrite/components/bubble-menu.tsx --fix`。

- [x] **步骤 5：尝试启动本地页面验证**

```bash
./node_modules/.bin/vite --host 127.0.0.1 --port 5173
```

执行记录：启动失败。当前环境没有 `pnpm/npm/npx`，直接运行 Vite 时 Rollup 原生模块 `@rollup/rollup-darwin-arm64` 被 macOS 代码签名拦截，报 `ERR_DLOPEN_FAILED`。
