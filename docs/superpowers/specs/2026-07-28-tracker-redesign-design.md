# 求职看板 2.0 重构设计

**日期：** 2026-07-28

**目标：** 把 `/tracker`（求职看板）从「列表为主、信息稀疏、缺少主动跟进」的现状，重构为对齐成熟成品（Huntr / Teal / ApplyBolt）的「概览漏斗 + 看板为主 + 带日期跟进提醒」体验，同时补齐归档、活动时间线、联系人 CRM、列表排序等能力。

---

## 与既有设计记录的关系（重要）

本仓库已有两份相关 tracker 设计：

- `docs/superpowers/specs/2026-03-24-tracker-ux-redesign-design.md`
- `docs/superpowers/specs/2026-03-23-tracker-store-boundary-design.md`

本设计**部分取代（supersede）** `2026-03-24` 版中的以下决定，并说明原因：

| 2026-03-24 的决定 | 本次调整 | 原因 |
|---|---|---|
| 「列表是主工作流」，看板是次要流程视图 | 改为「概览漏斗 + 看板为主」，列表降级为可排序的辅助视图 | 用户明确要求对齐成品；成品普遍以 Kanban 为核心主界面 |
| 非目标：不重新设计数据库结构 | 允许给 `company` 表加列 + 用 JSON 列承载新模块 | 用户确认「可加字段 + JSON」，以支撑提醒 / 时间线 / CRM |
| 非目标：不做数据统计面板 | 新增顶部概览漏斗（轻量指标，非完整 BI） | 成品的核心动机来源；纯前端派生，成本低 |

**保留** `2026-03-24` 的以下原则（继续有效）：
- 状态动作必须是明确语义（「推进到筛选中」而非抽象「更改状态」）。
- 低频管理动作（删除 / 批量 / 打开 JD）降级，不与主流程抢层级。
- 派生逻辑集中在 `tracker` 内的纯函数，不在卡片组件里堆分支。

**保留** `2026-03-23` store 边界原则：store 只放跨组件共享状态与纯状态操作，异步增删改查逻辑放在业务 hook / 数据层，不回灌 store。本设计新增的字段与 action 遵循同一边界。

---

## 问题定义（基于代码走查 + 竞品调研）

> 说明：本机浏览器自动化不可用（内置 Chrome 121 在 macOS 26 崩溃、无独立 Chrome、Arc 拒绝 headless CDP），故走查以代码级追踪为主（已通读全部 tracker 组件、store、utils、Supabase 数据层）。

### 布局 / 信息架构
1. 导航名为「求职看板」，但默认视图是列表（`store.ts` `viewMode: 'list'`），管道感弱。
2. **缺少整体概览**：顶部只有一排状态 pill 计数（`status-filter/index.tsx`），没有「投递数 / 面试中 / offer / 本周待跟进 / 响应率」这类一眼定位的指标。

### 交互逻辑
3. **状态 pill 语义漂移**：列表视图里 pill 是过滤器；看板视图里它只是高亮 + 横向滚动到某列（`board/index.tsx` 的 `scrollToColumn`），与列本身信息重复，易误解。
4. **rejected 不对称 / 消失**：看板只有 5 列（`const.ts` `BOARD_COLUMNS` 无 rejected）。被拒岗位在看板上直接消失（`getJobsByStatus` 按 `status===column` 过滤），且能拖到 offer 却拖不到 rejected。
5. **列表不可排序**（`list/job-table.tsx` 表头是纯 `<th>`）：看不到「何时投的 / 在这个阶段卡了几天」，而这是求职最关键的指标。

### 功能缺失
6. **无带日期的跟进提醒**：`getTrackerNextAction` 只给静态文案（「推进到筛选中」），无日期、不提醒。
7. **无活动 / 变更历史**：无法回看「这家何时投、何时面」。
8. **无联系人 CRM**：无法记录 recruiter / 内推人。
9. **无归档**：offer/rejected 永久占位（rejected 在看板隐身但在列表堆积）。
10. **批量操作只能删除**（`header/index.tsx`），不能批量改状态 / 归档。
11. **颜色语义自相矛盾**：`const.ts` `STAGE_STATUS_COLORS` 里「进行中=绿、已完成=黄」，与直觉（完成=绿）相反；且与 `APPLICATION_STATUS_CONFIG` 两套配色并存。
12. `company_logo` 字段存在于数据模型，但录入流程无处填充（`add-job-form` 无该输入）。

---

## 设计原则

1. **概览 + 看板为主**：进入即看到漏斗概览与管道全貌；列表作为可排序的辅助视图。
2. **主动跟进驱动**：以 `next_action_date` 为核心，卡片 / 概览 / 列表都能体现「该做什么、什么时候到期、是否逾期」。
3. **管道保持干净**：终态（offer/rejected）可折叠、可归档，不淹没进行中的岗位。
4. **一套心智、一套颜色**：看板、列表、抽屉共享同一阶段语义与颜色 token。
5. **数据层最小侵入**：优先给 `company` 加标量列 + 用 jsonb 列承载新模块，不新建表。
6. **遵循 page-organization**：组件按文件夹 + `index.tsx` 导出；共享状态进 store；派生统计用 selector。

---

## 页面级结构

```
┌─ TrackerHeader ─────────────────────────────────────────────┐
│  求职看板        [搜索] [排序▾] [筛选▾] [视图: 看板|列表] [+ 新增]  │
├─ OverviewBar（新增·概览漏斗，顶部固定）───────────────────────────┤
│  已投递 12 · 面试中 4 · Offer 1 · 本周待跟进 3 · 响应率 42%        │
├─ 主体 ──────────────────────────────────────────────────────┤
│  看板：Saved │ Applied │ Screen │ Interview │ Offer │ Rejected(折叠) │
│        卡片：公司/职位 · 停留 N 天 · 下一步日期徽标 · JD/简历标记     │
│  列表：可点表头排序（投递日期 / 更新 / 停留天数 / 公司 / 状态）         │
└─────────────────────────────────────────────────────────────┘
```

**关键变化**
- 新增 **OverviewBar**（顶部固定漏斗，纯前端 selector 派生）。
- 状态 pill 行**合并进「筛选▾」下拉**，消除 pill 语义漂移。
- 默认视图从 `list` 改为 `board`。
- Header 增加**排序菜单**（仅列表视图生效）。

---

## 模块设计

### 1. OverviewBar 概览漏斗（P1）
- 指标：已投递数、面试中数、Offer 数、本周待跟进数（`next_action_date` 落在本周且未完成）、响应率（进入过 screen 及以后的比例）。
- 全部由 store selector 从 `jobs` 派生，**零 schema 改动**（响应率、待跟进依赖 P2/P3 字段时，先降级为「投递/面试/offer 计数」，字段就绪后补齐）。
- 点击某指标 = 应用对应筛选（如点「面试中」→ 筛选 interview）。

### 2. 看板重构（P1）
- **补 Rejected 列**：可折叠，默认收起，修复不对称与「被拒消失」。
- 卡片信息密度对齐 Huntr：
  - **停留天数**：由 `updated_at` 派生（`列内已 N 天`）。
  - **下一步日期徽标**：逾期=红、今日=橙、未来=灰（依赖 P3 字段，未就绪时不显示）。
  - 保留现有 JD / 简历 / 面试子阶段标记。
- 拖拽落到 **Offer / Rejected** 终态时弹轻确认，避免误拖。

### 3. 列表排序与信息密度（P2）
- 表头可点击排序：投递日期、更新时间、停留天数、公司、状态。
- store 增 `sortBy` / `sortDir`；排序为纯前端。
- 列表新增列：停留天数、下一步日期（就绪后）。

### 4. 归档（P2）
- `company.archived boolean default false`。
- 默认过滤 `archived=false`；Header 提供「显示归档」开关。
- offer/rejected 抽屉与卡片菜单提供「归档」动作。

### 5. 跟进提醒 / 下一步（P3）
- `company.next_action text`、`company.next_action_date date`。
- 抽屉「跟进」区可设置下一步动作 + 日期。
- 卡片 / 列表显示日期徽标；OverviewBar「本周待跟进」聚合；逾期高亮。
- **两种「待跟进」定义需统一，避免出现两个互相矛盾的数字**：
  - 现状：首页 `use-resume-spotlights.ts:141` 的 `pendingCount` 是**陈旧度驱动**（`daysDiff >= FOLLOW_UP_STALE_DAYS`，即 N 天未更新且非 offer/rejected）。
  - 本设计新增的是**显式日期驱动**（`next_action_date` 落在本周 / 已逾期）。
  - 收敛策略（P3）：把「待跟进」定义为 `has(next_action_date) ? 到期或逾期 : 陈旧度回退`——有显式下一步日期时以日期为准，没有时回退到现有陈旧度逻辑。抽取为 `tracker` 内的纯函数 `isJobPendingFollowUp(job)`，供 OverviewBar 与首页 `follow-up.tsx` **共用同一函数**，而非各算各的。

### 6. 活动时间线（P4）
- `company.activities jsonb default '[]'`：`{ id, type, label, at, note? }`。
- 状态变更自动追加一条（阶段 + 时间戳）；用户可手动加活动。
- 抽屉「跟进」Tab 内以时间线呈现。

### 7. 联系人 CRM（P4）
- `company.contacts jsonb default '[]'`：`{ id, name, role, channel, note }`。
- 抽屉「简历 & 联系人」Tab 内独立分区，增删改。

### 8. 抽屉简化 + 颜色统一（P4/P5）
- 抽屉三 Tab：**跟进（管道 + 下一步 + 活动时间线）／ 面试记录（子轮次）／ 简历 & 联系人**。
- 统一颜色语义：已完成=绿、进行中=蓝、待处理=灰、拒绝=红；收敛为单套 token，修掉 `STAGE_STATUS_COLORS` 的反直觉配色。

### 9. 批量改状态（P5）
- 批量模式在删除之外，新增「批量改状态 / 批量归档」。

---

## 数据层设计

新增列（`company` 表，全部可空 / 有默认值，向后兼容）：

```sql
alter table company add column if not exists archived boolean not null default false;
alter table company add column if not exists next_action text;
alter table company add column if not exists next_action_date date;
alter table company add column if not exists activities jsonb not null default '[]'::jsonb;
alter table company add column if not exists contacts jsonb not null default '[]'::jsonb;
```

- `src/lib/supabase/resume/company.ts`：`updateCompany` 已支持 partial 透传，新字段无需改签名；补便捷方法 `archiveCompany(id, archived)`、`addActivity(id, activity)`。
- `src/pages/tracker/types.ts`：`JobApplication` 增可选字段 `archived`、`next_action`、`next_action_date`、`activities`、`contacts`（可选，兼容旧数据）。
- `getCompanies` 映射时对新 JSON 字段做 `?? []` 兜底（与现有 `stage_details` 处理一致）。

---

## 代码结构（遵循 page-organization）

```
src/pages/tracker/
  index.tsx                       # 装配 OverviewBar
  store.ts                        # 增 sortBy/sortDir/showArchived + 新 action
  const.ts                        # BOARD_COLUMNS 加 rejected；统一颜色 token
  utils.ts                        # 增派生：停留天数、下一步徽标、概览统计、排序比较器
  components/
    overview-bar/index.tsx        # 新增
    toolbar/sort-menu.tsx         # 新增（排序下拉）
    toolbar/filter-menu.tsx       # 新增（合并原 status-filter 的 pill）
    board/index.tsx               # 加 rejected 折叠列 + 终态拖拽确认
    board/column-card.tsx         # 停留天数 + 日期徽标
    list/job-table.tsx            # 可排序表头 + 新列
    drawer/activity-timeline/index.tsx   # 新增
    drawer/contacts/index.tsx     # 新增
    drawer/index.tsx              # 三 Tab 重组
```

---

## 分期落地

| 阶段 | 内容 | Schema |
|---|---|---|
| **P1** | OverviewBar + 默认看板 + Rejected 折叠列 + pill 合并进筛选下拉 | 无 |
| **P2** | 列表可排序 + 卡片停留天数 + 归档 | +`archived` |
| **P3** | 下一步动作 / 日期 + 逾期聚合 + 概览「本周待跟进/响应率」补齐 | +`next_action`,`next_action_date` |
| **P4** | 活动时间线 + 联系人 CRM + 抽屉三 Tab 重组 | +`activities`,`contacts` |
| **P5** | 颜色 token 统一 + 批量改状态 + 空态/文案打磨 | 无 |

每个阶段可独立交付并回归。

---

## 待定项（默认取推荐值，用户可覆盖）

- **Rejected 呈现**：独立可折叠列（推荐）vs 完全移出看板只在列表/筛选看。→ 默认：可折叠列。
- **提醒强度**：日期徽标 + 概览聚合（推荐）vs 更主动的页内红点 / 首页联动。→ 默认：徽标 + 聚合，并与 `follow-up.tsx` 复用聚合。
- **company_logo 录入**：本次是否顺带在新增/编辑表单补 logo URL 输入？→ 默认：P5 顺带补一个可选 URL 输入（低成本，修复 12）。

---

## 非目标

- 不做完整 BI / 图表分析面板（仅轻量概览条）。
- 不接入邮箱解析 / Chrome 插件自动抓取 JD。
- 不新建独立数据表（用现有 `company` 表 + JSON 列）。
- 不引入实时协作到 tracker。

---

## 验证方式

- `pnpm exec tsc --noEmit`
- `pnpm build`
- 本仓库约定**不写测试、并删除现有测试文件**，故不含单测/集测环节；如需回归以 `/tracker` 手工走查为准（当前环境浏览器自动化不可用，需在可用环境手动确认）。
- 所有改动**未经用户主动提示不 commit**。
