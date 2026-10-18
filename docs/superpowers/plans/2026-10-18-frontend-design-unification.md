# 全站前端设计统一实现计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 逐任务实现与审查，主代理负责共享层、集成与浏览器验收。步骤用复选框记录。不并行分派多个实现子代理。

**目标：** 按已批准方案 A，统一非模板页面的黑白工作台体验，修复响应式、动作命名和状态真实性。

**架构：** 保留共享侧栏、路由、业务 store 和服务。新增可选 PageLayout/PageHeader 与流式 AuthLayout；各页显式接入，模板和 A4 文档不继承新的视觉规则。复杂页面使用原有模块边界，布局状态放页面 store。

**技术栈：** React 19、TypeScript、Tailwind 4、Radix/shadcn、Zustand、Motion、Vite、pnpm。

**状态：** 实现完成，最终独立复审通过。下列未勾选的验收条目包含未覆盖场景或缺失脚本；实际结果与限制见 [验收记录](2026-10-18-frontend-design-verification.md)，不将未实测项目计为通过。

## 全局约束与基线

- 当前分支；不提交、不推送，不改数据库、Edge Functions、AI 提示词、评论协议。
- 排除 `src/pages/template/**`；不修改 Card/Button 的默认视觉、不改根主题和文档字体、分页、PDF 数据源。
- 保留已有 `skills-lock.json` 及 `.agents/skills/**` 未提交内容。
- 页面字号：标题 24/32、分区 16/24、正文 14/22、元信息 12/18；页面间距仅一层负责，手机 16、平板 24、桌面 32。
- 新动效引用 `DURATION`/`EASE` 并接入 `useReducedMotion()`；不重挂需要保留状态的 tab 内容。
- 仓库无需 TDD；以静态检查、现有脚本、实际浏览器验证为准。
- 实施前 TypeScript 基线有 3 处错误：index 未用 useMemo，resume/editor 与 share/view 传入 PageLoading 不支持的 label。三个文件均在授权范围，修改时一并修正调用。

## 任务 1：共享布局、导航与账户页面（主代理）

文件：新增 `src/components/layout/page-layout.tsx`、`auth-layout.tsx`；修改 `dashboard-shell.tsx`、`src/hooks/use-breadcrumbs.ts`、`src/components/dashboard/site-header.tsx`、`assistant-entry.tsx`、`src/pages/{login,sign-up,forgot-password,reset-password}/index.tsx`、`src/pages/profile/index.tsx` 及资料/偏好组件、`src/pages/changelog/index.tsx`、`src/pages/404.tsx`（以现有实际入口为准）。

- [x] 定义 `PageLayout({children,className,width:'default'|'wide'|'narrow'})`：默认 max-w-7xl、wide max1600、narrow max4xl；统一 px4/sm6/lg8、py6/sm8、gap6。`PageHeader({title,description?,actions?,children?})` 使用语义 h1、可换行操作栏。
- [x] DashboardShell 仅对已接入路由移除原 p4；模板及正文编辑器保持原容器。中文面包屑映射已知路由，当前项 aria-current；手机显示当前页，动态 id 不裸露。
- [x] `AuthLayout` 用正常流 `min-h-full flex items-center justify-center px-4 py-8` 和 max-w-md 内容列；四个表单沿用逻辑与顺序，标题 h1，去除遮挡装饰。
- [x] Profile 统一头部、身份手机纵向、长邮箱 break-all、偏好紧凑行，骨架匹配实际内容；日志补 h1、紧凑日期；404 保留简洁主返回动作。
- [ ] 验证 320/390 短屏表单、profile 长内容；模板不接入 PageLayout；定向 ESLint。

## 任务 2：助手自适应画布与输入框

文件：`src/pages/assistant/index.tsx`、`store.ts`、`const.ts`、`types.ts`、新增 `hooks/use-assistant-layout.ts`；`components/assistant-canvas/{index.tsx,canvas-tabs.tsx}`、`components/chat-header/index.tsx`、`components/composer/index.tsx`；`src/components/ui/composer.tsx`。

- [x] ResizeObserver 测量助手根容器宽度；聊天至少360、画布至少380，空间不足改抽屉；渲染宽度 `Math.min(preferredWidth, availableWidth - 360)`，拖动以有效宽度为起点、夹取 min/max，不覆写保存偏好。
- [x] 页面 store 共享布局模式，header 切换与实际 drawer 同步；切换断点、侧栏开合时不丢可发现入口，检查关闭时焦点恢复。
- [x] 输入框以现有语义 token 替换 zinc/亮青，中文 tooltip/aria，tab 保留挂载并淡入，减少动效归零。
- [ ] 执行定向 ESLint、TypeScript；主代理验收 390/768/1024/1440、侧栏开关、最大画布偏好。

## 任务 3：首页与简历入口

文件：`src/pages/index/{index.tsx,insights.ts,types.ts}`、`components/{header,todo,statistical-card,insight-cards,entry,skeleton}/index.tsx`；`src/pages/resume/index.tsx`、`components/{head-bars,resume-card,create-resume-card}/index.tsx`。

- [x] 两页接入 PageLayout；首页标题有创建动作，最近简历/继续编辑先于统计，零待办收为行，指标与稀疏图表降低占位，快捷入口与最近动态保留。
- [x] 每个资源 `data/loading/error/retry` 独立，失败保留已有数据并显示刷新失败；初次失败显示“—”及重试。取消/账户变化不能串数据，继续并发，不用一个 Promise.all 阻塞。
- [x] 简历头部创建主操作，计数/在线紧凑，禁用辅助项不占手机多行；卡片提供真实正文编辑 link/button，“编辑信息”进菜单，删除进菜单，派生分享仍可发现。
- [x] 创建卡片真实 button；避免嵌套交互和 Card 事件冲突；保持弹窗描述与现有创建流程。
- [ ] 检查正常/空/失败语义、键盘入口、390 首屏，定向 ESLint/TypeScript。

## 任务 4：分享、求职与历史管理

文件：`src/pages/share/index.tsx`、`components/{header,overview,card,content}/index.tsx`；`src/pages/tracker/index.tsx`、`components/overview-bar/{index.tsx,metric-card.tsx}`、`components/list/job-table.tsx`；`src/pages/history/index.tsx`、`store/{types.ts,history-ui.ts}`、`components/{workspace,timeline,detail-panel}/`。

- [x] 三页接入统一容器，分享网格不改；统计更紧凑，卡片交互/状态字号≥12，空态可创建。
- [x] 求职 max1600，工作区得到更多高度；列表按容器查询隐藏次要列，详情仍显示全字段，保持既有看板/列表偏好与八阶段拖拽，横滚仅工作区。
- [x] 历史桌面主从双栏；窄屏列表→选择→详情→返回，页面 store 管视图，列表保持挂载/滚动，返回可聚焦被选版本；tab 淡入不丢状态；未同步空态提供 /resume 入口。
- [ ] 检查筛选清空/空态、768/1024 容器、历史返回与焦点；定向 ESLint/TypeScript。

## 任务 5：ATS、正文编辑与公开阅读

文件：`src/pages/optimize/index.tsx`、`components/{header,analysis,repair-checklist,dashboard}/`；`src/pages/resume/editor/index.tsx`、`components/toolbar/index.tsx`；`src/pages/share/view/[token].tsx`（可按实际职责抽取 view/components/reading-toolbar/index.tsx）。

- [x] ATS 接入统一容器，未检测/检测中/失败/有结果分别表达；修复清单只有真实结果为0才成功；问题与下一步前置，分数去巨大水印、概览紧凑、雷达/分析依据后置。
- [x] 跑马提示改静态可展开帮助；confetti 受 useReducedMotion 控制；不改评分/修复逻辑。
- [x] 编辑器工具按排版/版本协作/导出分组，窄屏图标加中文名称，呈现文档上下文/真实保存状态，保留自动侧栏与表单逻辑；修正 PageLoading 调用。
- [x] 公开阅读外框提供适宽/缩放工具，缩放只改变显示容器，不改 A4 源/打印/PDF；保留选字、评论锚点，修正 PageLoading 调用。
- [ ] 定向 ESLint/TypeScript、已有 ATS 验证脚本，阅读缩放/编辑预览尺寸检查。

## 任务 6：集成审查与验收

- [x] 对每个任务核对规格与 diff，修复重要缺口；最终单独进行范围/行为审查，记录结果。
- [ ] 运行 `pnpm exec tsc -p tsconfig.app.json --noEmit`，预期 exit0；改动 TS/TSX 执行 `pnpm exec eslint <files>`，预期无错误；`pnpm build` 预期成功。专项脚本根据改动选用已有 verify:ats 等，不新增无意义测试。
- [ ] 浏览器覆盖 390/768/1024/1440，公共布局补320；浅深主题、reduced-motion、无整页横向溢出；不提交真实业务表单或制造真实数据。
- [ ] 创建简历、创建分享、优化弹窗至少两轮开关和退出中重开；检查遮罩、内容及焦点；检查键盘编辑入口、历史返回、助手画布。
- [ ] 审查 template 无源文件改动且不接入新样式，A4/PDF 源文档不改；恢复浏览器视口和侧栏。
- [x] 写入实际验收记录和限制，最终报告已优化内容、验证与剩余限制；不把不可验证状态写成通过。
