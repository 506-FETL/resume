# 简历编辑首屏 LCP 实现计划

用户已授权本轮排查与修复，当前分支执行并最终交用户审查；不重复请求确认，不提交、不推送，不执行 TDD。沿用 writing-plans 拆分任务，在当前会话完成。

**目标：** 缩短正文请求前的工作区模块等待。

**架构：** 原加载 hook 常驻轻量入口；原工作区 lazy 加载；用户展示复用现有用户 store；其余加载与持久化顺序保持不变。

**技术栈：** React 19、Vite 7、Zustand、现有 Supabase SDK 与 Automerge。

- [x] 阅读防回归 23–27 节及编辑启动、正文传输的规格、计划和验收；保存原暂存差异摘要。
- [x] Chrome 录制请求与 CPU，识别控制工具的 IMG 候选干扰，准备原生刷新采样。
- [x] 将 `src/pages/resume/editor/index.tsx` 原工作区移至 `components/editor-workspace/index.tsx`，仅调整相对导入并将 `useResumeLoader()` 的返回值改为单层 props。
- [x] 入口调用 `useResumeLoader()`，使用已有延迟组件加载工作区，原样传入 RouteSkeleton；hook 不放进会 suspend 的子树。
- [x] 加载 hook 的 `subscribeToResumeConfigUpdates` 和保存 slice 的 `updateResumeConfig` 直接从 `@/lib/supabase/resume/config` 导入。
- [x] 沿用局部重试组件，增加原样 fallback 选项，默认调用保持不变。
- [x] 主入口路由预取无稳定收益，已撤回；通过真实 session 计时找到重复展示订阅，把 useCurrentUser 改为读取已有 useUserStore，保留原返回语义。
- [x] 验证 25 个 hook 消费者的 unknown、A→B→A、退出及零重复 session 读取。
- [x] 对照前后请求启动；验证同次加载只读一次、原门禁/错误/取消路径不变。
- [x] 验证生产模块依赖、真实页面重入/表单/检查/评论及合成离线保存重开。
- [x] 执行 `pnpm exec tsc -p tsconfig.app.json --noEmit`、node 类型检查、定向 lint、`pnpm build`；改动文件 Prettier 后执行 ESLint layout。
- [x] 删除临时探针/脚本/跟踪，执行 `pnpm format:check` 与 `git diff --check`，确认原暂存区摘要未变，更新验收与防回归记录。

文本解析直接计时仅约 1–2 ms，已排除该假设，不增加快速路径。锁屏期间的采样无 LCP，不纳入对照。
