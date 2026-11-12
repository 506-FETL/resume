# 加载体验调整实现计划

> 面向执行代理：使用 subagent-driven-development 的任务审查方式。共享基础先完成，随后按 dispatching-parallel-agents 将无重叠的页面目录分工；最终统一审查。用户已授权当前分支直接实施、最后审查；不创建分支、不 commit/push、不执行 TDD，不增加新依赖。

**目标：** 页面读取与预览采用合适占位，已有内容在同目标刷新时保留，必要提交继续就地反馈，避免一屏多处转圈。

**架构：** 复用 shadcn Skeleton 并提供少量内容/纸张组合。共享延迟边界允许调用方提供轻量 fallback，路由使用轻量结构占位。业务数据源、写入顺序、缓存与权限保持现状，仅修正已确认的独立就绪与刷新展示条件。

**技术栈：** React 19、TypeScript、Zustand、Motion、现有 shadcn/ui、Vite、Playwright。

**规格：** [全项目评估](../specs/2026-11-12-loading-experience-design.md)。组件检索已确认现有 Skeleton、Spinner、Button、Select、Dialog、AnimatedContent 足够；不引入新 UI 库。transitions-dev 的占位同槽衔接原则结合仓库既有 Motion 实现，不复制其另一套时长和 blur 参数。

## 任务 1：共享基础与路由（主代理）

- [x] `src/components/ui/skeleton.tsx`：接入公共 useReducedMotion，骨架默认仅作装饰。
- [x] 新增 `src/components/loading-skeleton/index.tsx`：导出 `LoadingRegion`、`ContentSkeleton`、`PaperSkeleton`、`FormSkeleton`。仅组合现有 Skeleton，使用公共时长和淡入，内容骨架默认三行，纸张保持 210/297 比例；调用方传 label/className，不构建配置生成器。
- [x] `src/components/deferred-content/index.tsx`：第三参数接受 ReactNode fallback，默认 FormSkeleton，保留 lazy 缓存与局部错误重试。调用示意：

```tsx
const Content = createDeferredComponent(
  loader,
  '评论面板',
  <ContentSkeleton label='正在加载评论' />,
)
```

- [x] 新增 `src/components/route-skeleton/index.tsx`，修改 `src/App.tsx`、`src/components/job-context/index.tsx`、`src/pages/resume/editor/index.tsx`：按当前页面类型使用轻量内容/纸张占位；恢复会话仍保留 PageLoading。不静态导入业务页面重模块。
- [x] 分别给 12 个表单与检查/填写建议/导出/模板/协作/分享/评论注册合适 fallback，保持窗口标题、关闭、跨关闭状态和错误重试。

## 任务 2：模板、简历与预览（独立实现）

文件范围：`src/pages/template/`、`src/pages/resume/components/`、`src/pages/resume/editor/components/template-switch-gallery/`、`src/pages/resume/editor/components/template-switch-dialog/components/dialog-body/`、`src/components/resume/template-resource-status/`。

- [x] 模板目录首次读取显示网格纸张骨架；卡片/向导/模板切换/详情背景的图片等待改 PaperSkeleton；图片解码、错误重试、精确版本和按需读取不变。
- [x] 简历预览与模板名称改纸张/文字占位，缓存成品保留；创建草稿和同步候选改对应内容占位，保留提交与识别 Spinner。
- [x] `TemplateResourceStatus` 的成功等待改纸张占位，错误分支与重试保留；目录消费者使用目录骨架，不拿纸张替代列表。
- [x] 模板加载更多继续只在尾部按钮反馈；去掉页数旁重复转圈，统计未知不写 0。
- [x] 完成变更文件 Prettier、ESLint layout 和定向 lint，给出修改清单与风险供任务审查。

## 任务 3：首页、优化、分享与历史（独立实现）

文件范围：`src/pages/index/`、`src/pages/optimize/`、`src/pages/share/components/`（不改 quick-dialog 根注册）、`src/pages/history/`、`src/pages/profile/index.tsx`。

- [x] 首页最近简历、三提醒、图表、动态改结构占位；已知标题/动作保留，各数据源依赖不合并；保留现有待办、统计布局。
- [x] 优化的问题分析、雷达区域、修复清单、高级工具和简历列表读取改局部骨架；生成/检测/应用修改继续使用真实任务反馈。
- [x] 快捷分享链接内容改行骨架；历史关联岗位和计数改短占位，已存在时间线/对比骨架不叠加圈；提交、恢复、导出保持原实现。
- [x] 资料页骨架保留结构，静态标题直接展示。
- [x] 完成变更文件格式和定向 lint，给出任务审查材料。

## 任务 4：求职详情与刷新（独立实现）

文件范围：`src/pages/tracker/`。不改数据库和网络协议。

- [x] 首次继续 TrackerSkeleton；同账户已初始化刷新保留旧内容，仅局部状态标记。失败保留旧内容及重试；已有保存队列与账户清空逻辑不动。
- [x] 公司、JD、投递详情/历史、准备简历与原件预览改内容/纸张骨架。
- [x] CompanyPicker 等选择器保留真实控件及已选值，同一请求只保留一个主要 Spinner；字段旁避免重复与布局跳动。
- [x] 公司规则、响应率未知信息改短占位；自动保存文字立即更新、圈延后出现，快速完成不闪圈。
- [x] 使用正式组件/真实 store 检查有旧结果刷新、失败重试、首次空/失败分离、320px 与键盘；临时材料仅放 tests/loading-audit/tracker。

## 任务 5：助手与其余读取入口（主代理）

- [x] `src/pages/assistant/hooks/use-assistant-bootstrap.ts`：会话列表返回后立即清除该列表 loading，消息独立等待；保留 ownsRequest/ownsView。初始化错误显示可重试错误，不把失败作为“暂无对话”。
- [x] 助手切换继续使用 pendingConversationId 的单项反馈，确认旧消息和新目标不会混淆；短反馈延后，读屏及禁用不延后。
- [x] 公开分享首次改中性纸张占位，网络异常区分链接不可用并支持重试；不改变密码、隐私失效、no-store 和正文真源。
- [x] 填写记录、派生关系、JD 初始读取和任务清单改对应占位；同步/提交/生成继续保留反馈。
- [x] 复查剩余 Spinner、PageLoading、toast.promise；去除同一任务的重复提示，未必要的行为不扩大重构。

## 任务 6：验证、审查、文档与清理

- [x] 任务差异进行规格与质量审查，修正遗漏，再按 review-animations 检查过渡、退出数据与减少动效。
- [x] `pnpm exec tsc --noEmit -p tsconfig.app.json` 和 node 配置类型检查；`pnpm build`；`pnpm format:check`；`git diff --check`。
- [x] 使用临时 tests/loading-audit 真实组件入口，隔离外部写入。验证首次/已有数据刷新、慢资源/失败重试、短任务、重开/反向、焦点与动态减少动效。
- [x] 实际模板页慢图桌面/手机不再逐卡转圈，恢复后显示真实图片；生产分包检查普通入口不带编辑器/WASM。
- [x] 代表性弹窗至少两轮开关与退出中重开；复核退出高度和数据，通读实际中文。
- [x] 写验收记录，更新防回归清单的加载使用规则与 AGENTS.md 中“整块加载”的旧表述；区分实施、验证、用户审查。
- [x] 删除本轮 tests 临时脚本/数据/截图，停止本轮服务与隔离浏览器；不影响已有 5173 服务。

## 交付状态

代码实施与独立源码审查完成，三项审查发现均修正复核。验证方式、实际结果和未覆盖范围见[验收记录](../specs/2026-11-12-loading-experience-acceptance.md)。全项目格式检查通过，临时夹具与预览服务已清理；用户审查尚未进行，前端未发布，无 commit/push。
