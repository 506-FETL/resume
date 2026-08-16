# 临时状态数据生命周期与定时清理设计

## 背景

幂等请求、限流桶、协作租约和运维错误事件只在短时间窗内有意义，但当前多张表只增不减。线上只读统计显示：

- `resume_comment_requests` 151 行，其中 67 行已超过 48 小时，未完成行 0。
- `resume_comment_rate_limits` 32 行，其中 7 行已超过 48 小时不再活跃。

当前规模很小，不需要立即分区；但如果没有生命周期契约，流量增长后会增加索引、vacuum、备份和故障恢复成本。

## 目标

- 为每类临时状态定义业务有效期、审计保留期和安全删除条件。
- 使用 `pg_cron` 定时、小批量、可重入清理，不把大 DELETE 放进用户事务。
- 清理不删除仍可能被重试、仍在阻断窗口或仍有效的会话。
- 记录每次清理的表、删除数、耗时和错误类别，不记录 key/user/share 内容。
- 给出何时才需要月分区的量化阈值，避免当前低流量过度设计。

## 非目标

- 不清理用户业务记录、评论正文、简历、发布批次或历史版本。
- 不把计费流水当作普通幂等缓存立即删除；AI ledger 有更长审计周期。
- 不以 `TRUNCATE`、无界 DELETE 或 CASCADE 作为常规定时任务。
- 不通过浏览器或公开 RPC 触发清理。

## 方案比较

### 方案 A：查询时顺便删除

无需调度，但把维护写入用户请求事务，增加锁等待和尾延迟，也可能在高峰期放大。

### 方案 B：数据库 `pg_cron` 分批清理（采用）

删除条件接近数据，事务短、可重复执行；Supabase 托管项目官方支持 pg_cron。外部通知和网络 I/O 不放在清理 SQL 内。

### 方案 C：立刻按月分区全部临时表

当前只有百级行数，会显著增加迁移、唯一约束和查询复杂度。先做 TTL 与规模监控，达到阈值再分区。

## 生命周期矩阵

| 数据 | 有效期/保留期 | 删除条件 |
| --- | --- | --- |
| `resume_comment_requests` | 48 小时 | `completed_at` 非空且早于 cutoff；异常残留的 NULL response 同样超过 48 小时后删除 |
| `resume_comment_rate_limits` | 48 小时无活动 | window 已结束、`blocked_until` 为空或早于 cutoff、`updated_at` 早于 cutoff |
| `resume_share_rate_limits` | 48 小时无活动 | window 与 block 均过期；父 share 删除仍由 FK cascade |
| `resume_share_owner_rate_limits` | 48 小时无活动 | window 与 block 均过期 |
| collaboration sessions/members | 24 小时宽限 | `expires_at` 或 `revoked_at` 早于 24 小时 cutoff；先分批删过期 member，仅在 session 已无 member 时再删 session，禁止用 FK cascade 绕过批量上限 |
| AI `pending` request | 15 分钟 | 不由通用 DELETE；先由 AI reconciler settle/release |
| AI finalized request | 180 天 | settled/released/rejected 且 finalized_at 早于 cutoff；先保留聚合 usage |
| `backend_error_events` | 7 天 | created_at 早于 cutoff |
| `backend_operation_metrics` | 30 天 | bucket_minute 早于 cutoff |
| alert state | 单行最新状态 | resolved 且 90 天无更新 |

若现有 share rate-limit 表缺少 `updated_at/window_seconds`，迁移补充这些列并在 consume 函数每次尝试时更新，避免只凭固定窗口猜测是否仍活跃。

## 清理函数

新增 `private.cleanup_backend_transient_data_v1(p_batch_size integer default 1000)`，仅允许 postgres/受控 cron 执行：

- `SECURITY DEFINER SET search_path=''`，所有对象全限定。
- batch size 限制 100–5000。
- 每张表通过主键/ctid 子查询选择最旧且满足 cutoff 的有限行，再 DELETE。
- 表与表之间使用独立短事务更理想；如果 pg_cron 只能调用单函数，则单次每表最多一批并设置 statement/lock timeout。
- 返回 JSON 统计仅包含每表删除数和总耗时，不包含被删 key。
- 使用 PostgreSQL advisory lock 或稳定 job 锁，避免同一清理任务重叠执行；获取不到锁就安全退出。
- `lock_timeout` 单独记为 skipped/warning，`statement_timeout` 单独记为 failed；不能依赖不会捕获 `QUERY_CANCELED` 的 `WHEN OTHERS`。

AI pending reconciliation 与物理删除分离。任何 pending 行必须先被状态机最终化，通用清理绝不直接减/删额度请求。

## 调度

- 每小时执行一次 transient cleanup。
- 每 5 分钟执行 AI pending reconciler。
- 每日低峰执行一次更大批次 catch-up，但仍有单次上限。
- `pg_net` 外呼只记为 queued；每分钟同时读取 `net._http_response` 与 `net.http_request_queue`。2xx、非 2xx、传输错误和超时按响应最终化；只有超过 2 分钟且响应表、请求队列都不存在时才记 missing。仍在队列中的陈旧请求保持 queued 并触发积压告警，异步入队成功不得记作 Edge 任务成功。

job 名称固定且迁移幂等：部署前按名称 unschedule 旧 job，再 schedule 新 job。启用 `pg_cron` 时不指定扩展版本，以符合当前 Supabase 扩展策略。

启用 `pg_net` 后对 `net` schema、表、序列和原始网络函数执行 best-effort 撤权；Supabase 托管环境可能由 `supabase_admin` 在扩展安装后恢复平台 ACL，因此不可把该 REVOKE 当作唯一边界。强制边界是 Data API 的 exposed schemas 明确只含 `public`、`storage`、`graphql_public`，不得包含 `net` 或 `private`；`public` schema 不提供任何可调用任意 URL 的包装 RPC，只有 postgres 所有者执行的固定名称私有包装函数能够外呼。部署验收必须用 `Accept-Profile: net` 证明 Data API 拒绝该 schema。

## 索引与 vacuum

为清理 predicate 建最小时间索引：

- requests 的 `(completed_at)` partial index。
- rate-limit 的 `(updated_at)` 或等价活动时间索引。
- sessions 的 `(expires_at)`/`(revoked_at)`。
- AI ledger 的 `(state, finalized_at/expires_at)`。
- metrics/error 的时间索引。

避免为低基数字段单独建索引。清理采用小批次并让 autovacuum 正常回收；不在 cron 中执行 `VACUUM FULL` 或阻塞性 REINDEX。

## 分区触发条件

当前不分区。任一高增长流水表同时满足以下条件时另开分区规格：

- 行数 ≥ 1,000,000 或表+索引 ≥ 1 GiB；
- 每日新增 ≥ 100,000 且连续 14 天；
- TTL DELETE 的 P95 超过 2 秒或持续造成 autovacuum 压力。

届时只对按时间追加、查询按时间窗的流水表按月 range partition；小型 rate-limit 当前状态表仍不分区。

## 可观测性与失败处理

- 每次 job 记录 started/completed/failed、删除总数和 duration 到运维指标。
- 成功清理额外持久化各表删除数的脱敏 JSON；只含固定表名和计数，不含请求、用户、分享或会话标识。
- 单次失败由下个周期重试；连续 3 次失败告警。
- 删除数达到 batch 上限连续 3 次标记 backlog warning，提示增大频率而不是无限增大事务。
- lock timeout 视为 skipped/warning，不阻塞业务。
- 所有 cutoff 使用 `pg_catalog.now()` 和 timestamptz；AI quota_date 的 UTC 规则不复用清理时区。

## 验证与验收

- 插入边界时间前后测试行，清理只删除满足 cutoff 的行。
- blocked rate-limit、有效 session、未完成幂等请求和 pending AI request 均不被错误删除。
- 重复执行清理结果幂等；并发启动两个任务只有一个实际工作。
- 10 万行合成数据下单批删除不超过 batch size，锁与执行时间在阈值内。
- cron job 唯一、调度正确、失败能在 metrics/alert 中看到。
- HTTP 401、500、传输超时和响应缺失都必须由响应对账记录为失败；告警还要读取 `cron.job_run_details`，避免 SQL 语句级失败静默。
- 清理后用户分享、评论重试/幂等、协作会话和 AI 额度行为不变。
- 线上初次运行前先以 SELECT 预览各表候选计数，并把实际删除数量与预览对比。

## 回滚

- cron job 可按稳定名称立即 unschedule；函数保留不等于会自动执行。
- TTL 删除不可恢复，因此首次上线采用较保守 cutoff 和小 batch，并先运行 dry-run 统计。
- 不为回滚恢复已经过业务有效期的幂等/限流行；如果误删仍有效会话，应修复 cutoff 后让业务重新建立会话，而不是手工猜测原 key。
- schema 新增时间列和索引可以保留，不影响业务路径。

## 参考

- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase pg_cron Extension](https://supabase.com/docs/guides/database/extensions/pgcron)
- [PostgreSQL Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html)
