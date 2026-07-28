# Tracker 2.0 P1 进度账本

分支: feat/kanban-v4
基线 HEAD: cae20bf
约定: 不写测试；不主动 commit（实现者只改工作区，不提交）
每任务审查用「文件快照前后 diff」隔离，非 commit range。

## 任务状态
- [x] T1 概览统计纯函数 (utils.ts, const.ts) — 规格✅ 质量通过 tsc干净 未提交
- [x] T2 OverviewBar 组件 (overview-bar/index.tsx) — 规格✅ 质量通过 tsc干净 未提交
- [x] T3 FilterMenu (toolbar/filter-menu.tsx) — 规格✅ 质量通过 tsc干净 未提交
- [x] T4 Header 接入 (header/index.tsx) — 规格✅ 质量通过 tsc+lint干净(import序已--fix) 未提交
- [x] T5 页面装配 + 默认看板 (index.tsx, store.ts) — 规格✅ 质量通过 tsc+lint+build干净 未提交
- [x] T6 停留天数徽标 (column-card.tsx) — 规格✅ 质量通过 tsc+lint干净 未提交
- [x] T7 Rejected 折叠列 + 终态确认 (const.ts, store.ts, board/index.tsx) — 规格✅ 质量通过 tsc+lint+build干净 未提交

## 最终整体审查（P1）
- 结论：无 Critical，可进入 P2。
- 已修复：M1(rejected 标签统一为「已终止」)、M2(仅 rejected 列头为 button + aria-expanded)、M3(删未用 TRACKER_OVERVIEW_METRICS)、M5(getDaysInStage NaN 兜底)、I1(「已投递」累计值改为不可点，消除与筛选/列头数字不一致)。
- 待用户决策：I2(「已投递」/响应率是否计入 rejected；受数据模型限制，无阶段历史)。M4/M6 记为可选、暂不改。
- 复验：tsc + eslint(整个 tracker 目录) 均干净。

## I2 已按用户决策修复（历史总数口径）
- getTrackerOverviewStats 改为基于 getFurthestStageIndex：投过就算（含已终止），据 stage_details 的「已完成/进行中」还原历史漏斗深度。
- 已知近似：直接建为 applied 又未推进就被拒的岗位（stage_detail 仍为「待处理」）不计入——「待处理」语义上=尚未真正投递，可接受。
- 复验：tsc + eslint(utils.ts) + build 均干净。

## 看板"太挤"布局修复（用户反馈）
- 根因：容器 xl:[&>*]:flex-1 让 6 列等分拉伸到 ~213px（比小屏 280px 还窄）；且折叠的已终止列因 CSS 特异性未收窄，白占一整列。
- 修复 board/index.tsx：活动列改 flex-1 + min-w-[240px]（默认折叠态每列≈246px）；已终止折叠为 48px 竖排 rail（竖排标签+计数，点击展开）；min-h 400→320；padding p-2→p-2.5。
- 复验：tsc + eslint + build 均干净。视觉需用户在浏览器确认（本机 Chrome 不可用）。

# P2 排序 + 归档
迁移(用户执行): alter table company add column if not exists archived boolean not null default false;
- [x] T8 types+data archived (types.ts, company.ts) — archived 必填，data 层 ?? false 兜底，archiveCompany 复用 updateCompany；tsc+lint 干净
- [x] T9 store 排序/归档状态 (store.ts) — sortBy/sortDir/showArchived + setSort(同字段翻转方向)/setShowArchived
- [x] T10 utils sortJobs + filter (utils.ts) — sortJobs(updated/created/days/company/status，rejected 末位) + filterJobs 加可选 showArchived(默认 true 保持旧调用)
- [x] T11 sort-menu + Header (toolbar/sort-menu.tsx, header/index.tsx) — 排序下拉，仅列表视图显示；import 序已 --fix
- [x] T12 列表可排序表头 (list/index.tsx, list/job-table.tsx) — SortableHead 提为顶层组件(避免嵌套定义 lint)，加停留列；list 应用 sortJobs+showArchived
- [x] T13 归档动作 (job-card, job-table, drawer) — 三处菜单加归档/取消归档，调 archiveCompany + syncJob
- [x] T14 显示归档开关 (header/index.tsx) — Archive 图标按钮切 showArchived；board/header count/store.selectAll 均接 showArchived 保持一致

## P2 复验
- tsc + eslint(整个 tracker + company.ts) + build 均干净。未提交。
- 待用户在 Supabase 执行迁移后归档才真正持久化：alter table company add column if not exists archived boolean not null default false;（迁移前 UI 可用，archiveCompany 会写 archived 字段，DB 无该列会报错——需先迁移）。

## P2 整体审查（无 Critical，可进 P3）
- 已修 I2：补 migration 文件 supabase/migrations/20260728000001_add_company_archived.sql（含 archived 列 + 部分索引），固化部署顺序（写路径 create/status-change/archive 都带 archived，硬依赖该列）。
- 已修 I1：getTrackerOverviewStats 的在办口径(interview/offer/pending)排除 archived；历史漏斗口径(applied/responseRate)保留含归档。
- 未改(有意)：M4 archived 必填(比可选更安全)、M3 handleArchive 三处重复(与既有 handleDelete/handleStatusChange 同模式)、M1/M2(排序方向/停留口径近似,可接受)。
- 复验：tsc + eslint + build 干净。

# P3 跟进提醒 / 下一步
迁移文件: supabase/migrations/20260728000002_add_company_next_action.sql (next_action text, next_action_date date)
- [x] T15 next_action 数据层 (types.ts, company.ts, add-job/utils.ts) — 两列 string|null，三处映射 ?? null，buildJobPayload 补 null
- [x] T16 utils isJobPendingFollowUp + getNextActionBadge (utils.ts) — 日期驱动(<=0 到期)+陈旧回退；getDaysUntil；badge tone overdue/today/upcoming；替换 stats.pending 口径
- [x] T17 抽屉下一步编辑 (drawer/next-action/index.tsx 新组件) — 输入+日期 Popover+保存/清除，挂在跟进 Tab 顶部(rejected 不显示)
- [x] T18 卡片/列表日期徽标 (column-card, job-table) — Bell+徽标，配色抽到 const NEXT_ACTION_TONE_CLASSES 共享
- [x] T19 首页待跟进口径统一 (use-resume-spotlights.ts) — pendingCount 改调 isJobPendingFollowUp；参数收窄为结构类型 PendingFollowUpJob；JobApplicationSummary+query 加 archived/next_action_date；删死常量 FOLLOW_UP_STALE_DAYS

## P3 复验
- tsc + eslint(tracker+company+homepage) + build 均干净。未提交。
- 需用户执行迁移: supabase/migrations/20260728000002_add_company_next_action.sql（写路径 create/update 现带 next_action/next_action_date，迁移前会报错——需先迁移）。

## P3 整体审查（无 Critical，可进 P4）
- 已修 #2：getNextActionBadge 对终态(offer/rejected)+归档返回 null，卡片/列表不再给已终止岗位挂「逾期」徽标（与抽屉一致）。
- 已修 #4：NextActionSection 加 key={selectedJob.id} 防御性重置本地态。
- 知悉不改 #1：listJobApplicationSummaries 具名 select 迁移前会抛错（迁移未跑时首页聚合走 catch 置零）——属加列迁移固有部署顺序约束，两个迁移文件已入库，同批上线即可。
- 不改(边角/超范围) #3(rejected 漏斗深度低估，近似可接受)、#5(diff 含 P1/P2 未提交改动，非 P3 引入)。
- 复验：tsc + eslint + build 干净。

# P4 活动时间线 + 联系人 CRM + 抽屉三 Tab
迁移文件: supabase/migrations/20260728000003_add_company_activities_contacts.sql (activities jsonb, contacts jsonb)
- [x] T20 activities/contacts 数据层 (types.ts, company.ts, add-job/utils.ts) — TrackerActivity/TrackerContact 类型；三处映射 ?? []；addActivity 复用 updateCompany；DrawerTab 改 follow-up/interview/documents；buildJobPayload 补空数组
- [x] T21 活动时间线 (drawer/activity-timeline/index.tsx) — 时间线(最新在上)+手动加 note+删除；状态变更由 drawer 自动追加 status_change(不可删)
- [x] T22 联系人 CRM (drawer/contacts/index.tsx) — 增删改(姓名/角色/渠道/备注)，onBlur 保存
- [x] T23 抽屉三 Tab 重组 (drawer/index.tsx) — 跟进(下一步+进度+时间线)/面试记录(StageDetail)/简历&联系人(Document+Contacts)；handleProgressChange 自动记一条活动

## P4 复验
- tsc + eslint(整个 tracker + company) + build 均干净（timeline jsx 一处 --fix）。未提交。
- 需用户执行迁移: supabase/migrations/20260728000003_add_company_activities_contacts.sql（写路径 create/update 现带 activities/contacts，迁移前会报错）。

## P4 整体审查（发现 2 Critical + 若干项，已修）
- 已修 K1+I1+I3：新增 utils buildStatusChangeActivity/appendStatusChangeActivity 单一入口；所有改状态站点(use-stage-detail 正向推进 handleSave/markCurrentStageComplete、drawer 回退/终止、board 拖拽 commitMove、job-card/job-table 下拉)统一记 status_change 活动；label 按序数判断 推进/回退/终止(修正原「回退却写推进」)；死代码 addActivity 保留但主路径改用 append 助手(助手在 utils，addActivity 仍可用于纯数据层调用)。
- 已修 K2：contacts 改受控 state + useRef 最新值 + onBlur 提交，消除快速多字段编辑的闭包丢数据竞态；切职位 useEffect 同步。
- 已修 N1/N2：interview tab 更名「阶段详情」(名副其实)，rejected 文案改「阶段详情不可再编辑」。
- 知悉不改 I2(活动列跨组件乐观写交错，触发窗口窄)、N3(空联系人即时落库)、N4(切职位残留 viewingStage，pre-existing)。
- 复验：tsc + eslint + build 干净。

# P5 颜色统一 + 批量改状态 + logo + 清理（零迁移）
- [x] T24 颜色 token 统一 (const.ts) — STAGE_STATUS_COLORS 进行中改蓝、已完成改绿，与 STAGE_STATUS_CONFIG 一致（修反直觉）
- [x] T25 批量改状态/归档 (header) — 批量模式加「改状态」下拉+「归档」按钮，Promise.all + syncJob，改状态记 status_change 活动
- [x] T26 logo URL 输入 (add-job types/form/utils, edit-form) — AddJobFormData 加 company_logo，两表单加可选 Logo 链接输入，buildJobPayload/updateCompany 透传 trim||null（修规格问题12）
- [x] T27 清理 status-filter 目录 + 收尾 — ALL_FILTER_STATUSES 内联进 filter-menu，删除整个 components/status-filter/ 目录，无 dangling 引用

## P5 复验
- tsc + eslint(整个 tracker) + build 均干净。未提交。零迁移。

## P5 整体审查（无 Critical，可收尾合并）
- 已修 #1：批量改到 rejected 加 AlertDialog 二次确认（与看板拖拽/抽屉单条一致）。
- 已修 #3：新建 components/company-logo.tsx（无 URL 或加载失败均回退占位图标），替换 4 处裸 <img>（board card/list card/list table/drawer 标题），修坏 URL 碎图。
- 知悉不改 #2(Promise.all 部分成功，与既有 delete 同模式)、#4(重复 id，既有模式)、#5(无目标静默)。
- 复验：tsc + eslint + build 干净（header fragment 缩进 --fix）。

## 全部 P1-P5 + 各期审查修复完成，均未提交。3 个迁移待用户执行。
