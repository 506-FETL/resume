# 职业档案与助手体验修正实现计划

> 面向 AI 代理的工作者：使用 subagent-driven-development 逐项实现和审查。用户授权当前分支直接落地，无 TDD、commit、push 或再次审批。临时验证放 tests，结束删除。

**目标：** 完成用户九项反馈及全项目 Tooltip 精简。

**架构：** 沿用私有资料、版本、提取、工具读取与来源引用链。改进缓存和交互，在助手中自动使用账户范围。复用 shadcn 与已有文件预览、Tiptap 定位。

**技术栈：** React、Zustand、shadcn/Radix、AI SDK、Supabase、Tiptap、Motion。

## 任务 1：职业档案保存、缓存与文件阅读

**文件：** `src/features/experience-sources/upload-dialog/index.tsx`、`use-source-list.ts`、`src/store/experience-sources/index.ts`、`src/pages/experience/components/{library,source-detail,reading-view}/index.tsx`、必要的 `src/lib/experience-sources/` 和 Edge。用户可见名称涉及 sidebar、breadcrumb、assistant 与 API 错误，统一“职业档案”，不改内部字段。

- [x] 阅读规格与实际代码，记录现有分页、全部缓存、原件 API 和可复用渲染器。
- [x] 上传加入 `queued` 状态，`addFiles` 仅选入；单一 `async save()` 处理当前 tab、失败重试及真实完成。底部按钮 `disabled={saving || !canSave}`，保存中统一 Spinner。固定外壳 `height: min(40rem, 85dvh)`，flex 头尾与滚动内容，不调整共享 Dialog。
- [x] `load(query, offset, refresh, kind)` 先返回有效缓存；当同 query 的全部页连续覆盖 total 时派生 kind 页，切换无网络。hook 只在没有有效缓存或实际请求时置 busy；列表保留 10 项分页与回页状态。
- [x] 新增原件展示，复用原件下载 API。Blob 缓存按 generation/source/version；PDF 真预览，其他文件按真实支持展示，明显下载入口，段落出处仍可读取。
- [x] 统一可见命名；本任务改动 Prettier → ESLint layout → TypeScript。验证固定尺寸、单保存、23 项分类缓存、失败、原件下载和按需加载，报告至 `/tmp/career-task-1-report.md`。

## 任务 2：自动档案、聊天文件、标签与 Context

**文件：** `src/pages/assistant/{components,store,runtime,hooks}`、`src/lib/ai/agent/{context-events,context-budget,agent-loop,evidence-tools,build-context}.ts`、`src/lib/ai/types.ts`、必要的资料 API 与 Edge。

- [x] 移除 `ConversationSources` 常驻 UI；将 `loadSourceScope` 连接本账户全库轻量目录并共享缓存，不逐轮重新全库下载正文。scope 冻结与显式 reference 版本优先不变。
- [x] 加号提供真实文件选择，并支持输入区 drop/paste；复用任务 1 保存/提取逻辑，上传完成只加附件引用、不自动发送正文。失败和未知结果可核对；历史文件有真实下载路径。
- [x] 实际渲染所有引用类型，追踪颜色根因；命令按 id 对照现有目录语义色，保持100/88px/8px及非submit移除。
- [x] 按 [shadcn Radix Context](https://ui.shadcn.com/docs/ai-elements/radix/context) 的 HoverCard+Progress 组合接入轻量组件，手机click/keyboard可打开。通过运行回调记录每步输入/输出usage，按 conversation保存当前窗口而非累计消费；未知/估算正确标示。
- [x] 保留队列、历史重试、来源变更摘要失效、账户与运行器边界；运行真实工具链与 UI 验证，格式/类型检查，报告 `/tmp/career-task-2-report.md`。

## 任务 3：Tiptap 存档与全站提示审查

**文件：** `src/components/ai-rewrite/ai-rewrite-bubble.tsx`、`src/components/tiptap-templates/simple/simple-editor.tsx`，新增选区存档组件，`rg -l 'Tooltip|tooltip=|title=' src` 确认的调用点。

- [x] 使用官方 BubbleMenu 既有定位，替换旧改写浮层为 `存入职业档案`。保存点击时选区和名称；动态加载提取，沿用 operationId/真实API，Spinner、错误重试与成功反馈，原文不变。
- [x] 逐处评估提示并在验收文档列出保留类别与删除点；只删重复文字或无意义 title，不删除图标/截断/快捷键/额外规则，保留ARIA名称。
- [x] 实际评论回复/编辑和代表性入口检查无重复提示，桌面手机/键盘/减少动效；实际选区存档并回读；格式/类型检查，报告 `/tmp/career-task-3-report.md`。

## 任务 4：集成、云端、验收交付

- [x] 每组实现生成任务差异包并审查规格与质量，修复确定问题；不改已有非本期修改。
- [x] 本期无 Supabase 迁移/Edge变更，无新增部署；复用既有云端服务，真实验收x-sb-edge-region、原件/账户权限与非模型操作无新增账单。
- [x] 桌面与320/390手机，浅深色、两轮开关/反向、键盘、动态减少动效；真实文件附件到模型读取与原件查看链路。
- [x] `pnpm exec tsc --noEmit`、`pnpm build`、`pnpm format:check`、`git diff --check`；更新防回归清单及新验收记录，清理本期 tests/临时账户/服务，保留用户原5173服务。
- [x] 记录实施完成、验证结果与未覆盖边界，用户审查待进行；前端未发布须明确，不自动推送。
