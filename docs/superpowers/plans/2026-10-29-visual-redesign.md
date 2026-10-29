# 全站「专注编辑」视觉重设计实现计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 执行独立模块任务，主代理统一处理共享组件与浏览器验收。各任务完成后检查规格合规性与代码质量，最后做整体审查。

**目标：** 按用户已批准的「专注编辑」规格完成全站视觉重设计，保留现有功能并提供实际验证证据。

**架构：** 沿用 PageLayout、DashboardShell、现有 shadcn 组件与 Zustand。共享层只改应用外壳和排版，页面内用单层内容块、信息行与明确的主次关系组织现有数据。文档正文、后端、权限和数据契约不变。

**技术栈：** React 19、TypeScript、Vite、Tailwind CSS 4、shadcn/ui、Motion、Zustand、pnpm。

**批准依据：** 用户于 2026-10-29 明确批准推荐方案及 `docs/superpowers/specs/2026-10-29-visual-redesign-design.md`，要求直接实施并验证。

## 全局约束

- 当前分支执行，不创建 worktree，不自动提交或推送；工作区已有暂存的动效变更，按修改前差异保护，不能归为本轮实现。
- 不执行 TDD，不增加依赖，不重造 Button、Tabs、Dialog、Select；普通语义布局可直接组合。临时验证脚本/夹具仅在 `tests/visual-redesign/`，结束删除本轮内容。
- 文件先 Prettier，再 ESLint `--fix --fix-type layout`。排版修复不得顺带改写逻辑。
- 所有动画复用 `src/lib/motion.ts` 与 `@/hooks/use-reduced-motion`；保留现有进入/退出/切换，去掉无意义旋转和追随光晕。
- 不改 store 的数据流、不改数据库/Edge Functions、不写用户简历内容。重构页面保持已有 history-style 目录及共享状态边界。
- 保留首页三提醒的紫/琥珀/红、大图标与局部渐变，保留 ATS 真实分数水印、Racing Sans One 及评分色。
- 保留看板/列表、工具栏、列宽及三页签抽屉；保留编辑器居中工具栏、手机图标、表单/检查切换；不改模板正文、测量、分页和打印。

## 文件职责与任务边界

| 任务 | 文件范围                                                                                                                                     | 职责                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1    | `src/components/layout/`、`src/components/dashboard/`                                                                                        | 应用外壳、导航、共享标题与认证布局 |
| 2    | `src/pages/index/`、`src/pages/resume/components/`、`src/pages/resume/index.tsx`、`src/pages/share/components/`、`src/pages/share/index.tsx` | 首页、简历与分享管理               |
| 3    | `src/pages/optimize/`、`src/pages/profile/`、`src/pages/template/`、`src/pages/changelog/`                                                   | 优化、设置、模板目录与日志         |
| 4    | `src/pages/tracker/`、`src/pages/assistant/`、`src/pages/history/`、`src/pages/resume/editor/`、`src/pages/share/view/`                      | 工作区和阅读界面                   |
| 5    | 认证页面、404、前四项遗漏与修正                                                                                                              | 共享变更的集成验收                 |
| 6    | 规格/验收/防回归记录、`DESIGN.md`、`.impeccable/design.json`                                                                                 | 证据、最终审查和视觉规范记录       |

任务 2–4 的写入目录互不重叠，分别由独立代理实施。所有代理只做局部静态检查；浏览器、全量类型/构建与报告由主代理统一执行，避免抢占页面或改动真实数据。

## 任务 1：共享外壳和视觉基础

**修改：** `src/components/layout/dashboard-shell.tsx`、`src/components/layout/page-layout.tsx`、`src/components/layout/auth-layout.tsx`、`src/components/dashboard/app-sidebar.tsx`、`src/components/dashboard/nav-options.tsx`、`src/components/dashboard/assistant-entry.tsx`、`src/components/dashboard/site-header.tsx`。

- [x] 记录当前差异和类型检查基线，确认已有本轮之外修改。
- [x] 外壳改用现有 Sidebar 的连续侧栏变体，移除浮动外框，保持折叠、手机抽屉和偏好保存。

```tsx
<AppSidebar variant='sidebar' />
```

- [x] 主区使用实色背景、细分隔线；普通页面标题 24–28 px、区块标题 16–18 px，桌面页边距 24–32 px，手机 16 px。编辑器不追加改变文档尺寸的全局规则。
- [x] 品牌区与导航行统一对齐，删除多余的「模块」分类标签；AI 助手入口沿用相同导航语言，保留实际链接与返回路径。
- [x] GitHub 入口保留点击和计数，移除外围粒子装饰；保留主题切换、面包屑与编辑器居中工具栏。
- [x] 认证布局接入相同表面层级，不改字段/提交行为。
- [x] 对改动文件运行 `pnpm exec prettier <files> --write`，再 `pnpm exec eslint <files> --fix --fix-type layout`。

## 任务 2：首页与管理页

**修改：** `src/pages/index/index.tsx` 及 `components/` 中最近简历、job-priorities、todo、statistical、entry、activity；`src/pages/resume/components/resume-card/index.tsx`、`create-resume-card/index.tsx`、`src/pages/resume/index.tsx`；`src/pages/share/components/{header,overview,toolbar,card}/index.tsx` 及页面入口。

- [x] 首页标题改为任务型标题，保留创建入口与引导/导入草稿；最近简历强调名称和继续编辑。
- [x] 三提醒改为紧凑横排，保留相应大图标和局部渐变；在手机垂直排布，长公司/岗位名可收缩。
- [x] 待办主区与统计/动态辅助区分开，使用语义 section、分隔线和稳定标题，不把每个数字重新包卡。

```tsx
<div className='grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_17rem]'>
  <div className='min-w-0 space-y-8'>{/* 原任务模块 */}</div>
  <aside className='min-w-0 space-y-6'>{/* 原统计与动态模块 */}</aside>
</div>
```

- [x] 各数据源 loading/error 保持原依赖；不得引入跨模块 Promise.all。
- [x] 简历卡用现有 Card/语义容器替代 MagicCard 追随光晕；名称 16–18 px，存储与时间一行次级显示；编辑、派生、分享及菜单原动作保留。
- [x] 有内容时降低重复新建卡权重，保持页头与空态新建；不改创建向导流程。
- [x] 分享统计压成信息行，分享卡去重同名信息；保留网格、状态筛选、复制/预览及全部权限动作。
- [x] 局部格式与 lint 检查；自审所有原处理器和 empty/loading/error 分支仍可达，返回修改清单。

## 任务 3：优化、设置与目录

**修改：** `src/pages/optimize/index.tsx`、`components/dashboard/overview-summary-card.tsx` 和相关结果组件；`src/pages/profile/components/`；`src/pages/template/components/template-filters/index.tsx`、`template-card/index.tsx`；`src/pages/changelog/components/changelog-entry/index.tsx`。

- [x] ATS 摘要缩短，去掉重复结果标题和第二套完整处理进度；真实水印与评分色保留；问题区提前，依据和工具仍能访问。
- [x] 保留唯一可操作的处理清单，未处理/已处理/忽略数据继续来自原实现；不能手写另一份业务统计。
- [x] 个人资料仅保留一次主要姓名/邮箱展示，使用信息行展示可编辑项，安全/额度/偏好按分组保留动作。
- [x] 模板筛选去掉外围大卡层，预览保持真实比例与懒加载；日志保持时间线和文章，收紧标签与辅助元信息。
- [x] 局部格式与 lint；确认模板正文与打印依赖未改、所有已有控件继续复用。

## 任务 4：跟进与文档工作区

**修改：** `src/pages/tracker/index.tsx`、`components/header/`、`components/board/`、`components/list/`、`components/drawer/` 中展示组件；`src/pages/assistant/components/chat-header/index.tsx`、`composer/index.tsx`、会话展示组件；`src/pages/history/components/`；编辑器 `components/sidebar/index.tsx` 与工具栏；公开分享 `components/reading-toolbar/index.tsx`。

- [x] 跟进区减少外框/列/卡三层重复边界；不改阶段顺序、最小 256 px 列宽与 44 px 结束列，不改移动搜索工具栏布局。
- [x] 抽屉头部只显示一组岗位/公司/状态，收紧阶段摘要和页签上方留白；原「跟进/阶段详情/联系人与简历」保留。
- [x] 助手头部删除重复产品标签；会话导航与消息区的视觉层级收紧；不改高频订阅、流式状态、画布、消息内容和输入能力。
- [x] 历史列表/预览两区统一选中态与分隔，减少嵌套容器；保留 forceMount、草稿、滚动和切换状态。
- [x] 编辑器与公开分享仅改应用工具层的边界和间距；纸张、页间距、分页、测量、正文 CSS 全部保持。
- [x] 局部格式与 lint；对照已有暂存动效差异，确认没有回退焦点、Presence 或减少动效逻辑。

## 任务 5：集成与实际验证

- [x] 主代理逐任务查看 diff，核对规格与功能保留；独立代码审查者覆盖任务 1–4 的规格合规性、状态分支、组件复用和质量。
- [x] 查看登录、注册、找回密码、设置密码失效态、404 的共享视觉，修正标题/文案不一致，不更改认证行为。
- [x] 全部改动文件完成格式整理，执行 `pnpm exec tsc -b`、`pnpm build`、`pnpm format:check`；记录 exit code、原有警告与新问题，失败定位后重跑受影响检查。
- [ ] 浏览器首轮覆盖桌面 1440 px、用户当前宽度、768 px、390 px；逐页真实数据或明确空态、长名称与主题状态。截图保存 `.impeccable/review/visual-redesign/`。
- [x] 实际操作导航、创建三入口、模板预览、分享弹窗、跟进看板/列表/三页签、编辑侧栏与检查、历史预览、助手画布；只读交互不写用户数据，必要写入使用本地隔离合成夹具。
- [ ] 弹窗至少两轮开关及退出中重开，键盘关闭后的焦点返回有效入口；观察进入/退出与减少动效，检查控制台警告。
- [x] 确认没有触及文档几何/打印规则；如有触及，执行规格要求的短文/临界页底/多页、背景开关真实 PDF 回归，不用构建代替。
- [x] 一次汇总修正浏览器发现，再按受影响尺寸/流程复查；不得将未覆盖状态写成通过。

## 任务 6：最终审查与交付

- [x] 使用 review-animations 阅读规范并检查本轮交互；运行一次 Impeccable detector，只修本轮真实问题。
- [x] 给独立 Impeccable finish reviewer 发送批准规格、实际截图、改动范围与已知限制；按其 verdict 修复，再核验。
- [x] 文档代理根据实现记录 token-bearing `DESIGN.md` 与 `.impeccable/design.json`，范围仅限应用外壳/界面，不给简历正文强加同一规则。
- [x] 写入 `docs/superpowers/specs/2026-10-29-visual-redesign-acceptance.md`；把触发场景、根因、长期约束及验收方法更新到防回归清单。
- [x] 清除本轮临时测试代码与夹具，保留必要截图与验收结果；逐项记录“实施完成 / 验证结果 / 用户最终审查待进行”。
- [x] 交付实际截图、改动摘要、通过检查及未覆盖的明确限制，不提交、不推送。

## 执行记录

任务 1–4 实施并经独立代码审查，任务 5 的实际页面检查见同日验收记录。布局覆盖了全部 17 类路由；未勾选的综合验收项包含未实测的运行中减少动效、所有失败/权限/长标题组合及退出中间帧，不能以默认状态通过替代。创建、保存、AI 请求等写入不作为普通截图动作；ATS 误触已单独披露。最终设计复审为 ship，六文件圆角修复经原审查者确认 resolved；设计规范及其 sidecar 已完成。实施完成、验证结果已记录，用户最终审查待进行。
