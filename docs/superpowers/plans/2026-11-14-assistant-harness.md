# AI 助手与经历资料实现计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 执行有独立边界的任务，并进行规格及质量审查；共享契约与集成由主代理负责。步骤以复选框记录。用户已经要求 UI 梳理完成后直接实施，不在任务间重复索要确认。

**目标：** 完成助手会话菜单、结构化引用、排队/立即发送、确认反馈、画布引用、上下文 harness 和私人经历资料库的完整链路。

**架构：** 保留现有 AI SDK ToolLoopAgent 和业务服务，在其外围建立明确运行控制、消息引用、独立上下文读取与摘要。经历材料经本机文字提取后存入账户私有资料库，按明确会话/简历范围检索；页面与助手共用资料数据与原文详情。

**技术栈：** React 19、TypeScript、Zustand、现有 shadcn radix-vega 封装、Dice UI File Upload、Motion、Supabase Postgres/Storage/Edge、现有 PDF.js/fflate 与 AI SDK 6。

**规格：** `docs/superpowers/specs/2026-11-14-assistant-harness-design.md`，尤其第 6.7 节的组件、布局、状态和动效。

**授权与约束：** 留在当前 main 分支，不建立 worktree，不自动 commit/push；用户仓库规定不采用 TDD。开发后以真实实现、隔离数据和真实入口验证，临时脚本/数据仅放 tests/，验收后删除。不得修改真实用户简历或上传截图作为样本。涉及的迁移/Edge 必须完成 linked 云端部署及线上 smoke，前端发布状态另记。

**状态：** 八项能力的主体已经接入，先前记录的验证与后端部署仍有效；逐条复查发现尚未完成的规格条目，继续执行下方「规格复查补齐」，不能将主体接入等同于整份规格完成。经历页原双栏已被 `2026-11-14-experience-library-redesign.md` 替代；最终产品审查待进行。

## 文件边界

| 边界       | 创建/修改位置                                                                                                                         | 职责                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 消息协议   | `src/lib/ai/types.ts`、`src/lib/ai/references.ts`、`src/lib/ai/commands.ts`、`src/pages/assistant/composer-references.ts`             | 带类型的标签、命令版本、兼容旧前缀、可见文本与模型材料分别生成     |
| 草稿与运行 | `src/pages/assistant/store.ts`、新增同页 store slices / harness 模块、`hooks/use-chat-stream.ts`、`hooks/use-write-confirm-bridge.ts` | 可继续输入、稳定提交身份、FIFO、暂停、立即发送、三态确认与真实收尾 |
| 模型上下文 | `src/lib/ai/agent/`、`src/lib/supabase/ai/context.ts`、`messages.ts`、新增 `src/lib/ai/knowledge/`                                    | 独立历史读取、预算与摘要、资料/规则信任边界、工具许可及知识读取    |
| 资料领域   | `src/lib/experience-sources/{types,const,extract,api}.ts`、`src/store/experience-sources/`、`src/lib/resume-import/extract.ts`        | 上传、原件/提取段落、版本、查找、关联和共享缓存                    |
| 资料服务   | `supabase/functions/experience-sources/`、`supabase/functions/shared/experience-source-contract.ts`、新 SQL 迁移                      | 入口校验、认证、私有存储、RLS、来源版本、范围、检索与清理          |
| 资料界面   | `src/pages/experience/`、`src/features/experience-sources/`、`src/components/ui/file-upload.tsx`及 registry 所需 hooks                | 独立页面、上传/选择/详情公共组件，真实状态及响应式布局             |
| 助手界面   | `src/pages/assistant/components/`、`src/components/dashboard/`、`src/App.tsx`、`src/hooks/use-breadcrumbs.ts`                         | 标题菜单、标签、队列、确认反馈、资料入口、导航与路由门禁           |
| 画布引用   | `src/pages/assistant/components/assistant-canvas/resume-preview/`及新增 hook/adapter                                                  | 可见页选区、字段入口、锚点、引用与回定位，独立于共享评论写入       |
| 验收       | 临时 `tests/assistant-harness/`；保留 `docs/superpowers/specs/2026-11-14-assistant-harness-acceptance.md`                             | 实现回放、浏览器交互、云端 smoke、实测记录与清理                   |

## 1. 消息与引用契约

- [x] 在 `src/lib/ai/types.ts` 增加判别联合，沿用已有 skill-reference：

```ts
type AiReferencePart =
  | { type: 'reference'; kind: 'resume' | 'job'; id: string; label: string }
  | {
      type: 'reference'
      kind: 'command'
      id: string
      label: string
      version: string
    }
  | {
      type: 'reference'
      kind: 'experience'
      id: string
      label: string
      versionId: string
    }
  | {
      type: 'reference'
      kind: 'annotation'
      id: string
      label: string
      resumeId: string
      anchors: CommentAnchor[]
    }

type AiUserReference = AiReferencePart | AiSkillReference
```

- [x] 新 `references.ts` 负责去重、标签摘要、模型材料和入口校验。annotation 可包含空字段锚点说明，但不伪造原文；旧无 ID 岗位引用保留兼容显示，不能赋予读取关联。
- [x] 将已有快捷指令模板放入 `commands.ts` 的稳定目录，记录 ID、displayName、version、prompt；Composer 菜单引用该目录，选择只添加标签。
- [x] 更新 createUserParts、编辑/复制/标题和历史搜索语义。正文只保留用户输入；只有指令或 skill 时允许执行，仅材料时询问任务。历史读取边界将已知旧引用前缀转成显示结构，不改用户任意相似正文。
- [x] 消息提交允许传入稳定 UUID，结果未知时查询同 ID，不能重复插入。数据库可见文本函数读取 reference.label，重建依赖表达式索引。

## 2. 经历资料后端、提取与持久化

- [x] 定义独立的资料、版本和段落契约。段落保留稳定 blockId、文字起止范围、正文和真实页码（如有）；主列表只取名称、格式、状态、更新时间、当前版本及短摘录。

```ts
interface ExperienceSourceReference {
  sourceId: string
  versionId: string
  name: string
}

interface ExperienceSourceBlock {
  id: string
  text: string
  start: number
  end: number
  page?: number
}
```

- [x] 扩展 PDF/DOCX 提取保留页/段位置，旧 `extractResumeFile` 的 text/sourceName 合约不变；新增 TXT/Markdown/粘贴适配，使用真实文件/字数限制，不调用模型。
- [x] 新增私有 bucket、资料/版本/段落、会话使用和简历关联数据。owner 由当前身份确定；检索与下载均检查归属；支持更新形成新版本、重命名、取消关联、删除所有版本和对象。
- [x] 专用 Edge action 覆盖 list/create/read/rename/replace/delete/search/link。复用现有 auth/CORS/地区封装，入口解析外部参数一次；资料元信息、原文、原件分别读取。
- [x] 建立稳定 operationId 入库身份及同账户内容复用；已保存结果复用，失败与未完成明确。删除先禁止新读取再清理文件，清理失败可重试；不将未知结果当成功。
- [x] 导出供前端使用的 API：列表分页、创建/替换（含可选原文件）、读取版本、下载原件、更新名称、删除、检索、读写会话来源及简历关联。实现者在交接中列出精确签名，UI 使用同一接口。
- [x] 用合成 PDF/DOCX/TXT/Markdown 回读提取，核对原文范围、中文、重复段落与真实页码；用隔离数据库/账户验证跨账户拒绝、重复入库、版本引用和删除恢复。脚本放 `tests/assistant-harness/sources/`。

## 3. 草稿、队列与确认运行控制

- [x] 将跨组件草稿正文、引用、反馈和待发项提升到页面 store。待发消息冻结 text、references、thinking、账户/会话与提交 ID：

```ts
interface AssistantSubmission {
  id: string
  conversationId: string | null
  ownerId: string
  text: string
  references: AiUserReference[]
  thinking: boolean
  createdAt: string
}

type ConfirmDecision =
  | { kind: 'accept' }
  | { kind: 'reject' }
  | { kind: 'revise'; feedback: string; proposalId: string }
```

- [x] 运行状态区分准备、生成、待确认、写入收尾、落库和终态。运行 Promise 完成后才启动下一项，不依据 streaming=false 释放执行锁。
- [x] `sendMessage` 接受结构化引用和 queue/interrupt 模式；运行中提交加入 FIFO。成功才消耗草稿；编辑、删除、立即发送维护同一条待发身份，深度思考设置按提交快照固定。
- [x] 中断先取消模型与未开始工具，等待已开始写入完成并保存真实结果，再启动新轮。失败/主动停止/额度不足/保存不明时暂停队列；成功后继续下一条。刷新恢复按账户、会话、窗口隔离并保持暂停。
- [x] ConfirmBridge 缺处理器时不 apply；采用、拒绝、修改分开。修改提交后旧方案零写入、旧轮未执行工具取消、反馈绑定 proposalId，并在收尾后启动修订轮；新方案重新确认。
- [x] 对确认期间可能被手动改过的简历字段，在真正 apply 前核对原字段基线，冲突时生成新差异，不扩大为通用并发框架。
- [x] 验证实际调度器：A 运行时 B/C 入队、只消费一次；立即发送 D 等 A 写入收尾；停止/保存失败暂停；连续 revise 两轮旧 apply 次数为 0；A→B→A 不串草稿。脚本放 `tests/assistant-harness/run/`。

## 4. 独立上下文、压缩和知识工具

- [x] 模型历史通过独立分页读取，不依赖页面 messages；按稳定游标加载检查点之后的完整记录。新增 checkpoints 表/RLS 和更新/截断失效机制。
- [x] 依据当前模型、代理请求限制设置明确可配置预算，采用中文/富文本保守估算并记录估算与实际 usage。只压缩较早完整轮次，工具调用和结果不能拆开；正在确认的参数不压缩。
- [x] 摘要走现有 llm-proxy 与取消/额度链路，保留目标、限制、事实与出处、未核实项、已应用/未应用方案和待办。原消息不删除，检查点只覆盖成功落库的边界；压缩失败不静默丢弃历史，不自动收费重试。
- [x] 重构 buildUserContext / toModelMessages：可信身份、业务工具规则与 schema 留在系统层；名称、资料、JD、工具返回和摘要作为来源明确的低信任材料。模型内容不能发出授权或装载上传的 skill。
- [x] 在现有工具注册机制中加入维护知识目录/按 ID 读取及经历资料检索/分段读取。经历检索仅在明确范围内，引用返回真实版本/段落；本机 preparation 缺失不冒充云端证据。
- [x] 绑定当前来源版本与摘要指纹，资料更新/删除/取消选用后失效；历史记录仍保持可读并注明来源不可用。
- [x] 验证 >30 条会话、刷新/上滚、两次压缩、长工具返回、截断/撤销、恶意名称/JD/上传文档、中文检索和无命中回退。合成输入与真实模型 smoke 分别记录，不把替身结果当真实模型质量。

## 5. 经历资料页面与公共组件

- [x] 从已核对的 Dice UI registry 加入 FileUpload 及所需 hooks，安装后检查实际依赖、图标与 import。复用已有 cn、Button、Spinner 和 motion tokens；不保留示例网络服务、随机进度或项目外全局 CSS。
- [x] 按 history-style 建立 `src/pages/experience/`，用 PageLayout、Item、Tabs、Command、Empty、Skeleton 组成资料列表和阅读区。原双栏已按最新资料库重构规格替换为通栏网格/列表与按需独立阅读；字号、行宽与状态层级按最终验收记录落地。
- [x] 在 `src/features/experience-sources/` 组合上传弹层、选择器、原文详情和出处定位，资料页与聊天复用。DialogDescription、键盘、触摸、焦点恢复、运行中减少动效均接入既有组件。
- [x] 应用级 Zustand store 共享元信息、成功缓存和在途读取；按账户/版本失效，写后更新目标，失败不缓存成空。页面 store 管理筛选、分页、视图、选中项、阅读导航和上传入口；表单输入保持局部。
- [x] 侧栏「我的简历」下方加入「经历资料」，同步路由门禁、面包屑与结构骨架；「用于 AI 助手」只附加引用并保留原草稿。
- [x] 实际入口验证上传与粘贴、读取原文、下载、更新、删除、关联简历、手机返回及失败重试；深浅色和短屏检查，采集两轮开关与快速反向中间帧。

## 6. 助手界面与画布引用

- [x] 将 ConversationNavigation 移至 ChatHeader 标题 Popover；复用既有新建、搜索、重命名、删除和历史列表，移除主侧栏会话段，保留工作台导航。
- [x] Composer 用独立 references 渲染 Attachment 标签；选择指令不改正文，发送历史气泡上方保留标签。新增经历资料选择、上传和本会话资料范围入口。
- [x] 输入不随 streaming 禁用；发送/停止分开，队列用 Item/Collapsible，提供编辑、删除、继续、立即发送。Enter/Shift+Enter/组合输入与 Cmd/Ctrl+Shift+Enter 按规格执行。
- [x] ConfirmCard 增加自由反馈，主输入默认回复待确认方案；显式选项才作为新任务排队。卡片/主输入共用反馈草稿，已失效方案不留可点击的 apply。
- [x] 画布选区在可见 DOM 内按字段切分，复用 CommentAnchor 的字素位置、原文、内容哈希与重定位；多字段聚合为一次引用。空字段及键盘提供等价入口，图片只引用字段，不上传图像理解。
- [x] 点击选区标签回到正确简历/字段；改写、重排、同名项和已删项按稳定身份处理，无法唯一重连时提示重新选择。浮层及定位不进入测量或 PDF/Word。
- [x] 同步消息编辑、复制、重跑、撤销和搜索：可见标签语义保持一致，模型展开提示词不泄露到正文。

## 7. 集成审查与本地验证

- [x] 对每个独立任务检查规格覆盖与代码质量；最终覆盖跨任务状态、数据隔离、费用和取消顺序。审查工作目录 diff 与新增源文件，不只看实现者总结。
- [x] 对所有改动源码按顺序执行局部格式与 layout 修复：

```sh
git ls-files -m -o --exclude-standard -z | xargs -0 pnpm exec prettier --write --ignore-unknown
# ESLint 仅对改动的 src/**/*.ts(x) 执行，运行前用 git 清单核对本期文件。
python3 - <<'PY'
from pathlib import Path
import subprocess
paths = subprocess.check_output(['git', 'ls-files', '-m', '-o', '--exclude-standard', '-z']).decode().split('\0')
source = [p for p in paths if p.startswith('src/') and Path(p).suffix in ('.ts', '.tsx')]
if source:
    subprocess.run(['pnpm', 'exec', 'eslint', *source, '--fix', '--fix-type', 'layout'], check=True)
PY
pnpm exec tsc --noEmit
pnpm build
```

- [x] 对新增 Edge 执行 Deno check；临时回放直接导入真实实现，避免复制业务逻辑。测试传输替身只用于控制取消/失败时序，数据库授权和实际原件读取另外实测。
- [x] 在实际页面通读全部新增文案，核查真实动作、键盘与焦点、加载/空/失败、会话滚动连续性、响应式和减少动效。动画至少两轮完整开关及退出中反向。
- [x] 核对源模块依赖图，PDF.js/fflate 与原文详情在实际入口加载，公开分享和助手初始包不新增重提取依赖；核对真实请求次数、字段和生产加载边界，未测量的公网性能不作固定提速承诺。

## 8. 云端部署、验收记录与清理

- [x] 开发与本地/隔离验证完成后，顺序部署当前 linked 项目的迁移和必要函数，核对 migration ledger、函数版本、Storage 私有设置及实际地区；不得并行刷新 CLI 数据库凭据。
- [x] 用隔离合成账户做线上 smoke：匿名拒绝、账户 A/B 隔离、文件保存/读取/下载、更新版本/删除、会话来源关系、检查点存取与标签搜索。基础资料操作前后 AI 额度不变；真实模型试验只使用合成数据并如实记录。
- [x] 记录实施完成、验证通过、用户审查待进行，注明本地前端与线上后端的实际生效范围；不得把前端本地构建称为线上发布。
- [x] 删除临时账户、数据、文件、服务和 `tests/assistant-harness/` 下的验收脚本/样本；保留非敏感验收文档和必要截图。用户原有数据、进程和工作区改动不清理。

## 覆盖核对与实施日志

- 需求 1 → 任务 6 会话菜单。
- 需求 2、7 → 任务 1 + 6 标签与快捷指令。
- 需求 3、5 → 任务 3 + 6 队列、立即发送与三态确认。
- 需求 4 → 任务 3 + 4 harness、知识、压缩与权限。
- 需求 6 → 任务 6 可见画布锚点。
- 需求 8 → 任务 2 + 5 + 6 经历资料、侧栏与聊天衔接。
- 用户 UI/布局/样式/动画约束 → 规格 6.7 + 任务 5–7。

执行中在此追加具体完成项和证据路径，不把计划中的预期结果写成已经通过。

原范围证据见同日 assistant-harness-acceptance.md；经历页整体重构及独立回放已完成，证据见 experience-library-redesign-acceptance.md。全部临时验收设施已清理。实施完成、已列验证通过，用户审查待进行；前端未发布，无 commit/push。

## 9. 规格复查补齐

用户要求逐条检查原规格并继续完成。以上完成标记表示原轮实施与已列验证，不覆盖本次发现的遗漏。对照与证据写入 `2026-11-14-assistant-harness-gap-audit.md`。

- [x] 统一历史工具重试的运行入口，保留账户、会话、取消、确认与保存边界；补齐提交目标快照、runId、状态及整理事件记录。验证运行中点击重试、写入收尾、切换账户和动态资料工具失败重试。
- [x] 撤销工具结果明确告知模型已撤销；按当前模型配置预算与预留，使用实际 usage 校准，清理可重读重复材料；整理期间展示真实状态。验证中文、长 JD、富文本、两次整理与失败回退。
- [x] 草稿持久化失败保留内存并提示刷新风险；确认模式随 proposal 重置，修订显示「已要求修改」。
- [x] 会话菜单加入内置搜索及手机弹层；新正文加可识别协议，旧前缀仅读取边界兼容；历史搜索覆盖完整选区摘录，并重建表达式索引。
- [x] 本机 preparation 原文按需读取及来源缺失说明；经历工具支持段落 ID，用户明确授权后可检索本人全库，展示只接受本轮实际读取且可定位的出处。
- [x] 历史来源标记已删除；来源详情使用实际名称；修复取消提取后重试及删除结果不明的核对流程。保持已确认的经历资料新布局。
- [x] 补齐中文同义问题、公司简称、同名不同任期、跨段成果和无命中回退的真实检索验收，记录输入量；补至少 10 秒流式期间输入响应、首字、请求次数/字段/载荷、上下文整理耗时及确认后真实保存链路。
- [x] 对补齐变更独立审查、局部格式和 layout 修复、类型与构建验证，部署新增迁移/必要 Edge 并完成云端 smoke；清理临时脚本与数据，分别记录实施、验证、用户审查状态。

本次补齐同时闭合批量停止、错目标/空模块撤销、确认前状态、摘要事实分类及 auth 级联摘要触发器权限问题。真实模型完整确认保存、A/B 隔离和三种宽度出处查看通过。详见总验收的“规格复查补齐与最终联调”。四条迁移与 experience-sources version 2 已部署，75 条完整账本双向差集为空；类型、构建、全项目格式与独立审查通过，临时脚本/数据/服务已清理。实施完成，验证通过，用户审查待进行；前端未发布，无 commit/push。
