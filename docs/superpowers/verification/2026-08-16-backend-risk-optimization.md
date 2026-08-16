# 后端风险优化验证记录

## 验证边界

- 计划：`docs/superpowers/plans/2026-08-16-backend-risk-optimization.md`
- 分支：`feat/be-optimize`
- 实施起点：`7e3b3930969fe52088ef909163080505e1de37ea`
- 上游：`upstream/feat/be-optimize`
- Supabase 项目：`bitxrpdtlohlnywgusfw`（`us-east-1`）
- Supabase CLI：`2.111.0`
- 数据库：PostgreSQL `17.6.1.021`
- 记录时间：2026-08-16（Asia/Shanghai）

本记录只保存对象、权限、计数、命令和退出码，不保存 JWT、用户 ID、分享 token、简历内容或服务密钥。静态检查、Node/HTTP 验证和数据库契约均不能替代真实浏览器交互；生产 smoke 结果将在部署阶段单独记录。

## 用户工作区保护

实施开始前存在下列用户自有未提交修改，本计划不修改、不暂存、不提交：

- `src/pages/history/components/detail-panel/detail-header.tsx`
- `src/pages/history/components/version-pdf-export/index.tsx`

## 实施前基线

### Git 与迁移账本

命令：

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
supabase --version
supabase migration list --linked
```

结果：退出码 `0`。

- 当前分支比上游领先 3 个文档提交。
- `init_table.sql` 因不符合 `<timestamp>_<name>.sql` 被 CLI 明确跳过。
- 线上独有迁移：`20260815164604`、`20260815170650`。
- 本地独有迁移：`20260816000001`、`20260816000002`。
- 最早被账本追踪的本地/线上迁移均为 `20260528000001`；八条更早的真实建表迁移不在当前工作树和线上账本中。

### 项目与 Edge Function

通过 Supabase 管理接口只读核验：

- 项目状态：`ACTIVE_HEALTHY`。
- 数据库时区：`UTC`。
- `llm-proxy`：版本 30，ACTIVE，`verify_jwt=false`。
- `resume-share`：版本 22，ACTIVE，`verify_jwt=false`。
- `resume-comments`：版本 18，ACTIVE，`verify_jwt=false`。

三项函数当前依赖函数体内鉴权；部署后必须继续验证 JWT 或分享凭据，不得把 `verify_jwt=false` 解释为匿名放行。

### 扩展

只读核验：

| 扩展 | 实施前状态 |
| --- | --- |
| `pg_stat_statements` | 已安装，1.11 |
| `http` | 已安装，1.6 |
| `pg_cron` | 可用但未安装 |
| `pg_net` | 可用但未安装 |
| `pgtap` | 可用但未安装 |

### 高权限函数

实施前确认：

- `check_ai_quota(uuid, integer)`、`consume_ai_credits(uuid, integer, text)` 对 `anon`、`authenticated`、`service_role` 均有 EXECUTE，且接受任意用户 ID。
- `get_ai_quota()` 对 `anon`、`authenticated`、`service_role` 均有 EXECUTE，并使用 `search_path=public`。
- `get_github_stars(text, text)` 和 `set_github_stars(text, text, integer)` 对 `anon`、`authenticated`、`service_role` 均有 EXECUTE；后者允许调用者提交任意仓库和星标数。
- 八个旧模板 SECURITY DEFINER 函数存在 PUBLIC/anon/authenticated 执行权且未固定 `search_path`。
- `postgres` 与 `supabase_admin` 在 public schema 的默认函数权限均自动授予 `anon`、`authenticated`、`service_role` EXECUTE。

### RLS 与表授权

实施前确认以下高风险策略：

- `resume_config`：存在 public `SELECT true` 和 authenticated `ALL true`。
- `resume_config_versions`：存在 public `SELECT true` 和 authenticated `INSERT true`。
- `ats`：存在 public `SELECT true` 和 authenticated `INSERT true`。
- `automerge_documents`：存在 anon/authenticated 任意 SELECT/INSERT/UPDATE。
- `resume_templates`：存在 public `SELECT true`、authenticated `INSERT true` 和 `DELETE true`。
- `company` 的策略按用户过滤，但底层 grants 仍过宽，需与其他基础表一起最小化。
- 评论基表 `resume_comments`、`resume_comment_threads` 当前只授权 `service_role`，应保持该边界。

实施后的目标是：`anon` 对基础表没有直接读写；`authenticated` 仅操作本人及父资源同属本人的记录；跨用户访问只允许持有效分享凭据经 `resume-share` / `resume-comments` Edge Function 读取指定快照和读写指定评论域。

### 临时表规模

实施前只记录聚合计数：

| 表 | 总行数 | 48 小时前行数 |
| --- | ---: | ---: |
| `resume_comment_requests` | 151 | 67 |
| `resume_comment_rate_limits` | 32 | 7 |

## 验证矩阵

| 阶段 | 命令或场景 | 退出码/结果 | 结论 |
| --- | --- | --- | --- |
| 迁移基线 | `supabase start` / `supabase db reset --local` | `1` / 未执行 | 本机无 Docker/Podman；不得记为通过，部署前需在隔离环境补验 |
| SQL lint | `supabase db lint --linked --level warning` | `0` | 线上现有旧模板/会话函数有 8 个 error、2 个 warning；任务 2/7 处理后复跑 |
| pgTAP | `supabase test db supabase/tests/database/003_comment_concurrency_contracts.sql --local` / `004_function_security.sql` | `1` / `1` | 本地 54322 无数据库；测试已写但未动态执行 |
| 并发 | `node --experimental-strip-types scripts/verify-database-concurrency.ts` | `1` | 本地数据库不可用；20 轮并发尚无运行证据 |
| Edge | `pnpm run verify:edge-context` / `pnpm run verify:edge-auth` | `0` / `0` | request ID、CORS、函数体鉴权顺序静态契约通过；不等于 Deno 运行时或真实浏览器验收 |
| GitHub 缓存 | `pnpm verify:github-stars` | 未执行 | 实施任务 9 更新 |
| TypeScript | `pnpm exec tsc -b --pretty false` | `0` | 当前任务 7 工作树类型检查通过；任务 11 将在最终提交重跑 |
| 全量 lint | `pnpm lint` | 未执行 | 实施任务 11 更新 |
| 构建 | `pnpm build` | 未执行 | 实施任务 11 更新 |
| 生产 ACL/RLS | 只读 catalog 查询 | 未执行 | 部署后更新 |
| 真实分享/评论 | 浏览器业务 smoke | 未执行 | 部署后更新 |
| 真实 AI 断流 | 浏览器/网络故障注入 | 未执行 | 部署后更新 |
| 外部 webhook | 告警投递 | 未配置/未执行 | 有 webhook secret 后更新 |

## 部署记录

尚未部署。这里将在任务 12 记录迁移 dry-run、账本 repair、数据库迁移、Edge Function 版本、cron/Vault 配置、生产只读核验与 smoke 结果。

## 任务 1：迁移基线恢复

- 已恢复八条真实历史迁移，并在最早迁移中前置 `update_updated_at_column()` 与 `uuid-ossp`。
- 已删除 CLI 不会执行且重复建表的 `init_table.sql`。
- 已将本地两条 20260816 文件名对齐为线上 `20260815164604` / `20260815170650`；此后 `migration list --linked` 只剩八条预期的历史 local-only 版本。
- 已移除 `resume_config` 上不会改变行值的 AFTER `resume_config_updated` 触发器；生产对象将在新迁移中显式删除。
- `supabase start` 失败证据：`docker: command not found (podman also not found)`。因此 fresh reset 仍是部署前硬门禁。
- 链接库 lint 证实旧模板函数引用不存在字段/表或类型不匹配，`cleanup_expired_sessions` 引用不存在的 `sync_sessions`；这些不是迁移恢复引入的问题，将按函数 inventory 删除或修复。

## 任务 2：高权限函数封堵

- 已用 Supabase CLI 创建 `harden_privileged_function_access` 迁移。
- AI 内部 check/consume RPC 仅保留 service role；无参 quota 读取仅保留 authenticated/service role。
- 默认函数权限不再向 PUBLIC、anon、authenticated 自动授予 EXECUTE。
- 八个无仓库调用点、无数据库依赖的旧模板函数保留对象但撤销浏览器执行权。
- GitHub 通用读取在发起 HTTP 前强制匹配 `506-FETL/resume`；浏览器共享缓存写回已删除。
- `pnpm exec tsc -b --pretty false`：退出码 `0`。
- 目标 ESLint：退出码 `0`；动画原语文件受仓库 ignore 规则影响，使用 `--no-warn-ignored` 后在任务 3 的组合目标 lint 中通过。

## 任务 3：基础表 RLS 与模板边界

线上迁移前聚合检查：

- `ats.user_id` 空值：0。
- ATS、协作文档、版本、公司、派生简历父引用的所有者冲突：均为 0。
- 当前简历及历史版本中的 community 模板 binding：均为 0（同时检查 camelCase/snake_case 快照键）。
- 四条 identity sequence 均存在：`resume_config_id_seq`、`resume_config_versions_id_seq`、`ats_id_seq`、`resume_templates_id_seq`。

实现结果：

- 六类基础表清空历史 permissive policy 后重建 authenticated owner-only 策略。
- child insert/update 通过不接受任意 user ID 的 private SECURITY DEFINER helper 校验父简历属于当前 JWT 用户，避免自引用 RLS 递归。
- anon 无基础表及 share/release/comment 基表直接 DML；分享跨用户访问仍只能走 Edge。
- `resume_templates.visibility` 数据与约束收敛为 `private`；社区目录、发布控件、community store/API 和跨用户运行时读取已移除。
- 遗留 `community` binding 类型只用于识别旧数据，运行时直接返回 `null`，不会查询其他用户模板。
- `pnpm exec tsc -b --pretty false`：退出码 `0`。
- 模板/RLS 相关目标 ESLint（含 `--no-warn-ignored`）：退出码 `0`。
- `supabase test db supabase/tests/database/001_base_rls.sql --local`：退出码 `1`，原因是本地 54322 无数据库容器；测试文件已创建但尚未动态执行。

## 任务 4–6：AI 预留结算、请求追踪与 CORS

- 已建立 UTC 日桶、AI request ledger 及 reserve/mark/settle/release/reconcile RPC；固定 1/3 积分规则不变，token usage 仅用于成本观测。
- `llm-proxy` 改为「鉴权 → 原子预留 → DeepSeek → 首个有意义内容前持久化 delivery started → 完成/部分结算」；上游失败或未交付释放预留，结算失败单独记入可告警指标。
- 已强制上游流返回 usage，并补齐非流式 `message` 返回的有效内容判定；对外错误不再返回 DeepSeek/数据库原始正文。
- 三个 Edge Function 已统一 UUID `X-Request-Id`、`Server-Timing`、Edge region、结构化脱敏日志和后台指标写入；验证期间发现并修复 request ID UUID 正则遗漏连字符的问题。
- `resume-share` 保留公开 CORS，但只返回指定分享的当前不可变 release 快照和短期评论凭据；owner 写分支仍校验 JWT、所有权和限流。
- `llm-proxy` / `resume-comments` 使用 `APP_ALLOWED_ORIGINS` 精确白名单；生产默认域为 `https://506resume.vercel.app`，无 Origin 的非浏览器请求仍需通过原业务鉴权。
- 评论数据库 `40P01` 已映射为可重试 `database_deadlock`，同时保留 SQLSTATE 仅用于脱敏指标。
- `pnpm run verify:edge-context`、`pnpm run verify:edge-auth`、目标 ESLint、`pnpm exec tsc -b --pretty false` 和 `git diff --check`：退出码均为 `0`。
- 本机无 `deno`，因此 `deno check` 未执行；SQL pgTAP/fresh reset 仍受 Docker/Podman 缺失阻断，不记为通过。

## 任务 7：评论锁顺序、函数安全与协作会话退役

- 已将评论写入和已读操作的请求幂等标识作为第一把事务级 advisory lock；版本文档同步统一按 `resume root → active version → comment scope` 加锁，并为冲突路径设置 3 秒 `lock_timeout`。
- 已通过只读链接库 catalog 查询确认迁移中重命名/包装的五个关键函数签名与生产现状一致；该检查退出码为 `0`，没有执行迁移或写入生产数据。
- public/private SQL 与 PL/pgSQL 函数统一固定 `search_path=''`，默认撤销 PUBLIC/anon/authenticated/service_role 执行权，再按浏览器所有者 API 与 Edge service API 显式白名单授权。
- 跨账号实时协作已三层退役：浏览器不再展示或自动加入协作会话，编辑器不再接受 `docUrl` 加载外部 Automerge 文档，`resume-comments` 删除协作者签发/续租/访问实现并对历史操作及 `accessKind=collaborator` 固定返回 403；数据库迁移撤销全部存量租约并在 bootstrap resolver 再次拒绝协作者参数。
- 分享快照和分享评论未被移除：客户端评论访问类型只保留 owner/share，匿名身份仍严格绑定分享的 version scope。
- 新增 `003_comment_concurrency_contracts.sql`、`004_function_security.sql` 和 20 轮多连接并发脚本，覆盖锁顺序、幂等、死锁、函数 ACL、默认权限、私有 schema 与评论/分享基表不可直连。
- `pnpm run verify:comment-service`、`pnpm run verify:edge-context`、`pnpm run verify:edge-auth`、`pnpm exec tsc -b --pretty false`、本次文件目标 ESLint 和 `git diff --check`：退出码均为 `0`。
- 两个 pgTAP 文件与并发脚本的动态执行退出码均为 `1`：本地 `127.0.0.1:54322` 拒绝连接，根因仍是本机无 Docker/Podman；测试代码已落地，但 fresh-reset、真实 SQL 执行和 20 轮并发结果仍是部署前硬门禁，不能记为通过。
