# 重点关注与求职详情布局实现计划

> 面向 AI 代理：按 subagent-driven-development 执行，任务逐项审查。用户已批准分区信息行并授权完成实现、验证和云端部署；本计划不再设重复批准关卡。

**目标：** 删除待补材料工作流，添加岗位红旗关注，并将投递详情改为分区信息行。

**架构：** 关注使用 company.focused_at，复用 tracker 的字段保存队列与账户作用域。首页从岗位摘要读取；投递事实和原件分开呈现，无原件不形成任务。保留现有看板、列表、抽屉、三页签和公司流程规则。

**技术栈：** React 19、TypeScript、Zustand、已有 shadcn/ui、Motion、Supabase PostgreSQL / Edge Functions。

## 全局约束

- 当前分支 feat/product-upgrade；不创建分支、不提交、不推送。保护开工前所有未提交文件。
- 只修改本功能直接相关代码，不重做页面结构或公共 Card / Dialog。
- 关注不更新 updated_at、不创建活动、不推进状态。结束、录用、归档保留红旗，但首页不展示。
- 无原件是完整投递；删除补充动作和入口，已有原件可更正并保留修订。
- 复用 Button、Tooltip、Badge、DropdownMenu、Collapsible、Dialog、Alert、Spinner、WorkflowDateField；详情用 section / dl，普通语义布局无需新组件。
- 所有新增动效遵循公共 DURATION / EASE 和 useReducedMotion。新测试放 tests/tracker-focus/，验收后删除自建测试文件，保留证据到忽略目录。
- 不执行 TDD。实际验证须覆盖生产实现，不抄业务逻辑。

## 任务 1：数据库关注字段和服务契约

文件：新增 supabase/migrations/\*\_tracker_focus.sql；修改 supabase/functions/job-submissions/index.ts。

- [x] 使用 `pnpm exec supabase migration new tracker_focus` 创建迁移。
- [x] 添加 `alter table public.company add column focused_at timestamptz;`，检查列级 SELECT / UPDATE 权限并延续现有 RLS。
- [x] 检查 update_company_updated_at，使用 company 专用触发函数：仅 focused_at 改变时保留 OLD.updated_at，其余业务变更仍更新时间；不得修改其他表的通用函数。
- [x] 删除 Edge supplement 动作。correct-material 仅能替换已有原件。同步 SQL save_job_submission_material 入口，禁止对 pending 主记录使用更正通道添加材料，保留 record 首次可选原件以及修订读取。
- [x] 在隔离 PostgreSQL 使用真实 authenticated / service_role 验证：关注开关、时间不变、普通修改时间改变、跨账户拒绝、pending 更正拒绝、已有原件更正保留历史。运行 Deno check、已有相关验证。
- [x] 保存报告和 diff，独立审查后进入部署关卡。

## 任务 2：关注状态、入口与首页

文件：src/lib/supabase/resume/company.ts；src/pages/tracker/types.ts、store.ts、store/selectors.ts；components/focus-button/index.tsx、board/index.tsx、list/job-card.tsx、list/job-table.tsx、toolbar/index.tsx、drawer/index.tsx；tracker/index.tsx、hooks/use-tracker-overview.ts；src/pages/index/{insights.ts,job-priorities.ts,index.tsx,components/job-priorities/index.tsx,components/todo/index.tsx}。

- [x] 岗位类型和摘要带出 `focused_at: string | null`；通用 API 不为仅 focused_at 写入显式 updated_at。
- [x] store 增加 `focusedOnly`、筛选 setter 和 toggleJobFocus，复用 saveJobFields、账号 scope 和字段版本。展示快照比较包含 focused_at。
- [x] 关注筛选与列表、看板、全选一致，接入 `/tracker?focus=1`。关注不引起职位重排。
- [x] 共用 FocusButton 使用现有 Button / Tooltip、aria-pressed、Lucide Flag；点击和指针事件与开详情/拖动分开，键盘正常操作，红色实心与灰色空心，触屏命中区 44 px。
- [x] 首页删除 pendingMaterials 资源，第三张卡使用 jobs 状态，按 focused_at 降序显示前 2 项，完整计数，查看全部链接，终态及归档不展示。
- [x] 今日待办去掉内层边框，保留图标、文字、分隔线和已有 Link/Button 交互。
- [x] 对实际优先级构建、筛选和 store 保存执行临时验证，检查刷新、取消和保存失败。

## 任务 3：移除补材料并重排投递详情

文件：src/lib/supabase/resume/submissions.ts；src/pages/tracker/components/drawer/{submission-list/index.tsx,submission-dialog/index.tsx,contacts/index.tsx,index.tsx}；必要的投递预览业务组件。

- [x] 删除 pending 汇总查询、类型和 supplement API；保留数据兼容 pending 值及历史文件、JD、修订。
- [x] 首次投递使用已有 Checkbox / Collapsible 选择“附上投递原件（可选）”，默认无原件；开启后选择平台版本或文件。移除稍后补材料选项。
- [x] applied 页改为 section 标题+编辑、dl 日期/渠道、可选备注、单文件行、JD 与历史折叠；无双层 Card。历史确认空时不显示空容器，错误可重试。
- [x] 联系人空态收成一行；准备简历保留原有 Collapsible；下方仅在原件存在时显示文件行，不重复日期渠道备注，不出现缺失任务。
- [x] 更正原件只对已有原件开放；更正信息继续保留历史，不改变当前流程阶段。旧多条投递的选择与只读访问保持完整。
- [x] 验证无原件、PDF、DOCX、平台固定版本、旧多记录及更正历史，检查 Dialog 描述、焦点和两轮开关及退出中重开。

## 任务 4：集成验证、云端部署与交付

- [x] 对修改文件先 `pnpm exec prettier <files> --write`，再 `pnpm exec eslint <files> --fix --fix-type layout`，普通 ESLint、`pnpm exec tsc -b`、`pnpm build`。
- [x] 实际页面验证桌面 / 390 / 320 px、深色、减少动效、长名称、空/多条、旗帜不拖动和整卡其他区域拖动、三页签无残影、边框完整、键盘焦点。
- [x] 独立审查本次相对开工快照的 diff；修复后复验相关路径。
- [x] 只部署本次已验证迁移与 job-submissions 到已链接项目 bitxrpdtlohlnywgusfw；核对迁移账本、函数版本、真实账户 HTTP smoke。测试账户及文件限定到本轮创建数据并清理，既有业务数据指纹不变。
- [x] 更新规格、计划、防回归清单，分别记录实施、验证、用户审查状态。清理本轮 tests 临时文件，复查最终改动范围；向用户提供实际完成项、验证结果和任何未完成限制。

## 最终记录

实施完成。静态检查、10 组真实数据库验证、19 项实际函数断言、16 项真实 store 断言、云端与主要 UI 路径通过。核对范围及未覆盖边界见 [验收记录](../specs/2026-10-28-tracker-focus-acceptance.md)，不将清单勾选解释为所有历史场景均重新跑过。

实际验收发现并补齐流程 RPC 的完整字段，修复投递事实重载后的焦点恢复；均经独立定点复审。重复 key 警告保留为单独诊断项。

云端迁移及 job-submissions 第 3 版已部署。用户对最终实现的审查尚未进行。未提交、未推送。
