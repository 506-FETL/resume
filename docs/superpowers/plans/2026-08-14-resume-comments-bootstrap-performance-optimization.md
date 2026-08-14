# 简历评论 Bootstrap 全链路性能优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在不迁移数据库、不引入新基础设施的前提下，将评论正常 bootstrap 收敛为浏览器一次请求、Edge 一次数据库 RPC，并通过非对称 JWT 本地验签消除 Auth 热路径网络往返。

**架构：** 浏览器继续通过 `resume-comments` Edge Function 访问评论服务；Edge 使用 Supabase `getClaims()` 校验 JWT、在本地验证评论访问令牌，然后调用一个 service-role-only 聚合 RPC。PostgreSQL 在同一事务快照中完成最终授权和数据聚合，Edge 本地签发 Realtime token；客户端精确记录请求、解析、Store 与 Realtime 各阶段，并用固定窗口报告 P50/P95。

**技术栈：** React 19、TypeScript 5.9、Zustand 5、Supabase JS 2.103.0、Supabase Edge Functions、PostgreSQL 17、PostgREST、Vite 7、Node 24、pnpm

**规格：** `docs/superpowers/specs/2026-08-14-resume-comments-bootstrap-performance-optimization-design.md`

**验证：** 仓库没有测试框架，且 `AGENTS.md` 明确不要求 TDD。本计划恢复可执行的 Node 断言脚本，配合 SQL 权限/查询计划检查、TypeScript、定向 ESLint、生产构建、远端身份矩阵、浏览器 Network 面板和重复性能基准验证。

---

## 实施约束

- 继续在当前 `main` 分支工作，不创建或切换分支，不执行 `git push`。
- 当前远端项目为 `bitxrpdtlohlnywgusfw`，数据库区域为 `us-east-1`；不得迁移数据库或创建副本。
- 数据库迁移必须纯新增；旧 Edge 实现保持可回滚，验证完成前不删除旧函数或撤销旧 JWT 密钥。
- 正常 bootstrap 必须只有一个数据库 RPC；只有明确的 `scope_missing` 才允许 Edge 在同一浏览器请求中执行一次 repair 和一次重试。
- 客户端不得实现 `scope_missing` 自动重试，不得将 JWT、评论访问令牌或匿名 secret 放到 URL、日志、缓存或性能详情。
- 不用提高告警阈值、删除慢样本或把残差命名为数据库耗时制造优化结果。
- `llm-proxy` 关闭平台旧 JWT 校验时，函数体内共享鉴权必须在额度查询和上游 LLM 请求之前执行。
- 每个提交只暂存计划列出的文件；提交前运行 `git diff --cached --name-status` 与 `git diff --check`。

## 文件结构与职责

### 新增

- `supabase/functions/shared/supabase-auth.ts`：Supabase Bearer 提取、`getClaims()` 验签、必需 claims 校验与鉴权模式分类。
- `supabase/migrations/20260814060000_optimize_resume_comment_bootstrap.sql`：私有访问解析/聚合实现和 service-role-only `bootstrap_resume_comments_v1` 包装器。
- `scripts/verify-supabase-edge-auth.ts`：以 stub 覆盖匿名、HS256、ES256/RS256 和非法 claims 分支。
- `scripts/verify-resume-comment-anchors.ts`：恢复锚点纯逻辑验证入口，修复现有悬空 npm script。
- `scripts/verify-resume-comment-client.ts`：恢复并扩展客户端 Store、缓存、协议与性能统计断言。
- `scripts/verify-resume-comment-service.ts`：恢复并扩展 Edge、CORS、RPC 权限和源码契约断言。
- `scripts/benchmark-resume-comments-bootstrap.ts`：对相同请求执行 `auto`/`us-east-1` 重复基准且不输出凭证。
- `scripts/prewarm-resume-comment-scopes.ts`：使用共享 TS 投影为安全可处理的既有版本预建缺失 scope，不输出快照或标识。
- `docs/superpowers/verification/2026-08-14-resume-comments-bootstrap-performance.md`：记录基线、发布版本、身份矩阵、SQL 计划与优化后 P50/P95。

### 修改

- `docs/superpowers/specs/2026-08-14-resume-comments-bootstrap-performance-optimization-design.md`：把状态更新为已批准。
- `package.json`、`pnpm-lock.yaml`：固定 Supabase JS 2.103.0，恢复评论验证命令并增加鉴权/基准命令。
- `supabase/functions/shared/cors.ts`：缓存预检并暴露计时、请求 ID 与 Edge 区域响应头。
- `supabase/functions/resume-comments/index.ts`：共享 JWT 鉴权、bootstrap 聚合 RPC、受控 scope repair、精确 Server-Timing 与响应元数据。
- `supabase/functions/resume-share/index.ts`：共享本地 JWT 鉴权与固定 Supabase JS 版本。
- `supabase/functions/llm-proxy/index.ts`：共享本地 JWT 鉴权、明确 401 映射与固定 Supabase JS 版本。
- `supabase/config.toml`：三个函数都由函数体鉴权，显式配置 `verify_jwt = false`。
- `src/features/resume-comments/api/client.ts`：协议版本、请求 ID、区域、响应字节和请求阶段计时。
- `src/features/resume-comments/api/performance.ts`：移除阈值包装和残差 `db`，增加滚动 P50/P95 与精确 `transportOverhead`。
- `src/features/resume-comments/api/cache.ts`：缓存协议版本，忽略旧协议 entry。
- `src/features/resume-comments/hooks/use-comment-realtime.ts`：测量 Store/Realtime，同步顺序保持 Store → Realtime → 异步缓存。

### 明确不修改

- 评论表领域模型、mutation RPC、Realtime 失效协议和 UI。
- Supabase 主数据库区域、只读副本、CDN 或代理层。
- 本次不撤销 legacy JWT key，不改变现有 access token 自然过期语义。

---

### 任务 1：恢复验证基线并固定依赖

**文件：**

- 创建：`scripts/verify-resume-comment-anchors.ts`
- 创建：`scripts/verify-resume-comment-client.ts`
- 创建：`scripts/verify-resume-comment-service.ts`
- 创建：`scripts/verify-supabase-edge-auth.ts`
- 创建：`scripts/benchmark-resume-comments-bootstrap.ts`
- 创建：`scripts/prewarm-resume-comment-scopes.ts`
- 创建：`docs/superpowers/verification/2026-08-14-resume-comments-bootstrap-performance.md`
- 修改：`package.json`
- 修改：`pnpm-lock.yaml`

- [ ] **步骤 1：恢复三份已删除的评论验证脚本**

从删除它们的提交父版本恢复脚本，再按后续任务的新协议逐项修改，避免重写时丢失既有锚点、Store、HMAC 与 Realtime 断言：

```bash
git show 3fb59a6^:scripts/verify-resume-comment-anchors.ts > /tmp/verify-resume-comment-anchors.ts
git show 3fb59a6^:scripts/verify-resume-comment-client.ts > /tmp/verify-resume-comment-client.ts
git show 3fb59a6^:scripts/verify-resume-comment-service.ts > /tmp/verify-resume-comment-service.ts
```

使用 `apply_patch` 将三份内容加入仓库；不得直接以 shell 重定向写工作区文件。

- [ ] **步骤 2：增加共享鉴权断言脚本入口**

`verify-supabase-edge-auth.ts` 使用注入的 `getClaims` stub，固定以下断言矩阵：

```ts
await assert.doesNotReject(() => authenticateSupabaseUser({
  request: request(),
  client: claimsClient({ shouldNotCall: true }),
  supabaseUrl,
}))
assert.equal((await authenticate(validEs256)).authMode, 'local_jwks')
assert.equal((await authenticate(validHs256)).authMode, 'legacy_auth')
await assert.rejects(() => authenticate(invalidIssuer), SupabaseAuthenticationError)
await assert.rejects(() => authenticate(expired), SupabaseAuthenticationError)
```

脚本必须覆盖：无 Authorization、不含三段的匹配 publishable key、不匹配的畸形 Bearer、`getClaims` error、HS256、ES256、RS256、未知 alg、错误 `iss`/`aud`/`exp`/`sub`/`role`/`session_id`。

- [ ] **步骤 3：增加无泄密基准脚本**

`benchmark-resume-comments-bootstrap.ts` 只从环境变量读取请求配置：

```ts
interface BenchmarkConfig {
  url: string
  publishableKey: string
  jwt: string | null
  accessBody: Record<string, unknown>
  samples: number
}

const regions = ['auto', 'us-east-1'] as const
```

每组默认 20 次 POST，单独记录首次 OPTIONS；输出 `count/P50/P95/max`、`Server-Timing`、`x-sb-edge-region`、`authMode`、`repair` 和响应字节数。日志只能显示 HTTP 状态、统计量和非敏感元数据，禁止打印 headers、body、JWT 或访问上下文。

- [ ] **步骤 4：增加缺失 scope 预热脚本**

预热脚本复用共享投影，分页处理而不把整库快照驻留内存：

```ts
interface PrewarmSummary {
  scanned: number
  created: number
  skipped: number
  failed: number
}

const PAGE_SIZE = 100
```

脚本必须要求 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，只查询缺少活动 version scope 的版本；每项调用 `buildCommentAnchorDocument()` 和 `ensure_resume_version_comment_scope`。输出仅包含 summary，任何错误日志只包含错误类别，不包含 snapshot、用户/简历/版本/scope ID 或 credential。

- [ ] **步骤 5：固定依赖与可执行命令**

将依赖固定为：

```json
"@supabase/supabase-js": "2.103.0"
```

保留并恢复：

```json
"verify:comments": "node --experimental-strip-types scripts/verify-resume-comment-anchors.ts",
"verify:comment-client": "node --experimental-strip-types scripts/verify-resume-comment-client.ts",
"verify:comment-service": "node --experimental-strip-types scripts/verify-resume-comment-service.ts",
"verify:edge-auth": "node --experimental-strip-types scripts/verify-supabase-edge-auth.ts",
"benchmark:comments": "node --experimental-strip-types scripts/benchmark-resume-comments-bootstrap.ts",
"prewarm:comments": "node --experimental-strip-types scripts/prewarm-resume-comment-scopes.ts"
```

运行 `pnpm install --lockfile-only` 更新 lockfile。

- [ ] **步骤 6：记录优化前基线**

验证文档写入已确认的同机基线：原告警 6702 ms、Edge 3573.7 ms、Auth 1382.2 ms、access 913.1 ms、线程阶段 1273.2 ms；补充当前函数版本、数据库区域、自动 Edge 区域，以及 OPTIONS/匿名 POST 的重复探测结果。明确旧 `db` 和 `clientOverhead` 仅为残差口径。

- [ ] **步骤 7：运行恢复后的基线验证**

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
pnpm exec tsc -p tsconfig.app.json --noEmit
git diff --check
```

预期：三个脚本均实际存在并通过；若旧性能阈值断言因后续接口尚未实现而失败，只允许在任务 5 更新对应断言，不能删除验证入口。

- [ ] **步骤 8：提交验证基线**

```bash
git add package.json pnpm-lock.yaml scripts/verify-resume-comment-anchors.ts scripts/verify-resume-comment-client.ts scripts/verify-resume-comment-service.ts scripts/verify-supabase-edge-auth.ts scripts/benchmark-resume-comments-bootstrap.ts scripts/prewarm-resume-comment-scopes.ts docs/superpowers/verification/2026-08-14-resume-comments-bootstrap-performance.md docs/superpowers/specs/2026-08-14-resume-comments-bootstrap-performance-optimization-design.md docs/superpowers/plans/2026-08-14-resume-comments-bootstrap-performance-optimization.md
git diff --cached --name-status
git commit -m "test(comments): 恢复性能优化验证基线"
```

---

### 任务 2：建立共享 Supabase JWT 本地验签

**文件：**

- 创建：`supabase/functions/shared/supabase-auth.ts`
- 修改：`supabase/functions/shared/cors.ts`
- 修改：`supabase/functions/resume-comments/index.ts`
- 修改：`supabase/functions/resume-share/index.ts`
- 修改：`supabase/functions/llm-proxy/index.ts`
- 修改：`supabase/config.toml`
- 修改：`scripts/verify-supabase-edge-auth.ts`
- 修改：`scripts/verify-resume-comment-service.ts`

- [ ] **步骤 1：实现共享 claims 验证接口**

共享模块导出固定契约：

```ts
export type SupabaseAuthMode = 'anonymous' | 'local_jwks' | 'legacy_auth'

export interface SupabaseAuthIdentity {
  userId: string | null
  authMode: SupabaseAuthMode
}

export class SupabaseAuthenticationError extends Error {
  readonly code = 'unauthorized'
  readonly status = 401
}

export async function authenticateSupabaseUser(params: {
  request: Request
  client: SupabaseClaimsClient
  supabaseUrl: string
}): Promise<SupabaseAuthIdentity>
```

无 Bearer 或 Bearer 等于 `apikey` 且以 `sb_publishable_` 开头时直接返回 anonymous，不调用 Auth。其他非三段 JWT 返回 401；`getClaims(jwt)` 成功后显式检查：

```ts
iss === `${supabaseUrl.replace(/\/$/u, '')}/auth/v1`
aud === 'authenticated' || aud.includes('authenticated')
Number.isInteger(exp) && exp > Math.floor(Date.now() / 1_000)
UUID_PATTERN.test(sub)
role === 'authenticated'
UUID_PATTERN.test(session_id)
```

只在验签成功后读取已验证 header：`HS256 → legacy_auth`，`ES256/RS256 → local_jwks`，其他算法拒绝。不得读取 `user_metadata` 或 `app_metadata` 授权，不得自行实现 JWT 签名验证。

- [ ] **步骤 2：给共享 CORS 增加预检缓存**

```ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-request-id, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'Server-Timing, X-Request-Id, X-Sb-Edge-Region',
}
```

`resume-comments` 可覆盖方法为 `POST, OPTIONS`，但不得缩小 expose headers。

- [ ] **步骤 3：接入三个 Edge Function**

三个函数把导入固定为：

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
```

`resume-comments` 删除 `authenticateUser()`；`resume-share` 删除 `authenticateOwner()`；`llm-proxy` 删除内联 `getUser()`。共享鉴权错误必须映射 401；`llm-proxy` 在 quota RPC 和 DeepSeek fetch 前要求 `identity.userId` 非空。公开 share GET/读取 POST 不调用共享鉴权。

- [ ] **步骤 4：显式配置函数体鉴权**

`supabase/config.toml` 最终为：

```toml
[functions.resume-share]
verify_jwt = false

[functions.resume-comments]
verify_jwt = false

[functions.llm-proxy]
verify_jwt = false
```

- [ ] **步骤 5：验证鉴权和供应链固定**

```bash
pnpm verify:edge-auth
pnpm verify:comment-service
pnpm exec eslint supabase/functions/shared/supabase-auth.ts supabase/functions/shared/cors.ts supabase/functions/resume-comments/index.ts supabase/functions/resume-share/index.ts supabase/functions/llm-proxy/index.ts scripts/verify-supabase-edge-auth.ts
git diff --check
```

预期：匿名分支从未调用 stub `getClaims`，完整 claims 矩阵通过；源码中不存在 `@supabase/supabase-js@2'` 或 `.auth.getUser(`。

- [ ] **步骤 6：提交共享鉴权**

```bash
git add supabase/config.toml supabase/functions/shared/supabase-auth.ts supabase/functions/shared/cors.ts supabase/functions/resume-comments/index.ts supabase/functions/resume-share/index.ts supabase/functions/llm-proxy/index.ts scripts/verify-supabase-edge-auth.ts scripts/verify-resume-comment-service.ts
git diff --cached --name-status
git commit -m "perf(auth): 将 Edge JWT 校验迁移到本地"
```

---

### 任务 3：实现 service-role-only 聚合 Bootstrap RPC

**文件：**

- 创建：`supabase/migrations/20260814060000_optimize_resume_comment_bootstrap.sql`
- 修改：`scripts/verify-resume-comment-service.ts`

- [ ] **步骤 1：定义私有解析器与公开包装器**

迁移创建 `private` schema，并实现以下精确入口：

```sql
CREATE OR REPLACE FUNCTION public.bootstrap_resume_comments_v1(
  p_protocol_version integer,
  p_access_kind text,
  p_user_id uuid DEFAULT NULL,
  p_scope_id uuid DEFAULT NULL,
  p_resume_id uuid DEFAULT NULL,
  p_version_id bigint DEFAULT NULL,
  p_share_id uuid DEFAULT NULL,
  p_release_id uuid DEFAULT NULL,
  p_password_generation text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_collaborator_role text DEFAULT NULL,
  p_anonymous_id uuid DEFAULT NULL,
  p_anonymous_secret_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';
```

公开函数第一条业务语句调用 `public.assert_resume_comment_service_role()`，拒绝协议版本不为 1、未知 access kind、冲突或缺失参数。内部调用：

```sql
private.resolve_resume_comment_bootstrap_access_v1(...)
private.build_resume_comment_bootstrap_v1(p_access jsonb)
```

私有函数同样固定空 `search_path`，所有对象使用 schema 限定名。

- [ ] **步骤 2：在数据库重新执行最终授权**

访问解析器必须基于当前权威数据检查：

- Owner：`resume_config_versions.user_id/resume_id`、活动 scope 和可选 `resume_config.current_version_id` 一致。
- Collaborator：session、member、scope、user、role、resume、version 一致，且两级记录均未撤销、未过期。
- Share：share 活跃、未归档、未过期，current release、version、scope 一致；数据库把当前 `password_hash` 仅放入内部 access envelope，Edge 使用现有 secret 重算并校验 password generation 后才允许返回数据。
- Anonymous：identity 的 id、version、secret hash 和 revoked 状态一致；正常 bootstrap 不更新 `last_seen_at`。

不存在可修复的 owner/share version scope 时返回判别联合，且仅在基础访问已经验证后携带 repair 所需的版本快照：

```json
{
  "protocolVersion":1,
  "status":"scope_missing",
  "repair":{
    "ownerUserId":"...",
    "versionId":42,
    "resumeId":"...",
    "snapshot":{},
    "projectionReferenceDate":"2026-08-14",
    "documentRevision":1
  },
  "access":{"kind":"owner","sharePasswordHash":null}
}
```

其他业务错误只返回批准的错误码：`unauthorized`、`not_found`、`share_unavailable`、`comments_disabled`、`stale_release`；不得返回 SQL 文本。

- [ ] **步骤 3：用集合聚合完整 bootstrap**

builder 使用 `MATERIALIZED` CTE 一次读取线程和评论，按 `last_activity_at DESC` 聚合线程、按 `created_at ASC` 聚合评论；作者集合由评论用户和解决线程用户的并集生成。返回结构固定为：

```json
{
  "protocolVersion": 1,
  "status": "ok",
  "access": {
    "kind": "owner",
    "userId": "...",
    "actorKind": "user",
    "actorId": "...",
    "canWrite": true,
    "canManageAll": true,
    "scopeId": "...",
    "versionId": 42,
    "ownerUserId": "...",
    "sharePasswordHash": null
  },
  "bootstrap": {
    "scope": {},
    "version": {},
    "counts": {"unresolved":0,"resolved":0,"detached":0},
    "threads": [],
    "profiles": [],
    "lastReadEventSeq": 0,
    "accessibleScopes": []
  },
  "eventSeq": 0
}
```

`scope.anchor_document` 只返回客户端实际使用的 `{nodes:[{nodeKey}]}`，不传完整文本与 blocks。`shared_link_count` 只统计未归档、启用且未过期的有效记录；counts 从已读取的未删除线程集合计算，禁止再次扫描线程表。无 actor 时 read cursor 为 0。内部 `sharePasswordHash` 必须在 Edge 响应前剥离。

- [ ] **步骤 4：加固 scope ensure 和 service-role 断言**

重新定义 `ensure_resume_version_comment_scope` 的既有 scope 查询，使 `owner_user_id/resume_id/version_id` 全部与已验证 version 一致；否则抛 `55000`，不能返回污染 scope。撤销普通角色执行 service-role 断言：

```sql
REVOKE ALL ON FUNCTION public.assert_resume_comment_service_role()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_resume_comment_service_role()
  TO service_role;
```

- [ ] **步骤 5：收紧函数权限**

```sql
REVOKE ALL ON FUNCTION public.bootstrap_resume_comments_v1(
  integer,text,uuid,uuid,uuid,bigint,uuid,uuid,text,text,text,uuid,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_resume_comments_v1(
  integer,text,uuid,uuid,uuid,bigint,uuid,uuid,text,text,text,uuid,text
) TO service_role;
```

私有函数撤销 PUBLIC 执行权限；不向 `anon` 或 `authenticated` 授予 `private` schema 使用权。

- [ ] **步骤 6：扩展静态与远端 SQL 验证**

服务脚本断言迁移包含 service-role assert、空 search path、完整 revoke/grant、`MATERIALIZED` 集合聚合，且不写 `last_seen_at`。应用迁移后运行：

```sql
SELECT
  has_function_privilege('anon', 'public.bootstrap_resume_comments_v1(integer,text,uuid,uuid,uuid,bigint,uuid,uuid,text,text,text,uuid,text)', 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated', 'public.bootstrap_resume_comments_v1(integer,text,uuid,uuid,uuid,bigint,uuid,uuid,text,text,text,uuid,text)', 'EXECUTE') AS authenticated_exec,
  has_function_privilege('service_role', 'public.bootstrap_resume_comments_v1(integer,text,uuid,uuid,uuid,bigint,uuid,uuid,text,text,text,uuid,text)', 'EXECUTE') AS service_exec;
```

预期：`false / false / true`。使用真实 owner/share 样本调用并比较旧 bootstrap 字段、线程顺序、评论顺序、counts、profiles、read cursor 和 share count。

- [ ] **步骤 7：检查查询计划**

通过带样本参数的包装 SELECT 运行：

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT public.bootstrap_resume_comments_v1(
  1, 'owner', versions.user_id, NULL, NULL, versions.id,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL
)
FROM public.resume_config_versions AS versions
JOIN public.resume_comment_scopes AS scopes
  ON scopes.version_id = versions.id
 AND scopes.kind = 'version'
 AND scopes.archived_at IS NULL
ORDER BY versions.id
LIMIT 1;
```

确认 scope/thread/comment/read-state/share/collaboration 使用已有索引；不存在随线程数增长的远程请求或重复 count 扫描，不发生磁盘 spill。只有计划证明缺口时才在新的追加迁移中加索引。

- [ ] **步骤 8：提交聚合 RPC**

```bash
git add supabase/migrations/20260814060000_optimize_resume_comment_bootstrap.sql scripts/verify-resume-comment-service.ts
git diff --cached --name-status
git commit -m "perf(comments): 聚合评论初始化数据库读取"
```

---

### 任务 4：将 Resume Comments Bootstrap 切到单次 RPC

**文件：**

- 修改：`supabase/functions/resume-comments/index.ts`
- 修改：`scripts/verify-resume-comment-service.ts`

- [ ] **步骤 1：规范化本地访问凭证**

为 bootstrap 增加不访问数据库的输入构造器：owner 读取 scope/resume/version 之一；collaborator 和 share 先调用现有 `verifyCommentToken()`；匿名 secret 只转换为 hash。RPC 参数不得包含原始 Supabase JWT、评论 token 或匿名 secret。

```ts
interface BootstrapRpcInput {
  p_protocol_version: 1
  p_access_kind: 'owner' | 'collaborator' | 'share'
  p_user_id: string | null
  p_scope_id: string | null
  p_resume_id: string | null
  p_version_id: number | null
  p_share_id: string | null
  p_release_id: string | null
  p_password_generation: string | null
  p_session_id: string | null
  p_collaborator_role: 'editor' | 'viewer' | null
  p_anonymous_id: string | null
  p_anonymous_secret_hash: string | null
}
```

- [ ] **步骤 2：实现一次 RPC 和受控 repair**

```ts
const first = await admin.rpc('bootstrap_resume_comments_v1', rpcInput)
await assertCurrentSharePasswordGeneration(first.data, tokenSecret)
if (isScopeMissing(first.data) && ['owner', 'share'].includes(rpcInput.p_access_kind)) {
  const projected = buildCommentAnchorDocument(
    first.data.repair.snapshot,
    first.data.repair.projectionReferenceDate,
  )
  await admin.rpc('ensure_resume_version_comment_scope', {
    p_owner_user_id: first.data.repair.ownerUserId,
    p_version_id: first.data.repair.versionId,
    p_anchor_document: projected.document,
    p_document_hash: projected.documentHash,
    p_projection_reference_date: first.data.repair.projectionReferenceDate,
  })
  repair = true
  result = await admin.rpc('bootstrap_resume_comments_v1', rpcInput)
  await assertCurrentSharePasswordGeneration(result.data, tokenSecret)
}
```

只有 `scope_missing`、owner/share、repair envelope 通过严格结构验证时执行一次 repair；第二次失败直接返回错误。Collaborator 永不 repair。正常路径禁止调用旧 `resolveAccess/loadThreads/loadReadState/loadVersionReference`，旧函数继续服务 mutation、list/recovery 以支持回滚。

- [ ] **步骤 3：验证 RPC 响应并本地签发 Realtime token**

Edge 严格验证 `protocolVersion/status/access/bootstrap/eventSeq`。分享分支使用 RPC 返回的当前 `sharePasswordHash` 和 Edge secret 调用现有 `derivePasswordGeneration()`，不匹配时在签发 Realtime token、repair 或返回业务数据之前拒绝。根据内部 access 构造 `ResolvedAccess` 并调用现有 `issueTopics()`；浏览器数据只包含 `bootstrap` 和 Realtime token，不包含内部 access envelope、snapshot repair 数据或 password hash。

成功协议固定为：

```ts
{
  ok: true,
  protocolVersion: 1,
  meta: { authMode, repair, coldStart },
  data: { ...bootstrap, ...realtime },
  eventSeq,
}
```

- [ ] **步骤 4：替换误导计时口径**

Edge 只发送真实测量值：

```text
auth_anonymous | auth_local | auth_legacy
access_token
rpc
repair
realtime_token
serialize
edge_total
```

删除残差 `db`、泛化 `access` 和 `total`；`serialize` 必须测量 `JSON.stringify`，`edge_total` 覆盖函数入口到 Response 构造完成。响应设置 `X-Request-Id`，并在可获得时透传/设置 `X-Sb-Edge-Region`。`coldStart` 只表示 isolate 首次处理请求，不伪装成 SDK JWKS cache hit。

- [ ] **步骤 5：验证正常路径不再多请求**

```bash
pnpm verify:comment-service
pnpm verify:edge-auth
pnpm exec eslint supabase/functions/resume-comments/index.ts scripts/verify-resume-comment-service.ts
git diff --check
```

源码断言必须证明 `bootstrap_scope` 分支只出现一次 `bootstrap_resume_comments_v1` 调用入口，不出现 `Promise.all([loadThreads/loadReadState/loadVersionReference])`，且 retry 受 `scope_missing && !repair` 限制。

- [ ] **步骤 6：提交 Edge 聚合链路**

```bash
git add supabase/functions/resume-comments/index.ts scripts/verify-resume-comment-service.ts
git diff --cached --name-status
git commit -m "perf(comments): 将初始化切换为单次聚合 RPC"
```

---

### 任务 5：实现客户端精确遥测与无阻塞提交

**文件：**

- 修改：`src/features/resume-comments/api/client.ts`
- 修改：`src/features/resume-comments/api/performance.ts`
- 修改：`src/features/resume-comments/api/cache.ts`
- 修改：`src/features/resume-comments/hooks/use-comment-realtime.ts`
- 修改：`scripts/verify-resume-comment-client.ts`

- [ ] **步骤 1：扩展响应遥测契约**

```ts
export type CommentAuthMode = 'anonymous' | 'local_jwks' | 'legacy_auth'
export type CommentBootstrapClientStage
  = 'auth_token' | 'fetch_headers' | 'response_body'
    | 'normalize' | 'store_commit' | 'realtime_connect'

export interface CommentResponseTelemetry {
  protocolVersion: 1
  authMode: CommentAuthMode
  repair: boolean
  coldStart: boolean
  edgeRegion: string | null
  responseBytes: number
  clientDurations: Partial<Record<CommentBootstrapClientStage, number>>
}
```

`CommentApiSuccess<T>` 增加 `telemetry`。客户端只接受协议 1；不兼容时抛 `ResumeCommentClientError('unexpected', '评论服务协议不兼容')`，禁止回退旧 bootstrap。

- [ ] **步骤 2：精确测量 request 与 normalize**

`request()` 依次测量 token 获取、fetch 到响应头、body text/JSON parse；实际发送 `x-request-id`，读取 `server-timing` 和 `x-sb-edge-region`。`responseBytes` 使用 `new TextEncoder().encode(responseText).byteLength`，文档注明这是解码后 UTF-8 大小。

`bootstrapScope()` 用 `performance.now()` 包住 `normalizeBootstrap()` 并把时长加入 `telemetry.clientDurations.normalize`。URL 构造规则为：

```ts
const region = import.meta.env.VITE_RESUME_COMMENTS_FUNCTION_REGION ?? 'auto'
if (region !== 'auto')
  url.searchParams.set('forceFunctionRegion', region)
```

- [ ] **步骤 3：实现固定窗口统计**

删除 `performanceBudgets`、target/warning/level/average 和 `clientOverhead`。每个受控 bucket 保留最近 50 个样本，nearest-rank 计算：

```ts
const percentile = (sorted: number[], ratio: number) =>
  sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0
```

bucket key 只允许 `stage/authMode/coldStart/repair/protocolVersion/edgeRegion` 的有限枚举组合；导出 `getCommentPerformanceSnapshot()` 返回 count、windowSize、P50、P95、max。`transportOverhead` 仅按以下公式计算：

```ts
Math.max(
  0,
  (clientDurations.fetch_headers ?? 0)
    - (serverDurations.edge_total ?? serverDurations.total ?? 0),
)
```

只接受 Edge 直接上报的 `rpc`，不得派生 `db`。

- [ ] **步骤 4：保持 Store、Realtime 与缓存顺序**

网络结果通过协议验证后立即设置 `hasFreshBootstrap = true`。marker 合并 request 阶段，并分别同步测量：

```ts
marker.measureSync('store_commit', () => {
  store.getState().replaceScope(payload)
  store.getState().setAccessState(nextAccessState)
})
marker.measureSync('realtime_connect', () => connectRealtime(scopeRealtime))
```

结束 marker 后才触发 `writeCommentCache(...).catch(...)` 和 `markRead(...).catch(...)`，两者均不得 await。缓存与网络保持并发，缓存只在 `!cancelled && !hasFreshBootstrap` 时提交。

- [ ] **步骤 5：给 IndexedDB 缓存增加协议版本**

`CommentCacheEntry` 写入 `protocolVersion: 1`；读取缺失或不同版本的旧 entry 时返回 null。缓存数据仍只保存业务 bootstrap，不能保存 Realtime token、authMode、request ID、JWT 或评论 access token。

- [ ] **步骤 6：扩展客户端断言**

脚本覆盖：Server-Timing 非法值忽略、`transportOverhead` 公式、50 样本淘汰、P50/P95/max、auth/cold/repair 分桶、缓存协议 miss、Store 排序和已读单调、request ID header、region header、Store 先于 Realtime、缓存写不 await，以及源码中不存在客户端 `scope_missing` retry。

- [ ] **步骤 7：运行客户端验证并提交**

```bash
pnpm verify:comment-client
pnpm exec tsc -p tsconfig.app.json --noEmit
pnpm exec eslint src/features/resume-comments/api/client.ts src/features/resume-comments/api/performance.ts src/features/resume-comments/api/cache.ts src/features/resume-comments/hooks/use-comment-realtime.ts scripts/verify-resume-comment-client.ts
pnpm build
git diff --check
git add src/features/resume-comments/api/client.ts src/features/resume-comments/api/performance.ts src/features/resume-comments/api/cache.ts src/features/resume-comments/hooks/use-comment-realtime.ts scripts/verify-resume-comment-client.ts
git diff --cached --name-status
git commit -m "perf(comments): 精确拆分初始化链路耗时"
```

---

### 任务 6：按兼容顺序部署数据库与 Edge Function

**文件：**

- 修改：`docs/superpowers/verification/2026-08-14-resume-comments-bootstrap-performance.md`

- [ ] **步骤 1：执行全部本地门禁**

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
pnpm verify:edge-auth
pnpm exec tsc -p tsconfig.app.json --noEmit
pnpm lint
pnpm build
git diff --check
```

- [ ] **步骤 2：应用纯新增迁移并核验权限**

通过 Supabase migration API 将 `20260814060000_optimize_resume_comment_bootstrap.sql` 应用到项目 `bitxrpdtlohlnywgusfw`。随后查询 migration 列表、函数签名和 `has_function_privilege`，运行 Supabase security/performance advisors；新 RPC 不得新增对 anon/authenticated 的 SECURITY DEFINER 暴露。

- [ ] **步骤 3：预热安全可处理的缺失 scope**

`prewarm-resume-comment-scopes.ts` 只接受 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 环境变量，分页读取尚无活动 version scope 的 `resume_config_versions`，调用共享 `buildCommentAnchorDocument(snapshot, projectionReferenceDate)` 后执行 `ensure_resume_version_comment_scope`。脚本只输出 scanned/created/skipped/failed 数量，不输出 snapshot、user/resume/version/scope ID；单条失败继续并在最终以非零退出码报告。

```bash
pnpm prewarm:comments
```

若执行环境没有 service-role credential，记录 `not_run_missing_credential`，不得把密钥写入 `.env`、命令历史或文档；线上仍由受控 `scope_missing` repair 兜底，并将 repair 样本排除在正常热路径统计之外。

- [ ] **步骤 4：在 legacy HS256 仍为 current 时部署兼容代码**

```bash
supabase functions deploy resume-comments --project-ref bitxrpdtlohlnywgusfw --no-verify-jwt --use-api
supabase functions deploy resume-share --project-ref bitxrpdtlohlnywgusfw --no-verify-jwt --use-api
supabase functions deploy llm-proxy --project-ref bitxrpdtlohlnywgusfw --no-verify-jwt --use-api
```

若 CLI 部署不可用，使用 Supabase Edge deploy API 上传入口及全部相对依赖。部署后核验三个函数均 `ACTIVE` 且 `verify_jwt=false`。

- [ ] **步骤 5：验证旧密钥兼容身份矩阵**

逐项验证：comments 的 publishable 匿名、owner JWT、非法 JWT；share 的无头公开读取、owner JWT、非法 JWT；llm-proxy 的无头/publishable/非法 JWT 均为 401、合法 JWT 通过鉴权。owner/collaborator/share/anonymous bootstrap 返回协议 1，权限撤销、过期和密码代次变化继续拒绝。

- [ ] **步骤 6：记录发布收据并提交**

验证文档记录迁移版本、三个 Edge 版本、时间、身份矩阵和回滚点，不记录 token、用户 ID、scope ID 或评论正文。

```bash
git add docs/superpowers/verification/2026-08-14-resume-comments-bootstrap-performance.md
git diff --cached --name-status
git commit -m "docs(comments): 记录评论性能兼容发布验证"
```

---

### 任务 7：零停机迁移 JWT 签名密钥

**文件：**

- 修改：`docs/superpowers/verification/2026-08-14-resume-comments-bootstrap-performance.md`

- [ ] **步骤 1：确认兼容代码和回滚点**

确认三个 Edge Function 已通过旧 HS token 验证，JWKS 当前状态已记录，旧函数版本可部署回滚。任何一项失败都停止密钥操作。

- [ ] **步骤 2：创建非对称 standby key**

在 Supabase Dashboard 的 Auth Signing Keys 中执行 legacy JWT secret migration，创建 Supabase 推荐的非对称 standby key。此操作不迁移数据库、不撤销旧 key。

- [ ] **步骤 3：确认 JWKS 已发布**

```bash
curl -fsS "https://bitxrpdtlohlnywgusfw.supabase.co/auth/v1/.well-known/jwks.json" | jq '.keys | map({kid,kty,alg,use})'
```

预期至少一个非对称公钥，输出中不包含私钥材料。

- [ ] **步骤 4：旋转 standby 为 current 并保留旧 key**

把新非对称 key 设为 current；legacy key 保留为 previously used，本次不 revoke/delete。刷新一个合法会话获取新 access token，禁止把 token 写入日志或验证文档。

- [ ] **步骤 5：验证新旧 token 和本地热路径**

旧 token 应继续成功且 `authMode=legacy_auth`；刷新后的新 token 应成功且 `authMode=local_jwks`。同一 isolate 连续调用确认 `auth_local` 阶段不再出现远程 Auth 往返；重新验证 comments/share/llm-proxy 身份矩阵。

- [ ] **步骤 6：异常时按顺序回滚**

若新 token 被 Edge 拒绝，先恢复上一 Edge 版本；若仍不兼容，把 legacy key 恢复为 current。不得撤销任何仍被会话使用的 key。把症状、回滚动作和最终状态记录到验证文档。

---

### 任务 8：执行端到端性能验收并选择区域

**文件：**

- 修改：`src/features/resume-comments/api/client.ts`（仅当 A/B 明确选出固定区域）
- 修改：`docs/superpowers/verification/2026-08-14-resume-comments-bootstrap-performance.md`
- 修改：`docs/superpowers/plans/2026-08-14-resume-comments-bootstrap-performance-optimization.md`

- [ ] **步骤 1：执行 `auto` 与 `us-east-1` 重复基准**

对相同用户、access body、scope 和数据，每组至少 20 个正常热样本；冷 isolate、首次 JWKS、legacy JWT、local JWT、首次 OPTIONS、预检缓存后和 repair 分组记录。报告 count、P50、P95、max、Edge region、响应字节和全部 Server-Timing 阶段。

- [ ] **步骤 2：按确定性规则选择区域**

正常热路径优先选择 P95 更低的配置，同时要求 P50 没有显著回退；差异落在网络抖动范围时保留 `auto`。只有 `us-east-1` 明确胜出时才把 `VITE_RESUME_COMMENTS_FUNCTION_REGION=us-east-1` 作为部署环境配置，并记录失去自动故障转移的权衡。

- [ ] **步骤 3：执行真实浏览器验收**

浏览器 Network 面板确认：正常 bootstrap 只有一个 POST；第二次同源条件下不重复 OPTIONS（受浏览器 max-age 上限约束）；POST 后没有 profiles/version/read-state list 请求；Store 先显示缓存且网络结果不会被旧缓存覆盖；Realtime 在 Store 提交后连接；IndexedDB 写入不阻塞完成。

- [ ] **步骤 4：执行数据库与功能矩阵**

验证 0/1/多线程、多级回复、删除、detached/resolved、多作者、read cursor、分享计数；owner 当前/历史/明确 scope/repair；collaborator editor/viewer/过期/撤销；share 登录/访客/匿名/关闭/失效/密码变化。重新运行 EXPLAIN、`pg_stat_statements`、security/performance advisors。

- [ ] **步骤 5：判断完成标准**

只有以下条件全部成立才勾选：正常 bootstrap 为 1 HTTP + 1 RPC；新 JWT 热路径为 `local_jwks`；无 profiles 二次请求；RPC 无非预期 N+1/大表顺序扫描；权限、缓存、Realtime 无回归；优化前后 P50/P95 可复现；每个阶段均可解释。剩余外部传输耗时必须如实报告，不能宣称“绝对毫秒级”保证。

- [ ] **步骤 6：完成最终验证与提交**

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
pnpm verify:edge-auth
pnpm exec tsc -p tsconfig.app.json --noEmit
pnpm lint
pnpm build
git diff --check
git status --short
```

更新本计划复选框和验证文档后提交：

```bash
git add docs/superpowers/plans/2026-08-14-resume-comments-bootstrap-performance-optimization.md docs/superpowers/verification/2026-08-14-resume-comments-bootstrap-performance.md src/features/resume-comments/api/client.ts
git diff --cached --name-status
git commit -m "perf(comments): 完成评论初始化全链路优化"
```

不执行 `git push`。
