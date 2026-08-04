# AI 助手 · S1 数据层与后端契约 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 搭好「网页版 ChatGPT + Agent」产品的数据地基与后端契约——`ai_conversations`/`ai_messages` 两表（parts 结构化）+ RLS + `chat-uploads` 私有 bucket + TS 类型与数据访问层 + `llm-proxy` 透传 `tools`/`tool_choice`。

**架构：** 后端 Supabase（迁移 + RLS + Storage），前端新增 `src/lib/ai/`（纯类型）与 `src/lib/supabase/ai/`（数据访问层，复用 `getCurrentUser` + `../client` + snake↔camel 范式，对齐 `src/lib/supabase/resume/company.ts`）。`llm-proxy` Edge Function 由"丢弃 tools 的代理"升级为"白名单透传瘦代理"。本子项目不含任何 UI 或 agent loop。

**技术栈：** Supabase（PostgreSQL + RLS + Storage）· Deno Edge Function · TypeScript · DeepSeek V4（OpenAI 兼容）

**验证约定：** 本仓库不写测试。门槛 = `pnpm lint` + `pnpm build`（类型层）+ 迁移可顺序执行 + 真实 DeepSeek key curl 验证 tools 透传 + RLS 冒烟。按用户偏好，实现期间**不 commit**，最终验证后由用户决定提交。规格：`docs/superpowers/specs/2026-08-04-ai-assistant-s1-data-backend-design.md`。

---

## 文件结构

**新建（迁移）：**
- `supabase/migrations/20260804000001_add_ai_conversations.sql`
- `supabase/migrations/20260804000002_add_ai_messages.sql`
- `supabase/migrations/20260804000003_add_chat_uploads_bucket.sql`

**新建（前端类型与数据访问层）：**
- `src/lib/ai/types.ts` — `AiMessagePart` / `AiMessageRole` / `AiConversation` / `AiMessage`
- `src/lib/supabase/ai/conversations.ts` — 会话 CRUD
- `src/lib/supabase/ai/messages.ts` — 消息读写 + 图片上传/签名 URL
- `src/lib/supabase/ai/index.ts` — barrel

**修改：**
- `supabase/functions/llm-proxy/index.ts` — 白名单透传 `tools`/`tool_choice`/多模态 content/thinking

> 说明：`getCurrentUser` 来自 `@/lib/supabase/user`（定义于 `user/profile.ts`）；数据访问层从 `../user` 引入，`supabase` client 从 `../client` 引入（与 `resume/company.ts` 一致）。

---

## 任务 1：迁移 — `ai_conversations` 表 + RLS + 索引

**文件：**
- 创建：`supabase/migrations/20260804000001_add_ai_conversations.sql`

- [ ] **步骤 1：写迁移文件**（延续既有中文注释头风格）

```sql
-- 20260804000001_add_ai_conversations.sql
-- AI 助手：会话表。owner-only RLS，按 updated_at 排序用于会话列表。

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '新对话',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
  ON public.ai_conversations USING btree (user_id, updated_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations_select_own" ON public.ai_conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations_insert_own" ON public.ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations_update_own" ON public.ai_conversations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations_delete_own" ON public.ai_conversations
  FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **步骤 2：验证 SQL 语法**

运行（本地若装了 supabase CLI）：`supabase db reset --dry-run` 或将文件粘入 Supabase SQL Editor 执行。
预期：无语法错误；`ai_conversations` 表、索引、4 条策略创建成功。
（无 CLI 时，此验证在任务 3 后统一在 Supabase 控制台顺序执行。）

---

## 任务 2：迁移 — `ai_messages` 表 + RLS + 索引

**文件：**
- 创建：`supabase/migrations/20260804000002_add_ai_messages.sql`

- [ ] **步骤 1：写迁移文件**

```sql
-- 20260804000002_add_ai_messages.sql
-- AI 助手：消息表。parts(jsonb) 对齐 AI SDK v6 UIMessage.parts，可存 text/image/tool-call/reasoning。
-- user_id 冗余存储：简化 messages 的 RLS 判定，避免每次 join 会话表。删会话级联删消息。

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON public.ai_messages USING btree (conversation_id, created_at);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_messages_select_own" ON public.ai_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_messages_insert_own" ON public.ai_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_messages_update_own" ON public.ai_messages
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_messages_delete_own" ON public.ai_messages
  FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **步骤 2：验证 SQL 语法**

预期：表、索引、4 条策略创建成功；`role` CHECK 约束生效。

---

## 任务 3：迁移 — `chat-uploads` 私有 bucket + Storage RLS

**文件：**
- 创建：`supabase/migrations/20260804000003_add_chat_uploads_bucket.sql`

- [ ] **步骤 1：写迁移文件**

路径约定 `{user_id}/{conversation_id}/{uuid}.{ext}`，故用 `(storage.foldername(name))[1] = auth.uid()::text` 限定首段为用户 id。

```sql
-- 20260804000003_add_chat_uploads_bucket.sql
-- AI 助手：聊天图片私有 bucket。对象路径 {user_id}/{conversation_id}/{uuid}.{ext}，
-- 仅允许用户读写自己 user_id 前缀下的对象。私有 bucket，前端用签名 URL 访问。

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat_uploads_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "chat_uploads_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "chat_uploads_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "chat_uploads_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **步骤 2：在 Supabase 顺序执行三份迁移**

运行：在 Supabase SQL Editor 依次执行 001 → 002 → 003（或 `supabase db push`）。
预期：2 表 + 2 索引 + 8 条表策略 + 1 bucket + 4 条 storage 策略全部就位，无报错。

- [ ] **步骤 3：RLS 冒烟（手动）**

用两个测试账号 A/B：A 登录插入一条会话与消息；B 登录 `select * from ai_conversations` 看不到 A 的行；B 尝试读 A 的 `chat-uploads` 对象被拒。
预期：跨用户读写全部被 RLS 拦截。

---

## 任务 4：前端类型 — `src/lib/ai/types.ts`

**文件：**
- 创建：`src/lib/ai/types.ts`

- [ ] **步骤 1：写类型**

```ts
// AI 助手核心数据类型。parts 是「前端 <-> DB」存储契约，
// 与 DeepSeek 线上 messages 格式解耦（发给模型时由 S3 agent 层转换）。

export type AiMessageRole = 'user' | 'assistant' | 'system'

export type AiToolCallState = 'call' | 'result' | 'error'

export type AiMessagePart =
  | { type: 'text', text: string }
  | { type: 'image', path: string } // Storage 对象路径，非签名 URL（URL 有时效）
  | {
    type: 'tool-call'
    toolCallId: string
    toolName: string
    args: unknown
    result?: unknown
    state: AiToolCallState
  }
  | { type: 'reasoning', text: string }

export interface AiConversation {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface AiMessage {
  id: string
  conversationId: string
  userId: string
  role: AiMessageRole
  parts: AiMessagePart[]
  createdAt: string
}
```

- [ ] **步骤 2：验证**

运行：`pnpm lint src/lib/ai/types.ts`（或全量 `pnpm lint`）
预期：无 error。

---

## 任务 5：数据访问层 — 会话 CRUD

**文件：**
- 创建：`src/lib/supabase/ai/conversations.ts`

- [ ] **步骤 1：写会话 CRUD**（复用 `getCurrentUser` + `supabase`，snake→camel 映射，错误抛 `Error`，对齐 `resume/company.ts`）

```ts
import type { AiConversation } from '@/lib/ai/types'
import supabase from '../client'
import { getCurrentUser } from '../user'

// 行 → camelCase 映射
function mapConversation(row: any): AiConversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listConversations(): Promise<AiConversation[]> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error)
    throw error
  return (data || []).map(mapConversation)
}

export async function createConversation(title = '新对话'): Promise<AiConversation> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ user_id: user.id, title })
    .select()
    .single()

  if (error)
    throw error
  return mapConversation(data)
}

export async function updateConversation(
  id: string,
  patch: { title?: string },
): Promise<AiConversation> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_conversations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error)
    throw error
  return mapConversation(data)
}

// 触碰 updated_at，使该会话在列表回到顶部（写完消息后调用）
export async function touchConversation(id: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { error } = await supabase
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error)
    throw error
}

export async function deleteConversation(id: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error)
    throw error
}
```

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：无 error。

---

## 任务 6：数据访问层 — 消息读写 + 图片上传

**文件：**
- 创建：`src/lib/supabase/ai/messages.ts`

- [ ] **步骤 1：写消息读写 + 图片能力**

```ts
import type { AiMessage, AiMessagePart, AiMessageRole } from '@/lib/ai/types'
import supabase from '../client'
import { getCurrentUser } from '../user'

const CHAT_BUCKET = 'chat-uploads'

function mapMessage(row: any): AiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    role: row.role,
    parts: (row.parts || []) as AiMessagePart[],
    createdAt: row.created_at,
  }
}

export async function listMessages(conversationId: string): Promise<AiMessage[]> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error)
    throw error
  return (data || []).map(mapMessage)
}

export async function insertMessage(
  conversationId: string,
  msg: { role: AiMessageRole, parts: AiMessagePart[] },
): Promise<AiMessage> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: msg.role,
      parts: msg.parts,
    })
    .select()
    .single()

  if (error)
    throw error
  return mapMessage(data)
}

// 上传聊天图片到私有 bucket，返回对象路径（供存入消息 parts 的 image.path）
export async function uploadChatImage(
  conversationId: string,
  file: File,
): Promise<{ path: string }> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png'
  const path = `${user.id}/${conversationId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(path, file, { contentType: file.type || 'image/png', upsert: false })

  if (error)
    throw error
  return { path }
}

// 私有对象换签名 URL（渲染或发给模型时用）；默认 1 小时
export async function getSignedImageUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(path, expiresInSeconds)

  if (error)
    throw error
  return data.signedUrl
}
```

- [ ] **步骤 2：验证**

运行：`pnpm lint`
预期：无 error。

---

## 任务 7：数据访问层 barrel

**文件：**
- 创建：`src/lib/supabase/ai/index.ts`

- [ ] **步骤 1：写 barrel**（对齐 `supabase/resume/index.ts` 的 `export *` 风格）

```ts
export * from './conversations'
export * from './messages'
```

- [ ] **步骤 2：验证**

运行：`pnpm lint` + `pnpm build`
预期：无 error；类型层构建通过（数据访问层可被 `@/lib/supabase/ai` 导入）。

---

## 任务 8：`llm-proxy` 升级为白名单透传瘦代理

**文件：**
- 修改：`supabase/functions/llm-proxy/index.ts`

- [ ] **步骤 1：扩展请求接口与透传字段**

将 `LLMProxyRequest` 接口与解构升级为包含 `tools` / `tool_choice` / `thinking` / `reasoning_effort`，并把 `messages` 类型放宽（content 可为字符串或多模态数组）。替换文件顶部接口与请求体组装：

```ts
/* global Deno */

import { corsHeaders } from '../shared/cors.ts'

interface LLMProxyRequest {
  messages: unknown[]
  model?: string
  response_format?: unknown
  temperature?: number
  stream?: boolean
  // Agent 支持：function calling（DeepSeek V4 官方支持，OpenAI 兼容）
  tools?: unknown
  tool_choice?: unknown
  // 思考模式（DeepSeek V4 支持 thinking 下的工具调用）
  thinking?: unknown
  reasoning_effort?: string
}

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      messages,
      model = 'deepseek-v4-pro',
      response_format,
      temperature = 0,
      stream = true,
      tools,
      tool_choice,
      thinking,
      reasoning_effort,
    } = (await req.json()) as LLMProxyRequest

    const apiKey = Deno.env.get('OPENAI_API_KEY')

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API Key not configured OPENAI_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 白名单透传：显式列字段，避免 ...rest 全量透传注入意外参数
    const requestBody: Record<string, unknown> = {
      model,
      messages, // content 可为字符串或多模态数组，原样透传（多模态为 S6 预留）
      temperature,
      stream,
    }
    if (response_format)
      requestBody.response_format = response_format
    if (tools)
      requestBody.tools = tools
    if (tool_choice)
      requestBody.tool_choice = tool_choice
    if (thinking)
      requestBody.thinking = thinking
    if (reasoning_effort)
      requestBody.reasoning_effort = reasoning_effort

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.text()
      return new Response(
        JSON.stringify({ error: `DeepSeek API error: ${error}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (stream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      })
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
```

> 向后兼容：现有 `runAtsStructured`/`runBulletRewrite`/JD 系列不传 `tools`/`tool_choice`/`thinking`，`if` 守卫使其不进入 body，行为完全不变。

- [ ] **步骤 2：部署 Edge Function**

运行：`supabase functions deploy llm-proxy`
预期：部署成功。

- [ ] **步骤 3：关键前置验证 — 真实 key curl 验证 tools 透传（决定 S3 能否成立）**

用真实登录态 token 对已部署的 `llm-proxy` 发一次带 `tools` 的**非流式**请求（`stream:false`），tools 用一个简单示例（如 `get_weather`）：

```bash
curl -X POST "$VITE_SUPABASE_URL/functions/v1/llm-proxy" \
  -H "Authorization: Bearer <登录用户的 access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stream": false,
    "messages": [{"role":"user","content":"杭州天气怎么样？"}],
    "tools": [{"type":"function","function":{"name":"get_weather","description":"获取城市天气","parameters":{"type":"object","properties":{"location":{"type":"string"}},"required":["location"]}}}]
  }'
```

预期：响应 `choices[0].message.tool_calls[0].function.name === "get_weather"`，`finish_reason === "tool_calls"`。
- [ ] 再发一次 **流式**（`stream:true`）同样请求，确认 SSE 增量里能解析出 tool-call、`finish_reason:tool_calls`。
- [ ] 若任一失败：**立即停下反馈，不进入 S3**（说明 DeepSeek 侧 tools/stream 行为与预期不符，需重新评估 agent 方案）。

---

## 任务 9：最终验证

- [ ] **步骤 1：类型与构建**

运行：`pnpm lint && pnpm build`
预期：lint 无新增 error（既有基线 warning 不计）；build 成功。

- [ ] **步骤 2：迁移已执行**（任务 3 步骤 2 已做）确认 Supabase 侧 2 表 + bucket + 全部策略在位。

- [ ] **步骤 3：RLS 冒烟已过**（任务 3 步骤 3）。

- [ ] **步骤 4：tools 透传验证已过**（任务 8 步骤 3）——**S1 的核心成果，S3 的前置门槛**。

- [ ] **步骤 5：向后兼容确认**：打开现有 AI 功能（ATS 分析 / 划词改写 / JD 派生任一），确认仍正常流式返回，未受 `llm-proxy` 改动影响。

---

## 自检记录

- **规格覆盖度：** 表(任务1-2)、RLS(任务1-3)、bucket+storage RLS(任务3)、索引(任务1-2)、TS 类型(任务4)、数据访问层会话(任务5)/消息+图片(任务6)/barrel(任务7)、llm-proxy 透传(任务8)、验证含 tools curl 与 RLS 冒烟(任务3/8/9)——规格全部章节均有对应任务。
- **占位符扫描：** 无 TODO/待定；每个代码步骤含完整代码；SQL/TS/Deno 均为可执行内容。
- **类型一致性：** `AiMessagePart`/`AiConversation`/`AiMessage` 在 types.ts 定义，数据访问层一致引用；`mapConversation`/`mapMessage` 字段与表列一一对应；`touchConversation` 提供规格中"写消息后刷新 updated_at"的能力（供 S2/S3 调用）。
- **兼容性：** llm-proxy 用 `if` 守卫透传新字段，旧调用行为不变（任务9 步骤5 显式回归）；vision 未写入（content 数组原样透传但不承诺可用），符合"甲方案"切 S6。
- **验证充分性：** tools 透传的流式+非流式双验证被列为 S3 前置硬门槛，失败即停。
