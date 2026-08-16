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
| 迁移基线 | `supabase db reset --local` | 未执行 | 实施任务 1 更新 |
| SQL lint | `supabase db lint --local --level warning` | 未执行 | 实施任务 1 更新 |
| pgTAP | `supabase test db --local` | 未执行 | 实施任务 8 更新 |
| 并发 | `pnpm verify:database` | 未执行 | 实施任务 8 更新 |
| Edge | `pnpm verify:edge-context` | 未执行 | 实施任务 6 更新 |
| GitHub 缓存 | `pnpm verify:github-stars` | 未执行 | 实施任务 9 更新 |
| TypeScript | `pnpm exec tsc -b --pretty false` | 未执行 | 实施任务 11 更新 |
| 全量 lint | `pnpm lint` | 未执行 | 实施任务 11 更新 |
| 构建 | `pnpm build` | 未执行 | 实施任务 11 更新 |
| 生产 ACL/RLS | 只读 catalog 查询 | 未执行 | 部署后更新 |
| 真实分享/评论 | 浏览器业务 smoke | 未执行 | 部署后更新 |
| 真实 AI 断流 | 浏览器/网络故障注入 | 未执行 | 部署后更新 |
| 外部 webhook | 告警投递 | 未配置/未执行 | 有 webhook secret 后更新 |

## 部署记录

尚未部署。这里将在任务 12 记录迁移 dry-run、账本 repair、数据库迁移、Edge Function 版本、cron/Vault 配置、生产只读核验与 smoke 结果。
