# 简历评论 Bootstrap 性能验证基线

- 记录日期：2026-08-14
- 函数：`resume-comments` v9（2026-08-14 05:03:19 UTC 为 ACTIVE）
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

本文件仅记录已确认的优化前基线；优化后结果、身份矩阵与 SQL 查询计划在后续部署验证中追加。

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

发布前函数源码已保存到本机忽略目录 `.superpowers/sdd/rollback-edge-before-bootstrap-optimization/`，可在兼容窗口内重新部署 v9、v15、v24。发布后重新下载三个函数，并与仓库内入口及相对依赖逐文件比较，结果一致。

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

Edge 日志已观测到 `resume-comments` v10 的成功 POST，但不以日志推断具体身份。合法 legacy owner/collaborator/share 正例、权限撤销与密码代次变化仍需使用不落盘的真实会话完成，完成前不进入签名密钥旋转。
