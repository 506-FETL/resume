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

实施后的目标是：`anon` 对基础表没有直接读写；`authenticated` 仅直接操作本人及父资源同属本人的记录；跨用户访问只允许有效分享凭据访问指定快照/评论域，或有效协作链接持有者经会话与租约校验编辑绑定的共享文档并评论。

### 临时表规模

实施前只记录聚合计数：

| 表 | 总行数 | 48 小时前行数 |
| --- | ---: | ---: |
| `resume_comment_requests` | 151 | 67 |
| `resume_comment_rate_limits` | 32 | 7 |

## 验证矩阵

| 阶段 | 命令或场景 | 退出码/结果 | 结论 |
| --- | --- | --- | --- |
| 迁移基线 | 隔离 Supabase 项目两次 `supabase db reset --linked --no-seed --yes` | `0` / `0` | 两次均从空库完整应用 41 条迁移；不再以本机 Docker 缺失代替数据库证据 |
| SQL lint | 隔离项目 `supabase db lint --linked --level warning --fail-on error` | `0` | 0 error；保留 2 条既有 warning：协作 resolver 未使用参数、bootstrap 的 STABLE/VOLATILE 标注 |
| pgTAP | 隔离项目直接执行 `supabase/tests/database/*.sql` 并汇总 TAP | 两次均 `83/83`、0 failures | 基础 RLS 8、AI 22、锁序 10、函数安全 11、维护 32；每次都在 fresh reset 后执行 |
| 并发 | 隔离项目 pooler 直连 20 轮 | `0` | 版本竞态 36 success/4 retryable/0 deadlock；幂等与限流各 40/40 success、0 deadlock；维护锁竞争安全跳过 |
| Edge | `pnpm run verify:edge-context` / `pnpm run verify:edge-auth` | `0` / `0` | request ID、CORS、函数体鉴权顺序静态契约通过；不等于 Deno 运行时或真实浏览器验收 |
| GitHub 缓存 | `pnpm verify:github-stars` | `0` | 固定仓库、只读前端和受控 Edge 刷新静态契约通过 |
| 维护任务 | `pnpm verify:maintenance` | `0` | TTL、批量、Vault、Cron、告警及 webhook 脱敏静态/行为契约通过 |
| TypeScript | `pnpm exec tsc -b --pretty false` | `0` | 应用类型检查通过 |
| 目标 lint | CI 文件白名单 ESLint | `0`（3 warnings） | 本轮后端文件无 error；保留既有 Fast Refresh warning |
| 全量 lint | `pnpm lint` | `1` | 仓库既有 `.superpowers` 产物等产生 4141 errors；不把目标 lint 通过扩大为全仓通过 |
| Deno | `pnpm dlx deno-bin@2.2.7 check ...` | `0` | 五个 Edge 入口全部通过 Deno 类型检查 |
| 构建 | `pnpm build` | `0` | 生产构建通过；仍有既有循环 chunk/大 chunk warning |
| 生产 ACL/RLS | 只读 catalog 查询 | 未执行 | 部署后更新 |
| 真实分享/评论 | 浏览器业务 smoke | 未执行 | 部署后更新 |
| 真实 AI 断流 | 浏览器/网络故障注入 | 未执行 | 部署后更新 |
| 外部 webhook | 告警投递 | 未配置/未执行 | 有 webhook secret 后更新 |

## 部署记录

生产尚未部署。隔离验证使用的临时项目均已显式删除，`supabase projects list` 只剩生产项目 `bitxrpdtlohlnywgusfw` 且已重新链接。这里将在任务 12 记录迁移 dry-run、账本 repair、数据库迁移、Edge Function 版本、cron/Vault 配置、生产只读核验与 smoke 结果。

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
- `postgres` 所有者的默认函数权限不再向 PUBLIC、anon、authenticated 自动授予 EXECUTE；托管迁移角色无法修改平台所有者 `supabase_admin` 的默认 ACL，因此平台对象由显式业务函数 inventory 排除，全部业务 RPC 继续由逐签名 ACL 与 catalog 契约覆盖。
- 八个无仓库调用点、无数据库依赖的旧模板函数保留对象但撤销浏览器执行权。
- 旧模板函数属于线上历史漂移、空库迁移链不创建；ACL 收紧改为 catalog 驱动的“对象存在才执行”，兼顾生产封堵与 fresh reset。
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
## 任务 7：评论锁顺序、函数安全与协作会话保留

- 已将评论写入和已读操作的请求幂等标识作为第一把事务级 advisory lock；版本文档同步统一按 `resume root → active version → comment scope` 加锁，并为冲突路径设置 3 秒 `lock_timeout`。
- 已通过只读链接库 catalog 查询确认迁移中重命名/包装的五个关键函数签名与生产现状一致；该检查退出码为 `0`，没有执行迁移或写入生产数据。
- public/private SQL 与 PL/pgSQL 函数统一固定 `search_path=''`，默认撤销 PUBLIC/anon/authenticated/service_role 执行权，再按浏览器所有者 API 与 Edge service API 显式白名单授权。
- 实时协作功能保持完整：协作链接持有者登录后可加入会话、编辑共享 Automerge 文档并以协作者身份读写评论；会话、成员租约、用户绑定、角色与 scope/version 仍由 Edge 逐项校验。
- 跨用户访问只保留两类显式授权边界：不可变分享 release 及其评论 scope，以及有效实时协作会话对应的单份简历与评论 scope；两者都不能读取其他用户数据。
- 新增 `003_comment_concurrency_contracts.sql`、`004_function_security.sql` 和 20 轮多连接并发脚本，覆盖锁顺序、幂等、死锁、函数 ACL、默认权限、私有 schema 与评论/分享基表不可直连。
- `pnpm run verify:comment-service`、`pnpm run verify:edge-context`、`pnpm run verify:edge-auth`、`pnpm exec tsc -b --pretty false`、本次文件目标 ESLint 和 `git diff --check`：退出码均为 `0`。
- 两个 pgTAP 文件与并发脚本的动态执行退出码均为 `1`：本地 `127.0.0.1:54322` 拒绝连接，根因仍是本机无 Docker/Podman；测试代码已落地，但 fresh-reset、真实 SQL 执行和 20 轮并发结果仍是部署前硬门禁，不能记为通过。

## 任务 8：Fresh reset 与 CI 门禁

- `package.json` 已固定 pnpm `10.33.3`，并增加 `verify:database` 与预留给任务 9 的 `verify:github-stars` 统一命令。
- 新增 GitHub Actions 数据库契约 workflow：固定 Node 24、pnpm 10.33.3、Supabase CLI 2.111.0，并将 checkout、setup-node、pnpm 与 Supabase setup action 固定到已核对的 commit SHA；workflow 仅授予 `contents: read`。
- CI 在 Ubuntu Docker runner 上执行 `supabase db start → fresh reset → 全部 pgTAP → 20 轮并发 → db lint → Edge 安全契约 → TypeScript → 目标 ESLint → production build`，任一步非零均阻止合并。
- `001_base_rls.sql` 的模板夹具已改为最终约束允许的 `private`；`002_ai_quota.sql` 的测试日桶改为显式 UTC 日期，不再依赖 session/database timezone。
- YAML 通过当前 Ruby/Psych 实际解析，workflow 与 `package.json` 通过 Prettier；首次错误来自当前 Psych 不支持 `safe_load_file` 且 Prettier 无 SQL parser，改用同库 `safe_load(File.read(...))` 并只检查支持的文件后退出码为 `0`。
- CI 目标 ESLint 退出码 `0`，保留 3 条既有 React Fast Refresh warning；扩大到整个 editor 目录会命中与本任务无关的 import-order 既有错误，因此 workflow 使用明确文件白名单。
- `pnpm build` 退出码 `0`，保留既有 Tiptap/Radix 循环 chunk 和大 chunk warning。
- `pnpm verify:database` 本机退出码 `1`，失败于 `supabase db reset --local` 的 `LegacyDbBootstrapError: failed to inspect service`；CI 文件已建立，但尚未在 GitHub runner 上产生 fresh-reset/pgTAP/并发通过证据。

## 任务 9：GitHub Stars Edge 缓存

- 迁移将 `github_stars` 收敛为固定 `506-fetl/resume` 单行缓存，浏览器仅有 SELECT；旧参数化 get/set RPC 被删除，无参读取函数使用 SECURITY INVOKER，`http` 扩展仅以 RESTRICT 语义删除。
- 只读链接库预检确认当前缓存只有一条目标仓库记录、没有非目标仓库记录，因此固定仓库约束不会丢弃或猜测迁移现有数据。
- `github-stars-refresh` 只接受 POST、空对象请求体和独立 maintenance bearer token；仓库 URL 固定在服务端，使用 5 秒超时、ETag/304、严格非负整数校验，失败只更新失败元数据而不覆盖最后成功 stars。
- 前端改为无参只读缓存；删除浏览器直连 GitHub 和客户端回写。缓存缺失/损坏/读取失败时隐藏该非核心展示，不把未知值显示为 0；陈旧缓存继续展示最后成功值。
- `pnpm run verify:github-stars`、目标 ESLint、`pnpm exec tsc -b --pretty false`、`git diff --check` 与 `pnpm build`：退出码均为 `0`；build 仍只有既有循环 chunk/大 chunk warning。
- 任务 9 完成时本机未预装 Deno；任务 10 已通过临时 Deno CLI 补做类型检查。本地 Supabase 数据库仍不可用，因此迁移执行和真实 GitHub 200/304/限流故障注入尚未动态验证，部署前仍需 fresh reset 和隔离环境 smoke。

## 任务 10：定时清理、额度对账与运维告警

- 新增私有维护配置、运行历史、告警状态和 AI usage 日聚合；临时清理与 Edge 外呼默认关闭，迁移应用时不会立即删除数据或请求外网。
- 清理函数使用事务 advisory lock、每表 100–5000 行上限、`FOR UPDATE SKIP LOCKED`、2 秒锁超时和 30 秒语句超时。锁超时记 skipped、语句超时记 failed；幂等/限流数据保留 48 小时。过期 member 先分批删除，仅在无 member 后删除过期 session，避免级联突破批量上限；有效协作会话及其编辑、评论能力不受影响。
- AI pending 只由 5 分钟 reconciler 最终化，通用清理不直接删除；已最终化流水保留 180 天并先按 UTC quota date、action、final state 聚合，再删除明细。
- `pg_cron` 建立固定名称的 AI 对账、Edge 响应对账、小时清理、每日 catch-up、运维 monitor 和每 6 小时 GitHub refresh；Edge 外呼仅允许两个固定函数名，URL 与维护 token 从 Vault 读取，网络超时 10 秒。入队只记 queued，响应对账联合响应表与请求队列：仍排队的陈旧请求保持 queued 并告警，只有响应和队列都不存在时才记 missing。Supabase 托管的 pg_net 对象由 `supabase_admin` 管理，平台 ACL 不能作为唯一隔离证据；Data API exposed schemas 已显式排除 `net`/`private`，且 public RPC 不允许调用任意 URL，部署时另以 `Accept-Profile: net` 做云端拒绝验证。
- 告警覆盖 AI 结算失败、评论服务错误/死锁、分享读取错误、维护连续 3 次失败/AI pending 积压/连续满批，以及 GitHub 缓存陈旧；同一 active alert 外部通知冷却 1 小时。
- `backend-ops-monitor` 仅接受带 maintenance bearer 的 POST 空对象；可选 webhook 只允许 HTTPS，载荷只含固定告警 code、计数、布尔状态与窗口。未配置 webhook 时结构化 warning 且不 ack，不声称已接通外部投递。
- 新增 32 项 pgTAP 维护契约，除 101 条过期错误事件的 100 行单批上限、AI 流水聚合与重复收敛外，还覆盖 public RPC 不得调用任意 pg_net URL、2xx/401/超时/缺失响应最终化、有效协作 session/member 保留、101 个过期协作 member 的分批清理、空 session 删除，以及 blocked/边界限流桶保留。并发脚本另覆盖清理 advisory lock 竞争。隔离项目两次 fresh reset 后五组 pgTAP 均为 83/83、0 failures。
- `pnpm run verify:maintenance`、`pnpm run verify:github-stars`、评论/Edge 三项既有 verifier、目标 ESLint、`pnpm exec tsc -b --pretty false`、`git diff --check`、SQL parser 与五个 Edge 入口的 Deno check：退出码均为 `0`。
- `pnpm build`：退出码 `0`，仍只有既有循环 chunk/大 chunk warning。隔离链接库 lint 为 0 error、2 条既有 warning；`Accept-Profile: net` 使用临时项目 secret key 探测返回 HTTP 406 / `PGRST106 Invalid schema: net`。外部 webhook 未配置，因此真实投递仍不声称已验收。

## 任务 11：隔离环境完整数据库验证

- Supabase 组织为 Free plan，preview branch 创建返回 402；改用组织剩余的免费项目名额创建一次性隔离项目，没有复制生产数据。最终验证项目 `eobtugytjmeevirfrsgn` 只写入迁移和合成夹具，验证完成后已不可恢复地删除；随后重新链接生产项目并确认项目列表只剩生产。
- 动态重放过程中发现并修复：托管迁移角色不能修改 `supabase_admin` 默认 ACL；生产漂移函数不能成为空库依赖；`greatest`/`extract`/`position` 不能当普通 `pg_catalog` 函数限定；RLS helper 在 deny-by-default ACL 后需给 authenticated 精确 EXECUTE；AI `INSERT ... RETURNING` 冲突时布尔变量为 NULL，必须 `coalesce` 进入幂等重放；锁序测试应检查真实锁定顺序；TAP catalog 扫描必须排除 aggregate。
- 正式 20 轮使用 `pg` 独立连接直连隔离 pooler，避免 Management API 临时登录角色与随机响应 boundary 污染并发结果。复审后进一步收紧脚本：直连 URL 必须显式选择 `linked`、匹配显式非生产项目 ref、当前链接项目、Supabase pooler 主机和 `postgres` 数据库；生产 ref 在连接前硬拒绝。直连还必须通过 `DATABASE_CONCURRENCY_CA_CERT_PATH` 提供项目 CA，启用证书链与主机名校验，拒绝 URL 中全部 query/fragment 覆盖项，并从已验证的 URL 组件构造客户端而非继续传入原始连接串。此前 20 轮是在已验证为一次性非生产项目、启用 TLS 但未校验证书链的条件下采集；结果保留为并发行为证据，不再作为最终传输安全配置的验收证据。
- 并发结果：版本竞态 40 个事务中 36 success、4 retryable、0 deadlock，P50 1643.4 ms、P95 1942.5 ms、max 1994.4 ms；幂等 40/40 success、0 deadlock，P50 1703.8 ms、P95 2013.3 ms、max 2051.5 ms；限流 40/40 success、0 deadlock，P50 1653.3 ms、P95 1896.1 ms、max 2284.8 ms；维护 cleanup advisory lock 竞争返回 `skipped_already_running`。
- 完成动态验证后的新鲜本地门禁：维护/GitHub/comment/Edge verifier、目标 ESLint、`tsc -b`、Deno 五入口 check、production build、`git diff --check` 全部退出 0。build 保留既有循环 chunk/大 chunk warning；数据库 lint 保留上述 2 条既有 warning。
- 最终实现审查发现并修复直连并发脚本的三项门禁缺口：仅设置 DB URL 可绕过 `linked` 检查、原始 URL query 可覆盖连接目标/TLS、cleanup 失败未影响退出码。修复后要求显式隔离项目 ref、当前链接一致、项目 CA 与证书/主机校验，拒绝全部 query/fragment，并对夹具删除及读回结果做硬断言。复审未发现剩余 Critical/Important；目标 ESLint、`tsc -b` 与工作树/index diff-check 均退出 `0`。

## 任务 12：生产部署前回滚点与只读预检

- 已确认链接项目为 `bitxrpdtlohlnywgusfw`；远端迁移账本与本地在 `20260815170650` 前一致，八条早期恢复迁移仅在本地账本出现，七条本轮迁移尚未应用。
- 逐项只读 catalog 检查确认八条恢复迁移对应的核心表、列和 helper 已在线上存在，因此后续只能修复历史账本，不能重放其 SQL。
- 生产数据库 `TimeZone=UTC`；部署前尚未安装 `pg_cron`/`pg_net`，也不存在 `cron.job`，与新增维护迁移的前置状态一致。
- Supabase CLI 的常规 dump 路径因本机无 Docker 不可用，Free plan 也未提供可列出的物理/PITR 备份。安装本地 `libpq 18.6` 后，通过 CLI 短期登录角色与本地 `pg_dump --schema-only` 生成真实逻辑回滚点；文件为 `supabase/.temp/backups/2026-08-16-pre-backend-risk-schema.sql`（gitignored），大小 250084 bytes，包含 29 个 schema/table/function/type/sequence/view DDL，且无 `COPY`/`INSERT`，SHA-256 为 `b6bec2041d99709d9b4a2cd01c99b7556897aca953583bf96abde40370fa3704`。
- 部署前 Edge 基线：`llm-proxy` v30、`resume-share` v22、`resume-comments` v18；`github-stars-refresh` 与 `backend-ops-monitor` 尚未部署。秘密列表仅核对名称，未回显或记录原值；`APP_ALLOWED_ORIGINS` 与 `BACKEND_MAINTENANCE_TOKEN` 尚未配置。

## 任务 12：生产部署与动态验收

- 对八条已通过 catalog 逐项确认的早期迁移执行 `migration repair --status applied`；再次列账后八条 local/remote 对齐。`db push --dry-run` 精确只列出本轮七条迁移，无 seed/roles；正式 push 退出码 `0`，最终 41 条迁移全部 local/remote 对齐。
- 生产迁移后确认 `TimeZone=UTC`、`pg_stat_statements`/`pg_cron`/`pg_net` 已安装、遗留 `http` 扩展与 `set_github_stars` RPC 已删除。六个受管 cron 均 active；AI 对账、Edge 响应对账、运维 monitor、GitHub refresh 已实际 `succeeded`，小时/每日清理在首次计划时刻前为 `not_run_yet`，另已手工执行同一有界清理函数验证。
- 清理启用前预览命中 75 条过期评论幂等记录、12 条过期限流桶，协作 session/member 候选均为 0。启用 `cleanup_enabled=true` 与 `edge_jobs_enabled=true` 后单批处理 87 条、`batchLimitHit=false`、耗时 34 ms；实时协作总量前后均为 7 个 session、2 个 member。
- 随机 64 字符维护 token 同时写入 Edge secret `BACKEND_MAINTENANCE_TOKEN` 与 Vault `resume_backend_maintenance_token`；项目 URL 写入 Vault，`APP_ALLOWED_ORIGINS=https://506resume.vercel.app`。命令与记录仅保留名称，不回显值。没有现成 `OPS_ALERT_WEBHOOK_URL`，因此外部 webhook 投递仍未配置；内部告警求值、告警状态、结构化日志和指标已启用，且无 webhook 时不会错误 ack。
- 五个 Edge Function 均部署为 ACTIVE 且 `verify_jwt=false`：`llm-proxy` v33、`resume-share` v24、`resume-comments` v20、`github-stars-refresh` v1、`backend-ops-monitor` v1；认证继续由函数体执行。无 maintenance token 的两个维护端点均返回 401；最终版 `llm-proxy` 无认证 POST 返回 401 / `auth_invalid`，恶意 Origin 预检返回 403 且无 allow-origin；`resume-comments` 的恶意 Origin 预检同为 403；公开 `resume-share` 预检为 200 且保留 wildcard。
- `private`/`net` 的 Data API 探测均返回 406 / `PGRST106`；anon 直读 owner 简历表与协作会话表均返回 401 / `42501`。生产 catalog 同时确认所有应用 SQL 函数固定空 `search_path`、PUBLIC/anon 无 SECURITY DEFINER 执行权、private schema 无客户端 USAGE、六张 owner 表均启用 RLS 且没有无条件读取策略。
- AI 生产 smoke 使用一次性已确认账号执行非流式 1 分 chat 与 3 分 ATS 请求，均返回 200；日桶为 used=4、remaining=16，两条流水均 `settled/completed` 且 debit 合计 4。随后删除临时账号并确认 auth、日桶、AI 流水全部级联清空。另由生产直接使用的纯分类函数覆盖 DeepSeek 400/401/402/422/429/500/503 映射，断流前/后分别映射 `none`/`partial`；数据库 22 项 AI pgTAP 覆盖预留、幂等、交付标记、结算、释放与超时对账。
- 公开分享/匿名评论 smoke 使用一次性合成简历：不可变 release 读取、评论 bootstrap、32 字节 base64url 匿名身份、锚点评论写入均成功。锚点从 Edge 返回的 release snapshot 使用共享核心算法在客户端侧重建；bootstrap 仅返回脱敏 `nodeKey`。账号、简历、分享、release、scope/thread/comment 全部级联删除，按设计独立保留的两条幂等记录与对应限流桶再按固定 request id/actor bucket 精确删除；最终零残留。
- 实时协作 smoke 使用两个一次性登录账号：owner 注册 session 返回 200，链接持有者加入返回 200 且服务端角色为 `editor`；Realtime/comment bootstrap 与协作者评论写入均为 200。协作者用自身 JWT 直读 owner `resume_config` 返回 200 空数组，证明链接授权未扩展到 owner 基表。清理后合成用户/简历/session/member/comment/幂等桶均为 0，原有 7 个 session、2 个 member 保持不变。
- GitHub 定时刷新及手工 dispatch 均成功，固定缓存行为 `506-fetl/resume`、`consecutive_failures=0`、无错误码；anon 新只读 RPC 返回 200，旧任意参数写 RPC 返回 404 / `PGRST202`。Edge dispatch 两条均由 queue/response 对账收敛为 `succeeded`。
- 部署后 15 分钟告警快照：AI 结算失败、评论死锁/错误、分享错误、cron/维护失败、过期 pending、陈旧 dispatch 全部为 0，active alerts 与 notifications due 均为 0。生产 `db lint --level warning` 退出码 `0`、0 error，仅保留 1 条既有 unused parameter warning。

## 任务 13：风险覆盖与最终一致性

| 原始风险 | 代码与迁移 | 契约、动态验收与回滚证据 |
| --- | --- | --- |
| AI 计费与上游调用非原子 | `20260816073703_add_ai_credit_reservations.sql`；`llm-proxy` 原子预留、交付标记、结算/释放与超时对账 | `002_ai_quota.sql` 22 项、上游 400/401/402/422/429/500/503 与断流状态 verifier、生产 1 分/3 分请求守恒 |
| 缺统一可观测性 | `20260816074307_add_backend_operation_metrics.sql`、共享 request context、维护告警与结构化 operation metrics | request-id/Edge verifier、六类 cron 实跑、15 分钟关键错误率与积压均为 0；外部 webhook 未配置的缺口显式保留 |
| SQL 逻辑难测试 | 五组 pgTAP、并发验证器与固定版本 CI | 两次隔离项目 fresh reset，pgTAP 83/83；workflow 对数据库、Edge、应用和构建建立硬门禁 |
| 额度重置时区不一致 | AI 日桶和额度 RPC 显式使用 UTC 日期并由 SQL 返回 reset 时刻 | AI pgTAP、生产 `TimeZone=UTC`、生产 1 分/3 分 smoke |
| `get_ai_quota()` 只读路径取行锁 | `20260816073703_add_ai_credit_reservations.sql` 将展示读取改为无锁计算，落库重置只在预留路径 | AI pgTAP 与生产 catalog 确认 lock-free、显式 UTC |
| pgsql-http 在事务内访问 GitHub | `20260816084543_move_github_stars_to_edge_cache.sql` 与 `github-stars-refresh`；删除 `http` 扩展及任意写 RPC | GitHub verifier、cron/手工 refresh 成功、新读 RPC 200、旧写 RPC 404 |
| 幂等/限流表无清理 | `20260816170453_add_backend_maintenance_jobs.sql` 的 48 小时有界清理、日聚合与 180 天 AI 明细保留 | `005_maintenance_contracts.sql`、清理锁竞争、生产预览后单批安全清理 87 条且协作数据不变 |
| 评论加锁顺序仅靠约定 | `20260816080301_fix_comment_lock_order_and_function_paths.sql` 统一 scope/version 锁序 | `003_comment_concurrency_contracts.sql`；20 轮版本、幂等、限流竞态均 0 deadlock，`40P01` 已进入指标 |
| 登录函数 CORS 过宽 | 共享 CORS 按函数类型区分：登录态函数显式来源白名单，公开分享继续 wildcard | Edge auth verifier；生产恶意 Origin 对 `llm-proxy`/评论为 403，公开分享为 200 |
| 初始化 SQL 无法从零重放 | 删除非标准 `init_table.sql`，恢复八条时间戳迁移并修正历史迁移依赖 | 两次空项目 41 条迁移重放；生产逐项 catalog 确认后 repair，最终 local/remote 41 条一致；部署前 schema-only 快照可回滚 |
| `search_path` 历史不统一 | `20260816072550` 与 `20260816080301` 统一空 `search_path` 和全限定引用 | `004_function_security.sql` 与生产 catalog 确认全部应用函数满足；生产 lint 0 error |
| 新增核验：基础表 RLS 越权面 | `20260816072828_harden_base_table_rls.sql` 收紧六张 owner 表、模板与 helper ACL；分享/协作只经受控 Edge capability | `001_base_rls.sql`、`004_function_security.sql`、生产 anon/跨用户 Data API 负向验证；公开分享评论及双账号实时协作正向 smoke 均通过 |

- 最终重新查询远端迁移账本，41 条迁移 local/remote 全部一致；生产 `db lint --level warning` 再次退出 `0`，仍只有既有 `private.resolve_resume_comment_bootstrap_access_v1` 未使用参数 warning。
- 最终 `llm-proxy` v33 部署退出 `0`，上传内容明确包含新增 `core.ts`；部署后函数列表为上述五个 ACTIVE 版本，无认证/恶意来源 smoke 分别返回预期的 401/403。
- 隔离环境及生产 smoke 都只使用合成账号/简历/请求；各次 finally 或精确补偿清理后已读回确认零夹具残留，原有实时协作总量维持 7 个 session、2 个 member。未读取或记录真实用户数据与 token。
- 两个用户自有 history 页面文件始终未暂存、未进入本任务提交；未执行 `git push`。当前缺口只有未提供 `OPS_ALERT_WEBHOOK_URL`，因此不能声称外部告警投递已接通；内部告警求值、状态、指标与日志已上线。
