# 公司与岗位流程重构实现计划

> **面向执行者：** 使用 executing-plans 在当前会话、当前分支逐项执行。用户已授权实施；沿用已经确认的产品边界，不重复索要同一范围的批准。未获授权不创建分支、不提交、不 push，不启动第四期。

**目标：** 按公司管理岗位流程；一个岗位流程只记录一次投递，被捞回后接续原流程，原投递材料、结束详情和面试记录保持可追溯。

**架构：** 新公司档案关联现有岗位 ID。复用 job_submissions 保存唯一主投递及旧凭据，补充和纠错保留版本；公司名额与阶段变更在数据库事务内生效。前端沿用 tracker store、保存队列、看板、列表、抽屉与三个页签。

**技术栈：** 当前 React / TypeScript、Zustand、shadcn/ui、Base UI / Radix、Motion、Supabase PostgreSQL / Edge Functions。使用已安装的 pnpm、Supabase CLI 和 pg，不引入新依赖或测试框架。

**设计依据：** [已确认的设计](../specs/2026-10-26-company-process-design.md)。本计划取代 [10 月 26 日提纲](2026-10-26-company-process.md)。

## 1. 当前状态与范围

| 项目                                           | 2026-10-28 状态                        |
| ---------------------------------------------- | -------------------------------------- |
| 一次投递、公司并行规则、结束后恢复方向         | 用户已确认                             |
| 最新 AGENTS.md、产品防回归清单及本模块历史资料 | 已重新读取                             |
| 本计划的代码路径与组件检索                     | 已完成                                 |
| 公司流程业务实现                               | 核心代码已实现，完整页面验收未完成     |
| 本次迁移、云端部署、线上验证                   | 迁移与函数已部署，核心 HTTP smoke 通过 |
| 重构后的实际 UI 与完整流程用户审查             | 尚未进行                               |

调研开始时分支为 feat/product-upgrade、HEAD f3466205，工作区包含已有 staged、unstaged 和 untracked 修改。计划编写期间外部提交已将 HEAD 更新为 45609cac；这些提交不是本次规划操作产生的。计划阶段仅修改四份设计/计划文档。实施开始时重新保存基线，特别保留已经进入 submissions.ts、submission-types.ts、submission-list 的修复，不按旧快照还原。不得 reset、覆盖、批量格式化或顺带清理。

本次保留首页提醒卡片、整卡拖动、轮次删除过渡、页签内容退出交接、模板预览延后重渲染等既有改动。它们是回归项，不另起一轮视觉改版。简历导入、编辑检查、模板协议和 PDF 分页实现不在本计划的改造范围。

## 2. 最新编码规则如何落实

| 新规则                   | 本计划执行方式                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 不为猜测的竞态增加复杂度 | 仅实现已确认的一次投递与单活跃流程约束；复用账户隔离、请求 ID、保存队列。没有证据不增加通用重试、租约、分布式锁或第二套操作代次 |
| 外部数据只在入口校验一次 | HTTP 的形状和文件在 Edge 入口校验；可由客户端调用的 SQL RPC 在入口验证参数、归属及业务约束。内部消费明确类型，不逐层重复解析    |
| 不提前抽只用一次的函数   | 仅提取公司规则、投递状态等有清楚概念或真正多处复用的逻辑；不建立通用流程引擎                                                    |
| 主函数先正常流程         | 准备变量、调用入口校验、执行事务或保存、返回结果按职责分段；细节放在对应模块的下方函数                                          |
| 注释只写不明显约束       | 说明旧凭据为何保留、历史轮次为何不重新规范化、未知日期为何不补今天；不逐行解释赋值                                              |
| 自动生成文件不手改       | 迁移文件由 CLI 创建；不修改已部署历史迁移。当前 Supabase client 没有接入生成的 Database 类型，不为本次另造生成流程              |
| 验证真实实现             | 通过实际 RPC、函数、Storage 与 UI 验证，不在测试中重写单流程判定；只用合成数据，临时脚本放 tests                                |
| 沿用仓库工具和流程       | 不执行 TDD，不引入新包；当前分支逐项完成，最后部署与验收                                                                        |

公司行锁和唯一索引用于直接实现业务规则：现有看板、列表、批量动作及投递函数都有写入入口，单靠某个按钮禁用无法约束它们。这里不声称已测得线上并发事故或概率，也不据此扩展其他防御机制。

## 3. 文件职责与组件复用

所有以下路径相对 D:\项目\resume。新业务组件使用文件夹 index.tsx；保留页面现有 components / hooks / const.ts / index.tsx / store.ts / types.ts / utils.ts 结构。

| 文件或目录                                                                                              | 操作与职责                                                                                          |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| supabase/migrations/                                                                                    | CLI 创建一份 tracker_company_processes 增量迁移；公司引用、主投递约束、纠错历史、事务、列权限与 RLS |
| supabase/functions/job-submissions/index.ts                                                             | 修改既有 record / supplement；加入详情纠错、材料纠错、旧记录确认及修订读取，不新增另一套上传服务    |
| supabase/functions/job-submissions/files.ts                                                             | 原样复用真实 PDF / DOCX 校验；仅在接口接入确有必要时修改                                            |
| src/lib/supabase/resume/company.ts                                                                      | 接入公司引用和受约束的创建、阶段、恢复、改公司 RPC；保留现有岗位 API 名称                           |
| src/lib/supabase/resume/tracker-companies.ts                                                            | 新增公司档案读取与规则修改 API；只负责边界映射与错误转换                                            |
| src/lib/supabase/resume/submissions.ts                                                                  | 单次投递状态、主记录补充与纠错、历史凭据和修订读取；原下载路径继续受保护                            |
| src/pages/tracker/types.ts、submission-types.ts、const.ts                                               | 公司规则、公司引用、投递状态、历史轮次和恢复事件类型；文案常量                                      |
| src/pages/tracker/store.ts、store/companies.ts、store/selectors.ts                                      | 新增公司 slice；列表分组、公司筛选与共享投递状态接入现有页面 store，精细订阅                        |
| src/pages/tracker/store/workflow-save.ts、workflow.ts                                                   | 复用队列接入事务；保留草稿、账户作用域、失败重试，修正恢复时的轮次规范化                            |
| src/pages/tracker/components/drawer/company-picker/index.tsx                                            | 新增公司选择业务组合：按 ID 选择或明确创建，不把文字输入直接认作已有公司                            |
| src/pages/tracker/components/drawer/company-details/index.tsx                                           | 新增轻量公司信息弹窗：规则、同公司流程、将岗位关联到已有公司                                        |
| src/pages/tracker/components/drawer/add-job/{index.tsx,types.ts,utils.ts,add-job-form/index.tsx}        | 沿用新增岗位表单，接公司选择、可选批次和转岗来源                                                    |
| src/pages/tracker/components/drawer/{index.tsx,edit-form.tsx,meta-bar.tsx}                              | 同公司入口、公司改关联；保留现有抽屉结构                                                            |
| src/pages/tracker/components/drawer/{stage-detail,submission-dialog,submission-list,document}/index.tsx | 已投递详情和材料摘要共用同一主记录；移除再次投递行为，保留旧凭据查看                                |
| src/pages/tracker/components/drawer/reopen-process/index.tsx                                            | 新增恢复表单，复用 Dialog / 日期 / Select；确认后继续旧流程                                         |
| src/pages/tracker/components/drawer/{activity-timeline,interview-sub-stages}/index.tsx                  | 展示恢复事件、过去结束详情和历史轮次，不改轮次删除动效                                              |
| src/pages/tracker/components/list/{index.tsx,job-table.tsx,job-card.tsx}                                | 在现有列表内增加公司分组，岗位仍使用现有行和卡片                                                    |
| src/pages/tracker/components/{toolbar,board,batch-actions}/index.tsx                                    | 公司筛选，复核状态入口是否统一进入 store；不更换拖拽引擎                                            |
| src/pages/tracker/{utils.ts,hooks/use-tracker-overview.ts}                                              | 当前阶段与历史投递分别统计，公司筛选不改变历史响应率定义                                            |
| src/pages/index/{job-priorities.ts,insights.ts,store.ts}                                                | 待补材料按岗位去重，保留模块各自加载                                                                |
| tests/company-process/                                                                                  | 本轮临时数据、SQL、接口及实际页面验收入口；完成后只删除本轮文件                                     |

已实际检索：src/components/ui/combobox.tsx、select.tsx、dialog.tsx、drawer.tsx、card.tsx、empty.tsx、alert.tsx、spinner.tsx；tracker-combobox、workflow-date-field、submission-dialog、stage-detail 及 list 的实际使用。Magic UI 组件在 src/components/ui 下，并非另一个 magicui 目录。

| 交互                         | 复用选择与原因                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 选择公司                     | Base UI Combobox；现有 TrackerCombobox 绑定自由文字，无法区分两个同名公司的 ID，因此只组合底层组件新增 company-picker，不复制下拉框实现 |
| 修改规则、目标阶段、材料来源 | 现有 Radix Select                                                                                                                       |
| 投递、纠错、恢复、公司信息   | 现有 Dialog / AlertDialog；每个内容区关联 Description，保留原抽屉的嵌套 Escape 处理                                                     |
| 投递日与恢复日               | WorkflowDateField / Calendar，不能改用 Input type=date                                                                                  |
| 材料区与异常状态             | Card / Empty / Alert / Spinner；业务区域留出 ring 空间，标题 16 px / 600，说明 14 px / 常规                                             |
| 过渡                         | PresenceDiv、DrawerTabPanel、ViewTransition、AnimatedContent、公共 DURATION / EASE 和 useReducedMotion；不改全局 primitive              |

已有组件覆盖本次控件需求，无需安装 registry 组件或自行制作基础控件。

## 4. 固定的数据与行为契约

### 4.1 公司与岗位

```ts
export type CompanyProcessPolicy =
  | 'unknown'
  | 'single_active'
  | 'multiple_active'

export interface TrackerCompany {
  id: string
  user_id: string
  name: string
  logo: string | null
  process_policy: CompanyProcessPolicy
}
```

tracker_companies 增加创建与更新时间。company 增加 tracker_company_id、recruitment_batch、referred_from_job_id，后两项允许空。流程 ID、resume_id、JD、分享与岗位上下文关系不变。已有 company / company_logo 字段保留为兼容显示值，由公司关联更新事务同步，页面不再维护两个可独立编辑的公司名。

占用名额的状态固定为 applied、assessment、screen、written、interview；saved、offer、rejected 不占用。archived 不参与名额判断。unknown 允许记录，不猜测公司招聘政策。

旧流程各自建立 unknown 档案，不自动同名合并。用户编辑岗位时可以选择已有公司；若想把多条旧流程归到同一公司，逐条关联即可，不新增批量公司合并系统。公司名称相同只提示已有候选，不作为唯一键。

### 4.2 一次投递与历史凭据

```sql
alter table public.job_submissions
  add column is_primary boolean not null default false;

create unique index job_submissions_one_primary_per_job
  on public.job_submissions(job_id)
  where is_primary;
```

迁移不直接给 job_id 建普通唯一约束，因为真实旧数据可能有多行。按 user_id / job_id 归属统计：一行设主记录；多行全部保留、无主记录；零行保持没有记录。后续 record 必须在事务内确认既无主记录、也无待确认旧记录，才创建主记录。

```ts
export type JobSubmissionState =
  | { kind: 'none' }
  | { kind: 'ready'; primary: JobSubmission; legacy: JobSubmission[] }
  | { kind: 'needs-resolution'; legacy: JobSubmission[] }
```

加载和错误放在 store 的请求状态，不混进上述真实业务状态。所有读取只取摘要；打开预览才下载正文或原文件。is_primary 是业务手写类型字段，按真实数据库字段名映射一次。

新增 job_submission_revisions：id、user_id、submission_id、created_at、reason、before_snapshot。before_snapshot 保存被修改前的投递元数据、材料快照与原文件引用；客户端只能按列读取修订摘要，预览与下载仍经 job-submissions 校验当前归属。修改日期、渠道、备注或已有材料前，在同一事务写修订，再更新主记录；未变更的保存不制造修订。旧文件不覆盖，不复制二进制文件，不另建上传桶。

pending → 已补材料复用 supplement；已完整材料的替换只能走明确的纠错动作。请求 ID、未知结果重试及文件上传失败处理沿用当前实现。错误码在 API 层映射一次，冲突返回可打开的已有岗位或主记录 ID，失败表单保留输入。

### 4.3 阶段与恢复

| 动作                                         | 事务结果                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| saved → applied                              | 主投递和阶段同时保存；允许日期、渠道、材料为空                                                            |
| 当前已经有投递事实，查看或回到 applied       | 使用同一主记录，不再次创建                                                                                |
| 补充或纠错投递信息                           | 更新主记录及修订；当前面试等阶段不回退                                                                    |
| 直接记录更后面的阶段                         | 保留现有跳阶段能力；占活跃名额，但不推断已有投递，不补造前序日期                                          |
| rejected → 恢复                              | 原结束详情写入恢复事件；原轮次标记为历史，再进入所选阶段；投递主记录不变                                  |
| 已归档流程恢复                               | 表单明确提示恢复后显示到当前列表；同一事务取消归档                                                        |
| 转到其他岗位                                 | 同公司创建关联流程，写 referred_from_job_id；默认保存，选择后续阶段时不伪造投递日期；原岗位不会被自动结束 |
| 单流程公司有其他进行中岗位                   | 新开始、恢复、换公司均拒绝，返回冲突岗位；不通过归档释放名额                                              |
| multiple_active / unknown 改成 single_active | 已有多个进行中岗位则拒绝规则修改，显示涉及岗位                                                            |

轮次类型增加可选 is_history；旧值缺失只在数据入口视作 false。normalizeInterviewSubStages 对历史轮次保留 status、start_date、notes 和 order；仅规范化当前轮次。恢复到 interview 时追加新轮次，其他恢复阶段在用户进入面试时再新增。既有轮次 UUID 不改变。

TrackerActivity 增加 workflow_resume 类型，结构化记录恢复日期、原因、来源/目标阶段、先前结束详情及历史轮次 ID。继续使用 activities，不建立通用事件溯源或第二套时间线。恢复事务使用现有活动 ID 作为本次恢复的稳定身份，重复请求不重复追加轮次。

## 5. 实施步骤

### 任务 1：只读核对与隔离验收准备

**文件：** 本计划；临时 tests/company-process/audit.sql、verify.mjs；证据输出至已忽略的 .superpowers/sdd/company-process-20261028/。

- [ ] 保存当前 git status、staged / unstaged 差异和本轮目标文件摘要。核对并保留已有 submissions 相关修复，不回退其他工作。
- [ ] 对照本地迁移与当前链接项目的 schema、权限、账本，只读统计旧数据；不把简历正文、联系人或文件内容写入报告。

```sql
select count(*) as processes,
       count(*) filter (where status in
         ('applied','assessment','screen','written','interview')) as active
from public.company;

select submission_count, count(*) as jobs
from (
  select user_id, job_id, count(*) as submission_count
  from public.job_submissions
  group by user_id, job_id
) grouped
group by submission_count
order by submission_count;
```

- [ ] 记录岗位、投递行、快照、原文件哈希及分享/简历关联的迁移前指纹。报告只存计数和摘要；全量行用于隔离比对时不进入版本库。
- [ ] 在隔离 PostgreSQL / 本地 Supabase 准备两个合成账户，覆盖三种公司政策、各阶段、0/1/多条旧记录、PDF / DOCX 与平台快照。沿用仓库已有 pg 验证方式，调用真实 SQL 和函数。

**通过条件：** 得到实际迁移分类数量、可复现的隔离环境；没有修改线上业务行。若权限不足，明确缺少的具体权限，不以空结果当成没有数据。

### 任务 2：增量结构与无损映射

**文件：** CLI 返回的 migration 文件；tracker/types.ts、submission-types.ts；新增 tracker-companies.ts。

```powershell
pnpm exec supabase migration new tracker_company_processes
```

- [ ] 创建 tracker_companies、job_submission_revisions 及第 4 节字段/索引。公司引用同时约束账户归属；转岗引用只能指向同账户、同公司的原流程，原流程删除后来源可为空，不级联删除新岗位。
- [ ] 在事务内按既有岗位一对一创建 unknown 公司；按 0/1/多条规则标记主记录。只增加关联和分类字段，不变更旧正文、文件、日期、材料内容及岗位主键。
- [ ] 明确新表 RLS、authenticated 可读列、service_role 权限；修订快照和 file_path 不直接暴露。保持 job_submissions 既有按列授权，新列显式加入读取清单，不改成 grant select on 全表。
- [ ] 隔离应用迁移，比较任务 1 指纹；使用真实 authenticated A/B 与 anon 验证，而非仅以 owner 执行 SQL。

**通过条件：** 旧数据指纹一致；跨账户引用被拒绝；同岗位最多一条主记录；旧重复记录和原文件完整保留。

### 任务 3：统一阶段、公司规则与恢复事务

**文件：** 同一增量迁移、company.ts、tracker-companies.ts、workflow.ts、types.ts、workflow-save.ts。

- [ ] 新增职责明确的 RPC：create_tracker_process、update_tracker_company_policy、reassign_tracker_process、transition_tracker_process、reopen_tracker_process。输入使用已确定类型；普通阶段转换继续复用现有 transitionJobWorkflow 计算内容，RPC 负责校验目标、归属与原子写入。恢复历史从数据库旧值生成，不接受客户端自报的旧历史。
- [ ] 用户 RPC 从 auth.uid() 取得账户，不接受客户端指定 user_id。需要写入受限列的事务函数明确使用 SECURITY DEFINER、固定空 search_path、全限定表名，撤销 PUBLIC / anon 的 EXECUTE，仅向 authenticated 开放，并在入口检查账户与岗位归属；该提权仅用于受控事务，不以它绕过读取权限。原 service_role 专用的 save_job_submission 继续保持受限调用，不开放给客户端。
- [ ] 开始、恢复、改公司和改规则统一锁定对应公司行，再读取活跃岗位并执行；涉及两个公司按 ID 顺序锁定。保持事务小，不把网络上传放进锁内。
- [ ] 公司名额判断由数据库中的同一业务函数承接，公司规则变更和岗位状态/公司关联的写入触发器调用它，覆盖 save_job_submission 的服务端写入。普通资料仍走既有保存路径；受约束的状态和公司引用改由 RPC 写，收紧对应列权限，不能留下 updateCompanyStatus 或直接 .from('company').update({status}) 的绕过入口。

```powershell
rg -n 'updateCompanyStatus|changeJobStatus|transitionJobWorkflow|recordSubmission' src
rg -n "update public.company|from\('company'\)" supabase/functions src/lib/supabase
```

- [ ] 修正历史轮次规范化；恢复前 flush 当前草稿，再调用 RPC 并合并服务器结果。沿用现有 runtime.versions 与 account-scope；不重写保存队列，不添加新的全局同步层。
- [ ] 对新建、批量、拖拽、编辑表单、投递、恢复分别检验名额约束。批量部分成功时保留成功结果、逐项反馈冲突，不假装整批成功。

**通过条件：** 两个真实会话同时开始同公司两个岗位只成功一个；结束后可开始另一个；归档不绕过；恢复重复请求只追加一次事件和轮次；直接写受限字段被拒绝。

### 任务 4：投递接口收敛与旧记录确认

**文件：** job-submissions/index.ts、对应 SQL RPC、submissions.ts、submission-types.ts。

- [ ] record 在同一事务创建主记录；仅当当前为 saved 时推进 applied，其余阶段保持不变。已存在主记录返回已有记录信息，同 ID 同内容重放返回成功，旧多条未确认返回 needs-resolution。保留原请求 ID 机制，不新造操作账本。
- [ ] 增加 resolve 操作：输入 jobId 与选择的旧 submissionId，校验同一岗位，原子设置唯一主记录；其他旧行只读保留。确认动作不修改阶段、旧文件和历史日期。
- [ ] 增加 update-details / correct-material 操作，写入变更前修订、原因及更新时间；复用现有文件校验、平台版本冻结和私有桶。所有补充/纠错仅允许当前主记录，旧凭据与修订只读；supplement 不改变原投递日期、渠道或记录时 JD。
- [ ] material / download 扩展可选 revisionId；先由服务入口定位归属，再取该版本的材料。继续保留 DOCX 二进制响应修复，验证原件字节一致。
- [ ] API 层返回 JobSubmissionState 和可识别错误，UI/store 不重复判断原始未知对象。旧记录确认前仅可查看和下载，不继续追加。

```ts
// 复用已有 SubmissionInput / SubmissionMaterialInput，不重做上传协议。
export interface SubmissionCorrection {
  submissionId: string
  reason: string
  submittedOn: string | null
  channel: string | null
  note: string | null
}
```

**通过条件：** 日期未知可保存；补材料不回退；修改原简历不改变已提交快照；纠错后旧文件/旧快照可读；异账户和匿名均不能读写；重试不增加投递次数。

### 任务 5：公司选择、分组与规则入口

**文件：** company-picker、company-details、add-job、edit-form、meta-bar；store/companies.ts、store/selectors.ts；list、toolbar、board。

- [ ] 在现有新增/编辑表单使用 company-picker。选择项按 ID 绑定；同名候选显示已有岗位辅助区分；明确的“新建公司”才生成档案。免费 JD 提取只回填候选名称，不自动选公司或修改其规则。
- [ ] 可选招聘批次放在已有补充信息中，不增加必填。公司信息弹窗显示规则、进行中数量和同公司岗位，允许打开或关联已有公司，禁止静默结束冲突岗位。
- [ ] 现有列表增加“按公司分组”选项，默认保持现有排序视图；启用后公司内沿用现有排序和岗位行。按公司 ID 分组，绝不以名称作为 React key。
- [ ] 公司筛选放在现有工具栏并与搜索、阶段、归档组合。看板仍按阶段、256 px 普通列；从抽屉查看同公司流程时设置同一个筛选，不新开工作台。
- [ ] 公司活跃数量包含归档中的活跃岗位；列表可见数量按当前筛选，二者文案分清。公司读取有独立加载/失败状态，失败不假设规则 unknown。

**通过条件：** 两个同名公司不会串流程；已有未确认档案可明确关联；桌面和 390 px 布局保留；键盘选择、清空、Escape、焦点恢复和减少动效通过。

### 任务 6：一份投递详情、材料摘要和恢复入口

**文件：** drawer/stage-detail、submission-dialog、submission-list、document、reopen-process、activity-timeline、interview-sub-stages、drawer/index.tsx；store.ts。

- [ ] 已投递阶段显示同一主投递的日期、渠道、材料和记录时 JD。日期不再有可与主事实分叉的独立编辑器；stage_details 中的投递日期在同一事务同步，渲染以主投递为准。
- [ ] 联系人与简历保留“准备中的简历”，下方改为“已提交材料”摘要。复用已有 submission-list 文件重构其内容，所有“再次投递”入口移除；无投递时按钮为“记录投递”，有投递时为“补充材料”或“查看投递详情”。
- [ ] 旧多条凭据显示“确认本次投递”与只读历史，选择主记录前可逐条预览；确认后旧凭据收在可展开区域，不伪装成新的投递次数。
- [ ] 恢复表单包含恢复日期、目标阶段、可选原因及归档说明。操作名“恢复流程”；默认目标面试，允许回到测评/筛选/笔试。恢复冲突在表单内显示，并提供打开冲突岗位的真实按钮。
- [ ] 原岗位推荐到其他岗位时，复用新增职位表单、预选公司和来源岗位；不自动带入投递材料、不结束原岗位。单流程公司可先保存新岗，开始时再检验名额。
- [ ] Card 周围留出边框空间，标题、状态、说明有层级；加载、错误、无投递、待确认、待补、已有材料分别显示。保留三页签、草稿 flush、焦点交接、退出 inert 和新旧文字错开过渡。

**通过条件：** 两个页签展示同一次投递；后续阶段补充不回退；关闭表单不丢失败输入；旧结束详情和轮次结果可回看；所有新增操作可真实完成。

### 任务 7：首页、响应率和岗位上下文

**文件：** tracker/utils.ts、hooks/use-tracker-overview.ts、store/selectors.ts；index/job-priorities.ts、insights.ts、store.ts；submissions.ts。

- [ ] 待补材料只查询主记录并用 job_id 作为项目身份；旧多条未确认不能重复计为待补材料。投递详情确认问题留在岗位内，不伪装成已有材料待补。
- [ ] 当前“已投递/面试中/已录用”继续按当前阶段及页面筛选计数。历史投递分母改为有主投递事实的岗位；分子为这些岗位中有真实后续阶段记录的岗位，沿用历史阶段判定，不把推荐且未投递岗位算入分母。
- [ ] 无分母显示“—”；未确认旧投递另作明确说明，不算零。公司筛选与阶段数一致，历史响应率仍使用全部有依据流程，不能悄悄改成招聘回复概率。
- [ ] 验证补材料、纠错、恢复各执行一次后历史投递总数不增加。公司更名、改关联、恢复、归档后继续带原 jobId 进入编辑/定制/分享，返回同一岗位。

**通过条件：** 首页无重复材料提醒；当前与历史口径不混用；恢复未制造新投递；创建、导出、分享简历仍不自动进入已投递。

### 任务 8：本地整合验收与差异审计

**文件：** tests/company-process/ 临时验收与本计划；更新相关防回归记录。

| 真实验收场景                       | 必须观察到的结果                                           |
| ---------------------------------- | ---------------------------------------------------------- |
| 同公司 A 进行中，B 保存            | B 可以保存；B 开始受 single_active 限制                    |
| A 结束，B 开始；之后恢复 A         | B 开始成功；恢复 A 提示 B 冲突，原记录不变                 |
| A 归档但仍面试中                   | 仍占用名额                                                 |
| multiple_active / unknown          | 可记录两个真实活跃岗位；改为 single_active 前处理冲突      |
| 一岗位重复记录、双标签写入         | 一条主投递；相同请求复用，不同内容明确冲突                 |
| 材料缺失、未知日期、后续补充与纠错 | 日期不伪造、阶段不回退、旧版本可读取                       |
| 结束后两次恢复                     | 每次新增正确轮次，原轮次结果/笔记与结束信息仍保留          |
| 转岗及直接录入面试                 | 来源真实；没投递就不补造投递事实                           |
| 旧记录 0/1/多条                    | 0 不补造，1 关联，多个需确认且全部可回看                   |
| 账户 A → B → A、页面切换           | 复用现有作用域，旧响应不回填新账户或新岗位                 |
| 实际 PDF / DOCX 上传、固定平台版本 | 原件下载哈希一致；预览包含原模板绑定，原稿修改不影响留档   |
| 桌面、390 px、长公司名与同名公司   | 看板/列表/抽屉结构不变，无外层横向溢出和重复 key           |
| 选择器、日历、对话框               | 键盘/Escape/焦点正确；两轮开关与退出中重开；减少动效正确   |
| 页签、轮次、模板预览               | 无内容残留，删除占位连续收起，预览打开保持既有延后渲染策略 |

- [ ] 验证脚本只调用生产模块、真实数据库和真实函数；正常材料来源各走一遍实际页面，不能以 mock UI 或静态截图代替。
- [ ] 若触及模板正文、打印或分页，再按维护手册追加真实 PDF 回归；本计划不主动修改这些实现。保存/展示材料仍需真实预览与下载校验。
- [ ] 对本轮明确修改的文件先 Prettier，后 ESLint layout、普通 lint；运行 TypeScript 与构建。范围列表来自本轮差异，不对整个脏工作区执行 --write。

```powershell
# $changedSourceFiles / $changedDocFiles 由本轮文件清单逐项确认后赋值。
pnpm exec prettier $changedSourceFiles $changedDocFiles --write
pnpm exec eslint $changedSourceFiles --fix --fix-type layout
pnpm exec eslint $changedSourceFiles
pnpm exec tsc -p tsconfig.app.json --noEmit
pnpm build
git diff --check
```

- [ ] 在实际页面按标题、说明、按钮、错误依次通读文案。复查原生控件是否绕过现有组件，检查效果而非仅检查 import。
- [ ] 对照开工基线审计文件与行，保留其他任务修改。实际观察不到的场景记为未验证，不将编译通过等同于用户验收通过。

### 任务 9：部署当前链接项目并完成交付

本任务在隔离演练与本地整合通过后执行，不能把步骤留给用户。只部署本次已验证的迁移和 job-submissions；不重新部署未改动的 job-profile 或 resume-share。

- [ ] 重新检查链接项目、迁移账本与函数当前版本。dry-run 必须只包含本轮可部署迁移；出现其他未验证迁移则先隔离部署集合并再次核对，不能直接连带推送。

```powershell
pnpm exec supabase migration list --linked
pnpm exec supabase functions list
pnpm exec supabase db push --linked --dry-run
```

- [ ] 验证既有函数使用新迁移时仍可读材料；替换旧 save_job_submission 实现并在数据库拒绝再次追加。随后部署兼容后的函数，再启用前端入口，不能在后端未就绪时交付依赖新字段的页面。

```powershell
pnpm exec supabase db push --linked --yes
pnpm exec supabase functions deploy job-submissions
pnpm exec supabase migration list --linked
pnpm exec supabase functions list
```

- [ ] 不使用 include-all、include-seed、prune，也不重置云端数据库。沿用既有 JWT / 函数认证配置，不临时关闭认证来通过 smoke。若旧客户端写入受限字段，需要给出刷新提示，不保留绕过新规则的写入路径。
- [ ] 用合成账号完成公司创建、两流程冲突、一次投递、补文件、恢复、旧凭据确认、跨账户拒绝和匿名拒绝；核对列权限，确保没有 PGRST205 / 42501 导致正常入口失败。比较迁移前后保留数据指纹，记录部署时间、迁移版本与函数版本。
- [ ] 删除本轮合成账号/业务数据/文件并核验；临时脚本仅删除本次 tests/company-process 下创建的文件，已存在的其他 tests 不动。若动作被权限或自动审批阻止，记录真实原因，不换路径绕过。
- [ ] 新问题按“触发场景、根因、长期约束、验收”补入 docs/product-development-guardrails.md。更新第三期计划，分别填实施、验证、部署与用户审查结果。

**交付状态模板：**

| 阶段             | 当前结果 | 完成时记录                        |
| ---------------- | -------- | --------------------------------- |
| 实施             | 未开始   | 文件清单、功能路径                |
| 本地与隔离验证   | 未开始   | 命令、环境、场景和结果            |
| 云端部署与 smoke | 未开始   | 项目、迁移/函数版本、保留数据对照 |
| 用户审查         | 尚未进行 | 实际反馈和需调整项                |

## 6. 依赖顺序与计划自检

任务 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9。复用当前会话顺序实施，不需要新增子代理或多分支协作。数据模型先稳定，界面只消费统一结果；保留旧入口所需的读取能力，禁止再追加多次投递。

- [x] 规格覆盖：公司规则、一次投递、历史材料、恢复、转岗、既有布局、统计、账户隔离和云端交付均有对应任务。
- [x] 具体路径核对：已检查关键 API、SQL、store、页面与基础组件；新增文件仅承接本次真实职责。
- [x] 新规则核对：不加通用防御框架；不复制验证业务；不引入新工具；不重写现有保存队列。
- [x] 状态核对：文档完成不等于业务完成，没有将实施、部署或验收提前勾选。

## 7. 已查阅资料

- 根 AGENTS.md 与 docs/product-development-guardrails.md，2026-10-28 重新读取；本次新增规则为防御性编码八条。
- [第三期旧设计](../specs/2026-10-26-product-phase-three-design.md)与[执行记录](2026-10-26-product-phase-three.md)：多次投递已撤回，其他既有能力继续保留。
- [看板账户隔离](../specs/2026-10-15-tracker-account-isolation-design.md)、[布局与统计](../specs/2026-10-25-tracker-layout-counts-design.md)、[切换与预览性能](../specs/2026-10-26-ui-transition-performance-design.md)。
- 当前 Supabase CLI 2.120.0 的 migration new / list、db push、functions deploy / list help 已核对；计划阶段未执行迁移创建或云端写入。
- Supabase 官方[迁移流程](https://supabase.com/docs/guides/local-development/cli-workflows)与[列权限](https://supabase.com/docs/guides/database/postgres/column-level-security)：沿用现有迁移模式并明确检查新增列授权。实施前再核对当时文档与环境，不为计划升级依赖。

## 8. 2026-10-28 执行记录

清理补充：云端两个合成账号、上传文件和业务行已清理并验证，隔离 PostgreSQL 已停止。最后停止本轮 5192 / 5193 验收服务、解除 Q: 映射并删除 tests/company-process 的命令被自动审批拒绝，返回 blocked by policy；未绕过重试。本地临时目录（含临时验证凭据）、映射及验收服务仍保留，待解除该限制后清理，不能提交该目录。用户未授权 git push，本轮没有推送。

- 用户已明确授权实施；在 feat/product-upgrade、HEAD 45609cac 上继续，未创建分支、提交或 git push。沿用原看板、列表、抽屉和三页签；复用现有 Combobox、Dialog、Select、Calendar、Card、Alert、Spinner 与动效封装。
- 核心代码：公司档案/并行规则、按公司筛选和列表分组、单份投递详情和材料摘要、补材料/更正及旧版本、恢复流程/历史轮次、同公司转岗来源、首页和响应率口径均已接入。API 返回明确投递状态，复用原账户作用域与串行保存队列。
- 隔离验证：PostgreSQL 17.11 的 16 组真实 SQL/权限/并发场景通过；真实前端 workflow/utils 验证恢复后续面试和统计口径通过。证据位于 .superpowers/sdd/company-process-20261028/database-report.md、database-results.json、frontend-results.json。
- 静态检查：本轮源文件 Prettier、ESLint layout 和 lint 通过（旧 interview-sub-stages 的两条 ref 命名 warning 保留）；TypeScript、Deno job-submissions check 与 Vite 构建通过。构建仍有既有循环 chunk / 大 chunk 提示，不扩展到打包重构。
- 云端：仅部署 20261028063058_tracker_company_processes.sql 和 job-submissions，当前链接项目 bitxrpdtlohlnywgusfw；迁移账本已核对，函数版本 2、ACTIVE，认证配置未改变。dry-run 无其他迁移。
- 线上 smoke：两临时账户验证一次投递及重放、公司名额、归档占位、结束/恢复去重、转岗、列权限、匿名与跨账户拒绝；PDF / DOCX 上传下载逐字节一致，纠错后的旧 PDF 可下载，日期更正不回退面试阶段。迁移前后原有 2 个岗位、1 份投递、3 个分享的全部旧字段哈希一致。临时账户、文件和业务行已删除并核验。
- 页面验收未完成：生产预览到达未登录求职跟进入口。尝试继续时，computer-use 安全检查因无法可靠确认 Windows 当前浏览器 URL 中止本轮 UI 操作；没有改用其他浏览器控制方式绕过。不能据接口通过宣称桌面/390 px、键盘/Escape/焦点、两轮开关/反向切换、减少动效、实际材料预览均通过。
- 尚待完成：实际页面中的正常/冲突/旧多条确认路径、平台固定版本真实预览与原稿修改隔离、窗口和账户切换、上述动效和响应式回归，以及最终整体审查。核心实现状态不等于完整验证通过，用户审查尚未进行。

| 阶段                      | 本轮结果                           |
| ------------------------- | ---------------------------------- |
| 核心实施                  | 已实现，待完整 UI 验收后的必要修正 |
| 类型、构建、隔离数据库    | 通过，见上述证据与既有警告         |
| 云端部署和核心 HTTP smoke | 通过，原数据保留，测试数据已清理   |
| 实际页面完整验收          | 未完成，浏览器安全检查中止         |
| 最终用户审查              | 尚未进行，未宣布交付完成           |
