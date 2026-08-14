# 简历评论 Bootstrap 性能验证与发布记录

- 记录日期：2026-08-14
- 优化前历史函数：`resume-comments` v9（2026-08-14 05:03:19 UTC 为 ACTIVE）
- Supabase 项目：`bitxrpdtlohlnywgusfw`
- 数据库区域：`us-east-1`
- 自动 Edge 区域：`ap-northeast-2`（首尔）

## 优化前同机告警

| 阶段               |      耗时 |
| ------------------ | --------: |
| 端到端原始告警     |   6702 ms |
| Edge Function 内部 | 3573.7 ms |
| Auth               | 1382.2 ms |
| access             |  913.1 ms |
| 线程阶段           | 1273.2 ms |

该请求 `requestCount = 1`，线程数为 1。旧 `db` 是 `total - auth - access` 的残差，并非纯数据库执行时间；旧 `clientOverhead` 同样是残差，混合了浏览器、网关、调度与网络传输开销。

## 重复探测

| 探测      | 已确认结果                                                                                  |
| --------- | ------------------------------------------------------------------------------------------- |
| OPTIONS   | 匿名 POST 前重复触发预检；响应未提供 `Access-Control-Max-Age`，浏览器不能复用预检。         |
| 匿名 POST | 每个逻辑 bootstrap 的 `requestCount = 1`，未发现客户端重复 bootstrap；告警样本为 1 个线程。 |

自动路由的 Edge 位于 `ap-northeast-2`，而 Auth/PostgREST 与主数据库位于 `us-east-1`；后续基准将以相同身份和访问上下文分别测量 `auto` 与 `us-east-1`。

本文件先保留已确认的优化前基线，再追加兼容发布、签名密钥轮换与优化后实测结果。不同阶段的版本号、样本和口径不得混用。

## 兼容发布收据

- 发布时间：2026-08-14 16:00 UTC（2026-08-15 00:00 UTC+8）
- 数据库迁移：`20260814060000_optimize_resume_comment_bootstrap`
- 迁移文件 SHA-256：`22f116cfbf0b8e219a9b033deb978ff2d1fc83d0149265da9b827c66a9f489de`
- 迁移方式：Supabase CLI linked project；dry-run 只包含该迁移，随后正式应用成功
- scope 预热：`not_run_missing_credential`。执行环境没有 service-role credential，未把密钥写入环境文件、命令或文档；线上由受控 `scope_missing` repair 兜底

| 函数              | 发布前            | 发布后            | `verify_jwt`   | 状态   |
| ----------------- | ----------------- | ----------------- | -------------- | ------ |
| `resume-comments` | v9 / `fc86f84e…`  | v10 / `bdb18952…` | `false`        | ACTIVE |
| `resume-share`    | v15 / `1c0e350b…` | v16 / `186d207b…` | `false`        | ACTIVE |
| `llm-proxy`       | v24 / `a19405ef…` | v25 / `622eac90…` | `true → false` | ACTIVE |

发布前函数源码已从 Git 提交 `ca2e281` 重建到本机忽略目录 `.superpowers/sdd/rollback-edge-before-bootstrap-optimization/`，可在兼容窗口内重新部署旧实现。兼容发布后的仓库源码另从提交 `48a36da` 保存到 `.superpowers/sdd/rollback-edge-v10-before-benchmark-header/`。这些是明确提交点的源码回滚包，不冒充从远端下载的运行时快照。

### 基准响应门禁补发

- 仓库提交：`00d4c24`、`e7bcf9b`
- 部署时间：2026-08-14 18:23:47 UTC
- `resume-comments` 部署后 bundle SHA-256：`c786867d98f692da8e538ab0a913a35fda8a9a71474109f96cc8e63f70645701`
- 变更：成功 `bootstrap_scope` 暴露 `X-Comment-Auth-Mode` 与 `X-Comment-Scope-Repair`；基准强制至少 20 轮、OPTIONS/POST 全 2xx、每个 POST 都有合法且匹配预期的鉴权/repair 元数据。
- CORS 实测：OPTIONS 200，`Access-Control-Max-Age: 86400`，两项新响应头均在 `Access-Control-Expose-Headers` 中。
- 代码复审：原评审代理复审通过，无 Critical / Important / Minor 问题。

签名配置导入与轮换分别使平台报告的三个函数 version 元数据递增，但函数 `updated_at` 与 bundle SHA-256 未随之变化。轮换后的最终运行态如下；判断代码内容以 SHA-256 为准，不以这两次元数据递增推断重新部署：

| 函数              | 最终平台 version | bundle SHA-256 | `verify_jwt` | 状态   |
| ----------------- | ----------------: | ------------- | ------------ | ------ |
| `resume-comments` |                13 | `c786867d…`   | `false`      | ACTIVE |
| `resume-share`    |                18 | `186d207b…`   | `false`      | ACTIVE |
| `llm-proxy`       |                27 | `622eac90…`   | `false`      | ACTIVE |

## 本地门禁

| 门禁                             | 结果                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------- |
| 四个 comments/auth 专用 verifier | 通过                                                                              |
| Task 5 目标 ESLint               | 通过                                                                              |
| 生产构建                         | 通过；仅有既有 circular chunk / 大 chunk 警告                                     |
| `git diff --check`               | 通过                                                                              |
| 全量 TypeScript                  | 未通过；错误仅位于独立 UI 迁移的 assistant/tracker 文件，本次性能文件没有类型错误 |
| 全量 ESLint                      | 未通过；仓库已有大量历史文档/页面格式错误，目标文件检查通过                       |

## 数据库权限与查询计划

- `bootstrap_resume_comments_v1` 与两个 `ensure_resume_version_comment_scope` 重载仅允许 `service_role` 执行；`anon`、`authenticated` 均不可执行。
- 三个 private helper 对 `anon`、`authenticated`、`service_role` 均不可执行，且 private schema 对这些角色均无 `USAGE`。
- 所有新增函数固定空 `search_path`；security advisors 未报告目标函数暴露。
- advisors 发布前后均为 security 61、performance 103，目标迁移没有增加告警。
- 数据库共有 29 个版本、6 个活动 version scope、23 个缺失 scope；缺失项继续使用带 revision 校验的原子 repair，不混入正常热路径样本。

聚合 RPC 的首次冷执行为 103.9 ms。缓存预热后的 5 次执行为 49.4、17.7、11.9、16.7、22.5 ms，P50 为 17.7 ms，最小值为 11.9 ms；全部为 shared buffer hit，磁盘 read block 为 0。该结果只衡量 PostgreSQL 聚合执行，不包含 Edge、网关与跨区域传输。

## 发布后数据面验证

| 路径               | 身份/输入                            | 结果                                              |
| ------------------ | ------------------------------------ | ------------------------------------------------- |
| comments OPTIONS   | 浏览器预检                           | 200，`Access-Control-Max-Age: 86400`              |
| comments bootstrap | publishable 匿名身份请求 owner       | 401；`auth_anonymous=0.2 ms`，`edge_total=5.1 ms` |
| comments bootstrap | 无 Authorization 且 share token 非法 | 401；`auth_anonymous=0.1 ms`，`edge_total=4.4 ms` |
| comments bootstrap | 非法 JWT                             | 401；`edge_total=3.6 ms`，请求 ID 正确回传        |
| share GET          | 无分享 token                         | 404 `unavailable`                                 |
| share owner POST   | 非法 JWT                             | 401 `unauthorized`                                |
| llm-proxy POST     | 无 Authorization                     | 401 `unauthorized`                                |
| llm-proxy POST     | publishable key 作为 Bearer          | 401 `unauthorized`                                |
| llm-proxy POST     | 非法 JWT                             | 401 `unauthorized`                                |

Edge 日志曾观测到 `resume-comments` v10 的成功 POST，但不以日志推断具体身份。该段表格是轮换前的负例基线；下面使用不落盘的隔离真实会话补齐 owner 与三函数鉴权正例，并据此进入签名密钥轮换。

## JWT 签名密钥零停机轮换

### 时间线与最终状态

| 时间（UTC） | 事件 | 已确认结果 |
| ----------- | ---- | ---------- |
| 18:27:55 | 迁移 legacy JWT secret | HS256 为 `in_use`；平台同时创建 ES256 `standby` |
| 18:32:56 | 公网 JWKS 首次可见 | 1 个 `EC` / `ES256` / `sig` 公钥，不含私钥材料 |
| 18:48:08 | 缓存等待结束 | 自 standby 创建后已超过 20 分钟，期间 HS256 始终为 current |
| 18:48:24 | 旋转 signing key | ES256 为 `in_use`；HS256 为 `previously_used` |
| 轮换后复查 | 管理面与公网 JWKS | 状态保持不变；JWKS 仍发布 1 个 ES256 公钥 |

轮换前管理面没有新式 signing key，公网 JWKS 的 `keys` 也为空。轮换期间和轮换后均未 revoke、delete 或导出任何私钥/legacy secret；旧 HS256 保留为 `previously_used`，可接受未过期旧会话并作为回滚基础。

### 新旧 token 与三函数鉴权矩阵

测试使用单独创建、已确认邮箱的临时 Auth 用户和最小简历。所有 token、refresh token、service-role key、用户/简历/version/scope 标识均只存在于内存和长驻 shell 变量，没有写入命令参数展开、仓库、日志或本文。`llm-proxy` 正例测试前把该临时用户额度设为已耗尽，确保合法 JWT 只能到达额度门禁，不调用上游模型、不产生费用。

| 路径 | 身份 | 结果 | 结论 |
| ---- | ---- | ---- | ---- |
| comments owner bootstrap | 轮换前旧 HS256 | 200，`legacy_auth`；首次 `repair=true`，第二次 `repair=false` | 旧密钥兼容与受控 repair 正常 |
| comments owner bootstrap | 轮换后旧 HS256 | 200，`legacy_auth`，`repair=false` | 旧 token 未被强制失效 |
| comments owner bootstrap | 刷新后的新 ES256 | 200，`local_jwks`，`repair=false` | 新 token 进入本地 JWKS 分支 |
| share owner POST | 新旧 token | 均为 400 `missing shareId` | 两种 token 均越过鉴权，未执行写入 |
| llm-proxy POST | 新旧 token | 均为 403 额度门禁 | 两种 token 均越过鉴权，未调用上游 |
| comments | 无头 / 非法 JWT | 401 / 401 | 拒绝保持不变 |
| share | 无分享 token / 非法 JWT | 404 / 401 | 公开读取与 owner 鉴权边界保持不变 |
| llm-proxy | 无头 / publishable Bearer / 非法 JWT | 401 / 401 / 401 | 匿名和非法身份保持拒绝 |

新 token 首次样本为 `auth_local=188.4 ms`、`rpc=235.2 ms`、`edge_total=430.9 ms`；第二次为 `auth_local=142.1 ms`、`rpc=117.8 ms`、`edge_total=267.1 ms`。20 轮中观测到最快 `auth_local=0.8 ms`，也有不同 isolate/JWKS 缓存状态下的更高值，因此只确认鉴权模式为本地 JWKS，不把“本地验签”描述成固定零耗时。

完成远端验证后已硬删除临时 Auth 用户。Auth 管理查询返回 404，按用户查询 `resume_config` 剩余 0 行；相关版本、评论 scope 和额度行随外键级联删除，测试数据不可恢复。

## 20 轮区域基准

基准对同一 owner、同一 access body、同一已预热 scope 顺序执行 `auto` 与 `us-east-1`，每个区域 20 个正常热 POST；每组先单独执行一次 OPTIONS。脚本强制全部 POST 为 2xx、协议元数据存在、鉴权模式与预期一致、`repair=false`，强制区域还要求返回的 Edge region 精确匹配。

| token / 路由 | OPTIONS | count | P50 | P95 | max | Edge region | 响应字节 | 门禁 |
| ------------ | ------: | ----: | --: | --: | --: | ----------- | -------- | ---- |
| HS256 / auto | 816.5 ms | 20 | 609.1 ms | 870.1 ms | 1559.3 ms | `us-west-1` | 2353–2354 | 全 200、`legacy_auth`、`repair=false` |
| HS256 / us-east-1 | 402.7 ms | 20 | 499.9 ms | 890.3 ms | 977.0 ms | `us-east-1` | 2353 | 全 200、`legacy_auth`、`repair=false` |
| ES256 / auto | 861.6 ms | 20 | 494.9 ms | 751.5 ms | 1275.7 ms | `us-west-1` | 2352–2353 | 全 200、`local_jwks`、`repair=false` |
| ES256 / us-east-1 | 401.6 ms | 20 | 486.6 ms | 975.1 ms | 998.6 ms | `us-east-1` | 2352 | 全 200、`local_jwks`、`repair=false` |

区域选择使用新 ES256 热路径：`auto` 的 P95 比强制 `us-east-1` 低 223.6 ms，P50 只慢 8.3 ms（约 1.7%），符合“P95 更低且 P50 无显著回退”的规则。因此保留 `auto`，不修改 `VITE_RESUME_COMMENTS_FUNCTION_REGION` 或客户端代码，也保留自动故障转移。

同路由对比中，ES256 / auto 相比 HS256 / auto 的 P50 从 609.1 降至 494.9 ms，P95 从 870.1 降至 751.5 ms。本结果是当前客户端网络位置和时段的 20 轮样本，不承诺绝对延迟，也不把 OPTIONS、网关、调度或外部传输归入数据库耗时。

数据库运行态补充：`pg_stat_statements` 中聚合 RPC 主记录累计 67 次、总执行 3591.3 ms、平均 53.6 ms、返回 67 行；最终 fresh advisors 为 security 61、performance 102。该统计只衡量 PostgreSQL 执行，不等同于上表端到端时间。

## 尚未形成证据的验收项

- 当前没有可控制且已登录的真实浏览器会话，因此未完成 Network 面板中的“第二次同源不重复 OPTIONS”、IndexedDB/Store/Realtime 提交顺序验证；Node/HTTP 基准不能替代浏览器证据。
- 本轮真实会话覆盖 owner、新旧 JWT 和三个 Edge Function 鉴权边界，但没有重做 collaborator editor/viewer、share 登录/访客/密码代次、权限撤销/过期，以及 0/1/多线程、多级回复、删除、read cursor 的完整功能矩阵。
- 全量 TypeScript 仍被既有 assistant/tracker UI 类型错误阻断；全量 ESLint 仍被用户暂存的 brainstorm HTML 与既有格式问题阻断。四个 comments/auth 专项 verifier、目标 ESLint、生产构建和 `git diff --check` 均通过。

因此，任务 7 的签名密钥迁移和任务 8 的新旧 token/20 轮区域基准已完成；原设计的真实浏览器与完整业务矩阵仍保持未勾选，不据此宣称整个设计任务已完成。
