# 实时协作恢复与生命周期加固验证记录

## 1. 结论与证据边界

- 验证日期：2026-08-18（Asia/Shanghai）
- 计划：`docs/superpowers/plans/2026-08-18-realtime-collaboration-recovery.md`
- 实施前 HEAD：`b45d5da7ec452ae59b7bf50749b72429fb132e94`
- 本轮补充修复：`f603300`、`59924e9`、`6f31997`
- Supabase project ref：`bitxrpdtlohlnywgusfw`
- 本记录不保存 JWT、用户 ID、用户姓名、简历正文、邀请 token、完整 session ID 或服务密钥；下文测试会话统一写为 `sess-A`、`sess-B` 等脱敏标识。

当前结论：数据库 lease migration 与兼容 v1/v2 的 `resume-comments` 已按顺序部署；生产存量 Automerge 快照可重新加载，协作用户颜色符合编辑器依赖的六位 HEX 契约，未登录邀请会直接并稳定停留在登录页。服务端 lease/tombstone/TTL/cap/双协议矩阵已用隔离数据完成动态 smoke，最终本地门禁通过。

不能把本轮描述为“三端业务全矩阵已通过”：当前只取得一个可控制的匿名浏览器上下文和一次既有登录宿主页只读证据，未取得第二个已登录 guest 身份。双端结构化/富文本编辑、停止共享后的 Broadcast 即时踢出、丢 Broadcast 后 30 秒 renew 踢出、第二轮完整生命周期，以及新建简历保存后刷新，均保留为发布前的真实浏览器验收门禁。

证据类型约定：

- **真实浏览器**：通过应用内浏览器或当时已连接的登录浏览器直接观察页面、URL、正文与 console。
- **服务端动态**：对已链接 Supabase 项目调用真实 Edge/RPC；测试数据在事务回滚或专用清理步骤中回收。
- **线上只读**：迁移账本、函数版本、聚合数据与 Edge/Realtime 日志查询。
- **动态 verifier**：Node 中真实构造 Automerge Repo/文档并执行断言，或对源码 mutation 验证门禁会红；不等于浏览器业务验收。
- **静态审查**：TypeScript AST/源码契约与独立代码审查；不等于服务端或浏览器动态执行。

## 2. 部署前基线

| 项目                                    | 部署前结果                                                              | 证据类型      |
| --------------------------------------- | ----------------------------------------------------------------------- | ------------- |
| Git                                     | HEAD `b45d5da`；`main`；worktree clean                                  | CLI           |
| Supabase 链接                           | `bitxrpdtlohlnywgusfw`                                                  | CLI           |
| migration                               | `20260818051900` 仅本地、远端账本尚无该版本                             | CLI           |
| `resume-comments`                       | v23，ACTIVE，`verify_jwt=false`；函数体继续执行 JWT/会话/lease 业务鉴权 | 管理接口      |
| `pnpm verify:collab`                    | exit 0                                                                  | 动态 verifier |
| 任务 8 白名单 ESLint                    | exit 0                                                                  | ESLint        |
| `pnpm exec tsc --noEmit --pretty false` | exit 0                                                                  | TypeScript    |
| `pnpm build`                            | exit 0；仅既有 circular chunk 与大 chunk warning                        | 生产构建      |
| `git diff --check`                      | exit 0                                                                  | Git           |

## 3. 云端部署顺序与最终状态

严格执行了以下顺序，没有先部署依赖新列/RPC 的 Edge：

1. `supabase db push --linked --dry-run`：exit 0，只列出目标前向 migration `20260818051900_add_comment_collaboration_member_lease.sql`。
2. `supabase db push --linked --yes`：exit 0。
3. `supabase migration list --linked`：本地/远端均出现 `20260818051900`。
4. 在账本确认后才执行 `supabase functions deploy resume-comments --project-ref bitxrpdtlohlnywgusfw`。
5. 部署检查点为 v24、ACTIVE；最终复核时当前版本为 v25、ACTIVE，源码 SHA-256 仍为 `eabf91c9…b0b690d`。当前列表显示多个 Edge Function 在同一毫秒更新，故这里只记录“同源码后续版本递增”，不推断其外部触发原因。
6. 2026-08-18 18:01 CST 再次执行 migration/function list：`20260818051900` 本地/远端一致；`resume-comments` v25、ACTIVE、`verify_jwt=false`。

`verify_jwt=false` 是现有函数部署方式，不代表匿名放行。register/join/renew/leave/resolve 仍由函数体校验登录用户、resume、session、协议与 lease。

### 发布门禁没有被越过

- `VITE_COLLABORATION_PROTOCOL_V2_ENABLED` 保持关闭，客户端新建协议仍为 v1；源码只在环境值精确等于 `true` 时选择 v2。
- 云端 secret 名称只读核对未发现 `COLLABORATION_LEGACY_REGISTER_CUTOFF_AT`，本轮没有配置 legacy cutoff。
- 本轮没有前端生产发布授权或可证明的兼容前端覆盖，因此没有声称 compatible frontend 已发布，也没有冒险配置 cutoff。
- 安全 cutover 仍必须按以下顺序执行：发布支持 `[1, 2]`、但新建仍为 v1 的前端 → 证明覆盖稳定 → 配置明确 UTC cutoff → 从 cutoff 起完整等待 8 小时且遥测确认 active v1 为 0 → 再开启 v2 新建。
- 旧前端不能加入 v2；在上述门禁完成前不能宣称完全跨版本兼容。

## 4. 服务端动态 smoke

测试使用隔离 resume/session/user 标识。数据库断言放在显式事务中并回滚；Edge 负向/幂等请求完成后核对表状态并清理。报告只保留脱敏会话名和结果，不保留 token/JWT。

|   # | 场景                                                  | 实际结果                                                                                                                          | 证据类型                      |
| --: | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
|   1 | v2 owner 首次 register、相同请求重试、竞争 register   | 首次返回 host lease；重试复用同 lease；竞争只有一个 winner                                                                        | 服务端动态                    |
|   2 | active 不同 register、revoked/expired session ID 重用 | active lease 不旋转；已退休 ID 返回 `session_id_retired`                                                                          | 服务端动态                    |
|   3 | 兼容客户端加入既有 v1，后续 renew/leave 沿用实际协议  | 响应协商 v1，后续操作保持 v1；无 capability 客户端不能操作 v2 行                                                                  | 服务端动态                    |
|   4 | v2 guest 相同 token 重试与不同 token 竞争             | 相同 token 返回同 `memberLeaseId`、JWT 与非空 bootstrap；竞争返回 `member_lease_conflict`                                         | 服务端动态                    |
|   5 | v2 原子 renew、旧/撤销/过期 token；v1 renew           | attempt 与 projection 同步延长到上限；无效 v2 token 返回 401 `unauthorized`；v1 保持 session 级语义                               | 服务端动态                    |
|   6 | release-before-claim：A leave 后迟到 A join           | leave 写入 tombstone 并返回 `revoked: true`；迟到 join 返回 `member_lease_retired`                                                | 服务端动态                    |
|   7 | A 退出、B 接管、late A；过期 A 后 B 接管              | B 可接管；A attempt 不能复活                                                                                                      | 服务端动态                    |
|   8 | guest leave 首次/重试与旧 token 迟到 leave            | 首次与重试均为 `revoked: true`；旧 token 不撤销新 projection                                                                      | 服务端动态                    |
|   9 | owner leave、同 lease 重试、错误 lease                | 同事务撤销 session/member/attempt；幂等重试为 true；错误 lease 为 false                                                           | 服务端动态                    |
|  10 | host register 响应丢失后重试                          | 同 resume 复用 pending session ID 并取回 winner host lease；只在明确 retired 后换 ID                                              | 服务端动态 + verifier         |
|  11 | generation A 迟到 catch，generation B 已接管          | 客户端 store 由 B 取得 owner generation；A 不 revoke、不清 B pending                                                              | mutation verifier + 静态审查  |
|  12 | legacy cutoff 前后                                    | 以隔离参数模拟 cutoff：此前可建 v1；之后既有 v1 可重试，新 v1 返回 426 `upgrade_required`，capable 客户端与既有 v1 drain 不受影响 | 服务端动态；未修改生产 secret |
|  13 | 每 session/user 32 attempt cap                        | 第 33 个 claim/release 均为 `attempt_limit` 且不增行；已有 token 仍可 renew/release                                               | 服务端动态                    |
|  14 | v1/v2 隔离                                            | v1 只能操作 v1 行；无 token leave、旧 JWT、迟到 v1 join 不能读写 v2 projection/ledger                                             | 服务端动态                    |
|  15 | host leave 后 guest renew / 新 join                   | renew 返回 401 `unauthorized`；新 join 在下发快照前拒绝                                                                           | 服务端动态                    |

本机执行 `supabase test db --linked` 仍被 Docker/Podman 不可用阻断，没有把它记为通过。等价动态证据来自已链接项目上的官方 SQL 执行接口：显式 `BEGIN`、构造隔离数据、调用真实 RPC、逐项断言、`ROLLBACK`。回滚后没有保留 smoke session/member/attempt 数据。

## 5. 线上日志与数据格式证据

### Edge 与 Realtime

- 查询窗口：2026-08-18 17:40:11–17:59:51 CST。
- `resume-comments` 真正进入 v25 deployment 的 96 次调用：92×200、2×401、2×404、0×函数内 5xx。401/404 来自负向授权/不存在场景。
- 同窗口另有 1 次 503：17:50:12 CST、耗时 9 ms、没有 deployment ID 和 function version，说明它没有进入可识别的 versioned function deployment，元数据与函数执行前的网关层失败一致。没有把它隐藏或写成“线上完全无 5xx”；后续若持续出现，应从网关/部署切换层继续排查。
- Realtime 协作 topic 有 67 条 cursor broadcast，错误关键词聚合为 0。日志包含的真实 topic/user payload 仅用于只读诊断，没有写入本报告。
- “无跨 resume 快照读取”主要由服务端授权/协议隔离 smoke 证明；Realtime 日志本身不足以证明这一点，因此没有用日志替代授权验收。

### 生产 Automerge 快照根因与修复

只读聚合确认 `automerge_documents.document_data` 为 `bytea`，线上 15/15 行实际形态是“Base64 ASCII 再包一层 bytea”；二次解码后的前 4 bytes 均为 Automerge magic `856f4a83`。旧 decoder 对 `\\x<hex>` 只做 hex 解码，得到 Base64 ASCII 而非 Automerge bytes，`repo.import()` 因此抛出 `Invalid magic bytes`。没有创建空文档 fallback，也没有覆盖或重写任何生产快照。

`f603300` 使用 magic-aware 解码：

- 原始 Automerge binary bytea 保持原 bytes；
- 生产 bytea-wrapped Base64 二次还原；
- plain Base64 正确还原；
- 畸形或非 Automerge ASCII 不被误当成有效快照，仍 fail-closed。

仓库动态 verifier 覆盖以上四类输入。独立审查另用一次性 Node 脚本测试约 1.06 MB 不可压缩快照，包裹解码约 44 ms，未见参数栈风险；该性能检查不是 `pnpm verify:collab` 的可复跑用例。解码修复的独立代码审查通过，Critical/Important/Minor 均为 0。

## 6. 浏览器验收

### 已真实执行

| 时间         | 上下文/场景                                                  | 预期                                      | 实际                                                                                                                                                                                                  | 证据类型             |
| ------------ | ------------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 17:33 CST 后 | 已有非空生产简历 `prod-resume-A`                             | 旧快照可加载，不回退空简历                | 编辑器正文与多段既有模块成功出现；没有 `Invalid magic bytes`，没有写回生产快照                                                                                                                        | 真实登录浏览器，只读 |
| 17:46 CST 后 | 匿名 visitor 打开标准邀请 `sess-anon-A`                      | 直接进入 `/login?redirect=...` 并稳定停留 | 0–300 ms 为邀请页；约 350 ms replace 到 login；修复前约 400 ms 会被退出动画中的 Editor 再推到 `/resume`，修复后持续观察至 1150 ms 仍在 login；loading=0、加载错误=0、登录按钮=1、console warn/error=0 | 应用内真实浏览器     |
| 17:55 CST 后 | 匿名 visitor 打开尾斜杠 `/resume/editor/` 邀请 `sess-anon-B` | 与标准路径一致                            | 稳定停留 login；loading/error=0、登录按钮=1、console warn/error=0                                                                                                                                     | 应用内真实浏览器     |

匿名跳转的精确根因不是 Auth stale session：诊断日志显示 `INITIAL_SESSION=false`，loader 先看到 `invite + anonymous`，随后退出动画中仍挂载的 Editor 收到 login location，并把 login 的 query 误解为 owner route，读取残留 resume ID 后抛出“用户未登录”再导航 `/resume`。`6f31997` 改用同一 `useLocation()` snapshot，并在 query/文档加载前用 `matchPath('/resume/editor', pathname)` 阻断离开中的 Editor；只让 pathname/search 驱动 loader，hash 通过 ref 在匿名 redirect 时读取，避免 hash-only 导航重连 guest。

门禁同时覆盖：`/resume/editor` 和 `/resume/editor/` 合法，`/resume/editor/extra` 非法；精确字符串比较、误接子路径和重新加入 hash 依赖三个 mutation 均被拒绝。最终独立审查 Critical/Important/Minor 均为 0。

### 未取得足够身份，不能记为通过

Chrome 控制扩展连续超时，应用内浏览器没有第二个登录态。已穷尽安全的新建 tab、标准/尾斜杠匿名导航和既有绑定复用，但没有绕过登录、读取浏览器存储或伪造用户身份。

以下场景未完成真实浏览器业务验收：

1. host 开启协作后正文、滚动位置和 loader 调用次数不变；既有源码/verifier 已覆盖 no-op，但不等于本轮浏览器通过。
2. 已登录 guest 首屏完整正文、join 后再订阅 Automerge/Yjs，以及控制台无 `Document ... is unavailable`。
3. host/guest 双向修改结构化字段和富文本字段；自动保存后两端刷新仍保留。
4. host 停止共享后，guest 收到一次提示并立即 replace 到 `/resume`；旧链接再次打开不显示数据。
5. guest 丢弃 `share-ended` 后，在 30 秒 renew 周期内因 401 自动退出。
6. owner 无 sessionStorage host 标记打开自己的邀请后，经 `owner_must_host` 恢复宿主。
7. 第二轮完整开启、加入、编辑、停止生命周期。
8. 新建隔离简历、保存、刷新仍加载并安全清理。当前没有已登录可控上下文，未用 SQL 插入或 HTTP 响应冒充“新建简历业务验收”。
9. `A user uses an unsupported color format` 浏览器 console 回归。根因与动态颜色门禁已通过，但没有第二个可控协作者触发 awareness，故只记为代码/动态 verifier 通过。

## 7. 协作用户颜色告警

`@tiptap/y-tiptap@3.0.7` 的 decoration consumer 只接受 `/^#[0-9a-fA-F]{6}$/`，原 `getParticipantColor()` 固定返回 `hsl(...)`，因此真实协作者 awareness 会触发 unsupported color warning。`59924e9` 保留同一 FNV userId→hue 与 85%/60% 视觉参数，只把结果确定性转换为 `#RRGGBB`。

动态门禁覆盖六个 HSL sector 与 0/59/60/119/120/179/180/239/240/299/300/359 边界、同 ID 稳定、不同 fixture 非恒定、用户报告的 hue 55 精确为 `#f0e142`。恒定颜色与单区段错误 mutation 均会失败；独立复审 Critical/Important/Minor 均为 0。没有声称未实现的 UI 文字对比度 AA 保证。

## 8. 最终本地门禁

| 命令                                                                                                                                                                                   | 结果                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `pnpm verify:collab`                                                                                                                                                                   | exit 0                                           |
| `pnpm exec eslint scripts/verify-realtime-collaboration.ts src/lib/automerge/shared/utils.ts src/lib/collaboration/shared/color.ts src/pages/resume/editor/hooks/use-resume-loader.ts` | exit 0                                           |
| `pnpm exec tsc --noEmit --pretty false`                                                                                                                                                | exit 0                                           |
| `pnpm build`                                                                                                                                                                           | exit 0；仅既有 circular chunk 与大 chunk warning |
| `git diff --check`                                                                                                                                                                     | exit 0                                           |

## 9. 数据与回滚边界

- 生产存量简历只读加载，没有空文档 fallback、没有批量修数据、没有覆盖 `automerge_documents`。
- 服务端 smoke 使用事务回滚或精确测试数据清理；匿名浏览器使用合成 session/resume/document 标识，因未登录在 join 前即被拦截，没有创建云端成员。
- migration 是前向 schema/ACL/RPC 变更，不执行破坏性回滚；若 Edge 需要回退，应部署仍理解新 schema 的上一兼容函数版本，保留新增列、ledger 与 tombstone 数据。
- 没有执行 `git push`。

## 10. 后续安全 cutover 与剩余验收

在宣布“实时协作完整恢复并可切 v2”前，仍需：

1. 发布当前 compatible frontend，保持 v2 新建开关关闭，并证明活跃前端已覆盖。
2. 准备 host、已登录 guest、anonymous 三个隔离浏览器身份，按第 6 节未覆盖项完整执行第一轮与第二轮。
3. 真实验证停止共享的 Broadcast 即时踢出，以及丢 Broadcast 后 renew 401 的 30 秒兜底。
4. 创建一份明确隔离的新简历，保存/刷新后确认仍加载，再按精确 ID 安全删除。
5. 只有 compatible frontend 覆盖可证明后才配置 UTC legacy cutoff；完整等待 8 小时且 active v1 清零后，才能另行发布 v2 新建开关。

当前状态是“v1-compatible 能力恢复、云端 lease 后端就绪、关键故障已修并通过现有动态证据”；不是“已完成前端发布、三端全矩阵和 v2 cutover”。
