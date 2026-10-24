# 求职跟进流程与抽屉实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 subagent-driven-development 逐任务实现此计划。步骤使用复选框跟踪进度。

**目标：** 新增测评与笔试阶段、并列终态曲线，自动维护阶段与面试轮次状态，自动保存阶段内容，并将联系人置顶、简历默认折叠。

**架构：** 将状态规范化与转换放在 tracker 纯领域模块；页面 Zustand 管理按职位隔离的草稿与串行写入。所有状态入口共用同一转换和写入动作。流程展示采用 ReUI Stepper 的 Radix 版本与 D3 曲线，表单和折叠复用现有 shadcn 组件。

**技术栈：** React 19、TypeScript、Zustand、shadcn/Radix、Motion、D3 shape、Supabase PostgreSQL。

## 全局约束

- 设计依据：`docs/superpowers/specs/2026-10-14-tracker-workflow-drawer-design.md`，用户已批准。
- 当前分支 main，基线 `956960639e1c77032d8bef8e80cd3fd14bb22cbe`；按照用户仓库指令在当前分支工作，不 push。
- 状态顺序：saved → applied → assessment → screen → written → interview；offer/rejected 同级互斥；rejected 显示「已结束」。
- 当前阶段即进行中；面试按 order 排序，之前轮次通过、最后轮次进行中；终态不新增轮次。
- 不在读取时回写数据，不虚构新阶段的旧日期或活动；保持历史日期与备注。
- 自动保存范围为阶段详情与轮次内容；联系人原有编辑保存行为保留。
- 只改 tracker、必要 company API 映射、首页状态消费、AI 求职工具的同一写入边界接线、必要依赖和迁移、对应验证及本次文档；不重做前轮页面、不改共享 Drawer/Dialog、Tiptap、不修无关全选问题。
- 按仓库要求不执行 TDD；复杂状态和并发使用隔离验证脚本，报告写入 `.superpowers/sdd/tracker-workflow/`。
- 所有新增动效使用仓库预设与 useReducedMotion；Radix 折叠使用 data-state 选择器。
- 任务完成后检查代码与规格，最终再做一次整体审查。数据库变更验证完成后部署已链接项目并核验账本和 smoke。

## 文件职责

- `src/pages/tracker/types.ts`、`const.ts`：统一八种状态、顺序、文案和配色。
- `src/pages/tracker/workflow.ts`：纯函数规范化、阶段转换、历史结束位置、自动面试轮次。
- `src/pages/tracker/utils.ts`：既有工具委托流程模块，更新统计和下一步动作。
- `src/pages/tracker/store.ts` 与 `store/workflow-save.ts`：领域草稿、保存状态、串行请求、作用域隔离、局部合并。
- `src/lib/ai/tools/tracker.ts`：保留既有确认桥，将职位写入接入同一领域边界。
- `src/lib/supabase/resume/company.ts`：必要的兼容读取与新建规范化；不扩大数据权限。
- `src/pages/tracker/components/{board,batch-actions,list,drawer}/` 相关入口：共享状态写入、自动保存、必要文案。
- `src/pages/tracker/components/drawer/{progress-timeline,stage-detail,interview-sub-stages,document}/index.tsx`：新布局；旧单文件重构为文件夹导出。
- `src/pages/tracker/components/drawer/progress-timeline/stepper.tsx`：带许可的 ReUI 最小适配源码。
- `src/pages/index/insights.ts`：新增状态的展示文案。
- `supabase/migrations/<CLI生成时间>_tracker_workflow_stages.sql`：只扩展 company_status_check。
- `package.json`、`pnpm-lock.yaml`：声明 d3-shape 及对应类型直接依赖。

### 任务 1：统一流程领域模型

- [x] 扩展 ApplicationStatus、状态配置、看板列、下一步动作和显示文案。保留 APPLICATION_STATUS_ORDER 的历史漏斗兼容用法，另提供在办阶段与终态常量。

```ts
export const ACTIVE_APPLICATION_STAGES = [
  'saved',
  'applied',
  'assessment',
  'screen',
  'written',
  'interview',
] as const
export const TERMINAL_APPLICATION_STATUSES = ['offer', 'rejected'] as const
```

- [x] 在 workflow.ts 提供纯函数：normalizeJobWorkflow(job)、normalizeInterviewSubStages(status, rounds)、transitionJobWorkflow(job, target, date?)。转换返回包含 status/stage_details/interview_sub_stages 的新职位；活动构造沿用 utils，避免循环导入。
- [x] 旧当前阶段待处理规范为进行中；缺失 assessment/written 不补完成经历。转换时保留已有日期/备注，只给真实进入的当前阶段补日期。结束标记实际所在阶段，历史已通过阶段保持通过；回退保留内容并重算状态。
- [x] 面试按 order 稳定排序：interview 只有最后轮进行中；offer 全部通过；rejected 前轮通过最后轮结束；删除当前轮重新规范化。旧已拒绝内部状态兼容，显示已结束。
- [x] 更新 utils 历史结束深度和响应率（从 assessment 开始算响应），以及首页直接消费的状态文案。读取与新建经同一规范化处理，不向数据库写兼容读取结果。
- [x] 隔离断言覆盖 8 状态、旧数据、不伪造日期、结束于 saved/screen、往返终态、面试 0/1/3 轮和删除后重算；运行 `pnpm exec tsc --noEmit` 与修改文件 ESLint。

### 任务 2：串行自动保存与统一写入入口

- [x] 页面 store 暴露内容编辑、立即刷新、重试、状态推进动作。按职位持有草稿与状态，计时器和请求不依赖 Drawer 生命周期。

```ts
type WorkflowSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'
// 内容更新只能修改阶段日期/备注、轮次名称/日期/备注及轮次数组。
// transition(jobId, target) 必须 await flush(jobId)，再以最新职位构造转换。
// 同职位请求串行；成功按提交字段合并，不能用完整旧 row 覆盖其它字段。
```

- [x] 编辑名称/备注防抖，日期/增删立即提交；失败保留草稿，可重试；保存中继续输入不会被旧响应覆盖，也不提前显示已保存。
- [x] 使用 jobId 和版本/生命周期标识阻止 A→B→A 或删除后的旧响应写入；关闭、切 Tab、切职位刷新队列。重载、联系人/简历/下一步响应不得覆盖较新流程草稿。
- [x] 将 board、batch-actions、list/job-table、list/job-card、drawer/index、drawer/edit-form 和新增入口接入共同规则与写入边界，取消全列表快照回滚以免覆盖别的请求。
- [x] 状态推进使用最新活动列表，终态有确认；状态失败保留正确基线与未保存内容。必要时活动/联系人等采用局部合并以满足并发要求，不改变它们的交互。
- [x] 隔离延迟/失败模拟验证连续输入、保存中再输入、失败重试、切职位 A→B→A、关闭、先改内容再推进、非流程字段并发更新；运行修改文件 ESLint 和 TypeScript。

### 任务 3：流程条、阶段详情与联系人简历布局

- [x] 获取并核实 ReUI Radix Stepper 源码和 MIT 许可，使用 Progress 圆点/标题布局；根据真实阶段状态受控显示，不把终态当第七和第八个顺序步骤。
- [x] 声明 d3-shape 直接依赖，用 linkHorizontal 生成右侧上下两条曲线；当前分支高亮，结束于早期阶段有明确位置说明。窄屏仅流程区域横向滚动。

```ts
const path = linkHorizontal<
  { source: [number, number]; target: [number, number] },
  [number, number]
>()({ source, target })
```

- [x] drawer 中提高桌面可用宽度（上限 56rem），流程导航与当前查看阶段可达；保留既有顶部推进/结束确认操作。
- [x] use-stage-detail 改为共享自动保存动作的 UI 适配；删除手动状态、完成阶段和保存/取消。普通阶段显示标题、自动徽标、日期、备注；自动保存反馈含失败重试。
- [x] 面试用 shadcn Accordion：当前轮展开，新增后展开并聚焦名称，历史轮摘要、可回看修正内容；删除确认；空态紧凑；关闭面板前处理焦点；保留现有备注编辑器。
- [x] 联系人置顶，Tab 改「联系人与简历」；下方简历 Collapsible 默认折叠，摘要显示绑定状态。展开加载列表/预览，各自处理 loading/error；同职位切 Tab 保留选择，换职位或重开恢复收起；切换绑定局部回滚。
- [x] 所有新动效接入 useReducedMotion 和 motion 预设；不改共享 UI。运行修改文件 ESLint 和 TypeScript，保存组件级自检报告。

### 任务 4：数据库迁移与隔离验证

- [x] 先读 Supabase 技能、changelog 与 migration 文档；用 CLI --help 确定命令；核对 linked project ref 和远端迁移账本，仅输出必要元数据。
- [x] 通过 `pnpm exec supabase migration new tracker_workflow_stages` 创建文件，然后写入：

```sql
alter table public.company drop constraint if exists company_status_check;
alter table public.company add constraint company_status_check
  check (status in ('saved', 'applied', 'assessment', 'screen', 'written', 'interview', 'offer', 'rejected'));
```

- [x] 在隔离 PostgreSQL 或等价数据库中创建实际 company schema 所需最小结构并应用迁移，断言 8 合法值都接受、非法值拒绝、旧数据保留。不给旧 JSON 历史批量补写。
- [x] 应用验证完成后部署仅本次待执行迁移；核对账本、实际约束、RLS 未变及线上事务回滚 smoke。无 Edge Functions 变更，不进行 Git push。

### 任务 5：整体 UI 与并发验收

- [x] 使用隔离 mock 数据服务展示真实 tracker 页面，覆盖八种状态和多轮面试，避免修改用户真实职位。
- [x] 桌面、手机、深色、减少动效；曲线与节点对齐；面试编辑自动保存、失败重试、切 Tab/关闭重开；联系人顺序、简历默认收起与展开加载。
- [x] 终态确认与删除轮次弹窗连续两轮打开关闭，加退出未完成时重新打开；检查键盘焦点和控制台错误。
- [x] 运行 `pnpm exec tsc --noEmit`、修改文件 ESLint、`pnpm build` 和针对性流程/队列验证脚本；只在新修改或失败时重复相应检查。
- [x] 最终 diff 审计和独立整体审查，修复有证据的范围内问题，记录截图及验证结果。

### 任务 6：交付

- [x] 将计划复选框与 `.superpowers/sdd/tracker-workflow/progress.md` 同步到真实完成状态。
- [x] 报告界面/逻辑变化、验证结果、数据库部署与任何实质限制；不把隔离 smoke 说成用户真实业务端到端验证。
