# AI Rewrite Hooks Memoization 实施计划

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 删除 `src/components/ai-rewrite` 中没有明确收益的 `useCallback` / `useMemo`，并把规则补充到 React 相关 skill。

**架构：** 保持现有 AI rewrite 分层不变，只把轻量事件处理和 session action 从 memoized callback 改为普通函数。`useAiRewrite` 的卸载取消逻辑直接使用 `abortRef` cleanup，避免为了 effect 依赖保留稳定 callback。

**技术栈：** React 19、TypeScript、Tiptap、ESLint、Prettier、Superpowers skills。

---

### 任务 1：建立当前规则检查基线

**文件：**

- 检查：`src/components/ai-rewrite`

- [x] **步骤 1：运行 memoization 规则检查**

```bash
rg -n "useCallback|useMemo" src/components/ai-rewrite
```

预期：命中当前多处 `useCallback`，证明本次规则检查在当前代码上失败。

执行记录：已命中 19 处 `useCallback` 相关位置，作为本次清理的基线。

### 任务 2：清理 ai-rewrite 运行时代码

**文件：**

- 修改：`src/components/ai-rewrite/ai-rewrite-bubble.tsx`
- 修改：`src/components/ai-rewrite/hooks/use-ai-rewrite.ts`
- 修改：`src/components/ai-rewrite/hooks/use-rewrite-session.ts`
- 删除：`src/components/ai-rewrite/hooks/use-rewrite-selection.ts`
- 新建：`src/components/ai-rewrite/utils/read-rewrite-selection.ts`

- [x] **步骤 1：删除组件层低收益 `useCallback`**

把 `handleClose`、`handleAction`、`handleApply`、`handleRetry` 改成普通函数。

执行记录：已完成，`ai-rewrite-bubble.tsx` 不再导入 `useCallback`。

- [x] **步骤 2：删除 session hook 中的低收益 `useCallback`**

把 `startStreaming`、`succeed`、`fail`、`reset`、`setJdDraft`、`waitForJd` 改成普通函数。

执行记录：已完成，`use-rewrite-session.ts` 只保留 `useState`。

- [x] **步骤 3：把 selection hook 改为普通工具函数**

删除 `useRewriteSelection(editor)` hook，把读取逻辑迁移为 `readRewriteSelection(editor)`。

执行记录：已完成，新增 `utils/read-rewrite-selection.ts` 并删除原 hook 文件。

- [x] **步骤 4：删除 AI 请求 hook 中的低收益 `useCallback`**

把 `cancel`、`run`、`retry`、`waitForJd` 改为普通函数。`useEffect` cleanup 直接 abort `abortRef.current`，不依赖 callback identity。

执行记录：已完成，`use-ai-rewrite.ts` 只保留 `useEffect` 和 `useRef`。

### 任务 3：更新 React hooks 使用规则

**文件：**

- 修改：`/Users/shemingcong/.codex/plugins/cache/openai-curated/vercel/fef63ecf/skills/react-best-practices/SKILL.md`
- 修改：`/Users/shemingcong/.codex/plugins/cache/openai-curated/build-web-apps/fef63ecf/skills/react-best-practices/SKILL.md`
- 新建：`/Users/shemingcong/.codex/plugins/cache/openai-curated/build-web-apps/fef63ecf/skills/react-best-practices/rules/rerender-manual-memoization-gate.md`

- [x] **步骤 1：补充 hooks 判断规则**

明确 `useCallback` / `useMemo` 不是默认优化，只在昂贵计算、memoized 子组件引用稳定、effect / 外部订阅稳定依赖、profiling 证明需要时使用。

执行记录：已完成，两个 React best practices skill 均能通过关键词检索到新规则。

### 任务 4：验证

**文件：**

- 检查：`src/components/ai-rewrite`
- 检查：React best practices skill 文件

- [x] **步骤 1：确认 ai-rewrite 不再命中低收益 memoization**

```bash
! rg -n "useCallback|useMemo" src/components/ai-rewrite
```

执行记录：通过，命令退出码为 0。

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
./node_modules/.bin/prettier --check src/components/ai-rewrite/README.md docs/superpowers/specs/2026-05-31-ai-rewrite-hook-memoization-design.md docs/superpowers/plans/2026-05-31-ai-rewrite-hook-memoization.md /Users/shemingcong/.codex/plugins/cache/openai-curated/vercel/fef63ecf/skills/react-best-practices/SKILL.md /Users/shemingcong/.codex/plugins/cache/openai-curated/build-web-apps/fef63ecf/skills/react-best-practices/SKILL.md /Users/shemingcong/.codex/plugins/cache/openai-curated/build-web-apps/fef63ecf/skills/react-best-practices/rules/rerender-manual-memoization-gate.md
```

执行记录：通过，命令退出码为 0。
