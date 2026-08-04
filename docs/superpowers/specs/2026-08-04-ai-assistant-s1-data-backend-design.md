# AI 助手 · S1 数据层与后端契约 — 设计规格

- 日期：2026-08-04
- 子项目：S1（五子项目序列的第 1 个：S1 数据层 → S2 页面骨架 → S3 Agent 引擎 → S4 工具集+确认 → S5 入口集成；另有 S6 图片理解从本子项目拆出）
- 范围：`supabase/migrations/**`、`supabase/functions/llm-proxy/**`、以及消息/会话的 TypeScript 类型与数据访问层
- 目标：为「网页版 ChatGPT 形态 + 内置 Agent」产品搭好数据地基与后端契约——会话/消息持久化、图片存储、以及把 `llm-proxy` 升级为可承载 agent 工具调用的瘦代理。

## 背景

用户要做一个独立全屏的 ChatGPT 形态 AI 助手产品（不是编辑器侧栏助手）：
- 入口在全局侧边栏，点进去是独立路由页面
- 左会话列表 / 中消息流 / 底 Composer
- 内置 agent：多步循环、调工具（读写简历/看板/模板等全局能力）、识别上传图片
- 会话与消息持久化（刷新/换设备仍在）
- 权限模型 C：读操作自动执行，写操作弹卡片确认后再落库
- Agent loop 跑在**前端**，`llm-proxy` 退为瘦代理
- UI 统一使用 GAIA UI（`ui.heygaia.io`，shadcn registry 分发）
- 工具调用采用 **Function Calling**（非 MCP）：agent loop 在前端浏览器，工具即直接调用同进程内的 zustand store / supabase-js，无进程边界需跨；写操作前端弹卡片确认（权限 C）也属前端 UI 逻辑。MCP 是"跨应用工具生态"协议，当前单应用内场景属过度工程。→ S4 工具集用**注册表模式**（tool = {schema + 执行函数}），未来若需接外部工具或对外开放能力，新增 MCP 适配器把工具翻译进 registry 即可，agent loop 与现有工具不改（YAGNI，现在不做）。

本子项目（S1）只做地基，不含任何 UI 或 agent 逻辑。

## 已查证的外部事实（api-docs.deepseek.com 官方）

- **Function calling**：`deepseek-v4-pro` 支持，OpenAI 兼容格式——请求 `tools`/`tool_choice`（`none`/`auto`/`required`/具名），响应 `choices[].message.tool_calls[]`（`id`/`type:function`/`function.name`/`function.arguments`），后续 `role:tool` + `tool_call_id` 回填。`finish_reason` 含 `tool_calls`。
- **Streaming + tools**：SSE 流式契约完整，支持流式工具调用。
- **Thinking + tools 并存**：官方明示自 DeepSeek-V3.2 起支持思考模式下的工具调用（V4 延续）。→ 不存在"reasoner 不能调工具"的障碍。
- **并行工具调用**：官方 news 提到支持 parallel function calls。
- **⚠️ Vision（多模态 content）**：官方 `/chat/completions` API Reference 中，message `content` 仍定义为字符串（"Text content (string)"），**未在该端点文档化 `image_url` 数组分块**。V4 的"识图"来自 App/新闻，开放 API 的确切收图格式未在此端点确认。→ **vision 从 S1 移除，拆为 S6，动手前用真实 key curl 实测。**

## 实测验证结果（2026-08-04，真实 key 打通 llm-proxy）

用真实登录 token 对升级后的 `llm-proxy` 发流式 tools 请求，SSE 实测确认（S3 前置门槛通过）：

- ✅ `tools` 透传成功，返回 `tool_calls[0].function.name = "get_weather"`，arguments 分片流式拼接为 `{"location":"杭州"}`
- ✅ `finish_reason: "tool_calls"` 明确终止信号（agent loop 据此判断执行工具）
- ✅ thinking 与 tools 并存：SSE 先流 `reasoning_content` 段（模型推理"我需要用 get_weather"），再流 `tool_calls` 段；`usage.completion_tokens_details.reasoning_tokens = 20`
- ⚠️ **新发现（影响 S3）**：`deepseek-v4-pro` **默认开启 thinking**（请求未传 `thinking` 参数仍返回 reasoning_content）。→ agent 每步工具调用前都会先推理一段，更慢更贵。**S3 必须能控制 thinking 开关/强度**（`thinking:{type:'disabled'}` 或 `reasoning_effort`），例如规划步开、纯执行步关。S1 已支持透传 `thinking`/`reasoning_effort`，此约束在 S3 展开。

S3 前端 agent loop 需解析的流式契约（已实测确认）：`delta.reasoning_content` 增量 → `delta.tool_calls[].function.arguments` 分片拼接 → `finish_reason:"tool_calls"`。

## 交付物

### 1. 数据表

延用你们既有的 owner-only + snake_case + 迁移注释风格（参见 `company` / `resume_config`）。表名统一加 `ai_` 前缀避免与业务表混淆。

#### `ai_conversations`
| 字段 | 类型 | 约束/说明 |
|---|---|---|
| `id` | uuid | PK，default `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL，RLS 归属（对齐 `auth.uid()`）|
| `title` | text | NOT NULL default `'新对话'`；首条消息后可由前端更新 |
| `created_at` | timestamptz | NOT NULL default `now()` |
| `updated_at` | timestamptz | NOT NULL default `now()`；新消息写入时前端一并更新，用于列表排序 |

#### `ai_messages`
| 字段 | 类型 | 约束/说明 |
|---|---|---|
| `id` | uuid | PK，default `gen_random_uuid()` |
| `conversation_id` | uuid | NOT NULL，FK → `ai_conversations(id)` **ON DELETE CASCADE** |
| `user_id` | uuid | NOT NULL，RLS 归属（冗余存储，简化 messages 的 RLS 判定，避免每次 join 会话表）|
| `role` | text | NOT NULL，取值 `user` / `assistant` / `system` |
| `parts` | jsonb | NOT NULL default `'[]'::jsonb`；对齐 AI SDK v6 `UIMessage.parts` 结构 |
| `created_at` | timestamptz | NOT NULL default `now()`；消息流排序 |

**`parts` 结构约定**（TypeScript 侧类型，见交付物 3）：数组，每元素是一个"块"：
- `{ type: 'text', text: string }`
- `{ type: 'image', path: string }` — 存 Storage 对象路径（不存签名 URL，URL 有时效）
- `{ type: 'tool-call', toolCallId: string, toolName: string, args: unknown, result?: unknown, state: 'call' | 'result' | 'error' }`
- `{ type: 'reasoning', text: string }` — 思考模式 CoT 展示（可选留存）

> `parts` 是前端与 DB 之间的存储契约，不是 DeepSeek 的线上格式；发给模型时由 S3 的 agent 层转换为 DeepSeek 的 `messages`（`content` 字符串 + `tool_calls` / `role:tool`）。

### 2. RLS 与 Storage

**RLS（两表一致，共 8 条策略）**
- 两表 `ENABLE ROW LEVEL SECURITY`
- 每表 4 条：`select` / `insert` / `update` / `delete`，条件均为 `auth.uid() = user_id`
- `insert` 用 `with check (auth.uid() = user_id)`；其余用 `using (auth.uid() = user_id)`
- `ai_messages` 按自身 `user_id` 判定（不 join 会话表）

**Storage bucket：`chat-uploads`**
- 新建**私有** bucket（`public = false`）
- 对象路径约定：`{user_id}/{conversation_id}/{uuid}.{ext}`
- Storage RLS（`storage.objects` 上加策略，限定 `bucket_id = 'chat-uploads'`）：
  - `select` / `insert` / `update` / `delete` 均要求对象路径首段等于当前用户：`(storage.foldername(name))[1] = auth.uid()::text`
- 前端渲染或发给模型时，用 `createSignedUrl` 按需换签名 URL（私有 bucket，避免图片公开可达）
- 注：图片"喂给模型"的格式属 S6；S1 只保证图片能安全存取。

**索引**
- `ai_conversations`：`idx_ai_conversations_user_updated (user_id, updated_at desc)` — 会话列表主查询
- `ai_messages`：`idx_ai_messages_conversation_created (conversation_id, created_at)` — 拉取会话消息流

**迁移文件**（延续 `supabase/migrations/` 时间戳命名 + 中文注释）
- `<ts>_add_ai_conversations.sql`
- `<ts>_add_ai_messages.sql`
- `<ts>_add_chat_uploads_bucket.sql`（bucket 创建 + storage.objects 策略）

### 3. TypeScript 类型与数据访问层

**类型**（新文件，建议 `src/lib/ai/types.ts`）
- `AiMessagePart`（上述 4 种块的可辨识联合）
- `AiMessageRole = 'user' | 'assistant' | 'system'`
- `AiConversation`（映射 `ai_conversations` 行，camelCase）
- `AiMessage`（映射 `ai_messages` 行，`parts: AiMessagePart[]`）

**数据访问**（新文件，建议 `src/lib/supabase/ai/conversations.ts` 与 `.../messages.ts`，对齐 `src/lib/supabase/resume/company.ts` 的写法与错误处理）
- `listConversations(): Promise<AiConversation[]>`（按 `updated_at desc`）
- `createConversation(title?): Promise<AiConversation>`
- `updateConversation(id, patch: { title?: string }): Promise<AiConversation>`（同时刷新 `updated_at`）
- `deleteConversation(id): Promise<void>`（级联删消息）
- `listMessages(conversationId): Promise<AiMessage[]>`（按 `created_at`）
- `insertMessage(conversationId, msg: { role, parts }): Promise<AiMessage>`
- `uploadChatImage(conversationId, file): Promise<{ path: string }>` + `getSignedImageUrl(path): Promise<string>`
- 所有函数复用现有 `getCurrentUser()` 鉴权与 snake↔camel 映射范式；写操作显式带 `user_id = user.id`

> S1 只交付这些函数与类型（可被后续子项目 import），不接任何 UI；本子项目不写调用页面。

### 4. `llm-proxy` 升级为瘦代理

现状（`supabase/functions/llm-proxy/index.ts`）：仅透传 `messages / model / temperature / stream / response_format`，**丢弃 `tools`**。

**升级：白名单透传（显式列字段，不做 `...rest` 全量透传，避免注入意外参数）**
- 新增透传：`tools`、`tool_choice`
- 保留：`messages`、`model`（默认 `deepseek-v4-pro`）、`temperature`、`stream`、`response_format`
- `messages[].content` 若为**数组**（多模态形态）照原样透传给 DeepSeek，不做改写、不阻断（为 S6 预留；S1 不承诺 vision 可用）
- 透传 `thinking` / `reasoning_effort`（可选，若前端传入）——官方 V4 支持，S3 思考模式会用
- 流式：`stream:true` 时继续原样 `text/event-stream` 透传 `response.body`；tool-call 增量在 SSE 内，由前端 loop（S3）解析
- 密钥仍只在 Edge Function（`OPENAI_API_KEY` → DeepSeek），前端永不接触
- 完全向后兼容：现有 `runAtsStructured` / `runBulletRewrite` / JD 系列不传 `tools`，行为不变

## 数据流与错误处理

- 全部走 Supabase，鉴权 `getCurrentUser()`，RLS 兜底"只能读写自己的数据"
- 数据访问层错误处理对齐 `company.ts`：抛 `Error`，上层用 `toast` + 现有 `getTrackerErrorMessage` 同类工具（本子项目不引入 UI，仅保证函数抛出可读错误）
- `updated_at` 由写消息的调用方负责刷新（数据访问层在 `insertMessage` 后可选地 `updateConversation` 触发排序更新——具体时机留给 S2/S3，S1 提供能力）

## 单元隔离与边界

- 表/RLS/bucket = 纯后端契约；类型 = 纯数据形状；数据访问层 = 唯一的 DB 读写出入口；`llm-proxy` = 唯一的 LLM 出口
- 上层（S2/S3/S4）只依赖数据访问层函数签名与 `parts` 契约，不直接碰 supabase 表
- `parts` 作为存储契约与 DeepSeek 线上格式解耦：换模型/换线上格式不影响已存历史

## 验证（本仓库不写测试，用下述门槛替代）

1. `pnpm lint` + `pnpm build`（类型层）通过
2. 迁移可在 Supabase 顺序执行、无报错；两表 + bucket + 8 条表策略 + 4 条 storage 策略就位
3. **关键前置验证（决定 S3 能否成立）**：用真实 DeepSeek key 对升级后的 `llm-proxy` 发一次带 `tools` 的请求，确认：
   - 非流式：响应含 `tool_calls`，回填 `role:tool` 后能拿到自然语言结果
   - 流式：SSE 中能解析出 tool-call 增量，`finish_reason:tool_calls`
   - 若失败，立即停下反馈，不进入 S3
4. RLS 冒烟：A 用户无法 select/update B 用户的会话与消息；跨用户读 `chat-uploads` 对象被拒

## 非目标（YAGNI / 移交其他子项目）

- 任何对话 UI、会话列表、Composer → S2
- agent loop、流式解析、多步循环、thinking 展示 → S3
- 工具定义与混合确认 → S4
- 侧边栏入口与路由 → S5
- **图片理解（vision）**：把图片真正喂给模型的格式与链路 → **S6**（动手前先 curl 实测 DeepSeek 收图格式）
- 不改现有 ATS/JD/改写功能
