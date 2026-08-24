# GResume 面试讲述稿重写实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建《项目解读》的飞书副本，将其改写为以业务能力为单位、端到端讲解、带高质量图示和面试追问防守的 GResume 项目面试讲述稿。

**架构：** 原文保持只读，副本按现有顶层章节逐段替换，避免全文 overwrite。每章先从当前代码、迁移和验证脚本建立证据清单，再生成自然语言讲述稿与画板，写入后通过最新 revision、章节回读和画板预览完成验证。

**技术栈：** `lark-cli`、飞书 Docs / Drive / Whiteboard、Mermaid、SVG、`@larksuite/whiteboard-cli`、Git、`rg`、TypeScript / React / Supabase 代码取证。

---

## 执行约束

- 原文 URL：`https://my.feishu.cn/wiki/R81gw53DGi3mktkKWZ1coRDAnUc`
- 所有飞书文档、Drive 和画板操作显式使用 `--as user`。
- 原文不得写入；所有修改只发生在副本。
- 不使用 `docs +update --command overwrite`。
- 每次 `block_replace`、`block_delete` 或插图后都重新 fetch；旧 block ID 和旧 revision 不得复用。
- 当前仓库已有用户改动和已暂存的飞书技能文件，执行期间不得清理、重置或提交它们。
- 本任务不修改业务代码，不新增测试代码；验证依据是代码事实、飞书响应、revision、章节回读和画板预览。
- 复杂 SVG 图使用独立画板子任务；简单 Mermaid 图可随章节 XML 直接插入。
- 工作产物放在被 Git 忽略的 `/Users/shemingcong/Downloads/resume/.superpowers/gresume-interview-rewrite/`。

## 文件与远端资源结构

**本地文件：**

- 读取：`docs/superpowers/specs/2026-08-24-gresume-interview-document-rewrite-design.md` — 已批准设计。
- 创建：`.superpowers/gresume-interview-rewrite/manifest.json` — 副本 URL、token、当前 revision 与章节状态。
- 创建：`.superpowers/gresume-interview-rewrite/source-outline.xml` — 原文最新目录与 block ID。
- 创建：`.superpowers/gresume-interview-rewrite/migration-map.md` — 原文细节到新章节的迁移映射。
- 创建：`.superpowers/gresume-interview-rewrite/evidence-ledger.md` — 已证实、合理推断和尚未证实的事实台账。
- 创建：`.superpowers/gresume-interview-rewrite/risk-register.md` — 面试风险、证据、边界与优化建议。
- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-01.xml` 至 `chapter-12.xml` — 各章飞书 XML 草稿。
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/` 下各任务明确列出的固定子目录 — 画板源码、转换结果与预览。
- 创建：`.superpowers/gresume-interview-rewrite/final-audit.md` — 全文覆盖、图示和风险验收结果。

**远端资源：**

- 保留：原 Wiki 文档，不修改。
- 创建：Drive“我的空间”中的《GResume 项目面试讲述稿（端到端版）》副本。
- 修改：副本文档十二个顶层章节及其画板。

### 任务 1：环境预检并创建安全副本

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/manifest.json`

- [ ] **步骤 1：创建忽略的工作目录**

运行：

```bash
mkdir -p .superpowers/gresume-interview-rewrite/chapters .superpowers/gresume-interview-rewrite/diagrams
```

预期：命令退出码为 `0`，且不会改变 Git 跟踪状态。

- [ ] **步骤 2：验证 CLI 与画板渲染器**

运行：

```bash
lark-cli --version
npx -y @larksuite/whiteboard-cli@^0.2.13 -v
```

预期：`lark-cli` 输出已安装版本；whiteboard CLI 输出 `0.2.13` 兼容版本，两个命令退出码均为 `0`。

- [ ] **步骤 3：读取原文基线**

运行：

```bash
lark-cli docs +fetch --doc 'https://my.feishu.cn/wiki/R81gw53DGi3mktkKWZ1coRDAnUc' --scope outline --max-depth 3 --detail with-ids --as user
```

预期：响应 `ok=true`、`identity=user`，包含 14 个顶层章节和最新 `revision_id`。

- [ ] **步骤 4：创建副本**

运行：

```bash
lark-cli drive +copy --url 'https://my.feishu.cn/wiki/R81gw53DGi3mktkKWZ1coRDAnUc' --name 'GResume 项目面试讲述稿（端到端版）' --folder-token my_space --as user
```

预期：响应 `ok=true`、`data.copied=true`、`file_type=docx`，并返回新的 `file_token` 与 `url`；返回 URL 不得等于原文 URL。

- [ ] **步骤 5：持久化副本身份**

使用 `apply_patch` 创建 `manifest.json`，写入复制响应中的 `copy_url`、`file_token`、`file_type`、`source_url` 和初始 `revision_id`。不得把 access token、App Secret 或其他凭据写入文件。

- [ ] **步骤 6：验证副本可读且原文未变化**

分别对原文和副本运行 `docs +fetch --scope outline --max-depth 2 --detail with-ids --as user`。

预期：两者初始章节一致；原文 revision 仍为步骤 3 的值；副本 URL 与 token 独立。

### 任务 2：建立细节迁移映射和证据台账

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/source-outline.xml`
- 创建：`.superpowers/gresume-interview-rewrite/migration-map.md`
- 创建：`.superpowers/gresume-interview-rewrite/evidence-ledger.md`
- 创建：`.superpowers/gresume-interview-rewrite/risk-register.md`

- [ ] **步骤 1：保存原文目录基线**

读取原文 `outline --max-depth 3 --detail with-ids` 的完整 `content`，使用 `apply_patch` 写入 `source-outline.xml`。文件必须覆盖原文 1–14 章全部 h2/h3 标题和 ID。

- [ ] **步骤 2：建立原文到新文档的迁移映射**

使用 `apply_patch` 创建 `migration-map.md`，明确以下映射：原 1→新 1；原 2 与原 4 的事实来源部分→新 2；原 3 与原 12 模板部分→新 3；原 4→新 4；原 7 与评论迁移→新 5；原 8→新 6；原 5→新 7；原 5.11 与原 12.5–12.12→新 8；原 6 与原 14.13 计费部分→新 9；原 11 与原 12.1–12.4→新 10；原 9、13 及原 14 的鉴权 / RLS / Edge / Storage→新 11；原 10 与原 14 的工程治理和规模化→新 12。

预期：原文每个 h3 至少有一个目标章节；任何“不迁移”项必须写明“事实过时”或“重复合并”的原因。

- [ ] **步骤 3：建立事实证据等级台账**

使用 `apply_patch` 创建 `evidence-ledger.md`，每条记录包含：结论、证据等级、当前代码 / 迁移路径、可安全使用的措辞、禁止使用的夸大措辞。

至少覆盖：CRDT 最终收敛、双通道协作、Postgres 派生快照、评论版本中心模型、分享发布快照、AI 工具确认写回、额度预留—结算—对账、RLS 与 Edge Function 信任边界、A4 分页稳定条件。

- [ ] **步骤 4：建立面试风险台账**

使用 `apply_patch` 创建 `risk-register.md`，至少包含：广播不保证严格可靠有序、跨设备离线合并边界、状态双源风险、评论锚点误匹配、分享撤销竞态、AI 重复执行、request_id 幂等边界、额度 partial 计费、分页跨浏览器差异、压测与恢复演练缺口。

- [ ] **步骤 5：验证覆盖度**

运行：

```bash
rg -n '^\| 原 ' .superpowers/gresume-interview-rewrite/migration-map.md
rg -n '已证实|合理推断|尚未证实' .superpowers/gresume-interview-rewrite/evidence-ledger.md
rg -n 'CRDT|评论|分享|AI|额度|分页|RLS' .superpowers/gresume-interview-rewrite/risk-register.md
```

预期：迁移映射覆盖 14 个原章节；三个证据等级均有定义；核心高风险能力均被风险台账命中。

### 任务 3：改写第 1 章“项目全景”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-01.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-01-architecture/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-01-architecture/preview.png`

**代码证据：** `src/App.tsx`、`src/pages/resume/index.tsx`、`src/pages/share/index.tsx`、`src/pages/assistant/index.tsx`、`src/pages/index/index.tsx`、`supabase/functions/`、`supabase/migrations/`。

- [ ] **步骤 1：读取原文第 1 章与当前项目入口**

对原文第 1 章执行 `docs +fetch --scope section --start-block-id ZlO3dq1QfojkgFxZ57DcTomqnSb --detail with-ids --as user`；同时用 `rg` 核对路由入口、核心页面、函数和主要迁移。

- [ ] **步骤 2：生成第 1 章 XML**

使用 `apply_patch` 创建 `chapter-01.xml`，内容必须包含：产品定位、真实业务痛点、四个约束、端到端业务地图、事实来源总览、能力阅读路线、难点与亮点、当前边界、面试追问与防守。正文不得以文件名为段落主语。

- [ ] **步骤 3：绘制整体分层架构图**

创建接近参考图风格的 SVG：业务体验层、浏览器状态与文档层、同步与持久化层、Supabase 能力层、外部服务层；用蓝 / 绿 / 紫 / 橙区分主链路、入口、数据和风险。SVG 必须包含完整 `viewBox`，文字使用 `<text>`，不得使用 pattern、clipPath 或 mask。

- [ ] **步骤 4：替换副本第 1 章**

先读取副本第 1 章的最新 section 和 revision，确定同父连续的起止 block ID；再执行：

```bash
lark-cli docs +update --doc "$GRESUME_COPY_URL" --command block_replace --start-block-id "$GRESUME_START_BLOCK" --end-block-id "$GRESUME_END_BLOCK" --content @./chapters/chapter-01.xml --revision-id "$GRESUME_REVISION" --as user
```

命令在 `.superpowers/gresume-interview-rewrite/` 作为 CWD 运行；变量值来自当次 fetch，禁止沿用旧值。

- [ ] **步骤 5：验证章节与画板**

重新 fetch 副本第 1 章，预期标题、十一段模板要素和架构图均存在。取得新 `board_token` 后执行 `whiteboard +export --output-type preview --output ./diagrams/chapter-01-architecture/preview --as user`，用 `view_image` 检查文字无溢出、层级清晰、无水印。

### 任务 4：改写第 2 章“简历数据生命周期”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-02.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-02-source-of-truth/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-02-field-lifecycle/diagram.svg`

**代码证据：** `src/lib/schema/resume/`、`src/store/resume/`、`src/store/resume/helpers/sync-service.ts`、`src/lib/automerge/document/`、`src/lib/supabase/resume/config.ts`、`supabase/migrations/20260220021550_create_resume_config.sql`、`supabase/migrations/20260220021731_automerge_documents.sql`、`supabase/migrations/20260321000100_create_resume_config_versions.sql`。

- [ ] **步骤 1：读取原文第 2 章以及第 4 章的事实来源段落**

用原文 outline 的最新 ID 分别 fetch 原第 2 章、原 4.3、4.5 和 4.6，避免依赖旧 revision。

- [ ] **步骤 2：核对数据身份与持久化边界**

检查 schema、entryId、variant、persisted mapping、`applyResumeChange`、Automerge persistence 和 Postgres snapshot 写入；将“文档是事实来源”拆成在线编辑、离线简历、富文本镜像和派生快照四种语境。

- [ ] **步骤 3：生成第 2 章 XML 与两张图**

XML 必须包含：结构化简历模型、唯一身份、状态边界、一次字段变更的生命周期、存储显式映射、版本派生、老数据兼容、多事实来源风险。图一为“事实来源与派生数据图”，图二为“字段从输入到持久化的端到端流程图”。

- [ ] **步骤 4：局部替换并验证**

读取副本当前第 2 章最新 section，按最新起止 ID 和 revision 执行 `block_replace`。重新 fetch 后检查：没有把 Zustand、Automerge、Yjs 和 Postgres 简化成单一事实来源；两张图与正文口径一致；面试防守明确说明离线与富文本边界。

### 任务 5：改写第 3 章“编辑与确定性输出”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-03.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-03-editor-architecture/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-03-pagination-state/diagram.mmd`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-03-content-to-pdf/diagram.svg`

**代码证据：** `src/components/resume/pagination/`、`src/components/resume/runtime/`、`src/lib/resume-template/`、`src/pages/resume/editor/`、`src/store/resume/export.ts`、`src/pages/share/components/pdf-export/index.tsx`。

- [ ] **步骤 1：读取原文第 3 章与模板相关原文**

读取原第 3 章以及原 12.1–12.4，建立“编辑器—模板—分页—导出”闭环，不把模板中心孤立讲解。

- [ ] **步骤 2：核对分页稳定条件**

检查字体等待、布局签名、逐帧测量、分页状态、打印闸门、A4 物理尺寸和模板 manifest；区分“设计上阻止未稳定导出”与“跨浏览器绝对一致”这两种不同结论。

- [ ] **步骤 3：生成第 3 章 XML 与图示**

正文必须逐步描述输入变更如何触发预览重排、测量、稳定判断和打印。SVG 绘制编辑器四部分架构；Mermaid 绘制分页状态机；另用阶段流程图展示内容产物从表单到 PDF 的流转。

- [ ] **步骤 4：局部替换并验证**

按最新 section ID 和 revision 替换副本第 3 章。导出画板预览，检查 A4、测量、ready / measuring / error 状态和打印闸门均可直观看懂；防守部分必须指出字体、浏览器和复杂内容仍需基准验证。

### 任务 6：改写第 4 章“实时协作与离线恢复”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-04.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-04-options/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-04-dual-crdt/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-04-collaboration-sequence/diagram.mmd`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-04-offline-recovery/diagram.svg`

**代码证据：** `src/lib/automerge/`、`src/lib/collaboration/`、`src/hooks/collab/`、`src/hooks/use-form-remote-sync.ts`、`src/lib/offline-resume-manager.ts`、`src/lib/resume-sync-service.ts`、`supabase/migrations/20260818051900_add_comment_collaboration_member_lease.sql`。

- [ ] **步骤 1：读取原文第 4 章并建立方案对比**

提取 OT、中心化 WebSocket、纯数据库覆盖写和 CRDT 的前提差异；不得把“后端没有常驻权威进程”写成 CRDT 的唯一理由，还要加入离线、多端和最终收敛需求。

- [ ] **步骤 2：核对双通道与会话生命周期**

检查 Automerge 结构字段、Yjs 富文本、Supabase Network Adapter、待发队列、session / lease、presence、IndexedDB、本地回灌和回声抑制；记录哪些通道持久化、哪些只广播 UI 状态。

- [ ] **步骤 3：生成第 4 章 XML 与四类图**

必须包含：方案对比图、双 CRDT 分层架构图、一次字段修改的时序图、断网恢复流程图。时序图参与者限定为用户 / 表单与 Store / Automerge 或 Yjs / Realtime / 协作者 / Postgres，使用参考图的生命线与激活条风格。

- [ ] **步骤 4：局部替换并验证**

替换副本第 4 章后重新 fetch，检查正常链路、离线链路、消息丢失补偿、回灌和富文本白名单均有说明。防守必须明确：CRDT 解决并发合并，不自动保证传输可靠、权限安全和业务语义正确。

### 任务 7：改写第 5 章“划词评论系统”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-05.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-05-anchor-model/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-05-create-sequence/diagram.mmd`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-05-relocation-ladder/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-05-auth-path/diagram.svg`

**代码证据：** `src/features/resume-comments/anchors/`、`src/features/resume-comments/api/`、`src/features/resume-comments/store/`、`supabase/functions/resume-comments/`、`supabase/functions/shared/resume-comment-*.ts`、`supabase/migrations/20260813000002_add_resume_comments.sql` 至 `20260822075237_optimize_resume_comment_mutations.sql`、`supabase/tests/database/003_comment_concurrency_contracts.sql`。

- [ ] **步骤 1：读取原文第 7 章与评论迁移历史**

按时间梳理：初始评论空间、version-centric 转向、跨 block 支持、锚点重定位、并发事务、锁序修复、性能优化和协作 lease。

- [ ] **步骤 2：核对锚点与写入事务**

检查 grapheme 索引、DOM projection、quote / prefix / suffix、signature、重定位阶梯、失效状态、匿名身份、Edge 鉴权、幂等请求、锁顺序和失效广播。

- [ ] **步骤 3：生成第 5 章 XML 与四张图**

图示包括：锚点数据模型、评论创建端到端时序、正文变化后的重定位阶梯、匿名与登录用户权限路径。正文必须解释 6.7 秒告警对应的链路问题与具体优化，不得只写“做了缓存”。

- [ ] **步骤 4：局部替换并验证**

替换副本第 5 章后回读；检查跨 block、跨版本、失效、高亮覆盖层、匿名鉴权、并发与性能均被覆盖。防守必须说明锚点迁移是启发式匹配，无法保证所有文本变化下语义绝对正确。

### 任务 8：改写第 6 章“一键分享与版本历史”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-06.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-06-snapshot-model/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-06-share-sequence/diagram.mmd`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-06-link-lifecycle/diagram.mmd`

**代码证据：** `src/lib/supabase/resume/share.ts`、`src/lib/supabase/resume/share-version.ts`、`src/pages/share/`、`src/pages/history/`、`supabase/functions/resume-share/`、`supabase/migrations/20260811000002_add_resume_shares.sql` 至 `20260815000001_fix_resume_share_public_snapshot.sql`、`supabase/migrations/20260817000002_fix_version_time_and_delete_with_shares.sql`。

- [ ] **步骤 1：读取原文第 8 章并核对快照语义**

确认分享记录、release 快照、版本来源、口令 / 有效期 / 启停、评论开放、历史版本删除与分享引用关系。

- [ ] **步骤 2：生成第 6 章 XML 与图示**

正文以“用户点下一键分享”为主线，讲清冻结内容、生成 release、配置访问、外部读取、评论关联和撤销。图示包括：工作文档 / 版本 / 发布快照关系图、创建分享时序图、分享链接生命周期状态图。

- [ ] **步骤 3：局部替换并验证**

替换副本第 6 章后回读并导出画板。防守必须区分“已发布内容不随工作文档继续编辑而变化”与“所有关联元数据永远不可变”，并指出撤销、过期和缓存失效的竞态边界。

### 任务 9：改写第 7 章“AI 智能体改简历”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-07.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-07-agent-loop/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-07-stream-sequence/diagram.mmd`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-07-confirm-state/diagram.mmd`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-07-failure-recovery/diagram.svg`

**代码证据：** `src/lib/ai/agent/`、`src/lib/ai/tools/resume.ts`、`src/lib/ai/active-resume.ts`、`src/lib/llm/`、`src/pages/assistant/`、`src/store/resume/apply-field.ts`、`supabase/functions/llm-proxy/`。

- [ ] **步骤 1：读取原文第 5 章并核对 agent loop**

确认上下文构建、工具注册、参数解析、多轮预算、流式消息、确认桥、工具重试、统一写入口和服务端代理边界。

- [ ] **步骤 2：生成第 7 章 XML 与四类图**

必须包含：为什么不是一次问答、模型参数为什么不可信、一次自然语言修改的端到端时序、工具调用循环、确认后写回、失败与重试。图示包括 agent loop、流式调用时序、确认写回状态图和异常恢复流程图。

- [ ] **步骤 3：局部替换并验证**

替换副本第 7 章后回读。防守必须说明用户确认不等于模型输出安全，最终仍依赖 schema、字段寻址、统一写入口和服务端信任边界；不得声称模型可以任意直接修改数据库。

### 任务 10：改写第 8 章“ATS 与岗位定制”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-08.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-08-assessment-pipeline/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-08-evidence-to-fix/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-08-lineage-tree/diagram.svg`

**代码证据：** `src/lib/ats/`、`src/lib/schema/ats.ts`、`src/lib/supabase/resume/ats.ts`、`src/pages/optimize/`、`src/store/jd-variant/`、`src/components/jd-variant/`、`src/lib/llm/prompts/optimize.ts`、`src/lib/llm/prompts/jd-variant.ts`、`supabase/migrations/20260220021702_create_ats.sql`、`supabase/migrations/20260528000001_add_resume_variant_columns.sql`。

- [ ] **步骤 1：读取原 5.11 和原 12.5–12.12**

合并 ATS 诊断与岗位派生，避免分别成为两套 AI 叙事；核对评分维度、证据位置、严重度、修复类型、原子应用和 lineage。

- [ ] **步骤 2：生成第 8 章 XML 与图示**

正文以“导入岗位描述并得到一份可投递变体”为完整流程。图示包括五维诊断管道、证据定位到原子修复的数据流、岗位版本派生树。

- [ ] **步骤 3：局部替换并验证**

替换副本第 8 章并回读。防守必须指出 ATS 分数是产品化诊断模型，不等于真实招聘系统通过率；岗位匹配结果依赖模型、提示词和输入质量。

### 任务 11：改写第 9 章“AI 额度与服务端信任边界”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-09.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-09-credit-state/diagram.mmd`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-09-credit-sequence/diagram.mmd`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-09-trust-boundary/diagram.svg`

**代码证据：** `supabase/functions/llm-proxy/`、`src/lib/supabase/quota.ts`、`src/store/ai-quota.ts`、`supabase/migrations/20260807000001_add_ai_credits.sql`、`20260816073703_add_ai_credit_reservations.sql`、`20260816074307_add_backend_operation_metrics.sql`、`20260816170453_add_backend_maintenance_jobs.sql`、`supabase/tests/database/002_ai_quota.sql`。

- [ ] **步骤 1：读取原文第 6 章和原 14.13 计费部分**

把旧的预检—扣减机制与当前预留—交付—结算—释放—对账机制明确区分，旧机制只作为演进背景，不得写成现状。

- [ ] **步骤 2：核对当前状态机与幂等边界**

检查 reserve、mark delivery、settle、release、reconcile、UTC 日用量、request_id、partial 交付和 cron / pg_net 补偿链。

- [ ] **步骤 3：生成第 9 章 XML 与图示**

Mermaid 绘制额度请求状态机；参考时序图样式绘制客户端 / Edge Function / Postgres RPC / 模型服务 / 对账任务的完整时序；SVG 展示客户端不可信与服务端权威判定边界。

- [ ] **步骤 4：局部替换并验证**

替换副本第 9 章后回读。防守必须明确 request_id 全局主键、重试复用、partial 全额计费、cron 自监控和观测写放大等当前风险。

### 任务 12：改写第 10 章“求职工作台”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-10.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-10-domain-model/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-10-board-rollback/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-10-dashboard-loading/diagram.svg`

**代码证据：** `src/lib/supabase/resume/company.ts`、`src/pages/company/`、`src/pages/index/`、`src/pages/template/`、`src/lib/resume-template/`、`supabase/migrations/20260220021810_company.sql`、`20260728000001_add_company_archived.sql` 至 `20260728000003_add_company_activities_contacts.sql`、`20260408130000_create_resume_templates.sql`。

- [ ] **步骤 1：读取原文第 11 章与模板中心部分**

核对公司、阶段、下一步、活动、联系人、首页聚合、分享运营视图、模板绑定和简历版本之间的关系。

- [ ] **步骤 2：生成第 10 章 XML 与图示**

正文以“一次投递从选择简历版本到后续跟进”为主线。图示包括求职业务对象关系图、看板拖拽与乐观回滚流程、首页多数据源并发聚合图。

- [ ] **步骤 3：局部替换并验证**

替换副本第 10 章后回读。防守必须说明首页模块各自加载、看板乐观更新失败回滚、模板只改变表现而不应改变业务数据的边界。

### 任务 13：改写第 11 章“身份、权限与运行基建”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-11.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-11-auth-state/diagram.mmd`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-11-request-sequence/diagram.mmd`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-11-runtime-architecture/diagram.svg`

**代码证据：** `src/lib/supabase/user/`、`src/lib/auth/redirect.ts`、`src/store/user.ts`、`src/pages/profile/`、`src/App.tsx`、`supabase/functions/shared/`、`supabase/migrations/20260807000002_add_profiles.sql`、`20260816072550_harden_privileged_function_access.sql`、`20260816072828_harden_base_table_rls.sql`、`20260804000003_add_chat_uploads_bucket.sql`。

- [ ] **步骤 1：读取原文第 9、13 章及原 14 的相关部分**

只保留与端到端业务能力有关的 Auth、JWT、RLS、SECURITY DEFINER、Edge shared、Storage、路由、请求上下文和观测，不写成 Supabase 百科。

- [ ] **步骤 2：核对身份事件流与四道闸门**

检查会话持久化、自动刷新、账号切换、受保护页面、profiles、用户 / 匿名 / bot 身份、JWT、本地验签、RLS、列级 GRANT 和 Edge 权限。

- [ ] **步骤 3：生成第 11 章 XML 与图示**

图示包括登录态事件流状态图、请求穿过浏览器 / Edge / JWT / RLS 的时序图、运行基建分层架构图。正文必须解释身份变化如何驱动各业务 store 清理和重新加载。

- [ ] **步骤 4：局部替换并验证**

替换副本第 11 章后回读。防守必须说明 CORS 不是安全边界、匿名入口依赖签名或短期令牌、RLS 不能代替服务端业务校验。

### 任务 14：改写第 12 章“工程交付与系统演进”

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/chapters/chapter-12.xml`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-12-delivery-flow/diagram.svg`
- 创建：`.superpowers/gresume-interview-rewrite/diagrams/chapter-12-scaling-roadmap/diagram.svg`

**代码证据：** `package.json`、`vite.config.ts`、`src/pages/`、`src/lib/motion.ts`、`supabase/config.toml`、`supabase/migrations/`、`supabase/tests/database/`、`supabase/functions/backend-ops-monitor/`、`supabase/functions/shared/operation-metrics.ts`、`.github/workflows/`（若存在）。

- [ ] **步骤 1：读取原文第 10 和 14 章**

将目录、状态管理、质量、迁移、观测和规模化演进组织为“如何维护一个持续演进的业务系统”，不重复前面章节已解释的底层原理。

- [ ] **步骤 2：核对真实工程门禁**

确认现有脚本、数据库验证、CI 是否存在、迁移可重放、监控任务、pg_stat_statements、告警 webhook、清理任务、PITR 和恢复演练证据。不存在的能力必须明确写为缺口。

- [ ] **步骤 3：生成第 12 章 XML 与图示**

图示包括从需求到迁移 / Edge / 前端 / 验证 / 发布的工程交付链路，以及按触发指标分档的规模化演进路线。章节结尾汇总系统级风险，但不重复每章的风险表。

- [ ] **步骤 4：局部替换并验证**

替换副本第 12 章后回读。确认没有把“有脚本”表述成“CI 已强制执行”，没有把“支持 PITR”表述成“已经完成恢复演练”。

### 任务 15：删除副本中已被重组吸收的旧第 13、14 章

**文件：**

- 修改：`.superpowers/gresume-interview-rewrite/manifest.json`

- [ ] **步骤 1：重新读取副本完整目录**

运行 `docs +fetch --scope outline --max-depth 2 --detail with-ids --as user`，确认前十二章已经是新标题，旧“账户体系”与“后端深潜”仍位于末尾。

- [ ] **步骤 2：验证迁移映射无遗漏**

逐项检查 `migration-map.md` 中原 13、14 章条目已经标记为迁移至新 9、11 或 12 章；存在未迁移条目时停止删除并补写目标章节。

- [ ] **步骤 3：删除旧第 13、14 章**

分别 fetch 两个旧章节的最新 section，取得各自同父连续起止 block ID；按从后向前的顺序执行以下完整命令，每次删除后重新 fetch 并为下一次删除更新四个任务变量：

```bash
lark-cli docs +update --doc "$GRESUME_COPY_URL" --command block_delete --start-block-id "$GRESUME_OLD_START_BLOCK" --end-block-id "$GRESUME_OLD_END_BLOCK" --revision-id "$GRESUME_REVISION" --as user
```

- [ ] **步骤 4：验证最终只有十二章**

再次读取 outline，预期恰好 12 个 h2，编号、标题和设计规格一致，不存在重复“账户体系”或“后端深潜”章节。

### 任务 16：全文事实、细节、图示和面试风险终验

**文件：**

- 创建：`.superpowers/gresume-interview-rewrite/final-audit.md`
- 修改：`.superpowers/gresume-interview-rewrite/manifest.json`

- [ ] **步骤 1：读取副本全文和三级目录**

从 `manifest.json` 读取 `copy_url` 到任务变量 `GRESUME_COPY_URL`，分别运行：

```bash
lark-cli docs +fetch --doc "$GRESUME_COPY_URL" --doc-format markdown --detail simple --as user
lark-cli docs +fetch --doc "$GRESUME_COPY_URL" --scope outline --max-depth 3 --detail with-ids --as user
```

预期：全文读取 `ok=true`；十二章目录完整；每章均包含“难点与亮点”“当前不足”“面试追问与防守”。

- [ ] **步骤 2：执行细节覆盖检查**

逐项对照 `migration-map.md`，把状态更新为“已迁移 / 已修正 / 重复合并”，不得保留无原因的未覆盖项。抽查 CRDT、评论、分享、AI、额度、分页、权限七条核心链路，确认正常和异常流程都存在。

- [ ] **步骤 3：执行事实措辞检查**

全文搜索并人工审查以下绝对化措辞：

```bash
rg -n '绝对|完全保证|零丢失|严格一次|百分之百|性能显著|不会失败|永远一致' .superpowers/gresume-interview-rewrite/chapters
```

预期：每个命中都由证据直接支持，或已改成体现证据等级的谨慎措辞。

- [ ] **步骤 4：导出并审查全部画板**

从全文 fetch 的 `reference_map` 或 whiteboard token 列表逐一执行：

```bash
lark-cli whiteboard +export --whiteboard-token "$GRESUME_BOARD_TOKEN" --output-type preview --output "$GRESUME_PREVIEW_PATH" --as user
```

用 `view_image` 检查全部预览：无空白图、无水印、无文字溢出、箭头不穿过文字、颜色语义一致、时序图参与者和消息顺序与正文一致。

- [ ] **步骤 5：生成终验报告**

使用 `apply_patch` 创建 `final-audit.md`，记录：副本 URL、最终 revision、十二章检查结果、画板数量与预览结果、事实修正清单、薄弱点清单、高风险面试表述及安全回答。

- [ ] **步骤 6：最终只读复核原文**

重新读取原文 outline 和 revision，确认原文仍为初始 14 章且 revision 未因本任务变化。若原文 revision 由外部协作者变化，只记录差异，不对原文写入。

- [ ] **步骤 7：交付副本链接**

向用户返回副本飞书链接、最终 revision、章节数、画板数，以及最重要的事实修正和面试风险摘要。不得暴露用户 open_id、访问 token 或应用凭据。
