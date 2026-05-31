# AI Rewrite Hooks Memoization 设计

## 背景

`src/components/ai-rewrite` 中存在较多 `useCallback` 包装。当前组件树没有使用 `React.memo` 形成需要稳定函数引用的性能边界，也没有明显昂贵的同步计算需要 `useMemo` 缓存。这些 hook 反而增加依赖数组维护成本，并让简单事件处理逻辑变得更难读。

## 目标

- 对 `ai-rewrite` 内所有 `useCallback` / `useMemo` 使用点逐一诊断。
- 删除没有明确收益的 `useCallback` / `useMemo`。
- 保留必要的 React hook：`useEffect`、`useRef`、`useState`。
- 保持现有划词改写行为不变：划词菜单、JD 等待、LLM 请求、重试、取消、应用候选都不改变。
- 将“不要默认使用 `useCallback` / `useMemo`”写入 React 相关 skill，避免后续继续无脑添加。

## 非目标

- 不重做 AI rewrite 的组件分层。
- 不改 LLM prompt、解析规则或 session 状态机。
- 不引入新的状态管理库。
- 不新增 React memoization 边界。

## 判断标准

`useCallback` / `useMemo` 只有在下面条件之一成立时才使用：

- 计算明显昂贵，且依赖稳定时缓存能减少实际开销。
- 函数引用会传给 `React.memo` / `memo` 子组件，并且该引用稳定性会影响跳过渲染。
- 函数引用必须作为 effect / 外部订阅 / 第三方 API 的稳定依赖。
- 已经通过 profiling 或明确约束证明引用变化造成问题。

以下场景不使用：

- 普通按钮点击、输入变更、弹窗关闭等轻量事件处理。
- 简单布尔值、字符串、对象字段读取等派生值。
- 为了“看起来像优化”而包裹函数。
- 为了逃避依赖数组告警而包裹函数。

## 方案

### 推荐方案：删除低收益 memoization

将 `ai-rewrite-bubble.tsx`、`hooks/use-ai-rewrite.ts`、`hooks/use-rewrite-session.ts` 中的低收益 `useCallback` 改为普通函数。原 `hooks/use-rewrite-selection.ts` 不再使用 React hook，改为 `utils/read-rewrite-selection.ts` 普通工具函数。`useAiRewrite` 的卸载取消逻辑改为 effect cleanup 直接读取 `abortRef`，避免依赖稳定 callback。

优点：代码更直接，依赖数组更少，行为更容易推理。

缺点：每次 render 会创建普通函数，但这些函数没有被 memoized 子组件用于跳过渲染，因此成本可以忽略。

### 备选方案：只删除组件层 callbacks

只删除 `ai-rewrite-bubble.tsx` 里的事件 handler memoization，保留 hooks 返回函数的 `useCallback`。

优点：改动更小。

缺点：hooks 内仍然保留不必要的依赖复杂度，不能完整贯彻规则。

### 备选方案：全部保留并加注释

保留当前写法，只用注释解释。

优点：运行时代码无改动。

缺点：不能解决用户指出的问题，也会继续鼓励错误模式。

## 采用方案

采用“删除低收益 memoization”。本次没有发现 `ai-rewrite` 内存在需要保留 `useCallback` 或 `useMemo` 的场景。

## 验证

- 规则检查：`rg -n "useCallback|useMemo" src/components/ai-rewrite` 应不再命中。
- 类型检查：`./node_modules/.bin/tsc --noEmit`。
- 代码检查：`./node_modules/.bin/eslint src/components/ai-rewrite --max-warnings=0`。
- 格式检查：`./node_modules/.bin/prettier --check src/components/ai-rewrite/README.md docs/superpowers/specs/2026-05-31-ai-rewrite-hook-memoization-design.md docs/superpowers/plans/2026-05-31-ai-rewrite-hook-memoization.md /Users/shemingcong/.codex/plugins/cache/openai-curated/vercel/fef63ecf/skills/react-best-practices/SKILL.md /Users/shemingcong/.codex/plugins/cache/openai-curated/build-web-apps/fef63ecf/skills/react-best-practices/SKILL.md /Users/shemingcong/.codex/plugins/cache/openai-curated/build-web-apps/fef63ecf/skills/react-best-practices/rules/rerender-manual-memoization-gate.md`。
