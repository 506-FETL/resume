# 助手上下文计数修复计划

**目标：** 消除重复放大的估算与输入时清空统计，明确首次和未知状态。

**架构：** 估算和校准使用 provider 的实际输入；显示取当前会话最近调用快照，草稿与既有调用分开。复用现有组件、store 和压缩机制。

**技术栈：** React、Zustand、AI SDK DeepSeek provider、Radix HoverCard、Vite。

- [x] 阅读防回归清单与 11 月 15 日档案/助手规格、计划和验收，复现完整请求在固定 usage 下估算从 9470 增到 23528。
- [x] 修改 `src/lib/ai/agent/context-budget.ts`：`observe(messages, inputTokens, requestInput = messages)` 用完整输入校准，消息前缀仍仅用于同轮预算复用。
- [x] 修改 `src/lib/ai/agent/agent-loop.ts`：在 provider fetch 中捕获 `{ messages, tools }` 并报告估算；完成时传入同一对象校准；raw 输入/输出缺失不作为 0。
- [x] 修改 `src/pages/assistant/components/context-usage/index.tsx` 和必要的局部快照选择函数：读取当前会话最近 assistant 记录，当前调用有统计时优先；保留“上次调用”，新会话“未发送”，加载/失败/旧记录缺失分别表述。移除 Composer 不再需要的 sources 传参。
- [x] 在 `tests/assistant-context-usage/` 运行正式 SDK/运行器及组件验收：固定请求多轮、真实上游 usage、输入/附件/切会话/失败、宽度主题、键盘和动效。复用现有 HoverCard、Progress、AnimatedContent，不引入新 UI 或测试依赖。
- [x] 对改动文件执行 `pnpm exec prettier <文件> --write`、`pnpm exec eslint <源码文件> --fix --fix-type layout`；运行 TypeScript、生产构建、diff 检查和局部 lint/格式检查。
- [x] 记录实际结果与限制，更新防回归条款，删除 tests 下临时脚本与账户/数据，交用户审查。不 commit 或 push，不自动发布前端。

实施完成，功能与局部工程验证通过；用户审查待进行。全仓既有格式问题、部署及清理证据见同名验收记录。前端未发布，未 commit 或 push。
