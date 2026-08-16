# AI 额度原子预留、幂等流水与 UTC 语义设计

## 背景

当前 `llm-proxy` 的顺序是 `check_ai_quota → DeepSeek → consume_ai_credits`。三个动作跨越两个数据库事务和一个外部 HTTP 请求，存在以下已确认问题：

- 两个并发请求可同时通过只读预检并都调用上游，最后只有一个成功扣费。
- `consume_ai_credits` 额度不足时返回 `{ ok: false }`，Edge 只检查 RPC 的 `error`，因此扣减拒绝会被当作成功。
- 上游已产生回答后，扣减 RPC 失败只写 `console.error`，没有补偿或告警。
- 数据库重置用 `current_date`，Edge 返回的 `reset_at` 用 UTC 次日零点，两处规则独立实现。
- `get_ai_quota()` 为了惰性重置执行 INSERT/UPDATE 和 `FOR UPDATE`，余额刷新会与真实扣费互相排队。
- 前端请求了 `stream_options.include_usage`，代理白名单没有透传；当前拿不到完整 usage。

产品当前采用固定积分制：普通调用 1 分，ATS/关键简历写操作 3 分。本设计不擅自改成按 token 计费；token usage 只用于成本分析和异常核对。

## 目标

- 在调用 DeepSeek 前，以单个数据库事务完成额度检查、幂等占位和额度预留，杜绝并发超额。
- 每个逻辑上游请求都有全局 UUID request ID 和可恢复状态流水。
- 正常完成、部分流、客户端取消、上游拒绝、数据库短暂失败和 Edge 中断都有确定的结算/释放规则。
- 额度周期统一为显式 UTC 日桶，由数据库返回唯一 `reset_at`。
- 余额读取是普通 SELECT，不插入、不更新、不取行锁。
- usage 能被安全采集，但不改变 1/3 积分计费。
- 对模型、字段和请求体建立服务端上限，防止客户端选择任意高成本模型或提交无界 payload。

## 非目标

- 不存储提示词、回答正文、工具参数或简历内容到计费流水。
- 不实现按 token、金额或动态模型价格扣费。
- 不承诺同一 request ID 重试时重放已生成的完整回答；系统不保存 LLM 正文。
- 不把所有 AI 业务策略下沉到 PL/pgSQL。数据库只负责并发一致性与最小状态转换，cost 分类和请求校验继续由 Edge TypeScript 负责。

## 方案比较

### 方案 A：调用上游后继续扣费，只补检查返回值

可修复 `{ ok: false }` 被忽略，但无法消除并发双放行，也无法处理 Edge 中断后的不确定状态。

### 方案 B：先直接扣费，失败时尽力退款

并发安全，但没有独立请求流水时无法可靠判断退款是否已经执行；重试可能重复扣减或重复退款。

### 方案 C：UTC 日桶 + 幂等请求流水 + 原子预留 + 状态结算/释放（采用）

额度在上游前预留，所有后续操作按 request ID 幂等更新；异常中断由定时任务依据持久化交付状态冲正。该方案既防止免费并发调用，也能避免无回答时长期占用额度。

## 数据模型

### `public.ai_quota_daily_usage`

额度消耗从“用户表上的今日计数”拆为显式日期桶：

- `user_id uuid`
- `quota_date date`，统一取 `timezone('UTC', now())::date`
- `consumed_credits integer not null default 0`
- `updated_at timestamptz`
- 主键 `(user_id, quota_date)`

`consumed_credits` 表示当天已结算和仍在预留中的总积分。预留时增加，释放时减少，结算时不再重复增加。

`public.user_quotas` 继续保存 plan 与 daily_limit。既有 `used_today/last_reset_date` 在迁移时只用于把当日存量导入 UTC 桶，之后不再作为额度真相源；确认所有调用迁移后再在独立清理步骤删除或标记弃用。

### `public.ai_credit_requests`

每个上游调用一行：

- `request_id uuid primary key`
- `user_id uuid not null`
- `quota_date date not null`
- `action text not null`
- `reserved_cost integer not null`
- `quota_debited integer not null`：普通用户等于 reserved_cost，root 为 0
- `state text`：`pending | settled | released | rejected`
- `delivery_state text`：`none | upstream_accepted | started | completed | partial`
- `upstream_request_id text null`：只允许短标识，不存响应正文
- `prompt_tokens/completion_tokens/total_tokens integer null`
- `finish_reason text null`
- `failure_code text null`：稳定枚举，不存上游原始响应
- `reserved_at/upstream_accepted_at/delivery_started_at/finalized_at/expires_at timestamptz`

约束保证积分非负、usage 非负、状态组合合法。索引覆盖 `(state, expires_at)` 与 `(user_id, quota_date, reserved_at desc)`。表启用 RLS，浏览器角色无表级权限；所有写入只允许 service-role RPC。

## RPC 状态机

### `reserve_ai_credits`

输入：`p_user_id`、`p_request_id`、`p_weight`、`p_action`。函数按以下顺序取锁：请求流水 → 用户额度配置 → UTC 日桶。

1. 以 request ID 插入请求占位；冲突时锁定既有行。
2. 既有行的 user/action/cost 不一致则返回 `idempotency_conflict`。
3. 同参数重放返回既有状态，不再次增计数。
4. 创建缺失的用户额度配置与当日日桶。
5. root 写流水但 `quota_debited=0`。
6. 普通用户在同一事务检查 `consumed_credits + cost <= daily_limit`；满足则增加日桶并置 `pending`，否则置 `rejected`。
7. 返回 `ok/state/remaining/daily_limit/reset_at/unlimited`。

### `mark_ai_request_delivery_started`

在第一个有意义的 SSE delta 发给客户端前执行。函数只允许 `pending` 从 `none/upstream_accepted` 进入 `started`，重复调用返回当前状态。Edge 必须等待该 RPC 成功后才 enqueue 第一段实际内容，保证“用户已收到内容”不会早于持久化标记。

### `settle_ai_credit_request`

正常 `[DONE]` 或非流式完整响应进入 `settled/completed`；中途断流但已交付内容进入 `settled/partial`。结算只更新流水和 usage，不再修改日桶。重复结算幂等；已 released/rejected 的请求不能被结算。

### `release_ai_credit_request`

上游非 2xx、fetch 失败、无响应体、或任何内容发出前取消时调用。函数锁定请求与对应日桶，把 `quota_debited` 从 `consumed_credits` 扣回并置 `released`。重复释放不再减计数；已 settled 的请求不能释放。

### `reconcile_expired_ai_credit_requests`

定时处理 `pending AND expires_at <= now()`：

- `delivery_state=started` 或更后：结算为 `partial`，因为用户已经得到内容。
- 仅 `upstream_accepted` 或 `none`：释放额度，优先保护用户权益。
- 每批有限行数并使用 `FOR UPDATE SKIP LOCKED`，允许重复执行和并发执行。

默认 reservation TTL 为 15 分钟，协调 DeepSeek 最长排队与当前 Edge 请求时限；具体值作为服务端常量和数据库约束共同维护。

## Edge Function 数据流

1. 校验/生成 UUID `X-Request-Id`，并在响应头原样返回。
2. 完成 JWT 验证、请求体解析、模型和字段校验。
3. 服务端计算固定 cost/action。
4. 调用 `reserve_ai_credits`。拒绝时返回 403，不调用 DeepSeek。
5. 调用 DeepSeek；模型固定白名单为当前产品使用的 `deepseek-v4-pro`，不接受任意字符串。
6. 上游非 2xx 时先幂等释放，再返回脱敏的稳定错误码；原始上游正文不返回客户端、不写日志。
7. 流式响应经过 SSE Transform：解析 request ID、finish_reason 与 usage，同时原样转发合法数据和 keep-alive 注释。
8. 第一个 content、reasoning_content 或 tool_calls delta 发出前，持久化 `delivery_state=started`。
9. `[DONE]` 时结算 completed；读取错误或客户端取消时，根据是否 started 结算 partial 或释放。
10. 最终状态 RPC 通过 Edge background task 兜底执行，并把失败写入结构化错误指标；即使即时结算失败，预留额度仍已计入，定时冲正可恢复。

非流式响应在完整 JSON 校验后结算，再返回给客户端。若结算状态写入短暂失败，仍返回已生成结果，因为预留已经原子占用额度；流水保持 pending 并由 reconciler 收口。

## Usage 与固定积分

代理对流式请求强制向上游发送 `stream_options: { include_usage: true }`，不依赖客户端是否传入。DeepSeek 会在 `[DONE]` 前返回最终 usage chunk；代理只提取三项整数和 finish_reason。

usage 用于：

- 按 action/model 分析真实成本。
- 发现异常超长请求或截断。
- 与供应商账单抽样核对。

usage 不参与当前积分结算。1/3 分规则由 `computeCost` 的服务端测试保护；若以后改按 token 计费，必须单独做产品与迁移规格。

## 请求边界

- `model` 只允许产品配置中的明确白名单。
- `messages` 必须是 1–128 项数组，角色与必要字段符合允许结构。
- 整体序列化请求上限 1 MiB；拒绝无界嵌套或非 JSON 值。
- `max_tokens` 必须是 1–16384 的整数。
- `temperature` 必须在 0–2。
- `thinking.type` 只允许 enabled/disabled，`reasoning_effort` 只允许当前上游文档支持值。
- tools 数量、函数名长度和单项 schema 大小设置上限；未知顶层字段不透传。
- 客户端 action/weight 继续不参与计费。

## 额度读取与前端同步

新版 `get_ai_quota()`：

- 用 `auth.uid()` 读取 plan/daily_limit。
- LEFT JOIN 当前 UTC 日桶；没有桶时展示 0 使用量。
- 不 INSERT、不 UPDATE、不 `FOR UPDATE`。
- 由 SQL 同时返回 `quota_date` 与 `reset_at`，前端不再自行计算次日零点。

预留成功响应头返回权威 remaining/reset_at。前端取消固定 `-1` 的盲目乐观扣减，改为用该元数据更新 store，并在完整流结束/失败后后台刷新。这样 heavy=3 不会短暂显示成只扣 1。

## 错误与重试语义

- 同 request ID、同参数：不重复预留；返回既有状态。
- 同 request ID、不同参数：409 `idempotency_conflict`。
- 已完成 request ID 不重放回答，返回 `request_already_finalized`；客户端如需重新生成必须创建新 request ID。
- 额度不足：403 `quota_exceeded`，包含数据库返回的 remaining/daily_limit/reset_at。
- 上游 400/401/402/422：不自动重试，释放额度并返回稳定分类。
- 上游 429/500/503：本批次不在 Edge 内自动重试，避免一次用户动作产生不可控重复上游调用；释放后由用户显式重试并使用新 request ID。

## 迁移与兼容

- 从 `user_quotas.used_today` 迁移当天 UTC 有效用量到日桶；历史过期计数不迁移。
- 旧 `check_ai_quota/consume_ai_credits` 在新 Edge 部署稳定后撤销并删除，避免两套计费入口并存。
- `ai_usage_logs` 暂时保留只读供历史分析；新调用以 request ledger 为准。
- 数据库函数使用 `SECURITY DEFINER SET search_path=''`、全限定对象名，并只授予 service role；`get_ai_quota()` 单独授予 authenticated。

## 验证与验收

- 20 个并发、总额度只够 1 次的请求中，最多 1 个 reservation 成功，且只有成功 reservation 才允许进入模拟上游。
- 相同 request ID 并发 20 次只增加一次日桶。
- 上游非 2xx、fetch 抛错、空 body、首 token 前取消均释放；首 token 后取消只结算一次 partial。
- 人为让 settle RPC 失败后，reservation 保持 pending 且日桶仍计费；reconciler 后续正确结算，不重复扣费。
- UTC 23:59:59 到次日 00:00:01 的跨日测试分别落入两个日桶，reset_at 与数据库规则一致。
- `get_ai_quota()` 的 EXPLAIN/锁观察确认没有写入和行锁。
- root 产生流水和 usage，但日桶不增加，unlimited 语义保持。
- 流式 usage 能被前端 parser 和服务端流水同时看到，且不改变固定积分。
- 输入边界、模型白名单、错误映射和日志脱敏均有定向验证。

## 回滚

- 新表和新 RPC 先上线，旧 Edge 尚未切换时不会影响现有调用。
- Edge 切换后若出现问题，可以回退到旧 Edge 代码，但必须保留 P0 权限封堵；回退窗口内禁止恢复浏览器执行旧内部 RPC。
- 已写入的新 reservation 不删除；回退前先运行 reconciler，使 pending 全部 settled/released，再决定是否恢复旧计数源。
- 不通过直接修改 `consumed_credits` 处理个案；任何冲正都必须走带 request ID 的幂等 release/reconcile 路径。

## 参考

- [DeepSeek Chat Completion 与 stream usage](https://api-docs.deepseek.com/api/create-chat-completion)
- [DeepSeek 错误码](https://api-docs.deepseek.com/quick_start/error_codes/)
- [DeepSeek 限速与 user_id 隔离](https://api-docs.deepseek.com/quick_start/rate_limit)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
