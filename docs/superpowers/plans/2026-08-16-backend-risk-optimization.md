# 后端风险优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在不改变“固定 1/3 积分”产品计费规则的前提下，完成数据库权限、AI 额度原子性、迁移重放、可观测性、锁顺序、临时数据清理和 GitHub Stars 缓存的系统性收敛，并把跨用户边界限制为有效分享凭据和有效实时协作链接各自绑定的最小资源范围。

**架构：** 浏览器只直接访问当前登录用户拥有的数据；分享快照和评论统一经 `resume-share` / `resume-comments` Edge Function 校验签名作用域。实时协作链接允许登录后的持有者编辑其绑定的单份共享 Automerge 文档并读写该版本评论域，但不授予 owner 其他数据访问权。AI 请求先在数据库原子预留固定积分，再调用 DeepSeek，并根据是否已向客户端交付内容进行结算或释放；后台定时任务负责超时对账、临时表清理、指标告警与 GitHub Stars 刷新。

**技术栈：** PostgreSQL / RLS / PL/pgSQL / pgTAP / pg_cron / pg_net / Supabase Edge Functions（Deno + TypeScript）/ React + Zustand / GitHub Actions

---

## 规格来源与不可变边界

本计划实现下列已批准规格：

- `docs/superpowers/specs/2026-08-16-backend-p0-security-and-migration-ledger-design.md`
- `docs/superpowers/specs/2026-08-16-backend-p0-base-data-rls-hardening-design.md`
- `docs/superpowers/specs/2026-08-16-ai-quota-reservation-ledger-design.md`
- `docs/superpowers/specs/2026-08-16-backend-observability-and-edge-request-security-design.md`
- `docs/superpowers/specs/2026-08-16-database-concurrency-contracts-and-function-hardening-design.md`
- `docs/superpowers/specs/2026-08-16-database-replayable-baseline-and-ci-design.md`
- `docs/superpowers/specs/2026-08-16-github-stars-edge-cache-design.md`
- `docs/superpowers/specs/2026-08-16-transient-data-lifecycle-design.md`

权限矩阵必须满足：

| 资源 | `anon` | `authenticated` | `service_role` |
| --- | --- | --- | --- |
| 用户基础数据、ATS、版本、协作文档、公司、用户模板 | 无直接读写 | 仅本人数据 | 后端受控访问 |
| 分享快照 | 仅通过 `resume-share` 且持有效分享凭据读取指定快照 | 同左 | 受控管理 |
| 分享评论域 | 仅通过 `resume-comments` 且持有效分享凭据读取/写入该域 | 同左 | 受控管理 |
| 跨账号协作会话 | 不支持未登录加入 | 持有效链接可编辑该会话绑定的共享简历并评论 | 受控管理会话、租约与评论 scope |
| AI 额度 | 无 RPC 执行权 | 仅由 `llm-proxy` 代表当前 JWT 用户操作 | Edge 内部执行 |
| GitHub Stars | 只读固定仓库缓存 | 只读固定仓库缓存 | 定时刷新写入 |

## 文件与职责

### 迁移与数据库测试

- 恢复：`supabase/migrations/20260220021550_create_resume_config.sql` 至 `20260409093000_add_template_binding_to_resume_config.sql` 的八条历史迁移，形成可重放基线。
- 删除：`supabase/migrations/init_table.sql`，避免 CLI 跳过和重复建表。
- 重命名：两条本地 `20260816...` 迁移为线上已经应用的 `20260815...` 版本号。
- 创建：`supabase/migrations/*_harden_privileged_function_access.sql`，封堵函数 ACL、默认权限及旧入口。
- 创建：`supabase/migrations/*_harden_base_table_rls.sql`，逐表重建所有者 RLS 与父资源一致性。
- 创建：`supabase/migrations/*_add_ai_credit_reservations.sql`，建立 UTC 日桶、请求流水和额度状态机。
- 创建：`supabase/migrations/*_add_backend_operation_metrics.sql`，建立私有指标与错误事件。
- 创建：`supabase/migrations/*_fix_comment_lock_order_and_function_paths.sql`，修复锁反转并统一函数安全属性。
- 创建：`supabase/migrations/*_move_github_stars_to_edge_cache.sql`，移除数据库外网 IO 和匿名写入口。
- 创建：`supabase/migrations/*_add_backend_maintenance_jobs.sql`，建立清理、对账、调度和监控函数。
- 创建：`supabase/tests/database/001_base_rls.sql`、`002_ai_quota.sql`、`003_comment_concurrency_contracts.sql`、`004_function_security.sql`。

### Edge Function 与客户端

- 创建：`supabase/functions/shared/request-context.ts`，解析/生成请求 ID 并输出结构化日志字段。
- 修改：`supabase/functions/shared/cors.ts`，区分匿名分享与显式来源白名单。
- 创建：`supabase/functions/shared/operation-metrics.ts`，聚合记录受控错误指标。
- 修改：`supabase/functions/llm-proxy/index.ts`，接入预留、交付标记、结算/释放与 usage 透传。
- 修改：`supabase/functions/resume-share/index.ts`、`supabase/functions/resume-comments/index.ts`，贯通请求 ID、结构化错误和 CORS。
- 创建：`supabase/functions/github-stars-refresh/index.ts`，仅使用服务端凭据刷新固定仓库缓存。
- 创建：`supabase/functions/backend-ops-monitor/index.ts`，执行维护并向可选 webhook 发告警。
- 修改：`supabase/config.toml`，登记新增函数且保持函数体内鉴权。
- 修改：`src/lib/llm/call.ts`、`src/lib/ai/agent/agent-loop.ts`、`src/lib/supabase/quota.ts`、`src/store/ai-quota.ts`，传递幂等键和请求 ID，并适配新的额度返回。
- 修改：`src/lib/supabase/github-stars.ts` 与 GitHub Stars 展示组件，改为只读缓存且不允许客户端回写。
- 修改/删除：模板页 community 相关 store、组件和运行时分支，移除跨用户模板读取入口，保留 official 与本人模板。

### 自动化验证与记录

- 创建：`scripts/verify-database-concurrency.ts`，多连接验证锁顺序与死锁重试语义。
- 创建：`scripts/verify-edge-request-context.ts`，验证请求 ID、CORS 和结构化错误映射。
- 创建：`scripts/verify-github-stars-cache.ts`，验证客户端只读及过期缓存降级。
- 修改：`package.json`，增加专项验证脚本。
- 创建：`.github/workflows/database.yml`，执行 fresh reset、pgTAP、catalog 门禁和构建。
- 创建：`docs/superpowers/verification/2026-08-16-backend-risk-optimization.md`，记录命令、退出码、生产部署与未覆盖项。

## 任务 0：冻结基线并建立验收证据

**文件：**

- 创建：`docs/superpowers/verification/2026-08-16-backend-risk-optimization.md`
- 不修改：`src/pages/history/components/detail-panel/detail-header.tsx`
- 不修改：`src/pages/history/components/version-pdf-export/index.tsx`

- [ ] **步骤 1：记录工作区与远端基线**

运行：

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
supabase --version
supabase migration list --linked
```

预期：当前分支为 `feat/be-optimize`；两处 history 页面修改保持未暂存；迁移列表明确显示两条 remote-only 和两条 local-only 版本漂移。

- [ ] **步骤 2：创建验证记录骨架**

写入明确字段：执行时间、提交、Supabase CLI 版本、生产项目 ID、数据库时区、扩展状态、每条门禁的命令/退出码/结论，以及“静态验证不等于浏览器业务验收”的边界。

- [ ] **步骤 3：保存只读权限快照**

通过链接项目执行只读 SQL，记录 `pg_proc.proacl`、表策略、表 grants、迁移版本、扩展与定时任务；结果只记对象名和权限，不记录 JWT、用户 ID、分享 token 或密钥。

- [ ] **步骤 4：提交基线记录**

```bash
git add docs/superpowers/verification/2026-08-16-backend-risk-optimization.md
git commit -m "docs(backend): 记录风险优化实施基线"
```

## 任务 1：恢复可重放迁移基线并对齐账本

**文件：**

- 恢复：`supabase/migrations/20260220021550_create_resume_config.sql`
- 恢复：`supabase/migrations/20260220021702_create_ats.sql`
- 恢复：`supabase/migrations/20260220021731_automerge_documents.sql`
- 恢复：`supabase/migrations/20260220021810_company.sql`
- 恢复：`supabase/migrations/20260321000100_create_resume_config_versions.sql`
- 恢复：`supabase/migrations/20260328090000_add_resume_appearance_to_resume_config.sql`
- 恢复：`supabase/migrations/20260408130000_create_resume_templates.sql`
- 恢复：`supabase/migrations/20260409093000_add_template_binding_to_resume_config.sql`
- 删除：`supabase/migrations/init_table.sql`
- 重命名：`supabase/migrations/20260816000001_grant_resume_share_allow_comments_insert.sql` → `supabase/migrations/20260815164604_grant_resume_share_allow_comments_insert.sql`
- 重命名：`supabase/migrations/20260816000002_add_resume_comment_thread_read_states.sql` → `supabase/migrations/20260815170650_add_resume_comment_thread_read_states.sql`

- [ ] **步骤 1：从删除前提交恢复八条原始迁移**

运行 `git show 8767b5b^:<path>` 检查原文，再用 `apply_patch` 恢复文件；不得用 shell 重定向写文件。

- [ ] **步骤 2：补齐最早迁移依赖**

在最早使用前定义 `public.update_updated_at_column()`；所有触发器依赖必须先于触发器创建。函数采用 `SET search_path = ''`，对象引用使用 `public.<name>` 或 `auth.<name>` 全限定名。

- [ ] **步骤 3：删除失效初始化脚本并对齐文件名**

用 `apply_patch` 删除 `init_table.sql`，用非破坏性文件移动对齐两条线上时间戳；SQL 正文保持不变。

- [ ] **步骤 4：验证迁移账本文件唯一性**

运行：

```bash
find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | sort
supabase migration list --linked
```

预期：没有非时间戳 SQL；相同版本号仅一个文件；remote/local 的两组 20260815 记录名称和版本一致。

- [ ] **步骤 5：执行本地 fresh reset**

运行：

```bash
supabase start
supabase db reset --local
supabase db lint --local --level warning
```

预期：全部迁移从空库成功执行，lint 无新增 error。若本机 Docker 不可用，验证记录明确标记为未执行，不以静态检查替代。

- [ ] **步骤 6：提交可重放基线**

```bash
git add supabase/migrations
git commit -m "fix(database): 恢复可重放迁移基线"
```

## 任务 2：封堵高权限函数与默认执行权

**文件：**

- 创建：`supabase/migrations/*_harden_privileged_function_access.sql`
- 修改：`src/lib/supabase/github-stars.ts`

- [ ] **步骤 1：使用 CLI 创建迁移**

运行：

```bash
supabase migration new harden_privileged_function_access
```

预期：生成唯一时间戳文件，后续 SQL 仅写入该文件。

- [ ] **步骤 2：写入函数 ACL 契约**

迁移必须：

```sql
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role supabase_admin in schema public revoke execute on functions from public, anon, authenticated;
revoke all on function public.check_ai_quota(uuid, integer) from public, anon, authenticated;
revoke all on function public.consume_ai_credits(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_ai_quota(uuid) from public, anon, authenticated;
grant execute on function public.check_ai_quota(uuid, integer) to service_role;
grant execute on function public.consume_ai_credits(uuid, integer) to service_role;
grant execute on function public.get_ai_quota(uuid) to service_role;
```

对 `set_github_stars` 以及已证明无调用/无依赖的八个旧模板 SECURITY DEFINER 函数执行 `REVOKE`；删除动作必须先通过 `pg_depend` 与仓库 `rg` 证明无依赖。所有保留的 SECURITY DEFINER 函数固定 `search_path=''` 并全限定引用。

- [ ] **步骤 3：消除客户端 GitHub Stars 写回**

删除 `setGitHubStars` 导出及调用；读取失败只返回最近缓存/空值，不再以浏览器输入写数据库。

- [ ] **步骤 4：运行 catalog 断言**

断言 public schema 中不存在 `prosecdef=true` 且 `proacl` 对 PUBLIC/anon/authenticated 开放的非白名单函数；断言默认函数权限不再给匿名和登录角色执行权。

- [ ] **步骤 5：提交权限封堵**

```bash
git add supabase/migrations src/lib/supabase/github-stars.ts
git commit -m "fix(database): 封堵高权限函数执行入口"
```

## 任务 3：重建基础表所有者 RLS 并移除社区模板越权面

**文件：**

- 创建：`supabase/migrations/*_harden_base_table_rls.sql`
- 修改：`src/lib/supabase/template/index.ts`
- 修改：`src/lib/resume-template/runtime/get-manifest-from-binding.ts`
- 修改：`src/lib/schema/resume/persisted.ts`
- 修改：`src/pages/template/const.ts`
- 修改：`src/pages/template/store/shared.ts`
- 修改：`src/pages/template/store/index.ts`
- 修改：`src/pages/template/store/user-templates.ts`
- 修改：`src/pages/template/store/workbench/templates-loader.ts`
- 修改：`src/pages/template/store/workbench/template-editor.ts`
- 修改：`src/pages/template/store/workbench/template-publisher.ts`
- 修改：`src/pages/template/store/workbench/types.ts`
- 修改：`src/pages/template/components/workbench/index.tsx`
- 修改：`src/pages/template/components/workbench/workbench-hero.tsx`
- 修改：`src/pages/template/components/workbench/user-template-section.tsx`
- 删除：`src/pages/template/store/community-templates.ts`
- 删除：`src/pages/template/components/workbench/community-template-section.tsx`
- 测试：`supabase/tests/database/001_base_rls.sql`

- [ ] **步骤 1：使用 CLI 创建 RLS 迁移**

```bash
supabase migration new harden_base_table_rls
```

- [ ] **步骤 2：建立迁移前不变量检查**

对每张子表检查孤儿记录、父行所有权冲突和空 `user_id`；发现冲突时迁移用明确异常中止，不自动猜测归属。

- [ ] **步骤 3：逐表清空旧策略并按矩阵重建**

对 `resume_config`、`resume_config_versions`、`ats`、`automerge_documents`、`company`、`resume_templates` 删除所有历史 permissive policy。登录用户策略统一使用 `(select auth.uid())`；子表 `WITH CHECK` 同时验证自身 `user_id` 和父 `resume_config.user_id`。`anon` 不获得基础表 `SELECT/INSERT/UPDATE/DELETE`。

- [ ] **步骤 4：保留分享的受控 Edge 边界**

不向 `anon` 开放 `resume_shares`、release、comment 基表。`resume-share` 和 `resume-comments` 使用 service role 查询后，在函数体内验证分享 token、状态、版本和评论 scope；测试必须证明仅拿到公开 share ID 不能直接从 Data API 读基础数据。

- [ ] **步骤 5：移除社区模板跨用户入口**

将 UI tab 收敛为 `official | mine`，模板来源收敛为 `official | user`。移除 `listPublishedCommunityTemplates`、`getPublishedCommunityTemplateById` 与 community store/component；本人发布状态仍作为本人模板属性保留，但不形成跨用户可见目录。

- [ ] **步骤 6：编写 pgTAP RLS 测试**

`001_base_rls.sql` 至少覆盖：anon 对六类基础表均无权限；用户 A 可 CRUD 本人记录；用户 B 无法读写 A；伪造子表 `user_id` 无法绕过父所有权；service role 仅用于 Edge 契约测试。

- [ ] **步骤 7：运行专项验证**

```bash
supabase test db supabase/tests/database/001_base_rls.sql --local
pnpm exec tsc -b --pretty false
pnpm lint -- src/lib/supabase/template src/lib/resume-template/runtime src/pages/template
```

预期：pgTAP 全通过；类型检查和目标 lint 无新增错误。

- [ ] **步骤 8：提交 RLS 收敛**

```bash
git add supabase/migrations supabase/tests/database/001_base_rls.sql src/lib/supabase/template src/lib/resume-template/runtime src/lib/schema/resume/persisted.ts src/pages/template
git commit -m "fix(database): 收紧基础数据所有者边界"
```

## 任务 4：实现 AI 额度预留流水与 UTC 日桶

**文件：**

- 创建：`supabase/migrations/*_add_ai_credit_reservations.sql`
- 测试：`supabase/tests/database/002_ai_quota.sql`
- 修改：`src/lib/supabase/quota.ts`
- 修改：`src/store/ai-quota.ts`

- [ ] **步骤 1：使用 CLI 创建迁移**

```bash
supabase migration new add_ai_credit_reservations
```

- [ ] **步骤 2：创建数据模型与约束**

建立 `ai_quota_daily_usage(user_id, usage_date, reserved_credits, consumed_credits, updated_at)`，主键 `(user_id, usage_date)`；建立 `ai_credit_requests(id, user_id, idempotency_key, requested_credits, status, delivery_started_at, prompt_tokens, completion_tokens, total_tokens, reserved_at, settled_at, expires_at, request_id)`。约束状态为 `reserved|delivering|completed|released`，并为 `(user_id,idempotency_key)` 建唯一索引。

- [ ] **步骤 3：实现五个 service-role RPC**

实现并只授权 `service_role`：

```sql
public.reserve_ai_credits(p_user_id uuid, p_idempotency_key text, p_credits integer, p_request_id uuid)
public.mark_ai_request_delivery_started(p_request_id uuid, p_user_id uuid)
public.settle_ai_credit_request(p_request_id uuid, p_user_id uuid, p_prompt_tokens integer, p_completion_tokens integer, p_total_tokens integer)
public.release_ai_credit_request(p_request_id uuid, p_user_id uuid, p_reason text)
public.reconcile_expired_ai_credit_requests(p_limit integer default 200)
```

`reserve` 在单事务中锁定 UTC 当日日桶，重复幂等键返回原记录；余额不足不新增预留。`settle` 把 reserved 转 consumed；`release` 只释放尚未 delivery 的请求；已 delivery 的过期请求由 reconciler 结算，未 delivery 的释放。

- [ ] **步骤 4：替换只读额度查询**

`get_ai_quota` 改为普通 `SELECT`，使用 `(timezone('UTC', now()))::date` 计算当日展示值，返回 SQL 计算的下一 UTC 零点 `reset_at`，不使用 `FOR UPDATE`，不在读取路径落库重置。

- [ ] **步骤 5：编写 pgTAP 状态机测试**

覆盖同一幂等键只预留一次、并发最后一份额度只有一个成功、午夜边界按 UTC、未交付释放、已交付结算、settle/release 重试幂等、非法状态跃迁被拒绝、anon/auth 无执行权。

- [ ] **步骤 6：适配客户端额度类型**

前端只通过 llm-proxy 响应和 service-backed quota 读取获得 `remaining/reset_at`；删除接受任意 `user_id` 的浏览器 RPC 参数。Zustand 继续合并 in-flight 刷新，不做轮询。

- [ ] **步骤 7：运行数据库与类型门禁**

```bash
supabase test db supabase/tests/database/002_ai_quota.sql --local
pnpm exec tsc -b --pretty false
pnpm lint -- src/lib/supabase/quota.ts src/store/ai-quota.ts
```

- [ ] **步骤 8：提交额度状态机**

```bash
git add supabase/migrations supabase/tests/database/002_ai_quota.sql src/lib/supabase/quota.ts src/store/ai-quota.ts
git commit -m "feat(ai): 增加原子额度预留与结算"
```

## 任务 5：把 llm-proxy 接入预留、交付与结算

**文件：**

- 修改：`supabase/functions/llm-proxy/index.ts`
- 修改：`src/lib/llm/call.ts`
- 修改：`src/lib/ai/agent/agent-loop.ts`
- 创建：`scripts/verify-edge-request-context.ts`

- [ ] **步骤 1：定义请求协议**

客户端每次逻辑请求生成稳定 `idempotency_key`；网络重试复用该键。代理只接受白名单字段 `model/messages/temperature/max_tokens/stream/stream_options`，强制 `stream_options.include_usage=true`，校验消息长度、积分档位和模型白名单。

- [ ] **步骤 2：在上游调用前原子预留**

从已验证 JWT 获取用户 ID，调用 `reserve_ai_credits`；余额不足返回 402，冲突/非法参数返回 409/400，数据库异常返回 503。不得再使用 `check_ai_quota → upstream → consume`。

- [ ] **步骤 3：实现 SSE 交付边界**

解析 DeepSeek SSE，允许 keep-alive/空行；在第一个有意义的内容 delta 写给浏览器前调用 `mark_ai_request_delivery_started`。正常 `[DONE]` 后用最终 usage 调 `settle_ai_credit_request`；usage 只记录成本分析，不改变固定 1/3 积分。

- [ ] **步骤 4：实现断开与异常补偿**

上游在交付前失败、超时或浏览器取消时调用 `release_ai_credit_request`；交付开始后的中断调用 `settle_ai_credit_request`，若结算 RPC 失败则输出结构化 error 并保留流水给 reconciler，不能只 `console.error` 后丢失。

- [ ] **步骤 5：验证幂等和四类失败**

`verify-edge-request-context.ts` 构造：同键重试、余额不足、上游 429/503、交付前取消、交付后取消、结算 RPC 失败。断言 HTTP 状态、稳定 error code、请求 ID 和流水最终状态。

- [ ] **步骤 6：运行 Edge 与客户端门禁**

```bash
node --experimental-strip-types scripts/verify-edge-request-context.ts
deno check supabase/functions/llm-proxy/index.ts
pnpm exec tsc -b --pretty false
pnpm lint -- supabase/functions/llm-proxy/index.ts src/lib/llm/call.ts src/lib/ai/agent/agent-loop.ts scripts/verify-edge-request-context.ts
```

- [ ] **步骤 7：提交代理事务流**

```bash
git add supabase/functions/llm-proxy/index.ts src/lib/llm/call.ts src/lib/ai/agent/agent-loop.ts scripts/verify-edge-request-context.ts
git commit -m "fix(ai): 接入额度预留与流式结算"
```

## 任务 6：统一请求上下文、结构化指标与 CORS

**文件：**

- 创建：`supabase/functions/shared/request-context.ts`
- 修改：`supabase/functions/shared/cors.ts`
- 创建：`supabase/functions/shared/operation-metrics.ts`
- 创建：`supabase/migrations/*_add_backend_operation_metrics.sql`
- 修改：`supabase/functions/llm-proxy/index.ts`
- 修改：`supabase/functions/resume-share/index.ts`
- 修改：`supabase/functions/resume-comments/index.ts`

- [ ] **步骤 1：创建指标迁移**

```bash
supabase migration new add_backend_operation_metrics
```

建立 `private.backend_operation_metrics` 分钟桶和受限 `private.backend_error_events`；仅 `service_role` 可执行聚合写 RPC，事件字段禁止存请求正文、JWT、用户 ID、分享 token 和简历内容。

迁移同时确保 `pg_stat_statements` 已启用（不固定扩展版本）；只授予运维函数读取所需统计的最小权限，不向 `anon` 或 `authenticated` 暴露原始查询文本。慢查询验收使用规范化 queryid、调用次数、总耗时和均值，不持久化可能含业务值的原始语句。

- [ ] **步骤 2：实现共享请求上下文**

解析合法 UUID `x-request-id`，否则生成 `crypto.randomUUID()`；响应始终返回该头。日志结构固定包含 `request_id/function/operation/outcome/error_code/status/duration_ms`。

- [ ] **步骤 3：实现按函数 CORS 策略**

`resume-share` 保留 `Access-Control-Allow-Origin: *`；`llm-proxy` 与 `resume-comments` 从 `ALLOWED_ORIGINS` 解析精确来源，允许无 Origin 的非浏览器调用，预检拒绝不在白名单中的 Origin，并添加 `Vary: Origin`。

- [ ] **步骤 4：接入三项 Edge Function**

所有错误映射为稳定 code；数据库 `40P01` 映射为可重试冲突并计数；四类核心告警指标为 AI 结算失败、评论事务失败/死锁、分享读取失败、维护任务失败。

- [ ] **步骤 5：验证数据库慢查询观测**

执行只读查询确认 `pg_stat_statements` 可用，并验证运维汇总只返回规范化指标，不向客户端角色暴露查询正文；记录最慢关键 RPC 的 calls、mean/max execution time 作为部署前基线。

- [ ] **步骤 6：运行请求上下文验证**

```bash
node --experimental-strip-types scripts/verify-edge-request-context.ts
deno check supabase/functions/llm-proxy/index.ts supabase/functions/resume-share/index.ts supabase/functions/resume-comments/index.ts
```

预期：合法请求 ID 贯通、非法值被替换、白名单匹配精确、分享匿名 CORS 不变、敏感字段未进入结构化日志。

- [ ] **步骤 7：提交可观测性与 CORS**

```bash
git add supabase/functions/shared supabase/functions/llm-proxy supabase/functions/resume-share supabase/functions/resume-comments supabase/migrations
git commit -m "feat(backend): 统一请求追踪与安全响应"
```

## 任务 7：修复评论锁顺序并统一函数安全属性

**文件：**

- 创建：`supabase/migrations/*_fix_comment_lock_order_and_function_paths.sql`
- 创建：`supabase/tests/database/003_comment_concurrency_contracts.sql`
- 创建：`supabase/tests/database/004_function_security.sql`

> 权限边界补充：必须保留 `resume-comments` 对跨账号 `collaborator` 会话的注册、加入、续租与 bootstrap 授权。任何持链接的登录用户默认可编辑共享简历并评论，但 Edge 必须校验签名 token、当前用户绑定、session/member 有效期、撤销状态、角色和精确的 resume/version/scope；A/B 账号负向契约验证该能力不能横向读取 owner 的其他数据。
- 创建：`scripts/verify-database-concurrency.ts`

- [ ] **步骤 1：创建函数加固迁移**

```bash
supabase migration new fix_comment_lock_order_and_function_paths
```

- [ ] **步骤 2：重写已知锁反转路径**

所有评论写路径遵守 `request → rate limit → resume root → version → scope → thread → comment/event → read state`。`sync_resume_version_comment_document_v3` 不得先锁 scope 再调用锁 version 的函数；通过拆分“取行并锁定”和“业务校验”使 create-next 与 sync 使用相同顺序。

- [ ] **步骤 3：统一函数属性**

对业务函数 inventory 分类：保留者统一 volatility、SECURITY INVOKER/DEFINER、`SET search_path=''` 与全限定名；无仓库调用、无数据库依赖的旧函数明确 DROP。触发器函数也必须固定路径。

- [ ] **步骤 4：编写 pgTAP catalog 契约**

断言 SECURITY DEFINER 白名单、ACL 白名单、所有 public 函数 search_path、RLS 策略数量、无 `PUBLIC SELECT true`、关键 FK/唯一约束及分享评论匿名不直连基表。

- [ ] **步骤 5：编写多连接并发验证**

脚本使用两个数据库连接同步发起 create-next 与 sync、重复评论请求与限流请求；每组至少 20 轮，统计成功、可重试冲突、`40P01`、P50/P95/max。验收为无死锁，幂等结果一致。

- [ ] **步骤 6：运行安全与并发门禁**

```bash
supabase test db supabase/tests/database/003_comment_concurrency_contracts.sql --local
supabase test db supabase/tests/database/004_function_security.sql --local
node --experimental-strip-types scripts/verify-database-concurrency.ts
```

- [ ] **步骤 7：提交并发与函数加固**

```bash
git add supabase/migrations supabase/tests/database scripts/verify-database-concurrency.ts
git commit -m "fix(database): 统一锁顺序与函数安全属性"
```

## 任务 8：建立数据库 fresh-reset 与 CI 门禁

**文件：**

- 创建：`.github/workflows/database.yml`
- 修改：`package.json`
- 修改：`supabase/tests/database/001_base_rls.sql`
- 修改：`supabase/tests/database/002_ai_quota.sql`
- 修改：`supabase/tests/database/003_comment_concurrency_contracts.sql`
- 修改：`supabase/tests/database/004_function_security.sql`

- [ ] **步骤 1：增加本地统一命令**

`package.json` 增加：

```json
{
  "verify:database": "supabase db reset --local && supabase test db --local && node --experimental-strip-types scripts/verify-database-concurrency.ts",
  "verify:edge-context": "node --experimental-strip-types scripts/verify-edge-request-context.ts",
  "verify:github-stars": "node --experimental-strip-types scripts/verify-github-stars-cache.ts"
}
```

- [ ] **步骤 2：创建数据库 CI**

workflow 固定 Supabase CLI 主版本，启动本地栈，执行 fresh reset、`supabase db lint --local --level warning`、全部 pgTAP、catalog 测试、并发脚本、TypeScript 构建和目标 lint。任何一步失败阻止合并。

- [ ] **步骤 3：验证 workflow 语法与完整门禁**

```bash
pnpm verify:database
pnpm verify:edge-context
pnpm exec tsc -b --pretty false
pnpm build
git diff --check
```

- [ ] **步骤 4：提交 CI**

```bash
git add .github/workflows/database.yml package.json supabase/tests scripts
git commit -m "test(database): 增加迁移与并发契约门禁"
```

## 任务 9：将 GitHub Stars 移到 Edge 定时缓存

**文件：**

- 创建：`supabase/migrations/*_move_github_stars_to_edge_cache.sql`
- 创建：`supabase/functions/github-stars-refresh/index.ts`
- 修改：`supabase/config.toml`
- 修改：`src/lib/supabase/github-stars.ts`
- 修改：实际引用 GitHub Stars 的展示组件
- 创建：`scripts/verify-github-stars-cache.ts`

- [ ] **步骤 1：创建缓存迁移**

```bash
supabase migration new move_github_stars_to_edge_cache
```

固定单仓库键 `506-FETL/resume`；删除接受任意 owner/repo/stars 的浏览器写函数；提供无参数只读函数或受 RLS 保护的单行读取。确认没有依赖后删除数据库 `http_get` 路径，最后 `drop extension if exists http`。

- [ ] **步骤 2：实现刷新函数**

函数不接受任意仓库输入，从服务端常量读取仓库；可选使用 `GITHUB_TOKEN`，设置上游超时、`If-None-Match`、ETag 和稳定 User-Agent。只有 service role 写 `stars/count/etag/fetched_at/last_error_at`。

- [ ] **步骤 3：实现前端 stale-while-error**

客户端只读取缓存：新鲜值直接展示，过期值仍可展示但不写回；无缓存时隐藏数字而不伪造 0。移除所有 `set_github_stars` 调用。

- [ ] **步骤 4：验证缓存安全**

脚本断言匿名不能写、不能选择任意 repo、GitHub 304 不更新时间错误状态、GitHub 429/超时保留旧值、响应不泄露 token。

- [ ] **步骤 5：运行门禁并提交**

```bash
pnpm verify:github-stars
deno check supabase/functions/github-stars-refresh/index.ts
pnpm exec tsc -b --pretty false
git add supabase/migrations supabase/functions/github-stars-refresh supabase/config.toml src/lib/supabase/github-stars.ts scripts/verify-github-stars-cache.ts
git commit -m "refactor(github): 改用Edge定时刷新星标缓存"
```

## 任务 10：实现临时数据清理、额度对账与运维告警

**文件：**

- 创建：`supabase/migrations/*_add_backend_maintenance_jobs.sql`
- 创建：`supabase/functions/backend-ops-monitor/index.ts`
- 修改：`supabase/config.toml`

- [ ] **步骤 1：创建维护迁移**

```bash
supabase migration new add_backend_maintenance_jobs
```

- [ ] **步骤 2：建立小批量清理函数**

每次按主键/时间索引删除有限行数：已完成幂等请求保留 48 小时，限流桶保留 48 小时，错误事件按规格保留，AI 请求流水按审计周期保留。函数返回各表删除数量和耗时，避免长事务。

- [ ] **步骤 3：建立调度**

启用 `pg_cron` 和 `pg_net` 时不固定扩展版本；cron 名称稳定、迁移可幂等重建。维护函数定期执行清理与 `reconcile_expired_ai_credit_requests`；HTTP 调度只调用固定 Edge URL，认证值从 Vault 读取，不把 token 写进迁移正文。

- [ ] **步骤 4：实现告警函数**

`backend-ops-monitor` 汇总最近窗口四类错误率、死锁、维护失败和积压。配置 `OPS_ALERT_WEBHOOK_URL` 时发送脱敏 webhook；未配置时输出结构化 warning 并返回 `delivery_configured=false`，不得声称外部告警已经接通。

- [ ] **步骤 5：验证索引和批量边界**

用 `EXPLAIN (ANALYZE, BUFFERS)` 验证清理过滤走索引；插入超过单批上限的测试数据，确认一次只删限定数量，多轮最终清空且不删除活跃请求。

- [ ] **步骤 6：提交维护任务**

```bash
git add supabase/migrations supabase/functions/backend-ops-monitor supabase/config.toml
git commit -m "feat(backend): 增加定时清理与对账告警"
```

## 任务 11：完整本地验证与代码审查

**文件：**

- 修改：`docs/superpowers/verification/2026-08-16-backend-risk-optimization.md`

- [ ] **步骤 1：从空库运行完整验证**

```bash
supabase db reset --local
supabase db lint --local --level warning
supabase test db --local
pnpm verify:database
pnpm verify:edge-context
pnpm verify:github-stars
deno check supabase/functions/llm-proxy/index.ts supabase/functions/resume-share/index.ts supabase/functions/resume-comments/index.ts supabase/functions/github-stars-refresh/index.ts supabase/functions/backend-ops-monitor/index.ts
pnpm exec tsc -b --pretty false
pnpm lint
pnpm build
git diff --check
```

逐条记录实际退出码；若全量 lint 存在既有基线，记录完整输出并另跑本次文件目标 lint，不能把目标 lint 说成全量通过。

- [ ] **步骤 2：执行权限负向矩阵**

使用 anon、用户 A、用户 B 和 service role 四类会话验证：A/B 互相不可见；anon 不能直连任何基础表；有效分享凭据仅能经 Edge 读取指定快照并在指定评论 scope 操作；伪造/过期/撤销 token 均失败。

- [ ] **步骤 3：执行 AI 故障矩阵**

验证并发最后额度、重复幂等键、DeepSeek 400/401/402/422/429/500/503、交付前/后断流、结算 RPC 失败和超时 reconciler；核对日桶守恒式 `reserved + consumed` 与流水一致。

- [ ] **步骤 4：进行实现审查**

使用 `requesting-code-review` 技能审查规格覆盖、安全边界、迁移可回滚性、错误处理和测试真实性；修复必须项后重跑受影响门禁。

- [ ] **步骤 5：提交验证记录**

```bash
git add docs/superpowers/verification/2026-08-16-backend-risk-optimization.md
git commit -m "docs(backend): 记录风险优化验证结果"
```

## 任务 12：分阶段部署到已链接 Supabase 项目

**文件：**

- 修改：`docs/superpowers/verification/2026-08-16-backend-risk-optimization.md`

- [ ] **步骤 1：再次核对生产状态与回滚点**

确认项目 ID、当前远端迁移版本、函数版本、UTC 时区、扩展和活跃 cron；导出 schema-only 快照/迁移状态作为回滚证据，不导出或记录业务数据与密钥。

- [ ] **步骤 2：修复八条历史迁移账本**

仅当逐一验证线上对应表、列、约束已存在时，对八个恢复版本执行：

```bash
supabase migration repair --linked --status applied <version>
```

先用 `--dry-run` 可用路径或再次 `migration list --linked` 核对目标；绝不把尚未存在的结构标为 applied。

- [ ] **步骤 3：部署数据库迁移**

```bash
supabase db push --linked --dry-run
supabase db push --linked
supabase migration list --linked
```

预期：dry-run 只包含本计划的新迁移；应用后 local/remote 账本一致。

- [ ] **步骤 4：配置服务端秘密与调度**

配置 `ALLOWED_ORIGINS`、可选 `GITHUB_TOKEN`、随机维护 token；同一维护 token 分别写 Edge secret 与 Vault，命令输出不得回显其值。`OPS_ALERT_WEBHOOK_URL` 存在时接通告警，否则在验收记录中明确“外部投递未配置”。

- [ ] **步骤 5：部署 Edge Function**

```bash
supabase functions deploy llm-proxy --project-ref bitxrpdtlohlnywgusfw
supabase functions deploy resume-share --project-ref bitxrpdtlohlnywgusfw
supabase functions deploy resume-comments --project-ref bitxrpdtlohlnywgusfw
supabase functions deploy github-stars-refresh --project-ref bitxrpdtlohlnywgusfw
supabase functions deploy backend-ops-monitor --project-ref bitxrpdtlohlnywgusfw
```

函数体继续自行校验 JWT/分享凭据；不能因为 `verify_jwt=false` 而跳过认证。

- [ ] **步骤 6：执行生产只读验收和最小业务 smoke**

重新查询 ACL/RLS/catalog/cron/扩展；执行本人数据读取、有效分享快照、匿名分享评论、AI 一次 1 分和一次 3 分请求、GitHub Stars 只读缓存。禁止在生产创建跨用户探测数据；负向矩阵使用预先授权的测试账户。

- [ ] **步骤 7：观察部署后窗口**

检查结构化日志与指标：AI 结算失败、评论死锁 `40P01`、分享错误率、维护失败、超时流水积压。出现越权、额度守恒破坏或迁移异常时立即停止后续动作并按对应迁移/函数版本回滚。

- [ ] **步骤 8：提交最终部署记录**

```bash
git add docs/superpowers/verification/2026-08-16-backend-risk-optimization.md
git commit -m "docs(backend): 记录生产部署与验收"
```

## 任务 13：最终一致性检查

**文件：**

- 检查：本计划列出的全部文件
- 检查：两处用户自有 history 页面修改未被纳入任何本任务提交

- [ ] **步骤 1：核对规格覆盖**

逐条映射 11 项原始风险和新增基础表 RLS 风险到具体迁移、测试、指标与回滚证据；任何一项缺少代码或验收都不能标记完成。

- [ ] **步骤 2：核对提交边界**

```bash
git status --short --branch
git log --oneline --decorate -15
git diff --name-only upstream/feat/be-optimize...HEAD
```

确认没有提交 `src/pages/history/components/detail-panel/detail-header.tsx` 和 `src/pages/history/components/version-pdf-export/index.tsx` 的用户改动；不执行 `git push`。

- [ ] **步骤 3：按 verification-before-completion 复核证据**

只把实际运行且退出码为 0 的门禁描述为“通过”；浏览器、真实匿名评论和生产告警投递若未执行，明确列为剩余验收而不是推断完成。

## 完成定义

只有同时满足以下条件才可宣布全部优化完成：

1. Fresh reset、pgTAP、catalog、并发、Edge 类型检查、前端类型检查与构建均有当前提交上的证据。
2. 生产迁移账本 local/remote 一致，ACL/RLS 的只读查询符合访问矩阵。
3. AI 流水在成功、重试、断流和结算失败路径下保持额度守恒。
4. 有效分享凭据仍能读取指定快照并评论；无凭据/越 scope/跨用户基础表均失败。
5. GitHub Stars 浏览器路径只读，数据库事务中不再发外网请求。
6. 定时清理、AI 对账和指标监控已调度；未配置 webhook 时明确记录投递缺口。
7. 用户原有未提交修改保持原样；没有执行 `git push`。
