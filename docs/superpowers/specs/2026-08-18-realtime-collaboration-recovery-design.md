# 实时协作恢复与生命周期加固设计

日期：2026-08-18
状态：高层方案已确认，等待规格审查
范围：简历编辑器实时协作的开启、邀请加入、文档引导、在线同步、停止共享与失效恢复

## 1. 背景

当前实时协作同时出现四类回归：

1. 所有者开启协作成功的一瞬间，编辑器进入一次完整的简历重载，视觉上近似页面刷新。
2. 未登录用户打开协作链接后一直停留在“加载简历中”，不能及时进入登录流程。
3. 已登录协作者无法取得宿主文档，最终看到空白简历，并出现 `Document automerge:... is unavailable`。
4. 所有者停止共享后，已在线协作者不能可靠收到结束通知并自动退出。

近期实现尝试通过“先连接 Realtime、等待宿主 peer、再 `repo.find(documentUrl)`”解决首次加载，但它仍把首次文档可用性绑定在宿主在线状态和 Realtime 时序上，并保留了共享加载失败后创建空白文档的降级路径。继续增加延时或重试不能消除这一结构性风险。

本次设计将协作加入改为“服务端先鉴权并返回持久化快照，客户端确定性引导文档，再连接实时增量通道”，同时把协作开始、停止和失效处理收敛为明确状态机。

## 2. 已确认根因

### 2.1 开启协作触发整份简历重载

`use-collaboration-panel-value.ts` 在开启成功后向当前 URL 写入 `resumeId` 与 `collabSession`。`use-resume-loader.ts` 的加载 effect 又直接依赖 `collabSessionParam`，所以即使简历身份没有变化，也会重新执行 `loadResumeData()`。

`loadResumeData()` 开始时会清理同步任务、销毁现有 `DocumentManager`、重置编辑器状态并创建新 manager。这不仅造成可见的加载闪烁，还会销毁宿主刚刚建立的 Automerge adapter。协作 store 仍显示“协作中”，但真正承载文档同步的连接已经断开。

### 2.2 未登录状态与认证初始化状态混淆

用户 store 只保存 `currentUser: User | null`，其中 `null` 同时表示“尚未读取会话”和“已确认未登录”。协作者加载逻辑在 `currentUser` 为空时只维持 loading 并返回，因此未登录用户永久停在加载页。

### 2.3 共享加载失败后错误地创建空文档

协作者通过 `documentUrl` 加载失败后，持久化层继续尝试读取所有者数据。由于协作者不拥有该行，读取失败后又继续走 `createResumeDocument()`，把真实的共享文档故障转换成一份合法但空白的新文档。

共享邀请必须遵循 fail-closed：共享快照不可用、损坏、会话失效或文档 ID 非法时直接终止加入，绝不能进入普通简历回退或创建空文档。

### 2.4 停止共享消息存在发送和接收两端缺口

所有者当前执行顺序为：异步发起服务端 leave、发送 `share-ended`、立即断开 adapter。发送过程没有等待 Supabase Broadcast 服务端确认，因此频道可能在消息真正送出前被释放。

协作者侧还有第二个缺口：首次文档加载阶段创建的 adapter 只有 presence metadata；随后 `joinSession()` 复用同一 adapter 时没有更新 callbacks，因此 `onControlMessage` 可能从未绑定。即使 `share-ended` 已送达，也没有处理器触发自动退出。

### 2.5 加入顺序存在权限与数据循环依赖

当前协作者会先尝试连接公共 Automerge channel 和查找文档，随后才调用 Edge Function 执行会话授权。这样既形成首次加载循环，也让失效链接在服务端拒绝前先尝试文档同步。

## 3. 目标与非目标

### 3.1 目标

- 开启协作不重载、不替换、不销毁当前简历文档和编辑器实例。
- 未登录访问邀请时立即进入登录页，登录后安全返回原协作链接。
- 已登录协作者必须先通过服务端授权，再确定性加载所有者保存的 Automerge 快照。
- 共享加载失败明确报错并退出，任何情况下都不生成空白替代文档。
- 快照引导完成后继续使用 Automerge 增量、Yjs 富文本、Presence、光标和 UI 同步。
- 所有者停止共享后，协作者优先立即退出；广播丢失时也能在有界时间内退出。
- 已撤销或过期链接不能重新取得快照、续租权限或重新加入。
- 失败过程可恢复、可观测，避免重复 toast、重复导航和悬挂 loading。

### 3.2 非目标

- 本次不把全部协作频道迁移为 Supabase 私有 Realtime channel。
- 不重写现有 Automerge/Yjs 协议，不改变简历 CRDT schema。
- 不调整协作者的 editor/viewer 权限模型。
- 不处理 ATS 图、AI 画布或其他与本故障无关的功能。

## 4. 核心不变量

实现必须始终满足以下不变量：

1. **文档身份不变量**：一个协作会话内，宿主与协作者使用邀请 `documentUrl` 中同一个 Automerge document ID。
2. **授权先行不变量**：guest 在 Edge Function 授权成功前，不创建 Automerge/Yjs/光标/UI 协作频道。
3. **共享失败关闭不变量**：带有效邀请参数的加载只能成功得到共享文档或失败退出，不能回退成本人云端简历、IndexedDB 文档或空文档。
4. **宿主稳定不变量**：给当前简历增加协作 URL 参数不构成新的简历加载身份，不能触发 `loadResumeData()`。
5. **停止有界不变量**：服务端撤销是最终权威；广播负责即时通知，续租负责有限时间兜底。
6. **单次终止不变量**：无论广播、续租失败、频道关闭还是路由卸载谁先发生，guest 清理和导航只执行一次。

## 5. 总体架构

### 5.1 普通简历路径

普通编辑仍由 `useResumeLoader()` 按 `resumeId` 加载本人的在线或离线文档，不经过协作授权与共享快照引导。

### 5.2 宿主开启路径

宿主开启协作按以下顺序执行：

1. 确认当前 `DocumentManager` 和 handle 已就绪。
2. 将当前 Automerge 文档保存到 `automerge_documents`，保证服务端已有可引导快照。
3. 调用 `register_collaboration_session` 注册会话并取得 host lease。
4. 使用完整 callbacks 建立 Automerge adapter，并启动 Yjs、光标和 UI 同步层。
5. 进入 connected 状态，生成并展示分享 URL。
6. 用 replace 方式补齐当前地址中的会话参数，用于宿主刷新恢复；这一 URL 变化不触发简历 loader。

如果第 3 步之后任一步失败，应使用取得的 host lease 尝试撤销会话并释放所有本地协作资源，再进入 error 状态。

### 5.3 协作者加入路径

协作者加入拆为“认证、授权、文档引导、实时连接”四个阶段：

1. 路由识别同时存在且格式有效的 `resumeId`、`collabSession`、`docUrl`。
2. 等待认证状态从 unknown 变为 authenticated 或 anonymous。
3. anonymous：跳转 `/login?redirect=<安全的当前相对地址>`，不开始简历加载。
4. authenticated：调用 `join_collaboration_session`，请求中带会话和简历身份；Edge Function 验证登录用户、会话有效性和成员资格。
5. 如果当前用户是所有者，Edge Function 返回专用 `owner_must_host` 业务码，转入“宿主刷新与本人打开邀请”路径，不能把所有 `unauthorized` 都误判为所有者。
6. 普通协作者在同一次成功响应中取得评论权限和该会话简历的持久化 Automerge 快照。
7. 客户端校验并解析邀请 `docUrl`，解码快照，然后使用当前 Repo API 的 `repo.import(bytes, { docId })` 导入到邀请指定的 document ID。
8. 等待导入 handle ready，验证文档 schema 和 resume identity，再交给 `DocumentManager`。
9. 使用完整 callbacks 首次建立 Automerge adapter，随后启动 Yjs、光标和 UI 同步层。
10. 进入 connected 状态，展示简历并启动会话续租。

该流程不依赖宿主 peer 在首次加载的具体时刻在线。宿主在线时，快照之后的增量会继续通过 Automerge 同步；宿主短暂掉线时，协作者仍能以服务端最后保存快照进入，并在重连后合并增量。

### 5.4 宿主刷新与本人打开邀请

宿主刷新带协作参数的编辑器，或在新设备打开自己的邀请链接时，初始内存状态可能还没有 host role。该场景不能误走 guest 空文档路径：

1. 优先使用本地保存且与当前用户、resume、session 三者一致的 host role 恢复标记。
2. 没有可信本地标记时，先调用服务端 join 判定身份；只有专用 `owner_must_host` 才能转宿主恢复，普通 401/403 仍按失效处理。
3. 所有者按 owner source 加载自己的持久化文档，随后用同一 session ID 调用 register/resume，取得新的 host lease 并建立完整实时层。
4. 恢复过程不创建新 session ID，不让旧 guest 权限绕过服务端会话有效性。

## 6. 服务端契约

### 6.1 `join_collaboration_session` 响应扩展

现有评论权限字段保持不变，成功响应增加只用于首次文档引导的数据：

```ts
interface CollaborationJoinResult extends CollaborationCommentAccess {
  bootstrap: {
    documentData: string
    updatedAt: string
    documentVersion: number
    heads: string[]
  }
}
```

- `documentData` 使用可被现有 `decodeDocumentData()` 统一处理的 BYTEA/Base64 字符串。
- Edge Function 只能在 `getActiveCollaborationSession()` 和事务级成员 claim 成功后，根据 `session.resume_id` 与 `session.owner_user_id` 读取 `automerge_documents`。
- 不接受客户端提交的 owner ID，也不允许客户端用请求参数选择其他快照。
- 找不到快照、快照为空或查询失败时返回明确业务错误，例如 `collaboration_snapshot_unavailable`，不能返回成功但缺少 bootstrap。
- `renew_collaboration_session` 只续租成员与评论访问令牌，不重复下发大快照。
- 新 migration 为 session/member 增加 `protocol_version`，为 member 增加 `member_lease_id`，并提供仅 `service_role` 可调用的 host/member claim 与 revoke RPC。

### 6.2 错误码

前端至少区分：

- `unauthorized`：未登录、会话已撤销、成员已失效。
- `owner_must_host`：当前登录用户是简历所有者，应恢复为宿主而不是作为 guest 加入。
- `collaboration_snapshot_unavailable`：服务端没有可用快照。
- `collaboration_document_invalid`：客户端无法解析 docUrl、解码或导入快照。
- `collaboration_connection_failed`：快照成功但实时层连接失败。

所有错误以中文用户文案呈现，控制台保留结构化 code 和 cause，不能再只展示 Supabase Functions 的通用英文错误。

## 7. 客户端状态机

协作连接阶段扩展为：

```ts
type CollaborationPhase =
  | 'idle'
  | 'authenticating'
  | 'authorizing'
  | 'hydrating'
  | 'connecting'
  | 'syncing'
  | 'connected'
  | 'stopping'
  | 'ended'
  | 'error'
```

约束：

- 每次 start/join 分配 generation；旧 generation 的异步结果不得修改新会话状态。
- `isSharing` 由 phase 推导或只在 connected 时为真，不能与真实 adapter 生命周期脱节。
- stop/remote-end 共享同一个幂等 cleanup primitive。
- 页面 loading 由 loader 与 collaboration phase 共同决定，任何 error/ended 都必须结束 loading。
- 连接阶段变化使用现有轻量过渡；`useReducedMotion()` 时取消位移和时长，不能瞬间留下旧内容或空白占位。

## 8. 加载器与登录返回

### 8.1 认证三态

用户 store 增加明确认证状态，例如：

```ts
type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'
```

`getCurrentUser()` 完成后无论有无用户都必须退出 unknown。loader 不再使用 `currentUser === null` 推断“继续等待”。

### 8.2 安全 redirect

- 只允许以 `/` 开头、但不以 `//` 开头的站内相对路径。
- 不接受协议、host 或反斜杠形式，非法值回退 `/resume`。
- 登录页、已登录自动跳转 hook 与登录表单统一读取同一个经过清洗的 redirect。
- 登录成功使用 replace 导航回原邀请，避免返回键再次进入登录页。

### 8.3 稳定加载键

简历 loader 只根据实际文档身份启动：

- 普通路径：`resume:<resumeId>`。
- guest 邀请路径：`collab:<resumeId>:<sessionId>:<documentId>`。

宿主从普通路径开启协作后虽然 URL 新增 session 参数，但当前 store role 已是 host，加载键仍保持 `resume:<resumeId>`，因此不重载。

宿主刷新时若存在可信 host 恢复标记，直接保持 owner load key；没有标记时先做服务端身份判定，收到 `owner_must_host` 后切换到 owner 恢复流程，不执行 guest snapshot import。

## 9. 文档引导与持久化边界

### 9.1 新的共享引导入口

`AutomergeDocumentPersistence` 增加显式的 bootstrap/import 能力，guest 不再调用现有“共享 URL 查找失败后继续加载持久化文档”的组合路径。

建议把 manager 初始化参数区分为互斥联合：

```ts
type DocumentInitializationSource =
  | { kind: 'owner' }
  | {
      kind: 'collaboration'
      documentUrl: string
      documentData: string
      sessionId: string
    }
```

`kind: 'collaboration'` 下任何一步失败都抛出带 code 的错误，不执行 `loadPersistedHandle()`、`loadResumeConfig()` 或 `createResumeDocument()`。

### 9.2 写入权限

- guest 导入的 handle 可在内存、IndexedDB 与实时层中使用，但 `canPersistToSupabase` 必须保持 false。
- 只有 owner 能向 `automerge_documents` 和 `resume_config` 持久化。
- owner 收到 guest 的 Automerge 远端 change 后必须调度一次合并结果持久化；guest 本地 change 只进入 CRDT 实时同步，不能直接调用 owner-only 的 `resume_config` 写入。
- guest 的本地 IndexedDB 不能在下一次已撤销邀请中绕过服务端授权；每次邀请加载仍必须先 join 成功。

## 10. 停止共享与自动踢出

### 10.1 宿主停止顺序

`stopSharing()` 改为 Promise，并防止重复调用：

1. phase 进入 stopping，禁用重复点击，编辑器文档本身继续保留。
2. 调用 `leave_collaboration_session`，携带 host lease，等待服务端完成会话和成员撤销。
3. 服务端返回 `revoked: true` 后，通过启用 `broadcast.ack` 的 Automerge control channel 发送 `share-ended` 并等待 ack；设置短超时，避免 UI 无限等待。
4. 无论 ack 成功、超时还是失败，都执行本地幂等 cleanup：停止 Automerge/Yjs/光标/UI 协作层、清除会话存储、回到 idle。
5. 服务端撤销失败时不伪装成功：保留连接或进入可重试错误态，不能先断开后告诉用户“已关闭”。

服务端撤销是权威状态，广播只是降低协作者感知延迟。

### 10.2 协作者退出

guest 收到 `share-ended` 后：

1. 原子标记会话 ended，阻止后续 change/callback 写入。
2. 停止所有协作层并清除当前共享文档状态。
3. 展示一次“发起者已关闭实时协作”。
4. 使用 replace 导航到 `/resume`，不能留在可继续编辑的共享页面。

### 10.3 续租兜底

- connected guest 每 30 秒调用一次 `renew_collaboration_session`，页面从后台恢复可见时立即补一次。
- 401、`unauthorized`、会话撤销或成员撤销均走与 `share-ended` 相同的 remote-end cleanup。
- 临时网络错误不立即踢出；进入 reconnecting/error 提示并采用有限退避。连续失败但未得到权威撤销时，不把它误报为“宿主已停止共享”。
- 正常情况下广播使协作者立即退出；广播丢失时，已撤销会话最迟在下一次 30 秒续租内被发现。

## 11. Adapter 生命周期

- adapter 必须在授权和文档 import 后首次创建，并一次性携带完整 callbacks。
- 如果底层仍允许复用同 session adapter，必须提供 `setCallbacks()` 并更新 presence metadata；禁止返回带旧 callbacks 的实例。
- `broadcastControlMessage()` 返回 Promise，向上传递 send/ack 结果。
- disconnect 清理订阅、pending message、ready 状态和监听器；重复调用安全。
- Presence join 继续从 `newPresences` 解包，回调只接收真实远端 peer。

## 12. 错误体验

- 认证中：短暂显示“正在确认登录状态”。
- 未登录：直接跳转登录，不弹“加载简历失败”。
- 会话撤销/过期：显示“协作已结束或链接已失效”，返回简历列表。
- 快照不可用/损坏：显示“共享简历暂时无法加载，请联系发起者重新开启协作”。
- 实时连接失败但快照已加载：不显示空简历；展示可重试的连接错误，并禁止把 guest 状态保存为 owner 数据。
- 同一失败只产生一次 toast 和一次导航。

## 13. 兼容、发布与回滚

- 发布顺序固定为：先应用 `20260818051900_add_comment_collaboration_member_lease.sql`，再部署同时支持 v1/v2 的 `resume-comments`，最后发布明确发送 `protocolVersion: 2` 的新前端。不得 Edge-first 越过 migration。
- migration 将既有 session/member 回填为 protocol v1。旧已加载前端不发送协议字段，Edge 按 v1 处理；v1 register/join/renew/leave 只能读写 protocol 1 行，不能修改 v2 session/member。
- v2 session 的 host/member claim、leave 与 renew 强制 lease fencing；v2 collaborator JWT 同时绑定 `protocolVersion` 与 `memberLeaseId`。旧 JWT 缺少协议字段时只能按 v1 校验。
- v1 自然过期前保留双协议分支；确认所有 v1 session 过期后，另开迁移和 Edge 版本移除兼容，不能在本次发布中提前删除。
- 新前端遇到旧 Edge Function 或非 v2 响应时必须 fail-closed 并提示服务版本不匹配，不能回退空文档。
- 回滚新前端时，dual-protocol Edge 继续服务 v1；migration 和 fencing RPC 不回滚。部署后记录 migration 账本、Edge 版本以及 v1/v2 隔离 smoke。

## 14. 验证与验收矩阵

### 14.1 确定性验证

- 对共享 import 增加隔离验证：给定 Automerge binary 和指定 document ID，导入后内容、schema 与 document URL 一致。
- 验证 collaboration source 失败时不会调用 owner fallback 或 `createResumeDocument()`。
- 验证 loader key：host 增加会话参数不增加 `loadResumeData()` 次数；切换 resume/invite 会正确启动新 generation。
- 验证 stop 顺序：revoke 完成后才 broadcast，broadcast 完成/超时后才 disconnect。
- 验证 remote-end cleanup 对广播和续租同时到达是幂等的。
- 运行目标 lint、类型检查/生产构建和 `git diff --check`；既有无关基线错误单独记录。

### 14.2 浏览器业务验收

至少使用宿主、已登录协作者、未登录访客三个隔离浏览器上下文：

1. 宿主打开非空简历并开启协作：内容、滚动位置和编辑器实例不闪烁、不进入加载页。
2. 未登录访客打开链接：立即进入登录页；登录成功自动返回原链接。
3. 已登录协作者加入：首屏为宿主完整简历，无空白模板，无 unavailable 警告。
4. 宿主与协作者分别修改结构化字段和富文本：双向同步且刷新后保留。
5. 协作者刷新页面：重新授权并用快照引导成功，不依赖旧 IndexedDB。
6. 宿主停止共享：协作者立即收到提示并自动离开编辑器。
7. 人为丢弃 `share-ended`：协作者在一次续租周期内自动离开。
8. 使用已撤销链接重新访问：服务端在下发快照前拒绝，页面不展示共享数据。
9. 宿主刷新恢复或重新开启新会话：旧会话仍失效，新链接可正常使用。
10. 所有者在无本地 host 标记的新浏览器打开自己的链接：由服务端识别并恢复为宿主，不显示 guest 错误或空文档。
11. 连续执行至少两轮开启、加入、编辑、停止，排除只在首次成功的生命周期缺陷。

### 14.3 线上核验

- 部署当前已链接的 Supabase 项目，不要求用户手工执行。
- 核验 migration 已进入远端账本、Edge Function 版本已递增，并完成 v1/v2 register/join/renew/leave smoke。
- 检查 Realtime 日志中 Automerge control/sync、Yjs、Presence 的会话流量。
- 检查已撤销会话的 `revoked_at`、成员撤销和后续 renew 401。

## 15. 交付边界

本次交付完成的定义不是“构建通过”，而是：四个用户报告路径全部按浏览器矩阵验证通过，Edge Function 已部署并完成线上 smoke，协作者空白文档降级路径被移除，停止共享具备广播即时退出与服务端续租兜底两层保证。

## 16. 正式审查增补：分布式 lease 与 fencing

客户端 generation 和请求 timeout 只能隔离本地回调，不能取消已经抵达远端的请求。最终一致性边界必须落在数据库事务内：

- host register 调用 service-role-only 原子 claim RPC。首次插入生成 host lease；同 owner/resume/protocol 的 active session 重试返回既有 winner，不旋转 lease；revoked/expired session ID 永久退休。
- guest join 在确认 `owner_must_host` 后调用原子 member claim RPC。同 token 重试幂等；active 不同 token 返回 `member_lease_conflict`；只有不存在或已撤销的成员行才能由新 token 激活。迟到 join 无法覆盖已建立的新 lease。
- guest renew 是一次带 `protocol_version + member_lease_id + revoked_at + expires_at` 条件的 update-return；0 行即 unauthorized，不使用 select→touch。
- guest release RPC 按 protocol 和 member lease 加锁。相同 token 即使已经 revoked 也返回 `true`，不同 token 返回 `false`；prepare failure、abort、normal stop、best-effort stop 共用这一入口。
- host revoke RPC 在同一事务内核对 host lease，并原子撤销 session 与全部同协议成员；相同 lease 重试在 session 已 revoked 时仍返回 `true`，不匹配返回 `false`。leave 不依赖 active-session 查询。
- v2 collaborator JWT、普通评论 `resolveAccess` 与 bootstrap 快路径都绑定 `protocolVersion + memberLeaseId`。旧 JWT 只能访问 protocol 1 行，不能借新成员行恢复权限。
- Automerge callback 捕获 expected generation/session/role；peer/control 回调写 participants、toast 或远端 cleanup 前都必须通过门禁。phase overrides 类型与运行时顺序都不能覆盖派生 flag。
- Edge invoke timeout 只限制客户端等待时间，不视为远端取消。请求乱序安全性完全由 RPC fencing 和协议隔离保证。
