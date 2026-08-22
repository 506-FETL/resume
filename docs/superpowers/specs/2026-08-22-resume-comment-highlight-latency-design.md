# 评论高亮与发送延迟根因修复设计

日期：2026-08-22
状态：方案已确认，等待规格审查
范围：简历评论选区几何、评论客户端访问上下文、`resume-comments` Edge Function、评论写入数据库 RPC、性能遥测与云端发布

## 1. 背景

当前评论功能有两个直接影响体验的问题：

1. 跨多行或跨富文本块的评论高亮出现深浅不一的双层马克笔效果。
2. 评论写入偶发约 3 秒才返回；用户提供的网络记录显示 `resume-comments` 以 HTTP 200 完成，但耗时约 3.04 秒。

本地真实页面检查确认，高亮问题可稳定重现。评论写入的暖路径实测约 283 ms，因此 3 秒不是固定业务耗时，而是当前多段串行数据库链路在冷启动、跨区传输、数据库排队或锁等待时被放大的慢路径。现有 `Server-Timing` 对普通 mutation 只记录鉴权、序列化和 Edge 总时长，不能进一步区分访问解析、幂等、限流、写事务和回读阶段。

本设计采用已确认的“根因修复”方案：高亮按文本节点产生几何；owner、collaborator、share 三类访问都通过一次统一数据库 RPC 完成权威访问解析；幂等预读、限流、写事务和完整回读再收敛为一次 mutation RPC；同时补齐 mutation 全链路遥测。创建评论和回复叠加可见的乐观发送态：提交后评论立即出现在原位置，服务端确认前保持灰色“发送中”，成功后恢复为普通评论，失败则原位保留并允许重试或移除。

## 2. 已确认根因与证据

### 2.1 双层高亮

`rangeToVisiblePageRects()` 直接消费 `Range.getClientRects()`。Chromium 对跨块选区会同时返回：

- 每一行实际文字的 inline rect；
- 被完整选中的 `p`、`li` 等块级元素 rect。

当前 `mergeCommentPageRects()` 与 `mergeHighlightVisualRects()` 只合并同一视觉行的相邻或重叠矩形，不会删除覆盖多行的块级矩形。overlay 因此把块级矩形和文字行矩形各渲染一遍，同一区域叠加两层半透明琥珀色，形成截图中的深色涂抹。

真实页面测得正常文字行高度约 16.4 px，异常块级矩形高度约 33.5 px 并覆盖两行。高度仅用于证明根因，不能作为实现过滤条件，因为字体、缩放、行高和模板都会改变这些数值。

### 2.2 评论写入慢路径

慢路径并非 owner 专属。三类身份都有自己的访问校验：

- owner：scope locator；使用 `resumeId` 时还要解析当前 version 并确保 scope。
- collaborator：并行读取 scope、collaboration session 和 member，并核对协议、角色、lease、撤销与过期状态。
- share：并行读取 scope 与 share，核对 release、版本、过期和启停状态，再验证密码代际与匿名身份。

访问校验之后，所有身份还共同串行执行：幂等 replay 查询、限流 RPC、写入 RPC、目标线程/评论回读、用户资料回读和计数回读。即使 collaborator/share 的部分访问查询已并行，它们仍是多个独立 PostgREST 请求；共同写链路又继续产生多轮 Edge 到数据库往返。

这些调用由 Edge Function 访问位于 `us-east-1` 的数据库。Edge 自动区域在当前网络通常更接近用户，但每次评论的数据库往返数仍会显著影响所有身份的尾延迟。既有基准显示强制 Edge 到 `us-east-1` 没有稳定降低 P95，因此本次不更改区域策略。

数据库写函数使用 3 秒 `lock_timeout`，但截图中的 3.04 秒 HTTP 200 不能单独证明发生了锁等待；成功请求可能在超时前取得锁，也可能在其他未分段阶段变慢。修复必须先减少确定性的串行往返，再让下一次慢请求能被阶段耗时直接归因。

## 3. 目标与非目标

### 3.1 目标

- 跨行、跨段落、含粗体/链接等内联节点的评论选区每个位置只渲染一层高亮。
- 保持现有单行、跨内联节点、缩放、viewport 裁剪与同页约束。
- owner、collaborator、share 的权威访问解析分别从多次 PostgREST 查询收敛为一次 access RPC；share 仍在 Edge 内用当前数据库密码 hash 校验 token 的密码代际。
- 将普通评论 mutation 的 replay 预读、限流、写事务、线程/评论/资料/计数回读合并为一个数据库 RPC 往返。
- 三类身份在 Edge 鉴权后都只执行“access RPC + mutation RPC”两次串行数据库往返；不把 owner 的 locator 优化当作公共性能修复的主体。
- owner 完成 bootstrap 后可使用当前已引导的 `scopeId` 缩短 access RPC 内部查询，但不改变其他身份享有的公共链路优化。
- 上述公共链路覆盖创建线程、回复、编辑、删除评论、删除线程、解决、重开和重新关联；不是只优化创建评论。
- 创建线程和回复提交后立即插入本地临时评论，发送状态只显示在评论气泡内；发送按钮不再显示 spinner 或“正在发送”。
- 服务端成功或 Realtime 事件任一先到达时，用同一 request ID 原子替换临时评论；失败保留正文并提供重试、移除。
- 保持现有幂等键、限流规则、写权限、锁顺序、冲突映射和服务端确认语义。
- mutation 响应记录 auth、access RPC、数据库 mutation 总耗时、replay、rate limit、write、hydrate、serialize 和 edge total。
- mutation 客户端性能样本带上冷启动、鉴权模式、Edge 区域、响应大小和 transport overhead。
- 完成数据库迁移、Edge Function 云端部署、迁移账本、函数版本和线上 smoke 核验。

### 3.2 非目标

- 不把编辑、删除、解决、重开或重新关联改成评论气泡发送态；本次新增乐观气泡只覆盖创建线程和回复。
- 不修改已由服务端确认的普通评论颜色、透明度、hover 命中或现有定位动效；灰色样式只属于本地 sending/failed 项。
- 不重写完整评论写事务，不改变事件序列、revision 或 Realtime 协议。
- 不强制 Edge Function 区域。
- 不把 share 的访问解析和 mutation 强行合成一次 RPC：密码代际依赖只存在于 Edge 的 token secret，必须在 mutation 前用数据库返回的当前 password hash 完成校验。
- 不改变 `mark_read`、`mark_thread_read`、匿名身份创建和工作文档同步的业务协议；它们只接入通用阶段计时时才做无行为变化的调整。

## 4. 核心不变量

1. **文字几何不变量**：高亮源 rect 只能来自选区实际相交的文本节点子范围，不能来自包含文字的块级祖先。
2. **单层覆盖不变量**：同一评论的几何在合并后，不保留覆盖两个及以上视觉行的重复容器 rect。
3. **统一访问不变量**：owner、collaborator、share 都必须在每次 mutation 前通过同一个权威 access RPC；scope、session/member lease、share/release 和匿名身份校验不能因性能优化而跳过。
4. **服务端权威不变量**：正式 thread、comment、revision、counts 和 eventSeq 只由服务端成功响应提交；失败继续走现有 rollback/error 流程。
5. **锁顺序不变量**：新聚合 RPC 保持现有 `rate-limit bucket → request advisory lock → root/version/scope/thread row locks` 顺序，不在数据库函数中引入外部 I/O。
6. **幂等不变量**：相同 `(actor_key, request_id)` 的已完成请求返回已保存 response，不再次写评论；并发重试仍由现有 request advisory lock 收敛。
7. **权限不变量**：新增的 access 与 mutation SECURITY DEFINER RPC 都在入口校验评论 service role，并显式撤销 `PUBLIC`、`anon`、`authenticated`，只授予 `service_role`。
8. **兼容不变量**：迁移先于 Edge 部署；旧 Edge 在迁移后仍可调用现有 RPC，新 Edge 不在迁移落地前发布。
9. **乐观关联不变量**：每个临时评论必须绑定真实 mutation 使用的同一个 UUID request ID；HTTP 与 Realtime 只能把它结算一次，不能产生重复评论。
10. **内容保全不变量**：发送失败不能丢弃用户正文；只有用户点击“移除”才删除本地失败项，重试继续使用原 request ID。

## 5. 高亮几何设计

### 5.1 文本节点子范围

在 `geometry.ts` 增加内部 helper，对原始 `Range` 的 `commonAncestorContainer` 建立 `TreeWalker(NodeFilter.SHOW_TEXT)`：

1. 只处理 `range.intersectsNode(textNode)` 为真的文本节点。
2. 首尾文本节点分别使用原 range 的 UTF-16 offset；完全位于选区内部的文本节点使用 `[0, text.length]`。
3. 为每个非折叠片段创建临时 `Range` 并读取 `getClientRects()`。
4. 立即 `detach()`/释放临时 range 引用；不修改用户当前 Selection。
5. 后续 viewport 裁剪、page scale 换算和 `mergeCommentPageRects()` 保持不变。

当 `commonAncestorContainer` 本身是 Text 时必须显式把它作为唯一候选，避免 `TreeWalker.nextNode()` 跳过 root。元素边界由 `intersectsNode()` 决定是否包含其子文本；只有边界直接落在某个 Text 上时才读取该节点 offset。

该方案不根据 rect 高度、宽度或包含关系猜测“哪个是容器”，因此对字体、模板、缩放和行高稳定。

### 5.2 空白、换行和内联节点

- 折叠空白或 `<br>` 本身没有可见 rect 时自然不产生 overlay。
- 粗体、链接、span 等内联节点会产生多个相邻 text rect，继续由 `mergeCommentPageRects()` 合成一行。
- 跨 `p`/`li` 的选区会分别收集各块的文本行，不收集块元素 rect。
- 保持只允许起止位于同一可见简历页的现有约束。

### 5.3 视觉与动效

overlay 的颜色、圆角、阴影、hover 与定位过渡不变，因此不新增动效常量。现有 highlight 定位动效继续遵循 `src/lib/motion.ts` 和 reduced-motion 降级。

## 6. 统一访问解析 RPC

### 6.1 访问输入

Edge 复用 bootstrap 已有的 token 校验与 `buildBootstrapInput()`，把三种身份转换为统一、已验证格式的 RPC 参数：

- owner：登录 user ID 与唯一的 scope/resume/version locator；
- collaborator：登录 user ID、token 中的 scope/resume/version/session/role、协作协议版本与 member lease ID；
- share：登录 user ID 或匿名凭证 hash，以及 token 中的 scope/version/share/release/password generation。

数据库迁移新增 `public.resolve_resume_comment_access_v1(...) returns jsonb`。它只做访问解析，不加载 threads，不修复缺失 scope：

1. 校验协议与参数互斥约束。
2. collaborator 调用抽取后的私有 lease 校验 helper，保持 v1/v2 session/member 撤销、过期和 fencing 规则。
3. 复用 `private.resolve_resume_comment_bootstrap_access_v1()`，在数据库内部完成 owner、collaborator、share 的全部关联读取。
4. scope 不存在时返回 `not_found`，由既有 bootstrap/repair 流程负责创建，mutation 不隐式修复。
5. 返回现有 `BootstrapAccessEnvelope` 形状；Edge 继续用 `validateBootstrapAccess()` 做协议防御。

这样 collaborator 的 scope/session/member 和 share 的 scope/share/release/version/anonymous identity 都在一次数据库事务内读取，不再由 Edge 发起多个 PostgREST 查询。

### 6.2 share 密码代际

share access envelope 必须返回当前 `sharePasswordHash`。Edge 在 mutation 前调用现有 `derivePasswordGeneration()`，用仅存在于 Edge 环境的 token secret 计算当前代际，并与 token claim 做 timing-safe 比较。校验失败直接返回 `share_unavailable`，不能调用 mutation RPC。

这一独立 access RPC 是安全边界，不采用“缓存 15 分钟 access token 后跳过撤销检查”的方案。share 停用、换 release、关闭评论、改密码，以及 collaborator session/member 撤销，必须在下一次评论操作立即生效。

### 6.3 owner scope hint

`ResumeCommentClient` 保留调用方提供的原始 access locator，同时维护仅供非 bootstrap 请求使用的 resolved owner scope：

```ts
interface ResolvedOwnerScope {
  accessIdentityKey: string
  scopeId: string
}
```

- owner `bootstrap_scope` 成功并完成协议归一化后，记录响应中的 `scope.id`。
- `accessBody()` 在当前 owner access identity 与缓存 identity 相同时优先发送 `scopeId`。
- `setAccessContext()` 收到不同 resume/version/scope identity 时清空缓存；同 identity 的 React 重渲染不清空。
- share 与 collaborator 不需要该缓存，因为 token 已包含 scope ID；它们仍必须执行统一 access RPC 的权威状态检查。
- bootstrap 请求本身始终使用原 locator，以便服务端解析当前权威版本；bootstrap 成功后才绑定 scope。
- 工作文档发生 `stale_document` 并重新 bootstrap 时，新成功响应覆盖旧 scope。

这样 owner 的 access RPC 可以从已引导 scope 直接验证版本和所有权；它只是减少 access RPC 内部工作，不是其他身份被排除在外的专项快路径。

## 7. 聚合 mutation RPC

### 7.1 新函数与响应聚合

通过 `supabase migration new` 创建迁移，新增：

```sql
public.execute_resume_comment_mutation_v1(
  p_op text,
  p_scope_id uuid,
  p_actor_kind text,
  p_actor_id uuid,
  p_actor_key text,
  p_request_id uuid,
  p_payload jsonb,
  p_network_key text,
  p_share_id uuid,
  p_thread_id uuid
) returns jsonb
```

函数执行顺序：

1. `assert_resume_comment_service_role()`；校验请求身份参数。
2. 读取 `resume_comment_requests` 的已完成 response；命中则返回 `status='ok'`、`replayed=true`，不消费限流。
3. 调用现有 `check_resume_comment_rate_limit()`；若需要限流，返回 `status='rate_limited'` 与 `retryAfterSeconds`，提交本次 bucket 更新。
4. 调用现有 `execute_resume_version_comment_write()`；该函数继续负责 request advisory lock、现有 root/version/scope/thread 锁顺序、revision 校验、事件和幂等 response 落账。
5. 对创建线程和回复，把 `clientRequestId` 合并进本次 event 的 `sanitized_payload`；该 UUID 只用于当前客户端的乐观项与 Realtime 事件关联。
6. 调用新的私有 hydration helper，在同一事务快照中按目标 thread ID 聚合 thread、comments、profiles 与 scope counts，并构造现有 event 响应。
7. 返回 `status='ok'`、`replayed` 标记和完整 `CommentMutationResult` 原始数据。

预读、限流、写入和回读处于同一个 PostgREST RPC 事务内。新函数不自行提前取得 request advisory lock，避免把现有 `rate-limit → request` 顺序反转。并发的同 request 在预读都未命中时可能各消费一次限流，这与当前 Edge 两 RPC 竞态一致；最终写入仍由现有 request lock 幂等收敛。

私有 hydration helper 复用 bootstrap SQL 已有的 thread/comment/profile/count JSON 字段约定，只读取目标 thread，而不是全量 scope threads。删除整条线程时 thread 为 null、profiles 为空；删除单条评论时返回删除后的权威线程。Edge 继续使用现有 `normalizeMutation()`，客户端响应形状不变。

### 7.2 数据库阶段耗时

函数用 `clock_timestamp()` 记录 replay、rateLimit、write 与 hydrate 四段 wall-clock 毫秒，作为 `timings` 字段返回给 Edge。Edge 只把它们写入 `Server-Timing`，不把内部 envelope 暴露为客户端 mutation data。

整个 RPC 的 Edge 等待时间另记为 `mutation_rpc`。因此可以区分：

- SQL 内部锁/执行慢；
- Edge 到数据库的单次 PostgREST 往返慢；
- 同事务 hydrate 慢；
- Edge 外部网络传输慢。

### 7.3 权限

- access 与 mutation 公共函数均为 `SECURITY DEFINER SET search_path = ''`；mutation 继续使用 `SET lock_timeout = '3s'`。
- 两个公共函数创建后都立即 `REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role`，随后仅向 `service_role` `GRANT EXECUTE`；新增私有 helper 不向 API roles 授权。
- 所有对象使用 schema-qualified 名称。
- 不新增表、RLS policy 或浏览器可直接调用的 Data API。

## 8. Edge Function 写入链路

普通 comment mutation 保留现有请求格式校验，然后：

1. 在 Edge 验证 JWT/comment token，构造统一 access input。
2. 调用 `resolve_resume_comment_access_v1`，验证返回 envelope；share 额外完成密码代际 timing-safe 校验。
3. 根据权威 access 执行 `requireActor()`、`requireWrite()`、manage-all 和 stale-release 校验，并构造服务端可信 payload。
4. 计算已有规则使用的 network key，调用 `execute_resume_comment_mutation_v1`。
5. `rate_limited` envelope 映射为现有 HTTP 429 与 `retryAfterSeconds`。
6. `ok` envelope 已包含 thread/comment/profiles/counts/event；Edge 归一化协议后调度 notify 并直接响应，不再发起写后 hydrate 查询。

`readReplay()`、`enforceRateLimit()` 与 `loadThreads()` 仍保留给匿名身份、文档同步、已读、列表等未迁移操作使用，避免扩大本次业务范围。

### 8.1 `Server-Timing`

通用 timing name 扩展为：

- `auth_anonymous | auth_local | auth_legacy`
- `access_rpc`
- `mutation_rpc`
- `replay`
- `rate_limit`
- `write_rpc`
- `hydrate`
- `serialize`
- `edge_total`

bootstrap 既有 `access_token`、`rpc`、`repair`、`realtime_token` 保持兼容。

access 与 mutation RPC 的 Edge 往返分别记录 `access_rpc`、`mutation_rpc`；mutation SQL envelope 中的四段时间映射为 `replay`、`rate_limit`、`write_rpc`、`hydrate`。finalize 继续始终输出 `Server-Timing`。

### 8.2 通用响应 telemetry

成功响应统一带协议兼容的 `meta`：`authMode`、`coldStart`、`repair`。bootstrap 的 repair 使用真实值，普通请求固定为 false。客户端不再只为 bootstrap 解析 telemetry，所有成功响应都记录：

- `x-sb-edge-region`；
- response bytes；
- auth token、fetch headers、response body 等 client duration；
- Server-Timing；
- transport overhead。

`useCommentActions.execute()` 将 mutation response telemetry 交给现有 performance marker。现有 50 样本滑动窗口与开发环境 performance measure 保持不变。

### 8.3 创建与回复的乐观发送态

#### request ID 与本地实体

创建线程和回复在调用 client 前生成 UUID request ID，并把它同时用于：

- HTTP mutation 的 `requestId`；
- 本地临时 thread/comment ID（`local-thread:<requestId>`、`local-comment:<requestId>`）；
- store 的 pending creation 索引；
- 服务端 event 的 `clientRequestId`。

`ResumeCommentClient.createThread()` 与 `createReply()` 接受调用方传入的 request ID；`writeRaw()` 不再为这两项另生成 UUID。重试复用同一个 request ID，使“服务端已成功但客户端丢失响应”的场景通过 request ledger 返回 replay，而不是重复写一条评论。

store 增加专用的 `pendingCreationsByRequestId`，不使用现有“保存整个 store 快照再 rollback”的通用 optimistic primitive，避免多个异步结果乱序时恢复旧快照并覆盖其他更新。每个 pending creation 保存：类型、scope ID/epoch、临时 thread/comment ID、真实 thread/parent ID、正文、anchor（新线程）、原始 page index、request ID、状态与错误。

#### 提交体验

- 新线程：提交后立即关闭创建表单，清空草稿，创建临时 thread/root comment 并打开线程详情。
- 回复：提交后立即清空当前草稿、取消回复目标，并把临时 comment 插到对应 parent 下。
- 本地作者显示为“我”；成功后由服务端 profiles 返回的权威作者替换。
- 临时 thread 可出现在评论列表，但不进入服务端 counts、未读数和简历高亮；成功结算后才使用权威计数与高亮。
- 同一 thread 存在 sending/failed creation 时，textarea 继续允许输入，但 submit 暂时禁用且文案仍为“发送”，避免用同一个旧 revision 并发写入。失败项重试或移除后恢复发送。
- 创建/回复按钮区域不显示 pending spinner、“发送中”或“正在发送”；其他编辑、删除、解决等操作保持原有按钮级 pending 反馈。

#### 评论气泡状态

UI-only delivery state：

```ts
type CommentDeliveryState =
  | { status: 'sending', requestId: string }
  | { status: 'failed', requestId: string, message: string }
```

- sending：评论整体使用 muted foreground、约 55% 不透明度和轻微 grayscale，元信息行显示静态/旋转状态图标与“发送中”。
- success：移除 delivery state，以 `DURATION.base` 和招牌 easing 从灰色过渡到普通评论；不长期显示“已发送”。
- failed：保留灰色正文，状态改为 destructive 色“发送失败”，下方提供“重试”和“移除”。失败不再同时在 composer/button 区重复显示全局错误。
- pending/failed 评论不可回复、编辑或删除服务端内容；“移除”只移除本地失败项，不伪装成服务端删除。若服务端实际上已提交，后续权威 event 仍可重新显示该评论。
- 所有 opacity/filter/入场过渡复用 `src/lib/motion.ts`；`useReducedMotion()` 时 duration 归零，旋转图标改为不旋转的状态图标。

#### HTTP 与 Realtime 竞态

`ResumeCommentEvent` 增加可选 `clientRequestId`，由 `sanitized_payload.clientRequestId` 归一化。HTTP mutation response 和 `applyRealtimePatch()` 都调用同一个幂等 `settlePendingCreation(requestId, authoritativeThread)`：

1. 找到 pending 时，删除临时 thread/comment，应用权威 thread/event，并清理 pending index；HTTP 响应同时应用权威 counts，Realtime 先到时只对 `thread_created` 做一次事件推导计数，随后由 HTTP/bootstrap 校准。
2. pending 已被另一通道结算时，只按 eventSeq/revision 合并权威数据，不重复插入。
3. HTTP 失败到达时，若 pending 已被 Realtime 成功结算则忽略失败；否则原位标记 failed。
4. scope ID/epoch 已变化时不把旧结果写进新 scope；失败正文转回原 scope 草稿缓存，避免静默丢失。

这一协议使 HTTP 先返回、Realtime 先返回、响应丢失后手动重试三种顺序都能收敛为一条服务端评论。

## 9. 错误处理与兼容

- 新 RPC 的 `rate_limited` 仍返回现有中文文案和 429。
- `stale_revision`、`stale_document`、真正的 `40001`、`40P01` 和 3 秒锁超时继续由现有数据库函数及 Edge mapper 处理。
- 创建/回复失败只更新对应评论气泡的 delivery state；权限失效、分享失效等 scope 级错误仍同时触发现有 access invalidation。
- 数据库迁移先部署，旧 Edge 完全不受影响；随后部署新 Edge。
- 新 Edge 不做静默 fallback 到旧多 RPC 写路径。迁移账本是发布门禁；缺函数应暴露为部署错误，而不是长期保留双路径。
- 前端未部署到公开站点不影响云端 Edge 兼容，因为响应原有 `data/eventSeq/error` 结构保持不变，新增 `meta` 与 timing header 为向后兼容字段。

## 10. 验证与验收

### 10.1 高亮

- 确定性验证 `mergeCommentPageRects()` 的同一行合并和多行不合并。
- 浏览器 fixture 覆盖：跨两个 `p`、自动换行、粗体/普通文本交界、列表项、首尾部分选择。
- 真实简历复现原 Skills 多行评论，检查 overlay rect 数量与高度；不得再出现覆盖两行的源 rect。
- 单行评论、重叠线程 hover、缩放和滚动后重新定位不回归。

### 10.2 客户端与 Edge 契约

- `verify:comment-client` 覆盖 owner bootstrap 后请求切换为 scopeId、同 identity 保留、identity 变化清空。
- `verify:comment-service` 分别覆盖 owner、collaborator、share 的统一 access envelope，新 mutation RPC envelope、rate limit 映射、timing allowlist、普通 response telemetry 和原 mutation 响应形状。
- store 隔离验证覆盖：立即插入、HTTP 先结算、Realtime 先结算、重复结算、失败保留、同 request ID 重试、移除失败项、scope epoch 切换与两个不同线程结果乱序。
- UI 验证发送按钮始终保留普通文案；sending/failed 状态只出现在评论气泡；成功后灰色样式和状态文本消失。
- `verify:comments`、`verify:comment-client`、`verify:comment-service` 全部通过。

### 10.3 数据库

- 本地数据库可用时运行 reset 与现有数据库/并发验证；Docker 不可用时使用云端迁移前静态审查、隔离 SQL 验证和部署后只读查询作为等价门禁，并明确记录限制。
- 验证两个新公共函数都只有 `service_role` EXECUTE，私有 helper 对 API roles 不可调用。
- 验证已完成 request replay 不新增 comment/event；普通 create/reply 只新增一次。
- 验证限流 envelope、stale revision 映射和并发 request 幂等。
- 分别以 owner、collaborator editor、登录 share user、匿名 share user 验证访问撤销、role、release、密码代际和评论开关仍即时生效。
- 运行数据库 advisors，区分本次新增问题与既有告警。

### 10.4 性能

- 三类身份的暖路径数据库顺序统一从“多请求 access + replay + rate + write + 多请求 hydrate”减少为“单次 access RPC + 单次完整 mutation RPC”。
- 至少采集多次经用户授权或隔离 fixture 的 owner、collaborator、share 页面发送样本，记录总时长、`access_rpc`、`mutation_rpc`、`write_rpc`、`hydrate`、edge total 与 transport overhead；不以单次最快值或单一身份作为通过依据。
- 验收目标：正常暖路径不再稳定出现 3 秒；若仍出现慢样本，`Server-Timing` 必须能把 Edge 内耗时归入具体阶段，或明确显示为 transport overhead。
- 感知验收：点击发送后的下一个 React 提交周期内出现临时评论，不等待网络；真实总时长仍按完整 mutation 响应衡量，不能用乐观显示掩盖后端回归。
- 不承诺仅凭当前单样本达到任意网络环境下的固定 P95；发布后用现有滑动窗口继续观察 p50/p95/max。

### 10.5 通用质量门禁

- 目标文件 lint。
- TypeScript/生产构建。
- `git diff --check`。
- 浏览器控制台无新增 error/warning。

## 11. 发布、smoke 与清理

1. 使用 Supabase CLI 官方命令创建迁移文件，不手写时间戳。
2. 完成本地静态/隔离验证与 advisors。
3. `supabase db push` 部署迁移到当前 linked project。
4. 核对本地/远端 migration ledger 一致。
5. 部署 `resume-comments` Edge Function。
6. 核对函数 active version 与部署时间。
7. 线上 smoke 检查 CORS、未授权失败、成功 bootstrap 和一条经用户授权的真实 mutation；读取并记录新增 timing。
8. 用户已授权创建的临时性能验证回复在删除动作发生前再次请求确认，删除后验证线程与计数收敛。
9. 删除 `.superpowers/brainstorm/...` 临时视觉伴侣产物，确保交付 diff 不含诊断文件。

## 12. 回滚

- 前端高亮可独立回滚，不影响 anchor 数据。
- Edge 可回滚到旧访问与写入链路；新 RPC 保留但无人调用，不改变现有函数行为。
- 数据库迁移不执行破坏性 down migration；若停用新 RPC，先回滚 Edge，再另建迁移撤销其 EXECUTE 并删除公共函数与无调用私有 helper。
- 新增 timing/meta 字段为向后兼容字段，旧客户端会忽略。
