# 简历评论 Bootstrap 全链路性能优化设计

- 日期：2026-08-14
- 主题：`resume-comments-bootstrap-performance-optimization`
- 状态：待书面规格审查
- 范围：浏览器 → Supabase Edge Function → Auth/PostgREST → PostgreSQL 的评论 bootstrap 链路

## 1. 背景

开发环境记录到一次评论 bootstrap 慢请求：

| 指标 | 数值 |
| --- | ---: |
| 端到端耗时 | 6702 ms |
| 性能目标 | 2000 ms |
| 慢请求阈值 | 2500 ms |
| Edge Function 内部耗时 | 3573.7 ms |
| 函数外及客户端侧开销 | 3128.3 ms |
| Auth | 1382.2 ms |
| 权限解析 | 913.1 ms |
| bootstrap 数据阶段 | 1278.4 ms |
| 线程读取 | 1273.2 ms |
| 版本读取 | 651.3 ms |
| 已读状态读取 | 227.3 ms |
| 线程数量 | 1 |

`requestCount` 为 1，排除客户端重复 bootstrap。远端数据库统计显示评论数据规模很小，相关 scope、thread、comment、read-state 与 share 索引均已存在且被使用，评论查询没有进入慢查询榜，排除由数据量或缺失索引导致的慢 SQL。

## 2. 根因

本问题不是单点故障，而是以下路径共同放大：

1. 项目仍使用旧式对称 JWT，JWKS 为空；`auth.getUser()` 每次都要访问位于主项目区域的 Auth 服务。
2. Edge Function 自动路由到首尔 `ap-northeast-2`，主数据库位于 `us-east-1`，Auth 与 PostgREST 调用发生跨区往返。
3. 权限解析、线程、作者资料、版本、分享计数和已读状态由多个 PostgREST 请求完成。
4. `loadThreads()` 在读取线程与评论后串行查询作者资料，单个线程仍可能产生 2 次数据库往返。
5. 浏览器请求触发 CORS 预检，当前响应未配置 `Access-Control-Max-Age`；预检、Supabase 网关、调度和网络时间全部被归入 `clientOverhead`。
6. 当前 `db` 指标是 `total - auth - access` 的残余值，不是纯数据库执行时间；`clientOverhead` 也混合了网络和客户端 CPU，口径无法准确指导优化。

Auth 是根因之一，但不是唯一根因。即使将 1382.2 ms 的 Auth 耗时完全消除，原始请求仍剩余约 5.32 秒。要在现有基础设施内把代码可控延迟降到最低，必须同时消除远程 JWT 验证、多轮数据库往返和重复预检。

## 3. 目标

### 3.1 功能目标

- 正常 bootstrap 只包含 1 个浏览器逻辑请求。
- 正常 bootstrap 在 Edge Function 内只包含 1 个数据库 RPC。
- 非对称 JWT 热路径不请求 Auth 服务。
- 数据库 RPC 在同一事务快照内完成权限校验和完整 bootstrap 聚合。
- IndexedDB 缓存、Realtime、匿名评论和协作者能力保持不变。
- JWT 迁移不强制现有用户退出，发布过程可以回滚。

### 3.2 性能目标

- 不通过放宽阈值或隐藏告警制造“性能达标”。
- 以当前基础设施可实现的最低端到端 P50/P95 为目标。
- 分离代码可控耗时与外部传输耗时，所有阶段均可解释。
- 冷启动、旧 JWT 回退、首次 JWKS 和 JWKS 热缓存分别统计。
- `auto` 与 `us-east-1` 使用相同身份和数据实测，选择端到端更快的路径。

### 3.3 安全目标

- JWT 必须完成密码学验签和必需 claims 校验，禁止只解码不验签。
- 数据库必须根据当前权威状态重新授权，禁止仅凭 Edge 传入 claims 放行。
- 聚合 RPC 只允许 `service_role` 调用。
- 日志、响应头和错误详情不包含 JWT、评论正文、匿名 secret 或密码数据。

## 4. 非目标

- 不迁移 Supabase 主数据库区域。
- 不新增亚洲只读副本。
- 不引入新的 CDN、代理或第三方基础设施。
- 不改造评论领域模型、UI 或 Realtime 协议。
- 不把所有 mutation 重写为新的数据库事务；本次聚焦告警对应的 bootstrap 关键路径。
- 不在本次发布中撤销或删除旧 JWT 签名密钥。

## 5. 方案比较

### 5.1 方案 A：保守优化

迁移非对称 JWT、缓存 CORS 预检，但保留现有权限解析和多次数据库查询。

优点是变更较小；缺点是无法消除数据库往返放大，不满足彻底优化要求。

### 5.2 方案 B：本地验签与单次聚合 RPC

迁移非对称 JWT，将权限校验和 bootstrap 数据聚合为 1 次 service-role-only RPC，并改进 CORS 与计时口径。

该方案同时处理远程鉴权和多轮数据库访问，是本设计采用的方案。

### 5.3 方案 C：Edge Function 直连 PostgreSQL

使用数据库连接串和 Postgres 驱动绕过 PostgREST。

该方案可能减少少量内部 HTTP 开销，但会增加连接池、冷启动、连接上限和密钥管理风险。单次 RPC 已能取得主要收益，因此不采用。

## 6. 目标架构

```text
浏览器
  → resume-comments Edge Function
      → 本地验证 Supabase JWT / 评论访问令牌
      → 单次 bootstrap RPC
          → 校验当前数据库权限状态
          → 聚合 scope、version、threads、comments、
             profiles、read state、counts
      → 本地签发 Realtime token
  → 返回完整 bootstrap
```

职责边界如下：

- 浏览器负责会话令牌、访问上下文、缓存和 UI 状态提交。
- Edge Function 负责密码学验证、输入规范化、调用 1 次 RPC、签发 Realtime token 和协议响应。
- PostgreSQL 负责基于当前数据的最终授权、事务一致性和结果聚合。
- Realtime token 派生不访问数据库，不阻塞 RPC。

## 7. Supabase JWT 鉴权设计

### 7.1 共享鉴权模块

为 `resume-comments`、`resume-share` 和 `llm-proxy` 提供共享的 `authenticateSupabaseUser()`：

1. 从 `Authorization` 读取 Bearer 值。
2. 非 JWT 格式的 Publishable Key 直接视为未登录身份，不发送无效 Auth 请求。
3. 对用户 JWT 调用 `supabase.auth.getClaims(jwt)`。
4. 校验 `iss`、`aud`、`exp`、`sub`、`role` 和 `session_id`。
5. 只返回规范化的用户 ID 和非敏感鉴权模式。

`getClaims()` 对非对称 JWT 使用缓存 JWKS 本地验签；对迁移期旧 HS256 JWT 自动回退 Auth 服务。共享模块不自行实现加密算法。

### 7.2 依赖和 Edge 配置

- 将 Edge Function 使用的 `@supabase/supabase-js` 固定到明确版本，避免 `@2` 漂移。
- `resume-comments` 与 `resume-share` 保持 `verify_jwt = false`，由函数内鉴权负责。
- 为 `llm-proxy` 显式设置 `verify_jwt = false`，避免旧平台校验在函数执行前拒绝非对称 JWT。
- `llm-proxy` 在执行业务逻辑前必须使用共享鉴权模块拒绝未登录请求。

### 7.3 JWT 零停机迁移

1. 先部署同时兼容旧 JWT 和非对称 JWT 的代码。
2. 在 Supabase Dashboard 中迁移 legacy JWT secret，创建非对称 standby key。
3. 确认 JWKS 端点已发现 standby 公钥。
4. 旋转 standby key 为 current，新令牌开始使用非对称签名。
5. 旧密钥保留为 previously used，旧令牌继续工作直到自然过期。
6. 完整验证通过前不撤销或删除旧密钥。

## 8. 评论访问令牌与最终授权

Edge Function 继续本地验证现有评论令牌：

- 分享访问令牌：HMAC-SHA256。
- 协作者访问令牌：HMAC-SHA256。
- 匿名身份：secret 经 pepper 派生 SHA-256 哈希。
- Realtime token：现有 HMAC 签发。

Edge 只向 RPC 传递已经验证并规范化的访问类型、用户 ID、评论 token claims 和匿名 secret hash，不传原始 JWT、HMAC token 或匿名 secret。

数据库仍执行最终授权：

- Owner：scope/version/resume 必须属于当前用户。
- Collaborator：用户、session、member、role、scope 和 version 必须一致，且未过期、未撤销。
- Share：share、release、version 和 scope 必须一致；分享必须启用、未归档、未过期，密码代次必须匹配。
- Anonymous：identity、version 和 secret hash 必须匹配，身份未撤销。

不使用 `user_metadata` 或客户端提交的角色做授权。

## 9. 单次聚合 RPC

### 9.1 函数边界

数据库接口分为公开包装器和私有实现：

```text
public.bootstrap_resume_comments_v1(...)
  ├─ private.resolve_comment_access(...)
  └─ private.build_comment_bootstrap(...)
```

公开 RPC：

- 使用 `SECURITY DEFINER`。
- 固定空 `search_path`。
- 第一条语句执行 service-role 断言。
- 撤销 `PUBLIC`、`anon`、`authenticated` 的全部权限。
- 只向 `service_role` 授予 `EXECUTE`。

私有函数不暴露到 Data API，只负责权限分支和聚合逻辑。

### 9.2 输入协议

RPC 接收明确的协议版本和规范化访问参数：

```text
protocolVersion
accessKind
userId
scopeId / resumeId / versionId
shareId / releaseId / passwordGeneration
sessionId / collaboratorRole
anonymousId / anonymousSecretHash
```

函数拒绝未知协议版本、未知访问类型、非法 UUID、缺失字段和互相冲突的字段。

### 9.3 聚合内容

RPC 在同一个事务快照内完成：

1. 权限解析并确定唯一版本 scope。
2. 读取 scope 和当前 `next_event_seq`。
3. 按 `last_activity_at DESC` 读取未删除线程。
4. 聚合每个线程的评论，客户端仍按 `created_at` 排序。
5. 从评论作者 ID 集合一次读取 profiles。
6. 根据已读取线程使用条件聚合计算 unresolved、resolved 和 detached。
7. 读取版本引用并计算有效分享链接数量。
8. 按 actor 读取已读游标；无 actor 时返回 0。

正常路径不再执行：

- 线程读取后的额外 profile 网络请求。
- 单独版本网络请求。
- 单独分享计数网络请求。
- 单独已读状态网络请求。
- 重复线程计数扫描。

### 9.4 返回协议

```text
{
  protocolVersion,
  access: {
    kind,
    userId,
    actorKind,
    actorId,
    canWrite,
    canManageAll,
    scopeId,
    versionId,
    ownerUserId
  },
  bootstrap: {
    scope,
    version,
    counts,
    threads,
    profiles,
    lastReadEventSeq,
    accessibleScopes
  },
  eventSeq
}
```

Edge Function 严格验证返回结构，使用 `access` 签发 Realtime token，只把业务 bootstrap 和 Realtime token 返回浏览器。协议不兼容直接报错，不静默退回旧的多请求实现。

### 9.5 热路径写放大

bootstrap 保持只读，不为每次匿名读取更新 `last_seen_at`。匿名身份和协作者的活跃时间由身份创建、显式续期、写操作或低频心跳维护。

### 9.6 Scope repair

某些从未打开评论的旧版本可能还没有版本 scope。正常 RPC 返回明确的 `scope_missing`，Edge 进入一次性 repair：

1. 使用既有共享 TypeScript 投影逻辑生成 anchor document。
2. 调用现有 ensure scope 事务。
3. 重新执行聚合 RPC。

发布前使用同一投影逻辑预热可安全处理的既有版本，减少线上 repair。repair 使用独立性能阶段和计数，不计入正常 bootstrap 样本；不允许未知数据库错误触发自动重试风暴。

## 10. 客户端请求和缓存

- IndexedDB 缓存与网络 bootstrap 保持并发。
- 缓存命中可以先提交 UI；网络结果到达后以 event seq 和单调已读游标校准。
- 网络结果先写 Store，再异步写 IndexedDB，缓存写入不阻塞 bootstrap 完成。
- Realtime 在 Store 提交后连接，不等待 IndexedDB。
- 请求 URL 支持 `auto` 和指定 `forceFunctionRegion`；最终值由真实基准决定。
- 不将 JWT 放入 URL、查询字符串或请求体来规避 CORS。

## 11. CORS

共享 CORS 响应增加：

- `Access-Control-Max-Age`，用于缓存预检结果。
- `Access-Control-Expose-Headers` 包含 `Server-Timing`、`X-Request-Id` 和 `X-Sb-Edge-Region`。
- `Access-Control-Allow-Methods` 保持与实际接口一致。
- `Access-Control-Allow-Headers` 保持最小必需集合。

首次跨域请求仍可能预检；后续请求在浏览器允许的缓存周期内不重复预检。

## 12. 可观测性

### 12.1 客户端阶段

- `auth_token`：读取浏览器会话令牌。
- `fetch_headers`：发送请求至收到响应头。
- `response_body`：下载和解析 JSON。
- `normalize`：协议转换。
- `store_commit`：写入 Zustand。
- `realtime_connect`：启动订阅。
- `total`：完整 bootstrap。

### 12.2 Edge 阶段

- `auth_local` 或 `auth_legacy`。
- `access_token`：评论 HMAC 和匿名 secret 处理。
- `rpc`：唯一数据库调用。
- `realtime_token`。
- `serialize`。
- `edge_total`。

### 12.3 指标语义

- 删除把残余时间统称为 `db` 的口径。
- 将 `clientOverhead` 更名为 `transportOverhead`，表示预检、网关、调度和网络的混合开销。
- 样本增加 `authMode`、Edge 区域、协议版本、缓存状态、repair 状态、线程数和响应字节数。
- 不记录 access token、actor ID、评论正文或其他可识别个人的信息。
- 使用固定长度滚动窗口计算样本数、P50、P95 和最大值，不再仅输出进程生命周期平均数。
- 冷启动、旧 JWT、本地 JWT、repair 和正常热路径分别聚合。

## 13. 错误处理

- 无效 Supabase JWT：`unauthorized`。
- 无效评论访问令牌或匿名身份：`unauthorized`。
- 已撤销协作权限：`unauthorized`。
- 分享关闭或不可用：`share_unavailable` 或 `comments_disabled`。
- 版本与发布不一致：`stale_release`。
- 未创建 scope：内部 `scope_missing`，只允许进入受控 repair。
- RPC 协议不匹配：`unexpected`，记录 request ID 和协议版本。
- 未知数据库错误：映射为 `unexpected`，不向客户端返回 SQL 文本。

## 14. 数据库性能验证

不根据告警盲目添加索引。迁移后对聚合 RPC 使用：

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
```

重点检查：

- scope、thread、comment、read-state、share 和 collaboration 查询命中既有索引。
- 无随线程或评论数量增长的 N+1 子计划。
- 聚合排序没有不必要的磁盘 spill。
- 实际行数与估算行数不存在会改变执行计划的数量级偏差。
- `pg_stat_statements` 中 RPC 平均执行时间和调用次数符合预期。

只有查询计划证明存在缺口时才新增索引。

## 15. 发布顺序

1. 使用相同身份、scope 和数据记录优化前基线。
2. 部署纯新增数据库迁移，保留全部旧函数。
3. 部署兼容旧 JWT 的 `resume-comments`、`resume-share` 和 `llm-proxy`。
4. 在旧 HS256 仍为 current 时完成权限和功能验证。
5. 创建非对称 standby key，确认 JWKS。
6. 旋转为非对称 current，保留旧 key 为 previously used。
7. 获取新 JWT，重新验证全部 Edge Function。
8. 执行 `auto` 与 `us-east-1` 优化后基准，选择更快配置。
9. 完成前端构建、浏览器交互和真实网络验证。
10. 完整验证通过后交付；本次不撤销旧 JWT key。

## 16. 验证矩阵

### 16.1 身份与权限

- Owner：当前版本、历史版本、明确 scope、scope repair。
- Collaborator：editor、viewer、过期成员、撤销成员和过期会话。
- Share：登录用户、无身份访客、匿名评论者、关闭评论、失效发布和密码变更。
- 非法 JWT、过期 JWT、篡改评论 token 和错误匿名 secret 均被拒绝。

### 16.2 数据

- 0、1 和多线程。
- 多级回复、已删除评论、detached 和 resolved。
- 多作者资料合并。
- 已读游标为 0、落后和本机领先。
- 分享链接数量和版本引用正确。

### 16.3 缓存与 Realtime

- IndexedDB miss、hit、缓存晚于网络和离线恢复。
- 网络 bootstrap 不被旧缓存覆盖。
- Realtime 连接、连续事件、事件断档和协议不匹配恢复。
- bootstrap 不引发额外 list 请求。

### 16.4 性能

- 旧 HS256 JWT 回退。
- 非对称 JWT 首次 JWKS。
- 非对称 JWT 热缓存。
- Edge 冷启动和热启动。
- 首次预检和预检缓存后。
- `auto` 与 `us-east-1`。
- 正常 bootstrap 和 scope repair。

每组重复执行并报告样本数、P50、P95、最大值、Edge 区域和阶段耗时。

## 17. 完成标准

- 正常 bootstrap 只有 1 个逻辑 HTTP 请求和 1 个数据库 RPC。
- 非对称 JWT 热路径的 `authMode` 为本地 JWKS，Auth 服务不在热路径。
- `threads` 后不再追加 profiles 网络查询。
- RPC 查询计划不存在非预期大表顺序扫描和 N+1。
- 权限、缓存、Realtime 和数据矩阵无回归。
- 优化前后 P50/P95 有可复现的实测证据。
- 所有耗时阶段可以归因；不以提高告警阈值作为修复。
- 仍由外部网络主导的剩余时间被明确报告，不误归因为客户端 CPU 或数据库 SQL。

## 18. 回滚

- Edge Function 可以先回滚到旧实现；新增 RPC 不影响旧代码。
- 非对称 JWT 出现兼容问题时，将旧 key 恢复为 standby/current。
- 旧 JWT key 在验证完成前不撤销，因此回滚不要求用户重新登录。
- 数据库迁移为纯新增，不执行破坏性回滚；必要时停止新 Edge 调用后再通过后续迁移清理。
- 未验证完成前不删除旧函数、旧协议或旧签名密钥。

## 19. 主要影响文件

- `supabase/config.toml`
- `supabase/functions/shared/`
- `supabase/functions/resume-comments/index.ts`
- `supabase/functions/resume-share/index.ts`
- `supabase/functions/llm-proxy/index.ts`
- `supabase/migrations/`
- `src/features/resume-comments/api/client.ts`
- `src/features/resume-comments/api/performance.ts`
- `src/features/resume-comments/hooks/use-comment-realtime.ts`
- 评论验证脚本与性能验证记录

## 20. 官方依据

- [Supabase JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase `getClaims()`](https://supabase.com/docs/reference/javascript/auth-getclaims)
- [Supabase JWT 字段](https://supabase.com/docs/guides/auth/jwt-fields)
- [Supabase User Sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase Edge Function 区域调用](https://supabase.com/docs/guides/functions/regional-invocation)
- [Supabase Edge Function CORS](https://supabase.com/docs/guides/functions/cors)
- [Supabase Edge Function 401 与旧 JWT 校验](https://supabase.com/docs/guides/troubleshooting/edge-function-401-error-response)
- [Supabase 查询优化](https://supabase.com/docs/guides/database/query-optimization)
