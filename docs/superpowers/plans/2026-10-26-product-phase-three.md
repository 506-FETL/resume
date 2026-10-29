# 第三期岗位与投递流程实现计划

2026-10-28 计划更新：同岗位流程只投递一次，公司管理单个 / 多个并行流程；已结束后被捞回接续原流程。用户已确认方向，最新[公司与岗位流程实施计划](2026-10-28-company-process.md)取代下文多次投递任务，并落实 AGENTS.md 新增的防御性编码规则。核心重构及本次后端部署已完成，数据库与核心 HTTP 验证通过；实际页面完整验收尚未完成，详见最新计划第 8 节。旧执行记录保留，不据此继续扩展再次投递入口。

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development 逐任务实现此计划。步骤使用复选框跟踪进度。

**目标：** 在现有看板、列表和详情抽屉内完成建岗、准备简历、明确记录投递、保留实际材料和继续跟进。

**架构：** `company` 继续代表一个招聘岗位及共享进度；独立投递表记录每次事实、当时 JD 和不可变材料。已有编辑、定制、优化、历史、分享通过岗位 ID 带入上下文；现有分享保持 current/history 契约，新增用途与联系方式策略。

**技术栈：** React 19、TypeScript、Zustand、现有 shadcn/ui 与 Motion、Supabase Postgres / Storage / Edge Functions、pnpm。

---

## 状态与全局约束

- 布局审查：2026-10-26 用户已通过保留原布局的修正版。
- 实施：P3-01～P3-06 已完成，后端已部署。验证：核心云端及桌面 / 390 px 主流程通过；完整验收仍有下方未勾选项。实现后的用户审查：尚未进行。
- 仅第三期 P3-01～P3-06；不实施第四期素材库、深度分析或第六期面试备考。
- 保留现有看板 / 列表、工具栏位置、阶段列、详情抽屉及“跟进 / 阶段详情 / 联系人与简历”三个页签；看板普通列宽 256 px、间距 8 px。
- 同岗多次投递共用进度；新批次另建岗。导出和创建分享不等于已投递。
- 免费基础字段提取不进入积分预留或扣减链路；AI 定制、优化沿用原计费。
- 外部文件只支持 PDF / DOCX，每份 10 MB；先投后补可用。平台快照固定正文、可见性、外观和精确模板版本；后续原稿编辑不覆盖留档。
- 当前分支实施，不创建分支、不提交或推送。已有 staged 文档保留；不重置用户索引。
- 不要求 TDD；有意义的验证脚本与合成数据放在 `tests/phase-three/`，交付清理。实现者不部署；集成核验后由主代理统一部署已链接项目并执行线上 smoke。
- 先复用现有 UI 组件；所有新动效接入 reduced motion。弹窗两轮开关及中途反向切换、焦点恢复为验收项。
- 按职责分段；改动文件执行 Prettier、ESLint layout 修复及检查。防御仅围绕真实外部输入、归属、并发和不可变性，不建立通用兼容框架。

## 文件职责与共享接口

| 路径                                                                                           | 职责                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `supabase/migrations/`（由 CLI 创建）                                                          | JD 字段、投递记录、RLS、原子保存/补材料、私有桶与免费提取限额 |
| `supabase/functions/job-profile/`                                                              | 登录用户免费 JD 字段提取与结果校验                            |
| `supabase/functions/job-submissions/`                                                          | 验证原文件、受保护留档写入和读取                              |
| `src/lib/supabase/resume/job-profile.ts`                                                       | 免费字段提取客户端                                            |
| `src/lib/supabase/resume/submissions.ts`                                                       | 留档列表、记录、补材料、读取客户端                            |
| `src/pages/tracker/submission-types.ts`                                                        | 前后端材料来源和记录类型                                      |
| `src/pages/tracker/types.ts`、`store/`、`hooks/`                                               | 岗位字段与账户/岗位作用域内状态                               |
| `src/pages/tracker/components/drawer/`                                                         | 原抽屉内 JD、准备简历、多次投递及表单                         |
| `src/lib/job-context.ts`                                                                       | 岗位上下文的路由参数和归属读取                                |
| `src/components/jd-variant/`、`src/pages/resume/`、`src/pages/optimize/`、`src/pages/history/` | 复用原能力、传递岗位与简历                                    |
| `src/pages/share/`、`src/lib/supabase/resume/share.*`、`supabase/functions/resume-share/`      | 用途、固定/实时内容和服务端联系方式过滤                       |
| `src/pages/index/`                                                                             | 材料待补、到期跟进、下场面试的独立加载模块                    |

基础接口采用以下命名，任务 1 完成后以实际导出签名为后续任务的接口依据：

```ts
type SubmissionMaterialKind = 'pending' | 'platform' | 'file'
type SubmissionInput = {
  id: string // 一次表单操作生成一次；未知保存结果重试复用
  jobId: string
  submittedOn: string | null // YYYY-MM-DD；未知明确为空
  channel: string | null
  note: string | null
  materialKind: SubmissionMaterialKind
  resumeId?: string
  versionId?: number // 不提供时读取云端已保存内容
  file?: File
}
// extractJobProfile(jdText, signal?) -> company / position / location / salary / source
// listJobSubmissions(jobId) -> 轻量列表，不携带正文快照和文件字节
// recordJobSubmission(input) -> 本次记录
// supplementJobSubmission(id, material) -> 本次记录，仅允许 pending 首次补充
// getJobSubmissionMaterial(id) -> 平台快照及模板，或受保护原文件
```

## 任务 1：岗位资料、投递留档和免费提取服务

**文件：** 上表的迁移、两个新函数、两个客户端、submission-types；修改 tracker/types.ts、company.ts 及必要配置。不得改 tracker JSX、分享或首页。

- [x] 阅读 company 的现有 RLS / 数据类型、resume_config 及版本快照、精确模板协议、resume-import 免费服务模式。使用 CLI help 后创建迁移；本任务先在隔离环境验证，不直接修改线上结构。
- [x] `company` 增加 `jd_text`、`jd_updated_at`、`source`，旧数据默认为空；服务端对 JD 改动记录时间。保持 company_logo 历史值兼容。
- [x] 创建 `job_submissions`：owner、job、稳定请求 ID、投递日期/渠道/备注、创建与补充时间、JD 副本及其保存时间、材料类型、简历来源引用、固定快照/模板清单或私有文件信息。日期未知允许空；文件和平台快照不可覆盖；列表不读取大字段。
- [x] 原子记录保证 owner/job/resume/version 归属，唯一请求 ID 重放不重复，只有 saved 首次记录变 applied，保留其他阶段。补材料只从 pending 变为 platform/file，不改投递时间、渠道与原 JD；重复请求返回既有结果或明确冲突。
- [x] 平台材料从云端保存的配置/指定历史读取，固定精确模板清单；缺少模板失败并保留表单，不回退默认。文件由服务端校验扩展、MIME、实际 PDF/ZIP 内容、大小与 DOCX 必需文件，不允许覆盖归档对象。上传/事务失败处理孤立对象；文件私有且按当前登录归属读取，删除岗位不留下可读的孤立材料。
- [x] `job-profile` 复用现有模型凭据/认证/请求上下文，返回有限基础字段，提示模型仅引用 JD、不编造。输入限制 30,000 字符，账号限额与同文本缓存原子处理，失败可重试；不调用付费代理。客户端错误保留原 JD，可手填继续。
- [x] 客户端封装只做需要的转换和错误说明；校验作用域的机制复用 tracker 既有 guard。新增类型不使旧数据渲染崩溃。
- [x] 在 `tests/phase-three/` 验证同请求重放、跨用户拒绝、pending 补充一次、快照不受原稿更新影响、后续阶段不回退、PDF/DOCX 真伪/超限、免费调用无积分路径。输出命令、断言数量与结果。
- [x] 格式、类型与函数检查；在任务报告列出 RPC/函数/类型的最终接口供任务 2 使用。

## 任务 2：原有求职跟进内接入完整记录流程

**文件：** tracker 原有 add-job、edit、meta-bar、document、drawer、store/hooks；新增 `components/drawer/job-description/`、`submission-dialog/`、`submission-list/` 和材料查看组件。

- [x] 新增职位保留结构，增加 JD 原文与免费提取，允许手填与没有 JD；仅公司、职位必填。去掉 Logo 手填。提取结束只填仍未被用户改动的字段；关闭/换文本/换账户后旧响应失效。保存相同名称前提示已有岗，可打开或明确继续新建批次。
- [x] 原 meta-bar 加 JD 入口，已有编辑表单可更新 JD/来源。空、失败、载入状态分开。历史 JD 时间解释自然具体。
- [x] 原 documents 中保留联系人，把“投递简历”改为“准备中的简历”，其下展示投递记录。无材料不影响保存投递；无准备简历仍能上传原件。
- [x] 记录表单包含日期（可未知）、渠道（可未知）、备注、平台已保存版本 / 上传原件 / 稍后补材料三种来源。稳定请求 ID 跟随当前操作；保存未知提示查询/同 ID 重试，失败保留输入。
- [x] 抽屉、列表、看板拖入 applied、批量状态入口等统一复用记录入口，不将导出当投递。不破坏原有阶段动作/撤销/保存队列；再次投递不改变当前阶段。
- [x] 平台材料复用只读快照预览和精确模板渲染；PDF 有预览与原件下载，DOCX 可下载原件。显示 JD 副本、投递时间/渠道、记录/补充时间；待补记录提供补充入口，已归档材料没有静默替换。
- [x] 加载按账户/岗位隔离，迟到响应不能填到新岗位。组件复用现有 Dialog/Select/Popover/Collapsible，描述、焦点和减少动效齐全。
- [ ] 验证真实界面路径与类型/格式，不扩展为新岗位工作区。阶段变更统一入口如涉及既有批量语义，报告实际处理方式。

## 任务 3：岗位上下文与分享用途

**文件：** job-context、新增/现有 JD 定制入口、resume 编辑入口、optimize、history、share 创建与设置、share 客户端、服务端与迁移。

- [x] 通过 `jobId` 路由上下文在服务器归属读取后带入 JD 和关联 resumeId；保留返回该岗位入口。已有全局入口没有 jobId 时保持原行为。不得用全局旧缓存串账户/岗位。
- [x] 从准备简历进入原编辑、定制、优化、相关经历、历史、分享；缺 JD 提示补原文，缺简历选择已有/创建。定制完成可将新简历设为当前准备简历，明确成功后才更新关联。
- [x] 分享创建加入 `review | application | showcase` 用途：审阅 current+comments；正式投递固定已保存内容（复用历史快照及发布批次），不新增已投递事实；公开展示 current，手机号/邮箱默认关闭并可选择。
- [x] 保存用途和联系方式策略。旧链接新字段默认为保持原可见性，不变更 current/history 行为。隐藏联系方式必须在服务端输出/评论投影中完成，不能只用 CSS；公开展示不返回能绕过隐藏策略的评论内容或原附件。
- [x] 无论从 editor/resume/share 哪个创建入口，默认策略一致；现有设置可看清用途和实际固定/更新方式。正式投递不允许切回 current 却仍显示固定承诺。
- [x] 导航与版本文案使用“岗位定制”“投给某公司的版本”等具体措辞；不重构无关命名/API。相关经历复用已有表单/能力，不建设新素材库。
- [x] 验证岗位 JD 自动带入、不重复选择；正式分享后改原稿仍不变；审阅/公开链接随保存变化；公开隐藏联系人在响应中不存在；原 current/history 与评论行为回归。新增迁移仅本地验证，统一最后部署。

## 任务 4：首页与完整链路验收、云端交付

**文件：** `src/pages/index/` 的现有各自数据 hooks 与组件；必要轻量查询；本计划、路线图、防回归清单。

- [x] 首页在原有布局上优先显示待补材料、到期跟进和下一场面试，直接打开原岗位抽屉/相应页签。沿用已有 next_action、next_action_date 和面试轮次，不另造日历。各模块独立加载；失败可重试，零项是真实空态。
- [ ] 全链路：建岗→带 JD 定制→编辑/优化→导出或分享→明确记录投递→再次投递→跟进。验证先投后补、未知日期/渠道、外部 PDF/DOCX、旧岗位兼容、账户切换、上传失败及保存未知重试。
- [ ] 原页面对照：看板宽度/横向滚动、列表列、头部/工具栏和抽屉三页签不变；桌面与 390 px；键盘/Escape/焦点、减少动效；弹窗两轮和退出中重开。
- [x] 运行改动文件 Prettier、ESLint layout/lint、`pnpm exec tsc -p tsconfig.app.json --noEmit`、`pnpm build`、`git diff --check`。独立最终审查同时检查冗余防御、布局偏离、RLS 与快照。
- [x] 核对已链接项目 `bitxrpdtlohlnywgusfw`；经隔离数据库/函数验证后部署本期迁移与变更函数。核对云端迁移账本、实际函数版本和线上匿名拒绝/跨用户拒绝/正向流程/free 提取积分不变；临时合成账号/数据清理，不动用户现有数据。
- [ ] 清理本期 tests 临时验证文件和自建服务，保留用户 Vite；更新实现/验证/用户审查三个状态与证据。仅将已通过的 P3 项勾选；完整交付由用户最终审查。

## 执行记录

- 2026-10-26：修正版布局已批准；完成现有结构、当前分享契约和云端表结构只读核对。尚未开始生产实现。

- 2026-10-26：任务 1 本地实现与独立复查通过。27 项 SQL、3 项并发、22 项初轮 Deno 验证通过；DOCX 结构审查问题已修，20 项针对回归通过。真实云端、UI 与完整流程仍由任务 4 验收，未部署。

- 2026-10-26：任务 2 实现与静态独立复查通过，Select 减少动效缺口已修。局部格式/lint/类型与 7 组针对性逻辑验证通过；真实界面与云端链路仍待任务 4。
- 2026-10-26：用户反馈投递记录缺表后，先交付已复查的任务 1 后端：迁移 `20261026103110` 已应用，`job-profile` / `job-submissions` 均为 v1 ACTIVE。线上 24 项验证通过，合成账号和文件已清理；分享迁移仍待任务 3 完成后部署。客户端错误对象转换已修，8 组逻辑验证通过。整期界面与最终验收仍未完成。

- 2026-10-26：任务 3、4 实现和独立复查通过。分享迁移 `20261026112753` 及列级授权修正 `20261026122646` 均已部署；`resume-share` v45、`resume-comments` v43 ACTIVE，三个新增迁移本地与云端账本一致。18 项实际云端分享 / 首页断言通过，覆盖旧链接契约、正式分享不可变、联系方式过滤、旧评论令牌失效、权限和多次投递保持进度。
- 2026-10-26：最强模型完成最终独立审查；两项 P2（岗位绑定迟到响应、补录 JD 时间语义）已修复并复查通过。7 组异步回放与 6 个日期组合通过。分享用途控件补齐减少动效和标签关联，局部复查通过。全改动格式、layout、lint 和 TypeScript 检查通过；lint 的 7 个既有 warning、Deno 全量检查的 84 个既有错误另行记录，本期未新增，不将 Deno 全量检查称为通过。

## 实际界面验证与剩余项

- 已验证：免费 JD 提取及建岗、准备简历精确模板预览、真实空列表、先记投递再补平台材料、不可变快照及 JD 查看、未知日期和渠道、再次投递保持面试阶段；三种分享用途的真实创建、岗位定制自动带入 JD、返回原岗位。
- 已验证：首页三个提醒分别打开原抽屉的联系人与简历、阶段详情、跟进页签；桌面与 390 px 无新增页面横向溢出。记录投递和留档弹窗完成两轮开关、快速重开及 Escape / 焦点检查，修复两层浮窗一起关闭。
- 未完成的界面项：浏览器扩展未获本地文件访问权限，原生文件选择器到提交的 UI 全程未通过；真实 PDF / DOCX 的上传、下载字节和权限已通过云端接口验证。现有浏览器工具不能模拟系统减少动效，已检查新代码 hook 与降级样式，尚未在该系统模式实测。未重新触发付费 AI 定制 / 优化生成，也未把已有导出功能算作本期新完成的实机验收。
- 代码实现没有尚未开动的 P3 功能；上述未完成项属于验收范围。第四期未开始；用户尚未审查本期实现。

## 最终交付记录

- 最后一次 TypeScript 检查及生产构建均退出 0，构建耗时 1 分 49 秒；已有 chunk 大小和循环依赖提示保留，未无关重构。
- 实际云端验证共 42 项（岗位 / 投递 24，分享 / 首页 18）通过。最终静态审查及修复复查通过；不能用这些结果替代上方明确未完成的实机项目。
- 最后一个合成浏览器账号已删除，并验证 Auth 返回 404、company / resume_config / resume_config_versions / resume_shares / job_submissions 的该用户记录数全部为 0、私有材料目录为空。此前服务验收的两账号亦已清理。
- 自建 5193 预览服务、55436 隔离 PostgreSQL 和 P: 临时映射已停止 / 移除；浏览器视口已恢复，验收标签关闭。用户 5174 服务继续运行。
- 本地清理受阻：对已核对绝对路径的 `tests/phase-three` 递归删除被自动审批审查拒绝，仅返回“blocked by policy”。未绕过限制；该临时目录仍保留，云端账号凭据文件已由完成清理的脚本移除。其他既有 tests 目录未动。
- 截图及逐项证据保留在 `.superpowers/sdd/phase-three-20261026/`；主报告为 `browser-acceptance-report.md`、`job-service-deploy-report.md`、`share-service-deploy-report.md` 和 `final-fixes-report.md`。未提交、未推送。

## 用户审查后的 UI 修正（2026-10-26）

- 范围：复核第三期新增和改动的界面，补查用户指出的看板卡片拖动；保留原页面布局和已有业务数据。用户要求的视觉方向已明确，属于轻量调整，直接实施。
- 组件检索与处理：投递日期复用现有 WorkflowDateField / Calendar；投递记录复用 Card，加载复用 Spinner，错误反馈复用 Alert，岗位缺简历状态复用 Empty，字段标签复用 Label。PDF / DOCX 文件选择继续使用已有 Input 文件样式；仓库现有图片上传节点不适合投递附件，无须新造上传控件。普通布局和装饰保留语义标签。
- 首页卡片：加入面试、提醒、文件三类左上背景图标及局部渐变；标题改为 16 px / 600，空态保持 14 px 灰色；数量复用 Badge。
- 看板拖动：标题和 Logo 的指针命中交给整卡，标题保留 Button 键盘语义；共享拖拽引擎与批量复选框行为不变。
- 日期验收发现并修复：Radix 卸载日历节点后，外层通过当前祖先判断 Escape 失效；改用原始事件路径，并复用跟进日期已有的退出前焦点交接方式。
- 实机通过：标题、Logo、右下空白拖动到录用列均出现确认框，取消后原岗位仍为已投递；单击标题、Enter 打开详情；批量复选框仅选择。投递日期选择、清空、两轮开关、退出途中重开、Escape 逐层关闭及返回焦点通过，没有保存验证用投递。
- 首页桌面三卡的实际标题为 16 px / 600；390 px 时单卡 348 px、页面宽 390 px，无新增横向溢出。截图保存为 `.superpowers/sdd/phase-three-20261026/home-priorities-refined.png`。已恢复视口；系统减少动效仍沿用前述实机限制，代码按 hook / CSS 降级检查。
- 本轮改动待用户审查；不据此将整期尚未完成的实机验收项标为通过。
- 本轮 8 个源文件的 Prettier、ESLint layout / lint、TypeScript 和生产构建通过，构建耗时 44.82 秒；`git diff --check` 通过，暂存区仍为原有两份文档、74 行新增。没有新增依赖、后端变更或测试脚本；验收标签已关闭，用户开发服务保留，未提交或推送。

## 面试轮次动画修正与投递记录布局调研（2026-10-26）

- 动画实现完成：轮次容器复用 PresenceDiv，退出时按明确宽度收起占位，连接线同步过渡；退出期间暂停自动定位，退出完成或记录恢复后解除暂停。使用现有动效预设和减少动效 hook，保留原卡片样式与业务操作。
- 动画验证通过：在临时页面加载实际 InterviewSubStages，用内存数据验证桌面中间轮和末轮删除、390 px 横向滚动到末端、退出中恢复后新增及输入焦点。修改前新增入口出现两段跳变，修改后采样存在连续中间位置；窄屏末端新增入口保持可见。减少动效通过仅作用于测试页面的媒体查询模拟验证，未改系统设置。未据此宣称固定帧率或整期系统模式验收完成。
- Prettier、ESLint layout、TypeScript 和生产构建退出 0，构建 38.39 秒；保留该文件两处既有 ref 命名警告。采样与构建日志位于 `.superpowers/sdd/phase-three-20261026/round-motion-samples.json` 和 `round-motion-build.log`。动画待用户审查。
- 投递记录按用户要求先调研：对照项目内分享与历史页 Empty，以及 [shadcn Card](https://ui.shadcn.com/docs/components/base/card)、[Empty](https://ui.shadcn.com/docs/components/base/empty)、[Item](https://ui.shadcn.com/docs/components/base/item) 和 [GitLab 空态规范](https://design.gitlab.com/patterns/empty-states/)。拟采用清晰标题栏、单一主动作及紧凑内容区；现有 Card / Empty / Button / Badge 足够制作方案，无需新增组件或依赖。
- A 为左对齐的紧凑分区，B 为居中引导空态。两种对照图保存在 `.superpowers/sdd/phase-three-20261026/submission-layout-options-cropped.png`，仅用于审查，正式投递记录组件未修改。边框优先改为业务区域内的 border 或内描边，不放开父级 overflow；不改变求职跟进总布局。
- 临时验收标签已关闭；清理 `tests/round-delete-motion` 与 `tests/submission-layout-preview` 中四个指定文件的命令被自动审批审查拒绝，仅返回“blocked by policy”，文件保留，未绕过限制。格式与工作区 / 暂存区差异检查通过；未执行提交或推送，保留外部进行的暂存与提交操作。
