# 求职看板（Tracker）体验打磨 — 设计规格

- 日期：2026-08-03
- 范围：`src/pages/tracker/**`（含 store、utils、header、overview-bar、board、list、drawer 全链路）
- 目标：修复 4 类体验问题——动效缺失、归档逻辑与视觉、概览条交互与主次表达、Drawer 产品形态（常用操作外移 / 阶段切换灵活化 / 联系人按行解耦），并整体打磨 UI 与交互链路。

## 背景与现状问题（已核实）

1. **动效缺失**：整个 `tracker/` 模块无任何 `motion` 使用，仅 `transition-colors`；而仓库其余页面（history、template、resume、index）普遍使用 `motion/react`。动画生硬、无进出场与状态过渡。
2. **归档逻辑与视觉**（Header `Archive` 图标按钮）：
   - 该按钮实为「显示/隐藏已归档」开关（`showArchived`），但用 `Archive` 图标，语义误导为「归档此项」。
   - 无已归档内容时点击「无反馈」（列表/看板都无变化），用户困惑。
   - 开启态视觉弱（`secondary` 描边），不明显。
   - 已归档卡片/行在显示时与普通项无视觉区分。
3. **概览条（overview-bar）**：
   - 仅 `interview`/`offer` 设置 `filterStatus`（可点）；`applied`/`pending`/`rate` 传 `undefined` → 被禁用，点击无反应。
   - 被点中的指标无选中态视觉。
   - 「响应率」与计数混排，无主次，弱到看不见。
4. **Drawer 产品形态**：
   - 常用操作（推进 / 回退 / 归档）埋在 `⋯` 菜单，主路径不顺手。
   - 阶段切换死板：下拉改状态 → 「已完成」前强制先填日期 → 保存 → 才自动推进，步骤僵硬，不符直觉。
   - 联系人区一个全局「保存修改」耦合所有行：改一行必须整体保存，且回写会覆盖其他行的未保存编辑。

## 用户已确认的决策

- 概览：**四个计数（已投递/面试中/Offer/待跟进）全部可点筛选**；**响应率作为主视觉 KPI**（不可点）。
- 归档：**改造现有开关 + 视觉区分**（不新建独立视图）。
- 阶段切换：**时间线节点直接点击跳转 + 弱化强制校验**；阶段开始日期在推进/完成时**自动回填当天**（与看板拖拽 `autoCompleteStages(..., true)` 一致）。
- 动效：**全面而克制**，统一 `useReducedMotion` 无障碍降级。

## 架构设计

### 1. 统一筛选模型（支撑概览可点击的关键前提）

现状 `filterStatus: ApplicationStatus | null` 只能表达单一状态，无法承载「已投递 / 待跟进」这类跨状态聚合口径。

**store 变更（`tracker/store.ts`）**
- 新增 `metricFilter: TrackerMetricKey | null`，其中 `TrackerMetricKey = 'applied' | 'interview' | 'offer' | 'pending'`。
- `filterStatus` 与 `metricFilter` **互斥**：
  - `setFilterStatus(s)` 时清空 `metricFilter`。
  - 新增 `setMetricFilter(key)`：设置 metric 同时清空 `filterStatus`；再次传入相同 key 则取消（置 null）。
  - 新增 `clearFilters()`：两者归零（`searchKeyword` 保持不变，除非调用方另清）。
- 派生便利：组件内以 `filterStatus !== null || metricFilter !== null || searchKeyword.trim() !== ''` 判断 `hasActiveFilter`（不必进 store）。

**utils 变更（`tracker/utils.ts`）**
- 新增 `matchesMetric(job, key)`：
  - `applied` → `getFurthestStageIndex(job) >= indexOf('applied')`（历史漏斗口径，与概览统计同源）。
  - `interview` → `!job.archived && job.status === 'interview'`。
  - `offer` → `!job.archived && job.status === 'offer'`。
  - `pending` → `isJobPendingFollowUp(job)`。
- `filterJobs` 增加可选参数 `metricFilter?: TrackerMetricKey | null`：在现有 `showArchived / filterStatus / keyword` 过滤基础上，若存在 metric 则叠加 `matchesMetric`。保持 `filterStatus` 与 metric 互斥（同时只会有一个非空）。
- 看板视图沿用「不按 filterStatus 隐藏列、卡片级过滤 keyword」策略；metric 过滤在看板中作为**卡片级过滤**参与（与 search 相同层级），保证「点已投递」在看板下也有可见反馈（高亮/收敛卡片），不破坏拖拽改状态所需的全列结构。

> 口径一致性：概览统计（`getTrackerOverviewStats`）与 `matchesMetric` 必须同源。`applied` 用 `getFurthestStageIndex`，`pending` 用 `isJobPendingFollowUp`，`interview/offer` 用「未归档 + 当前状态」。

### 2. 动效基建

- 统一从 `motion/react` 引入；所有进出场/位移动画在组件内读取 `useReducedMotion()`，为 true 时禁用位移/透明度过渡（回退为静态或纯 `transition-colors`）。
- 复用仓库既有范式（`history/version-card.tsx`）：列表项 `initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.2, delay:index*0.04}}`。
- 数字滚动：优先复用 `@/components/animate-ui/primitives/texts/sliding-number`（`SlidingNumber`）；若集成成本高则实现轻量 `useCountUp` fallback（同样遵循 reduced-motion）。
- dnd 兼容：`@hello-pangea/dnd` 的 `Draggable` 通过 style transform 定位，**不得**在其直接包裹层加 motion 的 `layout`/`x/y`。卡片入场动画只作用于**非拖拽渲染路径**或内层 `Card`（仅 `opacity`），避免与库 transform 抢占。

### 3. 概览条重构（`overview-bar/index.tsx`）

布局两分区（`rounded-xl border bg-card/60`）：
- **左：Hero 响应率 KPI**
  - 大号响应率（数字滚动 + `%`），下方细进度条（宽度 = responseRate%），再下方注释「进入筛选及以后 N / 投递总数 M」。
  - `appliedPlus === 0` 时显示 `—` 与「还没有投递数据」，进度条空。
  - 不可点。
- **中：竖分隔线**（`sm+` 显示）。
- **右：4 个指标卡**（已投递 / 面试中 / Offer / 待跟进）
  - 全部 `button`，点击 `setMetricFilter(key)`；再点取消。
  - 选中态：`ring-2 ring-primary/40` + 顶部 accent 或主色底 `bg-primary/5` + 文本加深；未选：hover `bg-muted/60`。
  - 数字滚动动画。
  - `待跟进`（pending）在 >0 时用 amber 强调点。
- `metricFilter` 生效时，主内容区（list/board）据统一 `filterJobs` 收敛，list 空态文案兼容 metric 维度（「当前『待跟进』筛选下没有匹配的职位」）。
- 加载：保留 `Skeleton`；空 jobs 仍返回 null。

### 4. 归档 UX（Header + list/board 卡片）

- **Header 按钮**（`header/index.tsx`）
  - 计算 `archivedCount = jobs.filter(j => j.archived).length`。
  - 文案化按钮：`已归档` + 数量徽标（`archivedCount` chip）。
  - `archivedCount === 0`：`disabled` + `title`「还没有已归档的职位」——消除「点了没反应」。
  - 开启态（`showArchived`）：`variant` 提升为主色描边/填充，明显区别。
- **信息条**：`showArchived` 为 true 时，主内容区顶部渲染可关闭条「正在查看已归档职位 · 点此退出」，点击 `setShowArchived(false)`。放在 `tracker/index.tsx` 主区顶部或 list/board 上沿（统一一个位置）。
- **卡片/行视觉**：`job.archived` 时弱化——`opacity-60` + 「已归档」outline chip；`column-card` / `job-card` / `job-table` 行一致处理。

### 5. Drawer 重构（`drawer/index.tsx` + 子组件）

**D1 常用操作外移**
- Header 工具栏新增**主按钮**：`推进到「<下一阶段>」▸`，取 `getTrackerNextAction(selectedJob)`；`targetStatus === null`（interview 无固定下一步 / offer / rejected）时隐藏主按钮。
- 点击走 `handleProgressChange(targetStatus)`（已有）。终态（offer/rejected）保留二次确认。
- `⋯` 菜单保留：回退到上一阶段 / 终止该流程 / 归档 / 删除。

**D2 阶段切换灵活化（时间线可点跳转 + 弱化校验）**
- `progress-timeline.tsx`：节点点击语义从「查看历史」改为「**跳转到该阶段**」。
  - 点击任一非当前节点 → 调用新回调 `onStageJump(status)`。
  - Drawer 中 `onStageJump` = `handleProgressChange(status)`：
    - 前进/回退复用现有乐观更新链路（`autoCompleteStages` + `appendStatusChangeActivity`）。
    - 目标为 `offer` / `rejected` 走二次确认（复用现有 confirm 流程；`rejected` 目前有 confirm，新增 offer 分支或统一 `pendingJump`）。
  - 自动回填当天：`handleProgressChange` 调用 `autoCompleteStages(current, target, details, /* autoSetCurrentDate */ true)`（与看板一致），保证跳转后阶段有开始日期。
- `stage-detail` / `use-stage-detail`：去掉「选『已完成』前必须先填 start_date」的 `toast.warning` 硬拦截；日期为可选补充。面试阶段「全部子轮完成才可完成」的业务校验**保留**（属合理约束，非死板步骤）。「完成本阶段」按钮保留但不再是唯一推进路径。
- 保留「阶段详情」Tab 用于补充日期/备注/面试轮次；不再强制「一步一步」。

**D3 联系人按行解耦（`drawer/contacts/index.tsx`）**
- 删除全局「保存修改」按钮。
- 状态模型改为**按行独立**：每行维护自身相对服务端 baseline 的 dirty 判定。
  - 保留组件级 `contacts`（编辑态）与 `baseline`（服务端态）。
  - 每行 `dirty(row) = !contactEqual(row, baselineById[row.id])`（新行在 baseline 中不存在 → 视为 dirty）。
- 每行操作区（删除按钮**前方**）：仅当该行 dirty 时显示「保存」。
  - 保存该行：以最新服务端 `contacts` 为基，仅替换/插入该行后落库（`updateCompany({contacts})`），成功后同步该行到 baseline，**不覆盖其他行未保存编辑**（合并策略：`nextContacts = mergeRow(serverBaseline, editedRow)`，其余行取各自 baseline，避免把别的草稿一并写入）。
  - 复用现有的 stale-response 防护（`requestGeneration` / `jobId` 校验）思路，按行保存时同样忽略过期响应。
- 「添加联系人」始终可用：新增本地草稿行（dirty），由该行自身「保存」落库。
- 删除仍按行二次确认（保留 AlertDialog）。
- `next-action` 与 `activity-timeline` 的独立保存已符合直觉，保持；仅补充动效与视觉打磨。

## 数据流与错误处理

- 所有落库仍走 `updateCompany` / `archiveCompany` / `deleteCompany`（`@/lib/supabase/resume`），返回值经 `syncJob` 回写 store；失败 `toast.error` + 必要处 `restoreJobsSnapshot` 回滚（沿用现有乐观更新范式）。
- 不新增 Supabase 迁移：本次是交互/视觉/前端状态重构，`company` 现有列（archived / next_action(_date) / activities / contacts）已满足。
- `metricFilter` 仅前端状态，不落库、不入 URL（与现有 `filterStatus` 一致）。

## 单元隔离与边界

- `store` 只负责状态与互斥规则；纯谓词（`matchesMetric` / `filterJobs`）在 `utils`，可独立推理。
- 概览条、归档信息条、进度时间线、联系人各自为边界清晰的展示/交互单元；跳转/推进逻辑集中在 Drawer 容器，子组件通过回调上报（`onStageJump`），不各自持有落库逻辑。

## 测试

- 本仓库既定约定：不新增测试文件。以 `pnpm lint` + `pnpm build` 作为验证门槛（见 verification-before-completion）。
- 手动验证清单在实现计划中给出（覆盖 4 类问题的可视链路 + reduced-motion）。

## 非目标（YAGNI）

- 不重做看板拖拽引擎、不引入 URL 同步筛选、不改 Supabase schema、不做批量管理面板重构（仅随归档/动效顺带打磨）。
- 不改「面试阶段需子轮完成」这一业务规则（合理约束）。
