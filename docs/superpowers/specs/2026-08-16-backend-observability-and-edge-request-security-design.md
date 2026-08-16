# 后端统一可观测性与 Edge 请求安全设计

## 背景

当前三个 Edge Function 的观测能力不一致：

- `resume-comments` 已生成/回传 request ID，并记录分段 `Server-Timing`。
- `resume-share` 与 `llm-proxy` 没有统一 request ID、总耗时或稳定错误分类。
- 日志格式混合字符串与对象，部分错误直接带上游或数据库 message，难以聚合，也存在意外记录业务内容的风险。
- SQL 内部主要依赖 `RAISE EXCEPTION`；请求 ID 只有评论幂等路径落库，其他关键 RPC 无法关联到 Edge 请求。
- 线上已启用 `pg_stat_statements`，但没有固定的慢查询/高调用量检查与基线记录。
- 当前组织为 Free，不能把“配置付费 Log Drain”当作本次可用的唯一告警方案。
- shared CORS 对全部函数统一返回 `Access-Control-Allow-Origin: *`。它本身不是 JWT 泄露或鉴权绕过，但对需要登录的 LLM 与评论入口缺少来源纵深防御。

## 目标

- `llm-proxy`、`resume-share`、`resume-comments` 使用同一套 request context、结构化日志、错误分类与响应头。
- `X-Request-Id` 从浏览器贯穿 Edge、关键 RPC、幂等/计费流水和错误事件。
- 日志和指标不记录 JWT、apikey、密码、匿名 secret、用户 UUID、简历/评论/提示词正文或完整上游错误响应。
- 在不依赖付费 Log Drain 的情况下，对四类关键异常形成可查询指标和自动告警。
- 使用 `pg_stat_statements` 建立数据库性能基线，同时明确它不是端到端延迟。
- 登录型 Edge Function 使用显式 Origin allowlist；匿名分享读取保留跨来源能力，但仍依赖业务鉴权。

## 非目标

- 不自建完整 APM、分布式追踪平台或日志搜索产品。
- 不把用户身份哈希当作日志主键，也不存储可逆用户标识。
- 不使用日志替代事务流水、RLS 或签名令牌。
- CORS 不作为身份认证；无 Origin 的非浏览器请求仍必须通过原有 JWT/分享令牌校验。

## 方案比较

### 方案 A：只统一 `console.error`

实现简单，但没有稳定维度、成功请求分母和持久化错误率，Free 计划上仍难以告警。

### 方案 B：Edge 结构化日志 + 轻量数据库指标 + 定时 webhook 告警（采用）

每个请求同步返回 request ID 和 timing，后台异步写分钟级计数；仅错误保留短期 request ID 事件。定时 monitor 聚合阈值并发送通用 webhook。它不依赖付费日志导出，写入量可控，失败时仍有平台 console 日志兜底。

### 方案 C：直接接入商业 APM/Sentry

能力最完整，但需要新增账户、SDK、付费与数据治理决策。当前没有用户授权的外部观测平台，先提供供应商无关的稳定事件契约；以后接入时可以消费相同字段。

## Shared Request Context

新增共享模块负责：

- 接受合法 UUID `x-request-id`，否则生成 `crypto.randomUUID()`。
- 记录函数名、operation、开始时间、冷启动标记、Edge region、auth mode 和分段耗时。
- 提供统一 JSON response/failure/finalize 辅助函数。
- 所有响应包含 `X-Request-Id`；必要时包含 `Server-Timing`、`X-Sb-Edge-Region`。
- 日志使用单行 JSON 字符串，字段名固定，避免平台把嵌套对象渲染成不可检索文本。

结构化事件允许字段：

`timestamp, level, event, function, operation, requestId, status, durationMs, edgeRegion, authMode, category, errorCode, sqlState, upstreamStatus, coldStart`

禁止字段：Authorization/apikey/cookie、原始 request/response body、用户 ID、share password、comment secret、prompt/message/tool arguments、数据库完整 message/detail/hint、DeepSeek 原始错误正文。

## 错误分类

对外响应和内部日志使用稳定 code，不依赖供应商文案：

- `auth_invalid | forbidden | origin_forbidden`
- `invalid_request | payload_too_large | unsupported_model`
- `quota_exceeded | quota_reservation_failed | quota_finalization_failed`
- `upstream_invalid_request | upstream_auth | upstream_balance | upstream_rate_limited | upstream_unavailable | upstream_stream_failed`
- `database_conflict | database_deadlock | database_unavailable | database_unexpected`
- `share_unavailable | comment_rate_limited | unexpected`

数据库错误映射保留 SQLSTATE。`40P01` 必须单独映射为 `database_deadlock`；业务使用的 `40001` 需结合已知 message/code 区分 `stale_document/request_in_progress`，不能全部算作基础设施故障。

## 持久化指标

### `private.backend_operation_metrics`

分钟聚合表，主键为 `(bucket_minute, function_name, operation, outcome, error_code)`，保存 `request_count` 与 `duration_ms_sum/max`。Edge 在响应完成后通过 service-role RPC 做一次 UPSERT；写入使用 background task，不增加用户响应尾延迟。

### `private.backend_error_events`

仅保存需要排障的短期错误：`request_id`、function/operation、error_code/sql_state、status、duration、created_at。绝不保存 payload 或用户标识，保留 7 天。

指标写入失败时只输出脱敏 console 事件，不重试阻塞主请求。业务响应成功与否不由观测写入决定。

## 四类告警

`backend-ops-monitor` 每 5 分钟读取聚合表，以 stable alert key 去重并发送到 `OPS_ALERT_WEBHOOK_URL`。Webhook secret 只存在 Edge secrets/Vault，不写仓库。

1. **Edge 可用性**：单函数 5 分钟内 5xx ≥5 且 5xx 比率 ≥5%。
2. **DeepSeek 上游**：402 任意一次立即 critical；429/500/503 或 stream failure 5 分钟内 ≥3 次 warning。
3. **AI 一致性**：reservation/finalization RPC 失败或 reconciler 发现过期 pending 任意一次告警。
4. **数据库并发**：`40P01` 任意一次 warning；5 分钟内 ≥3 次 critical。

告警 payload 只含时间窗、函数、类别、计数、比例和最多 5 个 request ID。相同 alert key 在 30 分钟静默期内不重复发送；恢复后发送一次 resolved。

如果 `OPS_ALERT_WEBHOOK_URL` 尚未配置，monitor 返回健康但写结构化 `alert_delivery_not_configured`，部署验收明确标为“指标已就绪、外发告警未接通”，不得宣称完整告警已完成。

## Request ID 贯通

- 前端每个逻辑写请求/LLM 上游步骤生成 UUID，并在网络重试时复用。
- Edge 使用同一 ID 调用 AI reservation RPC；评论继续使用既有 `resume_comment_requests.request_id`。
- 分享与无法改变签名的旧 RPC 在 Edge metric/error event 中记录 request ID；新建或重构的关键 RPC 必须显式接收 request ID。
- 数据库异常返回 Edge 后，结构化日志和错误事件都使用同一 request ID。
- request ID 不是授权凭证，不允许用它读取业务响应或绕过幂等 actor key。

## `pg_stat_statements`

线上扩展已启用，不重复 CREATE。新增只读运维脚本/文档，固定采集：

- calls、mean/max/total exec time、rows、shared block hit/read。
- 关键 RPC 的规范化 queryid 与采集时间窗。
- 部署前后相同业务负载下的差异。

不自动调用 `pg_stat_statements_reset()`，避免破坏其他诊断窗口。数据库聚合时间只用于定位 SQL 热点；端到端仍以 Edge `Server-Timing` 和外部请求耗时为准。

## CORS 设计

共享模块改为按请求生成 CORS headers：

- `llm-proxy` 与 `resume-comments`：只允许 `APP_ALLOWED_ORIGINS` 中的精确 origin。生产至少包含 `https://506resume.vercel.app`；本地开发来源单独配置，不把通配子域或正则交给客户端。
- `resume-share`：匿名分享读取需要可嵌入/跨来源访问，保留 `*`；owner 写操作仍由 JWT、资源所有权和限流保护。
- allowlist 模式收到不匹配 Origin 时，OPTIONS 和实际请求都返回 403 `origin_forbidden`，且不回显任意 Origin。
- 无 Origin 的服务端/CLI 请求不因 CORS 被拒绝，但必须通过原业务认证。
- `Vary: Origin`、允许/暴露头和 max-age 由共享实现统一维护。

CORS 是浏览器纵深防御，不是防止已持有 JWT 的攻击者调用 API 的安全边界。

## 数据保留

- minute metrics 保留 30 天。
- error events 保留 7 天。
- alert state 保留最后状态，不形成无限历史。
- 清理由统一生命周期任务分批执行；表带时间索引。

## 验证与验收

- 三个 Edge Function 对合法/缺失/非法 request ID 都返回合法 UUID，且同一请求日志、指标、RPC 流水一致。
- 所有错误路径只返回稳定 code，不泄露数据库或 DeepSeek 原始正文。
- 日志扫描确认没有 JWT、apikey、密码、用户 UUID、评论/简历/提示词正文。
- 模拟成功与失败请求，minute metrics 的分母/分子和 duration 聚合准确。
- 四类阈值分别触发一次告警、静默期不重复、恢复后产生 resolved。
- webhook 不可用不影响业务请求，并生成 `alert_delivery_failed` 结构化事件。
- CORS 矩阵覆盖允许 origin、拒绝 origin、无 origin、预检和实际请求；拒绝来源不能读取响应。
- `resume-share` 匿名读取仍可跨来源，但只能得到有效分享的最小不可变快照；匿名评论仍必须由评论 token 授权。
- `pg_stat_statements` 采集脚本不修改统计状态，并明确输出数据库耗时与端到端耗时的差异。

## 回滚

- 共享 request context 可逐函数接入；若单个函数回归，只回退该函数适配，不删除指标表。
- 指标/告警 background task 失败不影响主请求，可通过环境开关停止写入。
- Origin allowlist 若遗漏合法生产域，只补充精确 origin 并重新部署；不得以永久恢复 `*` 作为登录函数的修复。
- 不删除已有 request/error 数据来隐藏告警；修复后通过 resolved 状态闭环。

## 参考

- [Supabase Edge Function Logging](https://supabase.com/docs/guides/functions/logging)
- [Supabase Edge Function CORS](https://supabase.com/docs/guides/functions/cors)
- [Supabase pg_stat_statements](https://supabase.com/docs/guides/database/extensions/pg_stat_statements)
- [Supabase Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
