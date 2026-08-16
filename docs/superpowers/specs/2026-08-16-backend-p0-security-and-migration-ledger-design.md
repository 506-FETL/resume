# 后端 P0 权限封堵与迁移账本对齐设计

## 背景与已确认事实

本设计是后端风险优化的第一批交付，只处理会直接造成越权、额度破坏或阻断后续安全迁移的事项。其余 AI 计费原子性、统一可观测性、锁顺序、测试体系、初始化基线、定时清理和 CORS 收敛分别进入后续规格，避免把多个可独立回滚的风险塞进一次上线。

当前代码与线上项目 `bitxrpdtlohlnywgusfw` 的只读核验确认：

- `check_ai_quota(uuid, integer)` 与 `consume_ai_credits(uuid, integer, text)` 是 `SECURITY DEFINER`，接收任意用户 ID；线上却同时允许 `anon`、`authenticated` 和 `service_role` 执行。攻击者可以查询或消耗其他用户额度。
- `get_ai_quota()` 只使用 `auth.uid()`，可以继续供 `authenticated` 调用，但线上额外授予了 `anon`。
- 8 个仓库内无调用点、线上无触发器依赖的模板旧函数仍允许 `PUBLIC`、`anon` 和 `authenticated` 执行。其中部分函数接收任意 `resume_id` 或 `user_id`，没有调用者所有权约束。
- `set_github_stars(text, text, integer)` 允许匿名调用者提交任意仓库与非负 star 数；`get_github_stars(text, text)` 也接受任意仓库参数，并在数据库事务内发起 HTTP 和写缓存。当前产品只读取 `506-FETL/resume`。
- `postgres` 与 `supabase_admin` 在 `public` schema 的默认函数权限会自动向 `anon`、`authenticated` 和 `service_role` 授予执行权。仅修现有函数不能防止同类问题复发。
- 线上迁移账本使用版本 `20260815164604` 与 `20260815170650`，本地同名迁移却使用 `20260816000001` 与 `20260816000002`。`supabase migration list --linked` 因而同时显示两条 remote-only 和两条 local-only 记录。
- `supabase/migrations/init_table.sql` 因文件名不符合 `<timestamp>_<name>.sql` 被 CLI 跳过。完整空库基线需要单独重建，不在本批次中顺带修补。

## 目标

- 立即阻止浏览器匿名或普通登录用户直接调用仅应由服务端执行的高权限 RPC。
- 保留现有前端需要的最小读取能力：登录用户读取自己的 AI 额度，所有用户读取固定项目的 GitHub star 数。
- 阻止 GitHub Stars 接口被用于伪造共享缓存、制造任意外部请求或扩张缓存表。
- 修改默认函数权限，使后续新建函数不再自动暴露给 `anon` 与 `authenticated`。
- 在新增任何安全迁移前，让本地与线上迁移版本一一对应，恢复可审计的迁移顺序。
- 通过单一安全迁移完成数据库权限变更，支持明确的上线前检查和上线后验证。

## 非目标

- 本批次不重构 AI 额度为“预留、结算、释放、冲正”流水；该设计需要独立的数据模型和失败恢复规格。
- 不在本批次移除 `pgsql-http` 或建设 Edge 定时刷新；这里只把入口限制为固定仓库并取消客户端写缓存。
- 不修复 `get_ai_quota()` 的读锁与 UTC 重置语义。
- 不重排评论路径锁顺序，不加入 pgTAP，不清理历史幂等与限流数据。
- 不把 `init_table.sql` 直接重命名成基线。它的依赖顺序、重复定义和与线上 schema 的差异必须在独立的“空库可重放”规格中处理。

## 方案比较

### 方案 A：只修当前两个 AI RPC

仅撤销 `check_ai_quota` 和 `consume_ai_credits` 的公开权限。改动最少，但模板旧函数、GitHub 缓存写入口和默认函数授权仍会留下同级漏洞；下一次创建函数还可能再次暴露。

### 方案 B：权限边界封堵 + 默认权限防复发 + 迁移账本对齐（采用）

先对齐两个同名迁移的本地时间戳，再新增一条原子安全迁移：收紧 AI、模板旧函数和 GitHub Stars 权限，限制固定仓库，并修正默认函数权限。同时移除前端 `set_github_stars` 回写。该方案覆盖当前暴露面与制度性根因，改动仍可在一个数据库迁移和一个非关键 UI 数据路径内独立验证、独立回滚。

### 方案 C：一次完成全部后端风险重构

同时改计费、日志、锁、基线、定时任务、CORS 与函数权限。覆盖面最大，但上线变量过多，无法把权限回归与计费回归隔离，任何失败都难以快速定位和回滚，因此不采用。

## 迁移账本设计

本地两条迁移的名称与线上记录一致，版本号不同：

| 当前本地版本 | 线上版本 | 迁移名称 |
| --- | --- | --- |
| `20260816000001` | `20260815164604` | `grant_resume_share_allow_comments_insert` |
| `20260816000002` | `20260815170650` | `add_resume_comment_thread_read_states` |

先以线上 schema 的可观察结果核验两条本地 SQL 已部署：列级 INSERT 权限、私有读状态表、索引、函数签名、函数体摘要和 ACL 均与本地迁移目标一致。核验通过后只修改本地文件名，使版本号与线上账本相同；不调用 migration repair，不改线上历史，也不重复执行迁移。

对齐后，`supabase migration list --linked` 必须满足：除无效的 `init_table.sql` 警告外，不再有 local-only 或 remote-only 记录。只有达到这一状态，才通过 Supabase CLI 生成新的安全迁移。

## 数据库权限设计

### AI 额度函数

- `check_ai_quota(uuid, integer)`：撤销 `PUBLIC`、`anon`、`authenticated` 的全部权限，只授予 `service_role` 执行权。
- `consume_ai_credits(uuid, integer, text)`：采用相同权限边界。
- `get_ai_quota()`：撤销 `PUBLIC` 与 `anon`，保留 `authenticated`，同时允许 `service_role` 供诊断或服务端调用。
- 三个函数的运行时 `search_path` 调整为空；函数现有表引用已使用 `public.`、身份函数使用 `auth.`，PostgreSQL 内置函数继续从隐式 `pg_catalog` 解析。

Edge Function 继续使用 service-role 客户端调用两个内部 RPC，前端继续只调用无参 `get_ai_quota()`，接口形状在本批次不变。

### 模板旧函数

对以下线上函数撤销 `PUBLIC`、`anon` 与 `authenticated` 的执行权，暂不删除对象，并保留 `service_role`：

- `decrement_template_likes(uuid)`
- `get_resume_template(uuid)`
- `has_liked_template(uuid, uuid)`
- `increment_template_likes(uuid)`
- `increment_template_usage(uuid)`
- `switch_resume_template(uuid, uuid, jsonb)`
- `sync_template_to_resume_config()`
- `update_template_custom_config(uuid, jsonb)`

仓库全量 RPC 调用搜索没有这些名称，线上依赖检查也没有发现触发器使用它们，因此收紧直接执行权不会影响当前代码路径。对象保留是为了让历史数据或未知旧客户端出现兼容性反馈时仍能基于原定义设计安全替代，而不是仓促恢复越权权限。

### GitHub Stars

保留现有 `get_github_stars(text, text)` 签名以避免前端接口迁移，但函数入口只接受大小写归一后的 `506-FETL/resume`；其他 owner/repo 在任何 HTTP 或写表操作前返回参数错误。函数改用空 `search_path` 与全限定对象引用。

`set_github_stars(text, text, integer)` 撤销 `PUBLIC`、`anon` 与 `authenticated` 的执行权，只保留 `service_role`。前端保留 GitHub 公共 API 的展示级兜底：数据库返回 stale 时仍可直接请求 GitHub 并在当前页面显示数值，但不再把浏览器提供的数据写回共享表。该路径失败时继续静默展示旧缓存，不影响核心业务。

这一步把任意外网目标、任意缓存 key 和伪造共享值的风险封住；数据库事务内 HTTP 的架构问题留给后续 Edge 缓存规格彻底解决。

### 默认函数权限

安全迁移分别修改 `postgres` 与 `supabase_admin` 在 `public` schema 下的默认函数权限：

- 撤销 `PUBLIC`、`anon` 与 `authenticated` 对未来函数的默认执行权。
- 保留 `service_role` 的默认执行权，避免 Edge 内部 RPC 因新增函数漏配而不可用。
- 任何确实面向浏览器的函数，都必须在创建函数的同一迁移中按完整签名显式授权。

本批次不修改表和序列的默认权限。表数据仍由 RLS 与显式策略保护，扩大该范围会带来不必要的兼容性风险。

## 变更原子性与部署顺序

本地迁移文件名对齐是纯仓库历史修正，数据库权限变更集中在随后新建的一条迁移中。安全迁移不删除函数、不修改业务表数据，所有 ACL、默认权限和 GitHub 读取函数替换在同一数据库事务内完成，避免出现只封住部分入口的中间状态。

前端移除共享缓存写回必须与安全迁移进入同一发布批次。即使前端先发布，唯一影响也是 stale 时不再更新共享缓存；即使数据库先发布，旧前端对 `set_github_stars` 的失败已被 `.catch(() => {})` 吞掉，star 数仍会使用直接 GitHub 请求结果展示。因此两端发布顺序不会中断核心页面。

## 错误处理与兼容策略

- 非固定 GitHub 仓库调用返回明确参数错误，不进入网络请求和缓存写入。
- 未授权 RPC 由 PostgREST 返回权限错误，不在高权限函数内部伪装成功。
- 如果发现模板功能仍依赖某个旧函数，不恢复接受任意资源 ID 的公开 `SECURITY DEFINER`。应新增使用 `auth.uid()` 或服务端断言、验证资源所有权的窄接口，再按所需角色单独授权。
- 如果安全迁移执行失败，PostgreSQL 事务整体回滚，不留下部分 ACL 状态。

## 验证与验收

上线前必须完成：

- `supabase migration list --linked` 不再出现四条迁移账本偏差。
- 仓库 RPC 调用清单确认：AI 内部 RPC 只来自 `llm-proxy`，前端只调用 `get_ai_quota()`；模板旧函数无当前调用点；前端不再调用 `set_github_stars`。
- 对新安全迁移执行 SQL 静态检查，并在可用的隔离数据库或临时环境验证函数签名与权限语句可执行。
- 运行相关 TypeScript 类型检查、定向 lint、生产构建和 `git diff --check`。

上线后通过只读 SQL 验证：

- `anon` 与 `authenticated` 无权执行两个 AI 内部 RPC、`set_github_stars` 和 8 个模板旧函数。
- `authenticated` 仍可执行 `get_ai_quota()`，`anon` 不可执行。
- `anon` 与 `authenticated` 仍可执行 `get_github_stars(text, text)`，但只有固定仓库参数可通过。
- 新默认函数权限不再包含 `PUBLIC`、`anon` 或 `authenticated`。
- Supabase security advisor 没有因本迁移新增告警。

最小业务冒烟覆盖：登录用户打开 AI 功能可读取自己的额度；`llm-proxy` 的额度预检和扣减 RPC 不因权限改变而报错；站点头部仍能显示 `506-FETL/resume` 的 star 数；简历编辑、分享与评论主路径不受影响。

## 回滚原则

- 本地迁移文件名如核验失败，在提交前恢复原名并停止新增迁移；不修改线上迁移账本来迎合本地错误。
- 数据库安全迁移如因语法或环境差异失败，由事务自动整体回滚。
- 已成功上线后若 GitHub star 展示异常，可回滚固定仓库函数实现或前端展示逻辑，但不恢复匿名共享写入口。
- 已成功上线后若发现旧模板调用，优先上线带身份与所有权校验的兼容函数；不得把无校验的旧函数重新授予浏览器角色。
- AI 内部 RPC 的浏览器执行权属于已确认漏洞，不作为常规回滚项。若 Edge Function 因权限异常不可用，只修复 `service_role` 授权。

## 后续批次

第一批与后续规格按以下顺序推进：

1. 先恢复早期迁移、对齐 2026-08-15 文件名并修复远端迁移账本；这是创建任何新安全迁移的前置条件。
2. 收紧高权限函数 ACL 与基础数据 RLS：除分享快照与对应评论的 Edge 授权边界外，禁止匿名或其他用户读写 owner 数据。
3. AI 原子预留、幂等请求流水、结算/释放、UTC 日桶与超时冲正。
4. 请求 ID、结构化状态日志、四类关键错误率、CORS allowlist 与可用告警出口。
5. 评论写路径统一锁顺序、死锁监控、数据库契约测试与历史函数 `search_path` 收敛。
6. 完成空库 reset/pgTAP CI 门禁。
7. GitHub Stars 上移 Edge 缓存，数据库退出同步网络 I/O。
8. 幂等、限流、会话、计费与运维事件按 TTL 分批清理。
