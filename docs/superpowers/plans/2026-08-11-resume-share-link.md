# 简历只读分享链接 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为云端简历生成可撤销的只读分享链接，别人拿到链接即可查看该简历快照（可选密码、可设有效期、可统计访问、可下载 PDF）。

**架构：** 独立 `resume_shares` 表存固化快照（复用 `PersistedResumeSnapshot`），owner-only RLS 管理；匿名读取与密码写入走 `resume-share` Edge Function（service_role 绕 RLS、脱敏、算哈希）；前端新增应用级 store + `ShareDialog`，挂到编辑器与简历卡片双入口；分享页 `/resume/view/:token` 复用 `ResumeTemplateRuntime` 渲染 + `react-to-print` 导出。

**技术栈：** React 19 · TypeScript · Zustand · Supabase（PostgreSQL/RLS/Edge Functions/Deno）· motion/react · react-to-print

**说明：** 本仓库默认不写测试（记忆确认）。每个任务的验证关卡用 `pnpm exec tsc --noEmit`、`pnpm lint`、必要时 `pnpm build`，以及人工核对 SQL / Function 逻辑。频繁 commit，中文 conventional commit，尾部带 `Co-authored-by: TRAE CLI <noreply@bytedance.com>`。

---

## 文件结构

**新增：**
- `supabase/migrations/20260811000002_add_resume_shares.sql` — `resume_shares` 表 + RLS + 索引 + updated_at 触发器
- `supabase/functions/resume-share/index.ts` — 匿名读取（GET）+ owner 密码写入（POST）
- `src/lib/supabase/resume/share.ts` — 数据访问层（owner 侧 CRUD + 快照读取 + 调用 Function）
- `src/lib/supabase/resume/share.types.ts` — 分享记录类型定义
- `src/store/resume-share/index.ts` — 应用级 Zustand store（barrel）
- `src/store/resume-share/store.ts` — store 实现
- `src/store/resume-share/types.ts` — store 状态与动作类型
- `src/components/resume-share/share-dialog.tsx` — 分享管理对话框（双入口共用）
- `src/components/resume-share/share-link-row.tsx` — 单条链接行（复制/统计/开关/改密码/删除/推送）
- `src/components/resume-share/create-share-form.tsx` — 新建链接表单（名称/密码/有效期）
- `src/pages/resume/view/[token].tsx` — 分享页（匿名只读）
- `src/pages/resume/view/components/share-pdf-export.tsx` — 分享页 PDF 导出按钮

**修改：**
- `src/App.tsx` — 为 `/resume/view/*` 开「裸壳」分支（不套 Dashboard/Assistant Shell）
- `src/pages/resume/editor/components/collaboration/collaboration-controls/index.tsx` — 加「分享」按钮
- `src/pages/resume/editor/components/collaboration/context.tsx`（或对应 hook）— 暴露打开 ShareDialog 的入口（若 context 存在）
- `src/pages/resume/components/resume-card/index.tsx` — 加「分享」入口，离线置灰
- `README.md` — 功能说明同步

---

## 任务 1：数据库迁移 `resume_shares`

**文件：**
- 创建：`supabase/migrations/20260811000002_add_resume_shares.sql`

参考现有迁移风格：`supabase/migrations/20260804000001_add_ai_conversations.sql`（owner-only RLS）、`supabase/migrations/table.sql`（触发器 `update_updated_at_column`、`resume_config.resume_id` 为 uuid unique）。

- [ ] **步骤 1：编写迁移 SQL**

创建 `supabase/migrations/20260811000002_add_resume_shares.sql`，内容如下：

```sql
-- 20260811000002_add_resume_shares.sql
-- 简历只读分享链接。快照固化存 snapshot（形态 = PersistedResumeSnapshot），
-- 与 resume_config 解耦。owner-only RLS 用于管理；匿名读取与密码写入走
-- resume-share Edge Function（service_role），匿名端永不直接 SELECT 本表。

CREATE TABLE IF NOT EXISTS public.resume_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  token text NOT NULL,
  label text,
  snapshot jsonb NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  password_hash text,
  expires_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_shares_token_key UNIQUE (token),
  CONSTRAINT resume_shares_resume_id_fkey
    FOREIGN KEY (resume_id) REFERENCES public.resume_config (resume_id) ON DELETE CASCADE,
  CONSTRAINT resume_shares_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT resume_shares_snapshot_is_object_check
    CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_resume_shares_user_resume
  ON public.resume_shares USING btree (user_id, resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_shares_resume_active
  ON public.resume_shares USING btree (resume_id) WHERE is_active = true;

ALTER TABLE public.resume_shares ENABLE ROW LEVEL SECURITY;

-- 仅 owner 可管理自己的分享记录（匿名端无任何直连策略，走 Edge Function）
DROP POLICY IF EXISTS "resume_shares_select_own" ON public.resume_shares;
CREATE POLICY "resume_shares_select_own" ON public.resume_shares
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "resume_shares_insert_own" ON public.resume_shares;
CREATE POLICY "resume_shares_insert_own" ON public.resume_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "resume_shares_update_own" ON public.resume_shares;
CREATE POLICY "resume_shares_update_own" ON public.resume_shares
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "resume_shares_delete_own" ON public.resume_shares;
CREATE POLICY "resume_shares_delete_own" ON public.resume_shares
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_resume_shares_updated_at BEFORE UPDATE
  ON public.resume_shares FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **步骤 2：静态核对 SQL**

核对：`resume_id` 引用 `resume_config(resume_id)`（uuid unique 存在于 table.sql:101）；`update_updated_at_column` 函数在既有库中已定义（table.sql:122 已使用）；策略命名与 ai_conversations 风格一致。无需本地起库（用户自行在 Supabase 执行迁移）。

- [ ] **步骤 3：Commit**

```bash
git add supabase/migrations/20260811000002_add_resume_shares.sql
git commit -m "feat(resume-share): 新增 resume_shares 表与 owner-only RLS

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 2：`resume-share` Edge Function

**文件：**
- 创建：`supabase/functions/resume-share/index.ts`
- 复用：`supabase/functions/shared/cors.ts`

参考 `supabase/functions/llm-proxy/index.ts`（Deno.serve、OPTIONS、service_role client、`admin.auth.getUser(jwt)` 鉴权）。密码哈希用 Deno 标准库 bcrypt。

- [ ] **步骤 1：编写 Edge Function**

创建 `supabase/functions/resume-share/index.ts`：

```ts
/* global Deno */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { compare, hash } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { corsHeaders } from '../shared/cors.ts'

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

interface GetResult {
  needPassword?: boolean
  snapshot?: unknown
  display_name?: string | null
  error?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

// 统一「不可用」文案：不区分 不存在 / 已关闭 / 已过期，降低探测。
function unavailable() {
  return json({ error: 'unavailable' }, 404)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'service credentials not configured' }, 500)
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // ============ 匿名读取：GET ?token / POST { token, password }（读取意图） ============
    // POST 且带 op 字段 → owner 写入；否则视为访问读取。
    const url = new URL(req.url)
    let token = url.searchParams.get('token') ?? ''
    let password: string | null = null
    let op: string | null = null

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>
      op = typeof body.op === 'string' ? body.op : null
      if (typeof body.token === 'string')
        token = body.token
      if (typeof body.password === 'string')
        password = body.password
    }

    // ============ owner 密码写入分支 ============
    if (op === 'set_password') {
      const authHeader = req.headers.get('Authorization') ?? ''
      const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (!jwt)
        return json({ error: 'unauthorized' }, 401)
      const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
      const userId = userData?.user?.id
      if (userErr || !userId)
        return json({ error: 'unauthorized' }, 401)

      const shareId = typeof token === 'string' ? token : ''
      // set_password 用 body.shareId 定位（token 复用为空），明文密码可为 null（清除）
      const bodyAgain = { shareId, password } // 见步骤 2 说明：实际从 body 解构
      const nextHash = bodyAgain.password ? await hash(bodyAgain.password) : null

      const { error } = await admin
        .from('resume_shares')
        .update({ password_hash: nextHash })
        .eq('id', bodyAgain.shareId)
        .eq('user_id', userId)
      if (error)
        return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    // ============ 匿名读取分支 ============
    if (!token)
      return unavailable()

    const { data, error } = await admin
      .from('resume_shares')
      .select('id, snapshot, display_name, is_active, password_hash, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (error || !data)
      return unavailable()
    if (!data.is_active)
      return unavailable()
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now())
      return unavailable()

    if (data.password_hash) {
      if (!password)
        return json({ needPassword: true } satisfies GetResult)
      const ok = await compare(password, data.password_hash)
      if (!ok)
        return json({ needPassword: true, error: 'wrong_password' } satisfies GetResult)
    }

    // 校验通过：自增访问计数与最后查看时间（尽力而为，失败不阻断返回）
    await admin
      .from('resume_shares')
      .update({ view_count: (data as any).view_count ?? undefined, last_viewed_at: new Date().toISOString() })
      .eq('id', data.id)
    await admin.rpc('increment_share_view', { p_share_id: data.id }).then(
      () => {},
      () => {},
    )

    return json({
      snapshot: data.snapshot,
      display_name: data.display_name,
    } satisfies GetResult)
  }
  catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unexpected' }, 500)
  }
})
```

> 注：步骤 1 的代码含两处需在步骤 2 修正的粗糙点（`bodyAgain` 变量、view_count 自增方式）。步骤 2 给出定稿实现，避免依赖脏 update。

- [ ] **步骤 2：修正密码写入解构与访问计数（定稿实现）**

将上面 `op === 'set_password'` 分支与访问计数改为下述定稿版本。密码写入直接从 body 解构 `shareId`，不复用 `token`；访问计数改为在读取到的 `view_count` 基础上 +1 的原子更新（避免额外 RPC 依赖）。

在 POST body 解析处补充 `shareId`：

```ts
    let shareId: string | null = null
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>
      op = typeof body.op === 'string' ? body.op : null
      if (typeof body.token === 'string')
        token = body.token
      if (typeof body.password === 'string')
        password = body.password
      if (typeof body.shareId === 'string')
        shareId = body.shareId
    }
```

密码写入分支定稿：

```ts
    if (op === 'set_password') {
      const authHeader = req.headers.get('Authorization') ?? ''
      const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (!jwt)
        return json({ error: 'unauthorized' }, 401)
      const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
      const userId = userData?.user?.id
      if (userErr || !userId)
        return json({ error: 'unauthorized' }, 401)
      if (!shareId)
        return json({ error: 'missing shareId' }, 400)

      const nextHash = password ? await hash(password) : null
      const { error } = await admin
        .from('resume_shares')
        .update({ password_hash: nextHash })
        .eq('id', shareId)
        .eq('user_id', userId)
      if (error)
        return json({ error: error.message }, 500)
      return json({ ok: true })
    }
```

访问计数定稿（select 增加 `view_count`，通过后 +1）：

```ts
    // select 字段补 view_count
    // .select('id, snapshot, display_name, is_active, password_hash, expires_at, view_count')

    // 校验通过后：
    await admin
      .from('resume_shares')
      .update({
        view_count: ((data as { view_count?: number }).view_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', data.id)
```

同时删除步骤 1 里的 `admin.rpc('increment_share_view', ...)` 与旧的 `bodyAgain` 版本。最终文件应无 `bodyAgain`、无 `increment_share_view` RPC 调用。

- [ ] **步骤 3：核对 Deno bcrypt 导入可用**

运行：`grep -n "deno.land/x/bcrypt" supabase/functions/resume-share/index.ts`
预期：命中导入行。bcrypt@v0.4.1 为 Deno 常用版本，`hash`/`compare` 为其导出 API。若部署环境对 top-level await/worker 有限制，回退方案：改用 `https://esm.sh/bcryptjs@2` 的 `hashSync`/`compareSync`（在计划执行时视 deploy 报错决定，先用 deno.land/x/bcrypt）。

- [ ] **步骤 4：Commit**

```bash
git add supabase/functions/resume-share/index.ts
git commit -m "feat(resume-share): 新增 resume-share Edge Function 匿名读取与密码写入

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 3：分享记录类型定义

**文件：**
- 创建：`src/lib/supabase/resume/share.types.ts`

- [ ] **步骤 1：编写类型**

创建 `src/lib/supabase/resume/share.types.ts`：

```ts
import type { PersistedResumeSnapshot } from '@/lib/schema'

/** resume_shares 表行（owner 侧可见字段，永不含 password_hash 明文回传给匿名端） */
export interface ResumeShareRecord {
  id: string
  resume_id: string
  user_id: string
  token: string
  label: string | null
  display_name: string | null
  is_active: boolean
  /** 是否设了密码（owner 侧只需知道有无，不需要 hash 本身） */
  has_password: boolean
  expires_at: string | null
  view_count: number
  last_viewed_at: string | null
  created_at: string
  updated_at: string
}

/** 新建分享链接的可选项 */
export interface CreateShareOptions {
  label?: string | null
  password?: string | null
  expiresAt?: string | null
}

/** 匿名访问分享页的读取结果 */
export interface ShareViewResult {
  needPassword?: boolean
  wrongPassword?: boolean
  snapshot?: PersistedResumeSnapshot
  displayName?: string | null
  unavailable?: boolean
}
```

- [ ] **步骤 2：验证类型**

运行：`pnpm exec tsc --noEmit`
预期：PASS（仅新增类型文件，`PersistedResumeSnapshot` 从 `@/lib/schema` 已导出，见 persisted.ts:90）。

- [ ] **步骤 3：Commit**

```bash
git add src/lib/supabase/resume/share.types.ts
git commit -m "feat(resume-share): 新增分享记录与访问结果类型

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 4：数据访问层 `share.ts`

**文件：**
- 创建：`src/lib/supabase/resume/share.ts`
- 参考：`src/lib/supabase/resume/company.ts`（CRUD 风格）、`src/lib/supabase/resume/form.ts:55`（`getResumeById` + `RESUME_PERSISTED_SELECTOR`）、`src/lib/llm/call.ts:41-66`（调用 Edge Function + JWT）、`src/store/resume/helpers`（`mapSourceToPersistedSnapshot`）

- [ ] **步骤 1：编写数据访问层**

创建 `src/lib/supabase/resume/share.ts`：

```ts
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { CreateShareOptions, ResumeShareRecord, ShareViewResult } from './share.types'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers'
import supabase from '../client'
import { getCurrentUser } from '../user'
import { getResumeById, RESUME_PERSISTED_SELECTOR } from './form'

const SHARE_SELECT = 'id,resume_id,user_id,token,label,display_name,is_active,expires_at,view_count,last_viewed_at,created_at,updated_at,password_hash'

function toRecord(row: Record<string, any>): ResumeShareRecord {
  const { password_hash, ...rest } = row
  return {
    ...(rest as Omit<ResumeShareRecord, 'has_password'>),
    has_password: Boolean(password_hash),
  }
}

function generateToken() {
  // 32 位十六进制随机串（两段 uuid 去横线拼接），足够长以抵抗枚举
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
}

/** 从云端简历配置构造完整快照（列表卡片场景：页面未加载文档） */
export async function getResumeSnapshotById(resumeId: string): Promise<{
  snapshot: PersistedResumeSnapshot
  displayName: string | null
}> {
  const source = await getResumeById<Record<string, unknown>>(resumeId, `${RESUME_PERSISTED_SELECTOR},display_name`)
  const snapshot = mapSourceToPersistedSnapshot(source ?? {})
  const displayName = (source as { display_name?: string | null } | null)?.display_name ?? null
  return { snapshot, displayName }
}

/** 列出某简历的所有分享链接（owner） */
export async function listResumeShares(resumeId: string): Promise<ResumeShareRecord[]> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_shares')
    .select(SHARE_SELECT)
    .eq('user_id', user.id)
    .eq('resume_id', resumeId)
    .order('created_at', { ascending: false })

  if (error)
    throw error
  return (data ?? []).map(toRecord)
}

/** 创建分享链接（owner）。带密码时先 insert 再调 Function 写 hash。 */
export async function createResumeShare(
  resumeId: string,
  snapshot: PersistedResumeSnapshot,
  displayName: string | null,
  options: CreateShareOptions = {},
): Promise<ResumeShareRecord> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登陆')

  const token = generateToken()
  const { data, error } = await supabase
    .from('resume_shares')
    .insert({
      resume_id: resumeId,
      user_id: user.id,
      token,
      label: options.label ?? null,
      display_name: displayName,
      snapshot,
      expires_at: options.expiresAt ?? null,
    })
    .select(SHARE_SELECT)
    .single()

  if (error)
    throw error

  const record = toRecord(data)

  if (options.password) {
    await setResumeSharePassword(record.id, options.password)
    return { ...record, has_password: true }
  }
  return record
}

/** 撤销 / 启用 */
export async function setResumeShareActive(shareId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('resume_shares')
    .update({ is_active: isActive })
    .eq('id', shareId)
  if (error)
    throw error
}

export async function updateResumeShareLabel(shareId: string, label: string | null): Promise<void> {
  const { error } = await supabase
    .from('resume_shares')
    .update({ label })
    .eq('id', shareId)
  if (error)
    throw error
}

export async function updateResumeShareExpiry(shareId: string, expiresAt: string | null): Promise<void> {
  const { error } = await supabase
    .from('resume_shares')
    .update({ expires_at: expiresAt })
    .eq('id', shareId)
  if (error)
    throw error
}

/** 推送最新快照覆盖 */
export async function pushResumeShareSnapshot(
  shareId: string,
  snapshot: PersistedResumeSnapshot,
  displayName: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('resume_shares')
    .update({ snapshot, display_name: displayName })
    .eq('id', shareId)
  if (error)
    throw error
}

export async function deleteResumeShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('resume_shares')
    .delete()
    .eq('id', shareId)
  if (error)
    throw error
}

/** 设 / 改 / 清密码（走 Edge Function，服务端算 hash） */
export async function setResumeSharePassword(shareId: string, password: string | null): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token)
    throw new Error('用户未登录')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ op: 'set_password', shareId, password }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`设置密码失败: ${text}`)
  }
}

/** 匿名读取分享内容（分享页调用；无需登录） */
export async function fetchSharedResume(token: string, password?: string): Promise<ShareViewResult> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...(password ? { password } : {}) }),
  })

  if (res.status === 404)
    return { unavailable: true }
  if (!res.ok)
    return { unavailable: true }

  const body = await res.json() as {
    needPassword?: boolean
    error?: string
    snapshot?: PersistedResumeSnapshot
    display_name?: string | null
  }

  if (body.needPassword)
    return { needPassword: true, wrongPassword: body.error === 'wrong_password' }

  return { snapshot: body.snapshot, displayName: body.display_name ?? null }
}
```

- [ ] **步骤 2：验证类型与依赖**

运行：`pnpm exec tsc --noEmit`
预期：PASS。核对 `mapSourceToPersistedSnapshot` 从 `@/store/resume/helpers` 导出（index.ts:3 已确认）、`RESUME_PERSISTED_SELECTOR` 从 form.ts:34 导出、`getResumeById` 泛型签名匹配（form.ts:55）。

- [ ] **步骤 3：Commit**

```bash
git add src/lib/supabase/resume/share.ts
git commit -m "feat(resume-share): 新增分享数据访问层与快照读取

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 5：应用级 Zustand store

**文件：**
- 创建：`src/store/resume-share/types.ts`、`src/store/resume-share/store.ts`、`src/store/resume-share/index.ts`
- 参考：`src/store/jd-variant`（应用级 store 风格）

- [ ] **步骤 1：编写 store 类型**

创建 `src/store/resume-share/types.ts`：

```ts
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { CreateShareOptions, ResumeShareRecord } from '@/lib/supabase/resume/share.types'

export interface ResumeShareState {
  /** 当前打开 ShareDialog 的简历（null = 关闭） */
  openForResumeId: string | null
  openForResumeName: string | null
  shares: ResumeShareRecord[]
  loading: boolean
  mutatingId: string | null
  error: string | null

  openDialog: (resumeId: string, resumeName: string | null) => void
  closeDialog: () => void
  loadShares: (resumeId: string) => Promise<void>
  create: (
    resumeId: string,
    snapshot: PersistedResumeSnapshot,
    displayName: string | null,
    options?: CreateShareOptions,
  ) => Promise<void>
  setActive: (shareId: string, isActive: boolean) => Promise<void>
  setLabel: (shareId: string, label: string | null) => Promise<void>
  setExpiry: (shareId: string, expiresAt: string | null) => Promise<void>
  setPassword: (shareId: string, password: string | null) => Promise<void>
  pushSnapshot: (shareId: string, snapshot: PersistedResumeSnapshot, displayName: string | null) => Promise<void>
  remove: (shareId: string) => Promise<void>
}
```

- [ ] **步骤 2：编写 store 实现**

创建 `src/store/resume-share/store.ts`：

```ts
import type { ResumeShareState } from './types'
import { create } from 'zustand'
import {
  createResumeShare,
  deleteResumeShare,
  listResumeShares,
  pushResumeShareSnapshot,
  setResumeShareActive,
  setResumeSharePassword,
  updateResumeShareExpiry,
  updateResumeShareLabel,
} from '@/lib/supabase/resume/share'

const useResumeShareStore = create<ResumeShareState>((set, get) => ({
  openForResumeId: null,
  openForResumeName: null,
  shares: [],
  loading: false,
  mutatingId: null,
  error: null,

  openDialog: (resumeId, resumeName) => {
    set({ openForResumeId: resumeId, openForResumeName: resumeName, shares: [], error: null })
    void get().loadShares(resumeId)
  },

  closeDialog: () => set({ openForResumeId: null, openForResumeName: null, shares: [], error: null }),

  loadShares: async (resumeId) => {
    set({ loading: true, error: null })
    try {
      const shares = await listResumeShares(resumeId)
      set({ shares, loading: false })
    }
    catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : '加载失败' })
    }
  },

  create: async (resumeId, snapshot, displayName, options) => {
    set({ error: null })
    try {
      const record = await createResumeShare(resumeId, snapshot, displayName, options)
      set(state => ({ shares: [record, ...state.shares] }))
    }
    catch (e) {
      set({ error: e instanceof Error ? e.message : '创建失败' })
      throw e
    }
  },

  setActive: async (shareId, isActive) => {
    set({ mutatingId: shareId })
    try {
      await setResumeShareActive(shareId, isActive)
      set(state => ({
        shares: state.shares.map(s => (s.id === shareId ? { ...s, is_active: isActive } : s)),
        mutatingId: null,
      }))
    }
    catch (e) {
      set({ mutatingId: null, error: e instanceof Error ? e.message : '操作失败' })
    }
  },

  setLabel: async (shareId, label) => {
    set({ mutatingId: shareId })
    try {
      await updateResumeShareLabel(shareId, label)
      set(state => ({
        shares: state.shares.map(s => (s.id === shareId ? { ...s, label } : s)),
        mutatingId: null,
      }))
    }
    catch (e) {
      set({ mutatingId: null, error: e instanceof Error ? e.message : '操作失败' })
    }
  },

  setExpiry: async (shareId, expiresAt) => {
    set({ mutatingId: shareId })
    try {
      await updateResumeShareExpiry(shareId, expiresAt)
      set(state => ({
        shares: state.shares.map(s => (s.id === shareId ? { ...s, expires_at: expiresAt } : s)),
        mutatingId: null,
      }))
    }
    catch (e) {
      set({ mutatingId: null, error: e instanceof Error ? e.message : '操作失败' })
    }
  },

  setPassword: async (shareId, password) => {
    set({ mutatingId: shareId })
    try {
      await setResumeSharePassword(shareId, password)
      set(state => ({
        shares: state.shares.map(s => (s.id === shareId ? { ...s, has_password: Boolean(password) } : s)),
        mutatingId: null,
      }))
    }
    catch (e) {
      set({ mutatingId: null, error: e instanceof Error ? e.message : '操作失败' })
    }
  },

  pushSnapshot: async (shareId, snapshot, displayName) => {
    set({ mutatingId: shareId })
    try {
      await pushResumeShareSnapshot(shareId, snapshot, displayName)
      set(state => ({
        shares: state.shares.map(s => (s.id === shareId ? { ...s, display_name: displayName } : s)),
        mutatingId: null,
      }))
    }
    catch (e) {
      set({ mutatingId: null, error: e instanceof Error ? e.message : '操作失败' })
    }
  },

  remove: async (shareId) => {
    set({ mutatingId: shareId })
    try {
      await deleteResumeShare(shareId)
      set(state => ({ shares: state.shares.filter(s => s.id !== shareId), mutatingId: null }))
    }
    catch (e) {
      set({ mutatingId: null, error: e instanceof Error ? e.message : '删除失败' })
    }
  },
}))

export default useResumeShareStore
```

- [ ] **步骤 3：编写 barrel 导出**

创建 `src/store/resume-share/index.ts`：

```ts
export { default } from './store'
export type { ResumeShareState } from './types'
```

- [ ] **步骤 4：验证**

运行：`pnpm exec tsc --noEmit && pnpm lint`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/store/resume-share
git commit -m "feat(resume-share): 新增分享管理应用级 store

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 6：ShareDialog 组件（含子组件）

**文件：**
- 创建：`src/components/resume-share/create-share-form.tsx`、`src/components/resume-share/share-link-row.tsx`、`src/components/resume-share/share-dialog.tsx`
- 参考：`src/components/ui/dialog.tsx`（shadcn Dialog）、`src/pages/resume/components/delete-resume-dialog`（对话框用法）、`sonner` toast（`src/components/ui/sonner.tsx`）

- [ ] **步骤 1：新建链接表单**

创建 `src/components/resume-share/create-share-form.tsx`：

```tsx
import type { CreateShareOptions } from '@/lib/supabase/resume/share.types'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CreateShareFormProps {
  onCreate: (options: CreateShareOptions) => Promise<void>
}

export function CreateShareForm({ onCreate }: CreateShareFormProps) {
  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async () => {
    setSubmitting(true)
    try {
      await onCreate({
        label: label.trim() || null,
        password: password.trim() || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      setLabel('')
      setPassword('')
      setExpiresAt('')
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="share-label" className="text-xs">链接名称（可选）</Label>
          <Input id="share-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="如：字节专用" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="share-password" className="text-xs">访问密码（可选）</Label>
          <Input id="share-password" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="留空则开即看" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="share-expiry" className="text-xs">有效期（可选）</Label>
          <Input id="share-expiry" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
        </div>
      </div>
      <Button onClick={handleCreate} disabled={submitting} className="self-start">
        {submitting ? <Loader2 className="size-4 animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
        生成分享链接
      </Button>
    </div>
  )
}
```

- [ ] **步骤 2：单条链接行**

创建 `src/components/resume-share/share-link-row.tsx`：

```tsx
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { Check, Copy, KeyRound, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { formatTime } from '@/utils/date'

interface ShareLinkRowProps {
  share: ResumeShareRecord
  busy: boolean
  onToggleActive: (isActive: boolean) => void
  onChangePassword: () => void
  onPushLatest: () => void
  onDelete: () => void
}

function buildShareUrl(token: string) {
  return `${window.location.origin}/resume/view/${token}`
}

export function ShareLinkRow({ share, busy, onToggleActive, onChangePassword, onPushLatest, onDelete }: ShareLinkRowProps) {
  const [copied, setCopied] = useState(false)
  const url = buildShareUrl(share.token)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('链接已复制')
    setTimeout(() => setCopied(false), 1500)
  }

  const expired = share.expires_at ? new Date(share.expires_at).getTime() < Date.now() : false

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-medium">{share.label || '未命名链接'}</span>
          {share.has_password && <Badge variant="outline"><KeyRound className="size-3" />密码</Badge>}
          {expired && <Badge variant="destructive">已过期</Badge>}
          {!share.is_active && <Badge variant="secondary">已关闭</Badge>}
        </div>
        <Switch checked={share.is_active} disabled={busy} onCheckedChange={onToggleActive} aria-label="启用或关闭链接" />
      </div>

      <div className="flex items-center gap-1.5">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{url}</code>
        <Button size="icon-sm" variant="ghost" onClick={handleCopy} aria-label="复制链接">
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          查看
          {' '}
          {share.view_count}
          {' '}
          次
        </span>
        {share.last_viewed_at && (
          <span>
            最后查看
            {' '}
            {formatTime(new Date(share.last_viewed_at).getTime())}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="xs" variant="outline" disabled={busy} onClick={onChangePassword}>
          <KeyRound data-icon="inline-start" />
          {share.has_password ? '改密码' : '设密码'}
        </Button>
        <Button size="xs" variant="outline" disabled={busy} onClick={onPushLatest}>
          <RefreshCw data-icon="inline-start" />
          推送最新版
        </Button>
        <Button size="xs" variant="ghost" disabled={busy} onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 data-icon="inline-start" />
          删除
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：主对话框**

创建 `src/components/resume-share/share-dialog.tsx`。快照来源分两种：编辑器场景由调用方传入 `getSnapshot`（复用 `getPersistedSnapshot`）；列表场景传入的 `getSnapshot` 内部调 `getResumeSnapshotById`。对话框只消费一个统一的 `getSnapshot: () => Promise<{ snapshot, displayName }>`。

```tsx
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import useResumeShareStore from '@/store/resume-share'
import { CreateShareForm } from './create-share-form'
import { ShareLinkRow } from './share-link-row'

export interface ShareSnapshotSource {
  getSnapshot: () => Promise<{ snapshot: import('@/lib/schema').PersistedResumeSnapshot, displayName: string | null }>
}

interface ShareDialogProps extends ShareSnapshotSource {}

export function ShareDialog({ getSnapshot }: ShareDialogProps) {
  const {
    openForResumeId,
    openForResumeName,
    shares,
    loading,
    mutatingId,
    error,
    closeDialog,
    create,
    setActive,
    setPassword,
    pushSnapshot,
    remove,
  } = useResumeShareStore()

  const [creating, setCreating] = useState(false)
  const open = Boolean(openForResumeId)

  const handleCreate = async (options: Parameters<typeof create>[3]) => {
    if (!openForResumeId)
      return
    setCreating(true)
    try {
      const { snapshot, displayName } = await getSnapshot()
      await create(openForResumeId, snapshot, displayName, options)
      toast.success('分享链接已生成')
    }
    catch {
      toast.error('生成失败，请重试')
    }
    finally {
      setCreating(false)
    }
  }

  const handlePush = async (shareId: string) => {
    try {
      const { snapshot, displayName } = await getSnapshot()
      await pushSnapshot(shareId, snapshot, displayName)
      toast.success('已推送最新简历到该链接')
    }
    catch {
      toast.error('推送失败')
    }
  }

  const handleChangePassword = (shareId: string, hasPassword: boolean) => {
    // 简单实现：用 prompt 收集密码；清空输入视为清除密码
    const input = window.prompt(hasPassword ? '输入新密码（留空则清除密码）' : '设置访问密码')
    if (input === null)
      return
    void setPassword(shareId, input.trim() || null)
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && closeDialog()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            分享「
            {openForResumeName || '简历'}
            」
          </DialogTitle>
          <DialogDescription>
            生成只读链接，别人无需登录即可查看这份简历的当前快照。你可随时关闭链接或推送最新版。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <CreateShareForm onCreate={handleCreate} />

          {(loading || creating) && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              处理中…
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!loading && shares.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">还没有分享链接，生成一个吧。</p>
          )}

          <div className="flex flex-col gap-2">
            {shares.map(share => (
              <ShareLinkRow
                key={share.id}
                share={share}
                busy={mutatingId === share.id}
                onToggleActive={isActive => setActive(share.id, isActive)}
                onChangePassword={() => handleChangePassword(share.id, share.has_password)}
                onPushLatest={() => handlePush(share.id)}
                onDelete={() => remove(share.id)}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **步骤 4：验证组件基础可用性**

运行：`grep -rn "components/ui/switch" src/components/ui/switch.tsx || ls src/components/ui/switch.tsx`
预期：确认 `Switch`、`Input`、`Label`、`Dialog`、`Badge` 均存在于 `src/components/ui/`。若 `switch` / `label` 缺失，用 shadcn 补齐（`pnpm dlx shadcn@latest add switch label`）或改用现有等价组件。

运行：`pnpm exec tsc --noEmit`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/components/resume-share
git commit -m "feat(resume-share): 新增分享管理对话框与链接行组件

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 7：编辑器入口接线

**文件：**
- 修改：`src/pages/resume/editor/components/collaboration/collaboration-controls/index.tsx`
- 参考快照来源：`src/store/resume/helpers/sync-service.ts:127`（`getPersistedSnapshot`）、当前简历 store（`useResumeFormStore` 状态）

- [ ] **步骤 1：确认当前简历 store 取值方式**

运行：`grep -rn "getPersistedSnapshot\|useResumeConfigStore\|currentResumeId\|display_name" src/pages/resume/editor/ | head -30`
预期：定位编辑器内如何拿到 `currentResumeId`、当前简历名、以及可传给 `getPersistedSnapshot(state)` 的 state。据此在下一步组装 `getSnapshot`。

- [ ] **步骤 2：在协作控制栏加分享按钮 + 挂载 ShareDialog**

在 `collaboration-controls/index.tsx` 顶部导入：

```tsx
import { Link2 } from 'lucide-react'
import { getPersistedSnapshot } from '@/store/resume/helpers/sync-service'
import useResumeShareStore from '@/store/resume-share'
import { ShareDialog } from '@/components/resume-share/share-dialog'
```

在组件内（`useCollaborationPanel` 解构附近）获取当前简历标识与打开方法。`resumeId` 与当前简历名从既有 store 读取（按步骤 1 结果接线，示例）：

```tsx
  const openShareDialog = useResumeShareStore(s => s.openDialog)
  // resumeId / resumeName 由步骤 1 定位的 store 提供，例如：
  // const resumeId = useDocumentStore(s => s.currentResumeId)
  // const resumeName = useResumeMetaStore(s => s.display_name)
```

在「开启协作」按钮旁新增分享按钮（放在 `body` 的按钮组内，`onClick` 打开对话框）：

```tsx
        <Button
          size={isMobile ? 'icon' : 'sm'}
          variant="outline"
          onClick={() => resumeId && openShareDialog(resumeId, resumeName ?? null)}
          disabled={!resumeId}
        >
          <Link2 className="size-4" />
          {!isMobile && '分享'}
        </Button>
```

在组件 return 的末尾（`HeaderTag` 之外，用 Fragment 包裹）挂载对话框，`getSnapshot` 复用编辑器内存中的 state：

```tsx
      <ShareDialog
        getSnapshot={async () => {
          const state = /* 编辑器当前简历表单 state，按步骤 1 结果获取 */ getCurrentPersistableState()
          return {
            snapshot: getPersistedSnapshot(state),
            displayName: resumeName ?? null,
          }
        }}
      />
```

> 执行时按步骤 1 定位的真实 store API 替换 `getCurrentPersistableState()` 与 `resumeId`/`resumeName` 取值；若编辑器已有导出「当前 persistable state」的 selector，直接复用，不要新造。

- [ ] **步骤 3：验证**

运行：`pnpm exec tsc --noEmit && pnpm lint`
预期：PASS。手动核对：编辑器工具栏出现「分享」按钮，点击弹出对话框。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/resume/editor/components/collaboration/collaboration-controls/index.tsx
git commit -m "feat(resume-share): 编辑器协作栏接入分享入口

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 8：简历卡片入口接线

**文件：**
- 修改：`src/pages/resume/components/resume-card/index.tsx`
- 参考：`src/lib/supabase/resume/share.ts` 的 `getResumeSnapshotById`

- [ ] **步骤 1：加分享按钮 + 挂载 ShareDialog**

在 `resume-card/index.tsx` 导入：

```tsx
import { Share2 } from 'lucide-react'
import { getResumeSnapshotById } from '@/lib/supabase/resume/share'
import useResumeShareStore from '@/store/resume-share'
import { ShareDialog } from '@/components/resume-share/share-dialog'
```

在组件内取打开方法：

```tsx
  const openShareDialog = useResumeShareStore(s => s.openDialog)
```

新增分享点击处理（离线简历不可分享）：

```tsx
  const handleShareClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (resume.isOffline)
      return
    openShareDialog(resume.resume_id, resume.display_name || '未命名简历')
  }
```

在 `CardFooter` 现有两个按钮之后追加分享按钮（保持 grid 布局，改为可容纳三个或另起一行）。示例：把 footer 改成纵向排列的两行，第二行放分享按钮：

```tsx
        <CardFooter className="mt-auto flex flex-col gap-2 px-5">
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleEditClick} className="flex-1">
              <Edit2 data-icon="inline-start" />
              编辑信息
            </Button>
            <Button
              variant="outline"
              onClick={handleDeriveClick}
              className="flex-1"
              disabled={isGenerating}
              aria-label="派生针对性版本"
            >
              <Sparkles data-icon="inline-start" />
              派生
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={handleShareClick}
            className="w-full"
            disabled={resume.isOffline}
            title={resume.isOffline ? '离线简历需先同步到云端才能分享' : undefined}
          >
            <Share2 data-icon="inline-start" />
            {resume.isOffline ? '同步后可分享' : '分享'}
          </Button>
        </CardFooter>
```

在组件 return 的 `</>` 前挂载对话框（列表页快照来源走云端读取）：

```tsx
      <ShareDialog
        getSnapshot={async () => {
          const { snapshot, displayName } = await getResumeSnapshotById(resume.resume_id)
          return { snapshot, displayName: displayName ?? resume.display_name ?? null }
        }}
      />
```

> 注意：`ShareDialog` 是否会因每张卡片各挂一个而多实例？会——但它靠 store 的 `openForResumeId` 控制 `open`，只有被点击的那张卡片其 `openForResumeId` 匹配时才渲染内容。为避免多个 Dialog 同时 `open`（store 是单例，`openForResumeId` 全局唯一），实际只有一个会打开。可接受。若想更干净，可在步骤 2 改为「列表页仅挂一个 ShareDialog」的方案。

- [ ] **步骤 2（可选优化）：列表页单例 ShareDialog**

若步骤 1 的「每卡一个 Dialog」不够优雅，改为：卡片只调 `openShareDialog`，`ShareDialog` 提升到 `src/pages/resume/index.tsx` 挂载一个。此时 `getSnapshot` 需依据 store 的 `openForResumeId` 动态取，改为：`ShareDialog` 内部自行用 `openForResumeId` 调 `getResumeSnapshotById`。执行者按代码整洁度二选一，推荐单例方案。

- [ ] **步骤 3：验证**

运行：`pnpm exec tsc --noEmit && pnpm lint`
预期：PASS。手动核对：卡片出现分享按钮，离线简历置灰。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/resume/components/resume-card/index.tsx src/pages/resume/index.tsx
git commit -m "feat(resume-share): 简历卡片接入分享入口

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 9：分享页 PDF 导出组件

**文件：**
- 创建：`src/pages/resume/view/components/share-pdf-export.tsx`
- 参考：`src/pages/history/components/version-pdf-export/index.tsx`（react-to-print 离屏打印模式）

- [ ] **步骤 1：编写导出组件**

创建 `src/pages/resume/view/components/share-pdf-export.tsx`：

```tsx
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import { FileDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import PagedResumeShell from '@/components/resume/paged-resume-shell'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'
import { Button } from '@/components/ui/button'
import { getBuiltInTemplateManifest } from '@/lib/resume-template/runtime/get-built-in-manifest'
import { getManifestFromTemplateBinding } from '@/lib/resume-template/runtime/get-manifest-from-binding'

interface SharePdfExportProps {
  snapshot: PersistedResumeSnapshot
  documentTitle: string
}

export function SharePdfExport({ snapshot, documentTitle }: SharePdfExportProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const previewData = useMemo(() => buildTemplateResumeData(snapshot), [snapshot])
  const [manifest, setManifest] = useState<TemplateManifest | null>(null)

  useEffect(() => {
    let cancelled = false
    const fallback = getBuiltInTemplateManifest(previewData.templateBinding?.basedOnResumeType ?? previewData.type)
    if (!previewData.templateBinding) {
      setManifest(fallback)
      return
    }
    getManifestFromTemplateBinding(previewData.templateBinding)
      .then(resolved => !cancelled && setManifest(resolved ?? fallback))
      .catch(() => !cancelled && setManifest(fallback))
    return () => { cancelled = true }
  }, [previewData])

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: documentTitle ? `${documentTitle}-简历` : '简历',
    pageStyle: `@page { size: A4; margin: 0; }`,
  })

  return (
    <>
      <Button variant="outline" disabled={!manifest} onClick={() => handlePrint()}>
        <FileDown data-icon="inline-start" />
        下载 PDF
      </Button>

      {manifest && (
        <div aria-hidden className="pointer-events-none fixed -left-[99999px] top-0 opacity-0">
          <PagedResumeShell ref={printRef} appearance={snapshot}>
            <ResumeTemplateRuntime data={previewData} manifest={manifest} />
          </PagedResumeShell>
        </div>
      )}
    </>
  )
}
```

- [ ] **步骤 2：验证**

运行：`pnpm exec tsc --noEmit`
预期：PASS。核对 `PagedResumeShell` 接受 `ref` 与 `appearance`（version-pdf-export 已如此用），`buildTemplateResumeData` 接受 `PersistedResumeSnapshot`（是 `TemplateResumeDataInput` 的超集，字段兼容）。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/resume/view/components/share-pdf-export.tsx
git commit -m "feat(resume-share): 新增分享页 PDF 导出组件

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 10：分享页 `/resume/view/:token`

**文件：**
- 创建：`src/pages/resume/view/[token].tsx`
- 参考：`src/components/resume/scaled-readonly-preview.tsx`（只读渲染）、`src/lib/supabase/resume/share.ts` 的 `fetchSharedResume`、`motion/react`

- [ ] **步骤 1：编写分享页**

创建 `src/pages/resume/view/[token].tsx`：

```tsx
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchSharedResume } from '@/lib/supabase/resume/share'
import { SharePdfExport } from './components/share-pdf-export'

type ViewState =
  | { phase: 'loading' }
  | { phase: 'password', wrong: boolean }
  | { phase: 'ready', snapshot: PersistedResumeSnapshot, displayName: string | null }
  | { phase: 'unavailable' }

export default function ResumeSharePage() {
  const { token } = useParams<{ token: string }>()
  const reduceMotion = useReducedMotion()
  const [state, setState] = useState<ViewState>({ phase: 'loading' })
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async (pwd?: string) => {
    if (!token) {
      setState({ phase: 'unavailable' })
      return
    }
    const result = await fetchSharedResume(token, pwd)
    if (result.unavailable) {
      setState({ phase: 'unavailable' })
      return
    }
    if (result.needPassword) {
      setState({ phase: 'password', wrong: Boolean(result.wrongPassword) })
      return
    }
    if (result.snapshot) {
      setState({ phase: 'ready', snapshot: result.snapshot, displayName: result.displayName ?? null })
    }
    else {
      setState({ phase: 'unavailable' })
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleSubmitPassword = async () => {
    setSubmitting(true)
    await load(password.trim())
    setSubmitting(false)
  }

  if (state.phase === 'loading') {
    return <CenteredMessage text="加载中…" />
  }

  if (state.phase === 'unavailable') {
    return <CenteredMessage title="链接不可用" text="该分享链接不存在、已关闭或已过期。" />
  }

  if (state.phase === 'password') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">需要访问密码</h1>
            <p className="text-sm text-muted-foreground">这份简历分享链接受密码保护，请输入密码查看。</p>
          </div>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmitPassword()}
            placeholder="访问密码"
            autoFocus
          />
          {state.wrong && <p className="text-sm text-destructive">密码错误，请重试。</p>}
          <Button onClick={handleSubmitPassword} disabled={submitting || !password.trim()}>
            {submitting ? '验证中…' : '查看简历'}
          </Button>
        </div>
      </div>
    )
  }

  // ready
  const previewData = buildTemplateResumeData(state.snapshot)
  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-dvh bg-muted/30"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <h1 className="truncate text-base font-semibold">{state.displayName || '简历'}</h1>
        <SharePdfExport snapshot={state.snapshot} documentTitle={state.displayName || '简历'} />
      </header>
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <div className="rounded-lg bg-background p-2 shadow-sm sm:p-4">
          <ScaledReadonlyPreview data={previewData} appearance={state.snapshot} />
        </div>
      </main>
    </motion.div>
  )
}

function CenteredMessage({ title, text }: { title?: string, text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      {title && <h1 className="text-lg font-semibold">{title}</h1>}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
```

- [ ] **步骤 2：验证渲染入参匹配**

运行：`pnpm exec tsc --noEmit`
预期：PASS。核对 `ScaledReadonlyPreview` 的 props：`data: TemplateResumeData`、`appearance?`（scaled-readonly-preview.tsx:11-16）。`buildTemplateResumeData` 返回 `TemplateResumeData`，`appearance` 传 `snapshot`（含 spacing/font/theme）兼容 `Partial<ResumeAppearanceConfig>`。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/resume/view
git commit -m "feat(resume-share): 新增匿名只读分享页

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 11：App 外壳裸壳分支

**文件：**
- 修改：`src/App.tsx:13-49`

分享页面向匿名外部访问者，不应套 `DashboardShell` / `AssistantShell`（含登录用户侧边栏/导航）。

- [ ] **步骤 1：加裸壳判断**

在 `App.tsx` 的 `App()` 内，`isAssistantRoute` 之后新增：

```tsx
  const isShareViewRoute = location.pathname.startsWith('/resume/view/')
```

将渲染分支改为三态（裸壳优先）：

```tsx
      <AnimatePresence mode="wait">
        <motion.div
          key={isShareViewRoute ? 'share' : isAssistantRoute ? 'assistant' : 'dashboard'}
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="h-dvh w-full"
        >
          {isShareViewRoute
            ? <Suspense fallback={<Loading />}>{element}</Suspense>
            : isAssistantRoute
              ? (
                  <AssistantShell>
                    <Suspense fallback={<Loading />}>{element}</Suspense>
                  </AssistantShell>
                )
              : (
                  <DashboardShell routeKey={location.pathname}>
                    <Suspense fallback={<Loading />}>{element}</Suspense>
                  </DashboardShell>
                )}
        </motion.div>
      </AnimatePresence>
```

- [ ] **步骤 2：确认分享页不因未登录被全局守卫拦截**

运行：`grep -rn "Navigate\|redirect\|requireAuth\|ProtectedRoute\|getSession" src/App.tsx src/components/layout/dashboard-shell* src/main.tsx`
预期：确认全局登录守卫的位置。分享页 `/resume/view/:token` 走裸壳分支，天然不经过 DashboardShell 守卫；但若 `main.tsx` 或路由层有全局 `requireAuth`，需为该前缀放行。若发现全局守卫，在守卫处 `if (pathname.startsWith('/resume/view/')) return children` 放行。

- [ ] **步骤 3：验证**

运行：`pnpm exec tsc --noEmit && pnpm lint && pnpm build`
预期：PASS。手动核对：访问 `/resume/view/<token>` 不出现 Dashboard 侧栏。

- [ ] **步骤 4：Commit**

```bash
git add src/App.tsx
git commit -m "feat(resume-share): App 外壳为分享页开裸壳分支

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 任务 12：文档同步与整体验证

**文件：**
- 修改：`README.md`

- [ ] **步骤 1：README 增补分享功能说明**

在 README「实时多人协作」章节后，新增「简历只读分享」小节，说明：可撤销临时链接、快照固化、可选密码、访问统计、允许下载 PDF、仅云端简历可分享。并在「数据库初始化」WARNING 中补一句：最新迁移新增 `resume_shares` 表，需部署 `resume-share` Edge Function（`supabase functions deploy resume-share`）。

- [ ] **步骤 2：整体验证**

运行：`pnpm exec tsc --noEmit && pnpm lint && pnpm build`
预期：全部 PASS。

- [ ] **步骤 3：人工端到端核对清单**

- 登录后编辑器工具栏「分享」按钮 → 弹窗生成链接 → 复制 URL。
- 新开无痕窗口访问 URL → 看到只读简历、可下载 PDF。
- 设密码 → 无痕访问要求输入密码；错误密码不放行。
- 关闭链接（Switch off）→ 无痕访问显示「链接不可用」。
- 改简历后「推送最新版」→ 无痕访问看到新内容。
- 简历卡片「分享」入口同样可用；离线简历置灰。

- [ ] **步骤 4：Commit**

```bash
git add README.md
git commit -m "docs(resume-share): README 增补简历只读分享说明

Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## 自检结果

**规格覆盖度：**
- §3 数据模型 → 任务 1 ✅
- §4 匿名访问机制（GET + 密码写入 + 脱敏 + 计数 + 统一文案）→ 任务 2 ✅
- §5 发起方（快照生成 / store / ShareDialog / 双入口）→ 任务 4/5/6/7/8 ✅
- §6 消费方（路由 / 状态机 / 渲染 / PDF / 动效 / 裸壳）→ 任务 9/10/11 ✅
- §7 边界（离线置灰 任务 8、cascade 任务 1、统一失败文案 任务 2、无测试）✅
- §8 文件清单 → README 同步 任务 12 ✅

**占位符扫描：** 任务 2 步骤 1 有意标注「粗糙点」并在步骤 2 给出定稿（这是刻意的两步走，非遗留 TODO）。任务 7 步骤 1/2 的 store 取值需按真实 API 接线——已用「先 grep 定位再替换」的可执行步骤覆盖，非模糊占位。任务 8 步骤 2 为可选优化，二选一明确。无「待补充/TODO」类空洞。

**类型一致性：** `PersistedResumeSnapshot`（persisted.ts:90）贯穿快照读取、store、Function 返回、渲染入参一致；`ResumeShareRecord`（含 `has_password`，剔除 `password_hash`）在 share.types / share.ts / store / 组件间一致；`fetchSharedResume` 返回 `ShareViewResult` 与分享页 `ViewState` 映射一致；`getPersistedSnapshot`（sync-service.ts:127）、`getResumeSnapshotById`（新增）分别覆盖编辑器 / 列表两种快照来源。

**待执行时确认（非计划缺陷，属真实接线点）：**
1. 任务 7：编辑器当前简历 persistable state 的确切 selector（步骤 1 grep 定位）。
2. 任务 11 步骤 2：是否存在全局登录守卫需为 `/resume/view/` 放行。
3. 任务 2 步骤 3：Deno bcrypt 导入在目标部署环境可用性（含 esm.sh/bcryptjs 回退）。
