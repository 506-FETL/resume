# 公司与岗位流程重构计划

> 后续按 executing-plans 在当前分支逐任务实施。此计划为用户要求的重构审查稿，业务实现、迁移及部署尚未开始；本轮另行完成已授权的动效修复。

**目标：** 公司管理并行招聘规则，岗位流程只记录一次投递，结束后被捞回时保留历史并接续面试。

**依据：** [重构设计](../specs/2026-10-26-company-process-design.md)。用户已确认单流程限制的是同时进行的流程数量。

**架构：** 新公司档案关联现有岗位 ID；投递事实与已投递阶段共用数据；原材料凭据保留。状态推进和名额约束在服务端原子处理。

**技术栈：** React、Zustand、现有 shadcn / Motion 封装、Supabase PostgreSQL / Edge Functions。

## 1. 确认历史数据与迁移映射

- [ ] 只读检查 company、job_submissions 的行数、同岗位多条记录、材料和同名公司，不输出简历正文或凭据。生成按账户隔离的迁移分类清单。
- [ ] 对照 tracker/types.ts、workflow.ts、store/workflow-save.ts 及 supabase/functions/job-submissions，固定开始、结束、恢复、转岗的输入输出和冲突原因。
- [ ] 定义公司规则 `unknown | single_active | multiple_active`；已保存、已录用、已结束不占活跃名额，归档不改变阶段判断。

## 2. 增量数据结构与事务约束

**文件：** 新建 CLI 生成的迁移；修改 `src/lib/supabase/resume/company.ts`、`src/pages/tracker/types.ts`，新增公司数据访问模块。

- [ ] 使用 `supabase migration new tracker_company_processes` 创建迁移，增加 tracker_companies 及 company 的所属公司引用，保留原岗位主键和所有关联。
- [ ] 为同账户公司与流程建立归属校验；公司数据读写、规则变更均受 RLS 保护。默认未知政策，迁移不据同名猜测单流程限制。
- [ ] 在公司行锁保护下事务处理开始 / 恢复 / 改公司 / 改规则，检测其他活跃流程，返回冲突流程 ID；直接写表也不能绕过约束。
- [ ] 在隔离数据库演练单流程双标签并发、跨账户、归档、改规则与恢复冲突，核对原材料及分享关联未变。

## 3. 合并一次投递事实与已投递阶段

**文件：** `src/pages/tracker/submission-types.ts`、`src/lib/supabase/resume/submissions.ts`、`src/pages/tracker/store.ts`、`src/pages/tracker/workflow.ts`、`supabase/functions/job-submissions/` 与对应增量迁移。

- [ ] 新写入对每个流程只允许一条主投递事实，进入已投递阶段与该事实保存原子完成；补充日期、渠道和材料按更新处理。
- [ ] 旧多条凭据全部保留；无歧义单条直接关联，多条进入只读确认状态，不自动取最新、不删旧文件、不制造多条新流程。
- [ ] 幂等重试返回同一事实，重复新建返回已有记录；后续阶段补材料不回退。未知日期和旧记录来源保持明确。
- [ ] 接口验证空材料、平台固定版本、PDF / DOCX 原件、纠错历史、迟到响应、两账号隔离和私有下载。

## 4. 接入公司与恢复流程界面

**文件：** tracker 现有 store / types / utils / const、list、board、drawer、drawer/submission-dialog、drawer/submission-list、drawer/stage-detail、drawer/add-job；必要业务组件采用文件夹 index.tsx。

- [ ] 新增职位时选择或创建公司，复用已有 Select / Dialog / 表单；显示同公司在办流程，避免手输公司名称制造无关联副本。
- [ ] 公司分组只增加在现有列表中，看板继续按阶段。保留头部、工具栏、阶段列及三页签位置。
- [ ] 移除多次投递入口；已投递阶段展示一份投递详情，联系人与简历页改成已提交材料摘要，并链接到同一详情。
- [ ] 已结束流程提供恢复动作，确认后追加恢复事件和面试轮次；旧结束原因和笔记可回看。转岗创建关联流程并记录推荐来源。
- [ ] 冲突提示使用现有 Alert / Dialog，给出打开冲突流程的真实入口，不能自动替用户结束其他流程。

## 5. 首页、统计与原有入口对齐

**文件：** `src/pages/index/job-priorities.ts`、`src/pages/index/insights.ts`、tracker 统计工具及岗位上下文相关调用。

- [ ] 待补材料按流程去重；历史投递和响应率按一次投递事实计算。恢复次数、文件替换与分享创建不计为新投递。
- [ ] 简历定制、编辑、历史、分享继续带原岗位 ID；验证改公司、归档、恢复后上下文不串流程。

## 6. 验收与部署

- [ ] 桌面 / 390 px 实测：单公司单流程、并行多岗位、结束后新岗位、原岗位被捞回、转岗、冲突重试和历史凭据确认。加载、失败、空数据分开；补材料、日历、确认框两轮开关与反向切换、焦点和减少动效均验证。
- [ ] 临时验证脚本与数据仅放 tests 下，收尾清理。对改动源文件执行 Prettier、ESLint layout / lint、TypeScript、生产构建与差异审计，保留已有授权修改。
- [ ] 隔离迁移通过后按依赖部署兼容后端与客户端；云端核对迁移账本、函数版本、正向读写、并发及跨账户拒绝。核对保留数据指纹并清理合成验证数据，不触碰用户现有材料。
- [ ] 分别记录实施完成、验证通过和用户审查结果，更新第三期旧规格与路线图，不开启第四期，不执行 git push。
