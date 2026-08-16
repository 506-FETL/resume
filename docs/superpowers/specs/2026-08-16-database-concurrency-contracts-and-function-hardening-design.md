# 数据库并发契约、自动化测试与函数安全收敛设计

## 背景

数据库逻辑目前集中在多个大型迁移中，评论相关单文件最高约 1500 行。关键事务依赖多层 IF、幂等表、限流桶与多行 `FOR UPDATE`，但仓库没有持续执行的数据库契约测试。

只读审计还确认了一个具体锁顺序反转：

- `create_next_resume_version` 按 `resume_config → resume_config_versions → resume_comment_scopes` 取锁。
- 最新 `sync_resume_version_comment_document_v3` 外层先锁 `resume_comment_scopes`，再调用内层函数锁 `resume_config_versions`。

两条并发路径可形成 version ↔ scope 等待环。现有“按约定写代码”不足以防止后续迁移再次改变顺序。

此外，线上仍有历史函数使用 `search_path=public` 或未固定 search_path；Security Advisor 已列出多个 mutable search path 告警。部分函数只在 trigger 中使用，部分是无调用点的旧 API，必须按用途分别处理，不能机械地只执行 `ALTER FUNCTION SET search_path=''` 后让未限定引用在运行时失效。

## 目标

- 定义并落实全库写事务的规范锁顺序，消除已知 version/scope 反转。
- 为额度、RLS、限流、幂等、评论锚点、状态迁移与函数权限建立可在 CI 重放的数据库契约测试。
- 对需要并发验证的路径增加多连接压力测试，不能用单会话 pgTAP 代替死锁证明。
- 全量盘点 public/private 函数的用途、ACL、`SECURITY DEFINER` 与 search_path；保留的函数统一 `SET search_path=''` 并使用全限定名。
- 新策略/分类/展示逻辑默认留在 TypeScript；只有必须原子修改多行的最小事务逻辑进入 SQL。
- 把 `40P01` 纳入稳定错误映射和自动告警。

## 非目标

- 不把现有全部 PL/pgSQL 重写成 Edge Function；需要原子一致性的写事务仍应留在数据库。
- 不用测试替代真实浏览器、流式连接或区域性能验收。
- 不在生产数据库创建测试账号或运行破坏性并发测试。
- 不为了消除 advisor INFO 而给 service-role 专用表添加公开 RLS policy。

## 方案比较

### 方案 A：只在文档中写锁顺序

成本最低，但无法阻止 SQL 重构时重新引入反转，也无法证明复杂幂等与权限契约。

### 方案 B：pgTAP 契约 + catalog 静态门禁 + 多连接并发测试（采用）

pgTAP 验证确定性数据库行为，Node/HTTP 或 PostgreSQL 多会话 harness 验证并发，catalog gate 阻止危险 ACL/search_path 回归。三者职责清晰，能覆盖单一工具无法证明的部分。

### 方案 C：引入大型 ORM/迁移测试框架并上移全部 SQL

会引入与现有 Supabase/PostgREST 架构不匹配的大规模改造，且 ORM 不能替代数据库锁和 RLS 测试，本轮不采用。

## 规范锁顺序

所有会同时持有多类业务行锁的写事务遵循：

1. 幂等请求行：`*_requests`
2. 限流桶：`*_rate_limits`
3. 所有权/根对象：`resume_config` 或 `resume_shares`
4. 版本：`resume_config_versions` 或 `resume_share_releases`
5. 评论 scope：`resume_comment_scopes`
6. thread
7. comment/event sequence
8. read-state/collaboration 派生行

同一类别多行始终按稳定主键升序锁定。不得在持有较低序号的锁后再获取较高优先级的锁；函数调用链也视为同一事务，外层必须知道内层会取哪些锁。

AI 额度使用独立顺序：request ledger → user quota account → UTC daily bucket。它与评论/分享对象不交叉。

## 已知反转修复

`sync_resume_version_comment_document_v3` 不再通过“外层 scope/read-state 锁 → 内层 version/scope 锁”的包装结构执行。采用单一事务函数或私有核心函数：

- 先 claim 幂等请求。
- 验证并锁 owner/version。
- 再锁 scope。
- 保存旧 read cursor、执行文档/锚点更新、恢复 cursor。
- thread relocations 按 thread ID 排序后逐行锁定。

`create_next_resume_version` 也在事务入口先建立幂等语义或明确标记为非重试 RPC，然后继续 root → version → scope。两条路径都保持 version 在 scope 之前。

对所有相关函数设置有限 `lock_timeout`，将无法及时取得锁映射为可观测的冲突，而不是长时间占用连接。`40P01` 不自动在 SQL 内吞掉或无限重试；Edge 只对确认幂等的操作允许一次带抖动重试。

## pgTAP 契约测试

测试放在 `supabase/tests/database/`，通过 `supabase test db` 在本地重放后的数据库执行。测试数据在事务内创建并回滚。

### 权限与 RLS

- 两个 authenticated identity 的 owner 隔离矩阵。
- 匿名只能通过 Edge 模拟契约访问分享快照/评论 scope，不能直连基础表或评论表。
- service-only RPC 对 anon/authenticated 的 `has_function_privilege` 为 false。
- 面向浏览器的函数只授予明确角色。

### AI 额度

- 预留、重复预留、参数冲突、额度不足、settle/release/reconcile 状态机。
- UTC 日桶、root unlimited 与纯读取 quota。
- 所有状态转换幂等，不出现负数日桶。

### 评论与分享

- request ID 幂等返回相同 response。
- 限流窗口、block、过期恢复。
- owner/share/comment token 的 scope 边界。
- 锚点合法/跨块/过期 revision、thread/comment 父子一致性。
- 分享发布与版本删除的约束。

### 函数与 schema

- 关键函数签名唯一，不残留旧 overload。
- `SECURITY DEFINER` 必须有固定空 search_path、明确 owner 和显式 ACL。
- trigger function 不允许浏览器直接 EXECUTE。
- public 表必须启用 RLS；公开访问例外必须出现在 allowlist 中。

## 并发测试

新增独立 harness，在本地 Supabase 或隔离测试项目上启动多连接：

- 20 个请求同时竞争最后 1 个 AI 积分，断言仅 1 个 reservation 成功。
- 相同 request ID 并发重放，断言只产生一行和一次计数。
- `create_next_resume_version` 与文档 sync 对同一 resume/version 并发循环，断言无 `40P01`，最终只能有一个 active version，revision 单调。
- 评论创建/回复/文档 relocation 与 mark-read 交叉运行，断言无死锁、无重复 event_seq、无半写 response。
- 每个场景记录成功/冲突/超时/死锁数和 P50/P95/max；预期业务冲突与基础设施死锁分开统计。

并发 harness 必须有总超时、测试数据命名空间和 finally 清理。生产环境只运行只读健康查询，不运行该压力测试。

## 函数 inventory 与处置

生成 catalog inventory：schema、完整签名、owner、language、security mode、proconfig、ACL、trigger/dependency、仓库调用点。

按以下类别处理：

1. **浏览器 API**：优先 SECURITY INVOKER + RLS；确需 definer 时内置 `auth.uid()`/owner 断言并最小授权。
2. **service-role RPC**：可保留 definer，但必须空 search_path、全限定引用、内部角色断言或严格 ACL。
3. **trigger function**：空 search_path、全限定引用，撤销浏览器直接执行权；trigger 不受该撤销影响。
4. **无调用/无依赖旧函数**：先由 P0 撤销浏览器权限；验证一个发布周期后删除，不让死代码长期留在 API schema。

已知需要收敛的历史函数包括 AI/GitHub（分别由对应规格处理）、分享限流/计数函数、`handle_new_user`、`update_updated_at_column`、`set_resume_config_version_no`、Automerge/协作 trigger 函数，以及旧模板函数。每个函数必须先把内部对象引用全限定，再设置空 search_path。

## SQL 边界规则

允许进入数据库：唯一性、外键、check、RLS、原子计数、幂等状态转换、必须在一个事务内完成的多表更新。

默认留在 TypeScript：模型选择、cost 分类、日志/错误展示映射、CORS、告警阈值、输入 schema、重试策略、产品文案。新增超过约 200 行或包含多个独立策略分支的 PL/pgSQL 必须先拆私有函数并补契约测试。

## CI 门禁

- `supabase db reset --local`
- `supabase test db`
- catalog 安全脚本：无意外公开 definer、无 mutable search_path、无未 allowlist 的宽松 RLS。
- 并发 harness 的短轮次 smoke；长轮次放手动/夜间任务。
- migration list 无 local/remote 漂移（联网部署门禁）与 `git diff --check`。

## 验证与验收

- 已知 version/scope 反转代码路径被移除，静态锁顺序断言通过。
- 并发场景连续多轮无 `40P01`；若出现一次即视为失败并保留 request ID/SQLSTATE。
- pgTAP 覆盖上述六类核心契约，失败能指出具体函数/策略而不是只报最终 HTTP 500。
- 全库保留函数的 mutable search_path advisor 告警清零；有意保留的例外必须在规格中具名，否则 CI 失败。
- 无调用旧函数从公开 API schema 移除或保持不可执行，不能仅靠注释说明“不要调用”。
- 新业务策略没有继续堆入现有 1000+ 行迁移文件；每次变更用新的聚焦迁移表达。

## 回滚

- 锁顺序重构保留旧函数定义的迁移前快照，但上线迁移显式删除旧签名，避免两个入口并存。
- 若新函数出现业务回归，回退到同一规范锁顺序的前一实现，不能恢复已知反转版本。
- 测试或 catalog gate 误报时修 allowlist/断言；不通过禁用整套安全门禁解决。
- 删除旧函数前先完成依赖和调用点证明；删除后的恢复必须以安全重建迁移完成，不从生产 catalog 手工复制执行。

## 参考

- [Supabase Database Testing](https://supabase.com/docs/guides/database/testing)
- [Supabase pgTAP](https://supabase.com/docs/guides/database/extensions/pgtap)
- [PostgreSQL Explicit Locking and Deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
