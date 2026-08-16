# GitHub Stars Edge 缓存设计

## 背景

当前 `get_github_stars(owner, repo)` 在用户请求的数据库事务中通过 `pgsql-http` 请求 GitHub。慢请求或超时会占用数据库连接和事务；通用 owner/repo 参数还允许调用者制造任意外网请求与缓存 key。

`set_github_stars` 允许浏览器把任意非负数写回共享表，存在缓存投毒和表膨胀。P0 权限规格会先撤销该写入口，并把读取限制为固定 `506-FETL/resume`。本设计完成后续架构收口：数据库只保存/读取缓存，网络 I/O 全部移到受保护的 Edge Function 和定时任务。

## 目标

- 用户请求路径不在 PostgreSQL 事务内访问外网。
- 只维护应用自己的 `506-FETL/resume` 一条缓存，不提供通用 SSRF/缓存 API。
- 浏览器只读缓存，永远不能提交 star 数或触发刷新。
- 定时刷新可重试、可观测、失败时保留最后成功值。
- 部署切换期间站点头部不因缓存迁移而中断。
- 确认无依赖后移除 `http` 扩展。

## 非目标

- 不构建通用 GitHub 仓库统计服务。
- 不把 star 数作为核心业务一致性数据；短期陈旧可以接受。
- 不让每个客户端在 stale 时直接刷新共享缓存。
- 不把 GitHub token 放到数据库表、前端环境变量或日志。

## 方案比较

### 方案 A：保留数据库 HTTP，只缩短 timeout

能降低最坏阻塞时间，但网络 I/O 仍占数据库事务和连接，无法解决职责边界。

### 方案 B：浏览器直接请求 GitHub，不做共享缓存

实现简单，但每个访问者都消耗 GitHub 限额，受 CORS/网络波动影响，且无法统一观测。

### 方案 C：定时 Edge 刷新 + 数据库只读单行缓存（采用）

官方推荐的 Supabase Cron/pg_net 调度 Edge 模式让外部请求异步化；Edge 负责超时、状态码和 JSON 校验，数据库只做原子 upsert 与公开只读。

## 数据模型与读取接口

`public.github_stars` 收敛为固定单行模型：

- `repo text primary key`，check 约束只能为 `506-fetl/resume`。
- `stars integer not null check (stars >= 0)`。
- `fetched_at timestamptz not null`。
- `etag text null`，限制长度，用于 GitHub 条件请求。
- `last_attempt_at timestamptz null`。
- `consecutive_failures integer not null default 0`。

新增无参 `get_app_github_stars()`，只做稳定 SELECT，返回 `repo/stars/fetched_at/stale`。函数优先使用 SECURITY INVOKER；表仅允许 `anon/authenticated` SELECT 固定行，所有写入只允许 service role。

旧 `get_github_stars(text,text)` 在前端完成切换后删除，避免继续暴露通用参数接口。`set_github_stars` 同时删除，不保留浏览器兼容入口。

## Edge 刷新函数

新增 `github-stars-refresh`：

- 只接受 POST。
- 使用独立 maintenance token 鉴权；不接受普通用户 JWT、publishable key 或匿名请求触发刷新。
- 仓库 owner/name 是服务端常量，不从请求 body 读取。
- 使用 5 秒 AbortSignal timeout、固定 User-Agent 和 GitHub JSON Accept header。
- 可选 `GITHUB_TOKEN` 只存在 Edge secrets；没有 token 时仍可用公开 API。
- 读取当前 ETag 并发送 `If-None-Match`。
- 200 时严格验证 `stargazers_count` 为安全非负整数，再通过 service role upsert。
- 304 时只更新 `fetched_at/last_attempt_at` 并清零失败计数。
- 403/429/5xx/timeout/JSON 错误不覆盖最后成功 stars，只增加失败计数并记录稳定错误类别。

Edge 日志和指标使用统一 request context；不记录 Authorization、GitHub token 或完整响应正文。

## 调度

使用 Supabase Cron 每 6 小时通过 `pg_net` 异步调用 Edge Function。项目 URL 和 maintenance token 存入 Vault，cron SQL 只读取 decrypted secret 构造请求，不把 secret 写进迁移文件。

job 使用稳定名称，迁移部署时先按名称 unschedule 旧 job，再 schedule 新定义，保证重复部署不产生多份任务。部署后手动安全调用一次完成 cache prime，再切换前端读取。

若某环境没有 `pg_cron/pg_net/Vault`，部署检查应明确失败并阻止切换；不回退到数据库同步 HTTP 或匿名客户端写回。

## 前端行为

- `src/lib/supabase/github-stars.ts` 改为调用无参只读 RPC。
- 组件删除 stale 时浏览器 fetch GitHub 并调用 `setGithubStars` 的路径。
- 有缓存时始终展示最后成功值；stale 不打扰用户，可仅保留可访问性友好的隐藏诊断状态。
- 无缓存或读取失败时静默隐藏/显示 0，GitHub stars 不是核心页面阻断条件。

## 扩展清理

完成函数切换后从 catalog 检查 `http` 扩展依赖。确认没有其他函数、view 或任务使用时，执行不带 CASCADE 的 `DROP EXTENSION IF EXISTS http`。如果仍有依赖，迁移应失败并列出依赖，不能用 CASCADE 强删。

`pg_net` 只用于 cron 异步调用 Edge，不参与用户数据库事务；`pg_cron` 只运行受控 job。

## 失败与告警

- 单次刷新失败：保留旧值，记录 warning，不重试风暴。
- 连续 3 次失败或缓存超过 24 小时：触发运维告警。
- GitHub 403/429：记录 rate_limited，等待下一周期；不让浏览器集体补刷。
- 数据库 upsert 失败：记录 `github_cache_write_failed` 并告警。
- 定时任务 12 小时没有成功 attempt：监控任务触发 `github_refresh_missing`。

## 部署顺序

1. P0 先撤销公开 set，限制旧 get 为固定仓库。
2. 创建新只读函数、Edge refresh、Vault secret 和 cron job。
3. 手动调用 refresh，验证缓存成功。
4. 前端切换无参读取并删除浏览器 fallback。
5. 删除旧 get/set 函数。
6. catalog 确认后删除 `http` 扩展。

## 验证与验收

- 匿名和登录用户只能读取固定缓存，不能写入或触发 refresh。
- 任意 owner/repo 参数接口不存在。
- refresh 的 200、304、403/429、5xx、timeout、非法 JSON 均有确定行为。
- 失败不会把 stars 覆盖为 0，也不会更新为调用者提供的值。
- 数据库活跃会话中不再出现 `extensions.http`；用户读取只执行普通 SELECT。
- cron 只有一个稳定命名 job，Vault/Edge secrets 不出现在仓库与日志。
- `http` 扩展删除前依赖数为 0，删除后站点头部仍能显示缓存。
- 24 小时陈旧与连续失败告警能被模拟触发。

## 回滚

- 新 Edge/cron 可先部署而不切前端；异常时停止 job，不影响旧固定仓库只读。
- 前端切换失败可回到旧的纯缓存读取函数，但不能恢复数据库 HTTP 或公开 set。
- `http` 扩展最后删除；若确有未识别依赖，停止删除并修正依赖，不使用 CASCADE。
- cache 行可重建，不做破坏性数据恢复。

## 参考

- [Supabase Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [GitHub REST API Rate Limits](https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api)
