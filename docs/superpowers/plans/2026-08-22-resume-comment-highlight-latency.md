# 简历评论高亮与写入延迟实施计划

> **执行要求：** 按任务顺序在当前分支实施；每个任务完成后运行对应验证，再进入下一项。仓库明确不要求 TDD，因此本计划采用“实现后立即补充回归验证”的节奏。

**目标：** 消除跨多行评论高亮的重复矩形，并把所有评论创建操作改为即时乐观展示；同时将所有身份路径下的评论写入收敛为“单次访问解析 RPC + 单次写入/回放/水合 RPC”，用分阶段遥测定位并降低尾延迟。

**架构：** 前端以 `requestId` 作为本地临时评论、HTTP 响应和 Realtime 事件的统一幂等键。数据库新增统一访问解析函数和统一评论变更函数；Edge Function 负责身份输入、分享链接代际校验、RPC 编排和 Server-Timing，不再串行执行多次水合查询。高亮几何改为逐文本节点创建子 Range，避免 Chromium 在跨块选择时额外返回块级容器矩形。

**技术栈：** React 19、TypeScript、Zustand、Motion、Supabase Edge Functions（Deno）、PostgreSQL / PL/pgSQL、Node 验证脚本、Vite。

---

## 文件职责

- `src/features/resume-comments/anchors/geometry.ts`：从选区中只采集文本节点子 Range 的可见矩形，并继续负责分页裁剪与坐标缩放。
- `scripts/verify-resume-comment-anchors.ts`：覆盖跨段落、列表、多文本节点、折行和空白节点的几何回归。
- `src/features/resume-comments/types.ts`：声明评论投递状态、临时实体标识和事件中的 `clientRequestId`。
- `src/features/resume-comments/store/types.ts`：声明待创建评论记录与对应 store 动作。
- `src/features/resume-comments/store/pending-creations.ts`：集中实现纯函数式的临时线程/回复构造、成功替换和失败状态转换。
- `src/features/resume-comments/store/create-store.ts`：持有 `pendingCreationsByRequestId`，将 HTTP / Realtime 结果幂等落入现有线程状态。
- `src/features/resume-comments/api/client.ts`：为创建线程/回复透传请求 UUID，解析通用遥测和事件请求 ID，并缓存 owner 已解析 scope。
- `src/features/resume-comments/api/performance.ts`：扩展所有评论请求都可记录的客户端与服务端阶段指标。
- `src/features/resume-comments/hooks/use-comment-actions.ts`：创建线程/回复时先落地本地评论，再异步发送；提供重试和移除动作。
- `src/features/resume-comments/hooks/use-comment-realtime.ts`：使用 `clientRequestId` 让 Realtime 结果提前确认待发送评论，并允许 HTTP 结果随后覆盖权威计数。
- `src/features/resume-comments/hooks/use-highlight-geometry.ts`：排除本地临时线程，避免它们在服务端确认前计入锚点高亮。
- `src/features/resume-comments/components/comment-composer.tsx`：拆分“输入区不可用”和“仅发送按钮不可用”，创建操作不再在按钮区域显示发送中。
- `src/features/resume-comments/components/comment-tree.tsx`：在评论气泡内展示灰色“发送中”或红色失败状态，以及“重试 / 移除”。
- `src/features/resume-comments/components/comments-panel.tsx`：新线程提交后立即关闭创建器并打开临时线程。
- `src/features/resume-comments/components/thread-detail.tsx`：回复提交后立即清空输入与回复目标，同一线程存在未完成创建时只禁用发送。
- `src/features/resume-comments/components/thread-list.tsx`：让临时线程在列表中以弱化状态出现，不影响服务端计数。
- `scripts/verify-resume-comment-client.ts`：覆盖乐观状态机、去重、通用遥测、降级动效和创建器交互契约。
- `supabase/migrations/20260822075237_optimize_resume_comment_mutations.sql`：新增访问解析、协作租约校验、统一写入水合 RPC 和权限收口。
- `supabase/tests/database/003_comment_concurrency_contracts.sql`：覆盖回放、锁顺序、重复请求和并发修改契约。
- `supabase/tests/database/004_function_security.sql`：验证新 SECURITY DEFINER 函数只能由 `service_role` 执行。
- `supabase/functions/resume-comments/index.ts`：改用两段 RPC；输出全操作通用 telemetry 与细分 Server-Timing。
- `scripts/verify-resume-comment-service.ts`：验证 Edge Function 不再走旧多查询水合路径，并覆盖所有身份和变更类型。
- `docs/superpowers/specs/2026-08-22-resume-comment-highlight-latency-design.md`：实现完成后更新状态和最终验证结果。

---

### 任务 1：修正多行高亮几何来源

**文件：**

- 修改：`src/features/resume-comments/anchors/geometry.ts`
- 修改：`scripts/verify-resume-comment-anchors.ts`

- [ ] **1.1 在几何模块增加文本节点遍历与边界比较辅助函数**

实现一个 `collectIntersectingTextRanges(range)`：使用 `TreeWalker(NodeFilter.SHOW_TEXT)` 遍历 `range.commonAncestorContainer` 下的文本节点，通过 `Range.comparePoint` / `compareBoundaryPoints` 判断相交关系；对首尾节点分别裁剪 offset，跳过空范围和不可见节点。每个结果必须是只以文本节点为边界的独立 `Range`。

核心结构：

```ts
function collectIntersectingTextRanges(range: Range): Range[] {
  const document = range.startContainer.ownerDocument
  const root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
    ? range.commonAncestorContainer.parentNode
    : range.commonAncestorContainer
  if (!document || !root)
    return []

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const ranges: Range[] = []
  let node = walker.nextNode()
  while (node) {
    const text = node as Text
    const start = text === range.startContainer ? range.startOffset : 0
    const end = text === range.endContainer ? range.endOffset : text.data.length
    if (end > start && range.intersectsNode(text)) {
      const textRange = document.createRange()
      textRange.setStart(text, start)
      textRange.setEnd(text, end)
      ranges.push(textRange)
    }
    node = walker.nextNode()
  }
  return ranges
}
```

实现时补齐 `commonAncestorContainer` 本身为 Text 时的处理，且不得用“高度阈值”删除矩形，以免误伤大字号或行内元素。

- [ ] **1.2 让 `rangeToVisiblePageRects` 只消费文本子 Range 的矩形**

保留当前同页、隐藏页、viewport 裁剪、scale 换算和 `mergeCommentPageRects`；把 `range.getClientRects()` 替换为：

```ts
const clientRects = collectIntersectingTextRanges(range)
  .flatMap(textRange => Array.from(textRange.getClientRects()))
```

确保跨段落与 `<li>` 选择不再返回段落或列表项的整块容器矩形。

- [ ] **1.3 增加几何回归验证**

在验证脚本中创建带两个段落、列表项、嵌套 `<span>` 和折行文本的 DOM fixture；断言返回矩形只来自文本子 Range、均位于 viewport 内、同一视觉行仍按既有规则合并，并覆盖折叠范围返回空数组。

- [ ] **1.4 运行高亮验证**

```bash
pnpm verify:comments
pnpm verify:comment-client
```

预期：两个命令退出码均为 `0`；现有锚点和高亮动效契约不回退。

- [ ] **1.5 浏览器视觉复核**

在 `/resume` 依次划选跨两段文字和跨列表项文字，创建或选中评论，确认每行只有一层连续马克笔，缩放和分页后仍贴合文字。

- [ ] **1.6 提交任务 1**

```bash
git add src/features/resume-comments/anchors/geometry.ts scripts/verify-resume-comment-anchors.ts
git commit -m "fix(comments): 修正跨行评论高亮重叠" -m "- 逐文本节点采集选区矩形\n- 增加跨块高亮几何回归验证"
```

---

### 任务 2：建立创建评论的乐观状态模型

**文件：**

- 修改：`src/features/resume-comments/types.ts`
- 修改：`src/features/resume-comments/store/types.ts`
- 新增：`src/features/resume-comments/store/pending-creations.ts`
- 修改：`src/features/resume-comments/store/create-store.ts`
- 修改：`scripts/verify-resume-comment-client.ts`

- [ ] **2.1 增加投递状态和待创建记录类型**

在领域类型中增加：

```ts
export type CommentDeliveryState = 'sending' | 'failed'

export interface CommentDelivery {
  requestId: string
  state: CommentDeliveryState
  errorMessage: string | null
}
```

给 `ResumeComment` 增加可选 `delivery?: CommentDelivery`，给 `ResumeCommentThread` 增加可选 `localOnly?: boolean`，给 `ResumeCommentEvent` 增加可选 `clientRequestId?: string`。服务端正常实体不写这些字段。

在 store 类型中增加：

```ts
export type PendingCommentCreation
  = | { kind: 'thread', requestId: string, threadId: string, commentId: string, body: string, snapshot: PendingCommentCreationSnapshot, createdAt: string }
    | { kind: 'reply', requestId: string, threadId: string, commentId: string, parentCommentId: string | null, body: string, threadRevision: number, documentHash: string, createdAt: string }
```

并声明 `pendingCreationsByRequestId` 与 `enqueuePendingThread`、`enqueuePendingReply`、`markPendingCreationSending`、`failPendingCreation`、`discardPendingCreation`、`settlePendingCreation`。

- [ ] **2.2 实现纯状态转换**

`pending-creations.ts` 必须统一生成：

```ts
const threadId = `local-thread:${requestId}`
const commentId = `local-comment:${requestId}`
const localAuthor = { kind: 'user', userId: 'local', displayName: '我', avatarUrl: null } as const
```

新线程插入 `orderedThreadIds` 首位并设为 active；回复追加到目标线程。`settlePendingCreation` 以 request ID 为键：

- HTTP 或 Realtime 任一先到时，都删除对应临时实体并合并真实线程；
- 重复成功不得产生重复评论；
- Realtime 只有事件和线程时先合并，HTTP 随后可覆盖权威 `counts` / `eventSeq`；
- 失败只更新临时评论的 `delivery.state` 和错误文案；
- 移除新线程删除整个本地线程，移除回复只删除该本地评论；
- 临时线程不得修改 `counts`、`lastEventSeq`、未读状态和高亮。

- [ ] **2.3 把待创建状态接入 Zustand store**

`replaceScope` 必须清理旧 scope 的本地待发送实体；`replaceThreads` 与 Realtime patch 必须保留仍未确认的当前 scope 本地实体。既有编辑/删除/解决等快照式乐观更新保持不变，避免把两种状态机混在一起。

- [ ] **2.4 增加纯状态回归**

在 `verify-resume-comment-client.ts` 构造 store，覆盖：新线程立即出现、回复立即出现、失败保留、重试回到 sending、移除、HTTP 先到、Realtime 先到、重复确认、切换 scope 清理，以及服务端计数不被临时实体污染。

- [ ] **2.5 运行状态验证并提交**

```bash
pnpm verify:comment-client
git add src/features/resume-comments/types.ts src/features/resume-comments/store/types.ts src/features/resume-comments/store/pending-creations.ts src/features/resume-comments/store/create-store.ts scripts/verify-resume-comment-client.ts
git commit -m "feat(comments): 增加评论乐观投递状态" -m "- 用请求标识管理临时线程与回复\n- 覆盖成功失败重试移除和实时去重"
```

预期：验证退出码为 `0`，且已有 mutation snapshot 契约继续通过。

---

### 任务 3：接入乐观创建交互和评论内状态 UI

**文件：**

- 修改：`src/features/resume-comments/api/client.ts`
- 修改：`src/features/resume-comments/api/performance.ts`
- 修改：`src/features/resume-comments/hooks/use-comment-actions.ts`
- 修改：`src/features/resume-comments/hooks/use-comment-realtime.ts`
- 修改：`src/features/resume-comments/hooks/use-highlight-geometry.ts`
- 修改：`src/features/resume-comments/components/comment-composer.tsx`
- 修改：`src/features/resume-comments/components/comment-tree.tsx`
- 修改：`src/features/resume-comments/components/comments-panel.tsx`
- 修改：`src/features/resume-comments/components/thread-detail.tsx`
- 修改：`src/features/resume-comments/components/thread-list.tsx`
- 修改：`scripts/verify-resume-comment-client.ts`

- [ ] **3.1 请求层统一使用客户端 UUID**

让 `createThread` / `createReply` 接收必填 `requestId`，并把它作为现有 mutation 的顶层 `requestId`。统一事件解析：

```ts
clientRequestId: typeof event.clientRequestId === 'string'
  ? event.clientRequestId
  : undefined
```

将 `readBootstrapTelemetry` 重命名为通用响应遥测解析器；bootstrap 与所有 mutation 都解析相同 `meta`、服务端阶段和传输字节字段。owner 成功 bootstrap 后按身份键缓存解析后的 `scopeId`，后续写请求带上该提示；身份、resume 或版本变化时失效。

- [ ] **3.2 创建动作先落本地再发网络请求**

在 `use-comment-actions.ts` 抽出 `sendPendingCreation(requestId)`：

1. `crypto.randomUUID()`；
2. 同步 `enqueuePendingThread` / `enqueuePendingReply`；
3. 同步清理原输入 draft、selection 或 reply target 所需上下文；
4. `void client.create…` 在后台发送；
5. 成功调用 `settlePendingCreation` 和既有权威 mutation 合并；
6. 失败调用 `failPendingCreation`，不设置顶层 composer 错误；
7. `retryPendingCreation` 复用同一个 request ID 和保存的 payload；
8. `discardPendingCreation` 只清理本地状态。

创建线程/回复不再经过 `pendingAction`；编辑、删除、解决、重开、重关联仍使用原机制。

- [ ] **3.3 Realtime 以请求 ID 确认本地评论**

当收到 `thread_created` 或 `comment_replied` 且存在 `clientRequestId` 时，先调用 `settlePendingCreation`；事件推导出的线程和 eventSeq 可先展示，HTTP 后到时再用完整 counts 覆盖。没有请求 ID 的远端评论沿用现有 patch 流程。

- [ ] **3.4 排除临时高亮与计数**

`use-highlight-geometry.ts` 对 `thread.localOnly` 直接返回空；列表过滤仍显示临时线程，但标题计数继续读取服务端 `counts`。同一线程存在 sending / failed 回复时，允许继续输入，但发送按钮不可用，文案保持“发送”。

- [ ] **3.5 调整 composer 提交禁用语义**

给 `CommentComposer` 增加 `submitDisabled?: boolean`。`disabled` 仅用于整个输入区不可编辑；`submitDisabled` 只禁用发送按钮。创建线程/回复不传 `pending`，因此按钮区域不出现 Loader 和“正在发送”；编辑等操作继续使用原 `pending` 行为。

- [ ] **3.6 在评论内部渲染发送中和失败状态**

`CommentNode` 根据 `comment.delivery` 渲染：

- sending：整条 article `opacity-55 grayscale-[0.35]`，正文下显示静音色“发送中”；
- failed：保留灰色正文，状态改为破坏性色“发送失败”，显示“重试”和“移除”；
- 成功：删除 delivery，恢复正常评论，不显示永久“已发送”。

使用 `AnimatePresence` / `motion` 和 `COMMENT_MOTION`，`useReducedMotion()` 时 duration 为 `0`；减少动效时状态图标不得旋转。临时评论隐藏回复、编辑、删除等服务端动作。

- [ ] **3.7 让创建器立即完成交互**

`comments-panel.tsx` 在本地 enqueue 成功后立即调用 `onFinishCreating()`；临时线程成为 active。`thread-detail.tsx` 在本地 enqueue 成功后立即清理 reply target。失败状态只出现在对应评论内，不重复显示全局 composer 错误。

- [ ] **3.8 更新客户端契约验证**

删除“创建面板必须 await 服务端后才关闭”和“创建按钮必须显示 pending”的旧断言，新增：

- request ID 从 action → client → event；
- creating/reply 不设置 `pendingAction`；
- 发送中与失败 UI 在 `CommentNode` 内；
- Retry / Remove 对应 action 存在；
- `useReducedMotion` 降级；
- 临时线程不进入几何；
- 通用 response telemetry 在 mutation 中也被读取。

- [ ] **3.9 运行客户端验证、构建并提交**

```bash
pnpm verify:comment-client
pnpm build
git add src/features/resume-comments/api/client.ts src/features/resume-comments/api/performance.ts src/features/resume-comments/hooks/use-comment-actions.ts src/features/resume-comments/hooks/use-comment-realtime.ts src/features/resume-comments/hooks/use-highlight-geometry.ts src/features/resume-comments/components/comment-composer.tsx src/features/resume-comments/components/comment-tree.tsx src/features/resume-comments/components/comments-panel.tsx src/features/resume-comments/components/thread-detail.tsx src/features/resume-comments/components/thread-list.tsx scripts/verify-resume-comment-client.ts
git commit -m "feat(comments): 即时展示待发送评论" -m "- 在评论气泡内呈现发送与失败状态\n- 支持同请求重试移除和实时确认"
```

预期：验证与构建均退出 `0`。

---

### 任务 4：新增统一访问解析与评论变更 RPC

**文件：**

- 修改：`supabase/migrations/20260822075237_optimize_resume_comment_mutations.sql`
- 修改：`supabase/tests/database/003_comment_concurrency_contracts.sql`
- 修改：`supabase/tests/database/004_function_security.sql`

- [ ] **4.1 抽出协作者租约校验 helper**

新增 `private.assert_resume_comment_collaboration_lease_v1(resume_id, session_id, user_id, role)`，复用现有 bootstrap v2 的会话活跃、成员、角色和 resume 绑定校验。`bootstrap_resume_comments_with_collaboration_lease_v2` 改为调用该 helper，返回结构不得变化。

- [ ] **4.2 新增统一访问解析函数**

创建 service-role-only：

```sql
public.resolve_resume_comment_access_v1(
  p_resume_id uuid,
  p_scope_id uuid default null,
  p_owner_user_id uuid default null,
  p_collaborator_user_id uuid default null,
  p_collaboration_session_id uuid default null,
  p_collaboration_role text default null,
  p_share_id uuid default null,
  p_release_id uuid default null,
  p_anonymous_id uuid default null
) returns jsonb
```

内部调用 `private.resolve_resume_comment_bootstrap_access_v1` 得出一致的 scope / version / actor / permissions；协作者调用租约 helper；分享身份返回供 Edge 做 timing-safe 校验所需的 password generation hash，但不把服务端 token secret 放进数据库。owner 的 `p_scope_id` 只作为校验后的快速提示，不能绕过 resume / owner / active version 检查。

- [ ] **4.3 新增统一水合 helper**

新增 private helper，按 thread ID 返回现有客户端 schema 所需的完整线程、评论作者 profiles、counts 和 event；字段别名必须与 bootstrap / 当前 Edge normalize 兼容。所有结果在同一数据库事务快照内产生，消除 mutation 后多次 HTTP 查询。

- [ ] **4.4 新增统一评论变更函数**

创建 service-role-only：

```sql
public.execute_resume_comment_mutation_v1(
  p_operation text,
  p_request_id uuid,
  p_scope_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_payload jsonb
) returns jsonb
```

严格顺序：

1. 检查 request replay；命中则返回已保存的完整响应；
2. 调用当前 rate limit RPC；
3. 调用现有 `write_resume_comment_*` 函数，让它继续按 request advisory lock → scope/thread lock 顺序执行；
4. 水合完整 thread / profiles / counts / event；
5. 对 `create_thread` / `create_reply` 把 `p_request_id` 写入 event sanitized payload 的 `clientRequestId`；
6. 保存可重放的完整 envelope；
7. 返回数据和数据库阶段耗时：`replay`、`rateLimit`、`writeRpc`、`hydrate`。

不得在 rate limit 前自行获取 request advisory lock；保留现有 `lock_timeout = '3s'` 和确定性冲突不重试契约。

- [ ] **4.5 收紧函数权限**

所有新增 `SECURITY DEFINER` 函数使用 `SET search_path = ''`，显式限定 schema；执行：

```sql
REVOKE ALL ON FUNCTION public.resolve_resume_comment_access_v1(...) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_resume_comment_mutation_v1(...) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_resume_comment_access_v1(...) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_resume_comment_mutation_v1(...) TO service_role;
```

private helper 同样撤销 PUBLIC 权限，不向客户端角色授予。

- [ ] **4.6 增加数据库契约测试**

覆盖：owner / collaborator / share 访问解析一致性；失效租约拒绝；request ID 重放返回相同实体且只产生一个事件；同线程重复创建不产生重复评论；新函数匿名和 authenticated 不可执行；service_role 可执行；函数 `proconfig` 包含空 search_path。

- [ ] **4.7 本地数据库验证**

```bash
pnpm verify:database
```

预期：本机 Docker 可用时 reset、pgTAP 与并发脚本全部通过。若 Docker 不可用，记录明确错误，继续执行 `supabase db lint --linked`、`supabase migration list --linked` 和线上隔离 smoke，不得把未运行冒充通过。

- [ ] **4.8 提交数据库任务**

```bash
git add supabase/migrations/20260822075237_optimize_resume_comment_mutations.sql supabase/tests/database/003_comment_concurrency_contracts.sql supabase/tests/database/004_function_security.sql
git commit -m "perf(comments): 合并评论写入数据库往返" -m "- 统一访问解析与评论变更水合\n- 保持限流锁顺序并收紧函数权限"
```

---

### 任务 5：将 Edge Function 切换到两段 RPC 并完善遥测

**文件：**

- 修改：`supabase/functions/resume-comments/index.ts`
- 修改：`scripts/verify-resume-comment-service.ts`

- [ ] **5.1 实现统一访问解析调用**

保留现有 JWT、协作 token、分享 token 和匿名 secret 校验入口；把 owner / collaborator / share 的多次 scope 查询替换为 `resolve_resume_comment_access_v1`。share 路径拿到数据库 generation hash 后，继续在 Edge 使用当前 timing-safe 比对；失败时不得调用 mutation RPC。

- [ ] **5.2 实现统一 mutation 调用和 envelope 解析**

所有写操作 `create_thread`、`create_reply`、`edit_comment`、`delete_comment`、`delete_thread`、`resolve_thread`、`reopen_thread`、`relink_anchor` 都调用 `execute_resume_comment_mutation_v1`。删除旧的“rate limit RPC → write RPC → thread 查询 → comments 查询 → profiles 查询 → counts 查询”Edge 串行路径。

对数据库返回 envelope 做结构校验；replayed 响应与首次响应必须走同一 JSON shape 和状态码。

- [ ] **5.3 输出全操作分阶段 Server-Timing**

成功和可安全返回的错误响应都写入：

```text
Server-Timing: access_rpc;dur=…, mutation_rpc;dur=…, replay;dur=…, rate_limit;dur=…, write_rpc;dur=…, hydrate;dur=…, serialize;dur=…, edge_total;dur=…
```

响应 `telemetry` / `meta` 至少包含 `authMode`、`coldStart`、`repair: false`、Edge region、响应字节、operation 和协议版本。bootstrap 继续保留已有 repair 含义；mutation 不再错误复用 bootstrap-only 字段。

- [ ] **5.4 为创建事件暴露 request ID**

把数据库 event sanitized payload 的 `clientRequestId` 规范化为顶层事件字段，确保 Realtime 查询返回和 HTTP mutation 返回一致。

- [ ] **5.5 更新服务验证脚本**

验证：

- 所有身份调用统一 access RPC；
- 所有写操作统一 mutation RPC；
- 分享代际校验仍在 mutation 前完成；
- 旧 hydrate 多查询不再出现在 mutation 分支；
- rate limit 和锁顺序由数据库函数负责；
- 所有响应均输出通用 telemetry；
- create 事件含 `clientRequestId`；
- deterministic conflicts 不进行 Edge 重试。

- [ ] **5.6 运行服务验证并提交**

```bash
pnpm verify:comment-service
pnpm verify:comment-client
git add supabase/functions/resume-comments/index.ts scripts/verify-resume-comment-service.ts
git commit -m "perf(comments): 缩短所有评论写入链路" -m "- 将身份解析和写入水合收敛为两段 RPC\n- 增加全链路阶段耗时与请求关联"
```

预期：两个验证命令退出码均为 `0`。

---

### 任务 6：全量本地回归与浏览器验收

**文件：**

- 可能修正：上述所有实现文件

- [ ] **6.1 运行静态验证、构建和 lint**

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
pnpm build
pnpm lint
```

预期：全部退出码为 `0`。若 lint 存在任务前已有问题，记录基线并证明本次修改文件无新增错误。

- [ ] **6.2 浏览器验收乐观成功路径**

在 `/resume` 分别验证新线程与回复：点击发送后不等待网络，输入框立即清空，灰色评论立即出现，“发送中”位于评论内，按钮仍显示“发送”；响应后评论平滑恢复正常。连续测试 owner 以及可用的 collaborator / share 身份。

- [ ] **6.3 浏览器验收失败、重试和移除**

通过离线或受控 stub 让创建失败，确认灰色正文保留、红色失败状态出现；恢复网络后点击“重试”，request ID 不变且服务端只产生一条评论；再次制造失败并点击“移除”，只移除本地实体。

- [ ] **6.4 浏览器验收并发和 Realtime 先到**

验证同一线程待发送期间可继续输入但不可再次提交；另一线程不受影响。使用延迟 HTTP / 正常 Realtime 的受控路径，确认 Realtime 先到不会重复评论，HTTP 后到只校正权威计数。

- [ ] **6.5 浏览器验收动效与可访问性**

普通模式检查发送状态切换自然；系统开启“减少动态效果”后重新验证，确认无旋转和位移/缩放动画。键盘提交、状态文案和失败按钮可被辅助技术识别。

---

### 任务 7：部署 Supabase 变更并完成线上门禁

**文件：**

- 修改：`docs/superpowers/specs/2026-08-22-resume-comment-highlight-latency-design.md`

- [ ] **7.1 部署迁移**

先确认 linked project 与迁移列表，再执行：

```bash
supabase migration list --linked
supabase db push --linked
supabase migration list --linked
```

预期：`20260822075237_optimize_resume_comment_mutations.sql` 在本地和远端账本均显示已应用。

- [ ] **7.2 部署 Edge Function**

```bash
supabase functions deploy resume-comments --use-api
supabase functions list
```

预期：`resume-comments` 版本号递增且状态为 ACTIVE。保持平台自动区域调度，不强制固定 us-east-1。

- [ ] **7.3 运行线上安全与性能 smoke**

先使用只读 bootstrap 验证 owner / collaborator / share 可用，再使用隔离 fixture 或用户明确允许的测试评论验证每种 mutation。记录：HTTP 状态、`Server-Timing`、总耗时、event request ID、是否 replay、数据库事件数；重放相同 request ID 必须只有一个实体。

任何删除真实线上测试评论都属于外部破坏性操作，执行前再次取得用户确认；此前已创建的“性能验证（完成后删除）”也不得静默删除。

- [ ] **7.4 检查数据库健康与函数日志**

执行可用的 linked lint / advisors / 函数日志检查，重点确认无 SECURITY DEFINER 暴露、无新增死锁或 3 秒 lock timeout、无 mutation 后 N+1 查询。若 CLI 版本不支持某项 advisor，用 Supabase MCP/SQL 等价查询并记录替代证据。

- [ ] **7.5 更新规格状态并提交收尾文档**

在规格文档写入实际验证命令、部署迁移账本、函数版本、线上 smoke 摘要及任何已知限制，然后提交：

```bash
git add docs/superpowers/specs/2026-08-22-resume-comment-highlight-latency-design.md
git commit -m "docs(comments): 记录评论优化验收结果" -m "- 补充本地与线上验证证据\n- 记录迁移账本和函数部署版本"
```

---

### 任务 8：最终清理与完成性复核

**文件：**

- 删除临时目录：`.superpowers/brainstorm/93548-1787377889/`
- 检查：本计划涉及的全部文件

- [ ] **8.1 移除 brainstorming 临时可视化目录**

只删除本次任务创建且仍未跟踪的 `.superpowers/brainstorm/93548-1787377889/`，删除前用 `git status --short` 再次确认范围。

- [ ] **8.2 运行最终验证**

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
pnpm build
git status --short
git log --oneline -8
```

预期：所有验证退出 `0`；工作树没有本任务遗漏文件；提交历史包含规格、计划、高亮、乐观状态、RPC、Edge 和验收记录。

- [ ] **8.3 对照验收标准逐项复核**

- 多行高亮没有块级双层矩形；
- 任意评论身份发送后立即有评论内灰色状态；
- 成功恢复正常，失败可同请求重试或本地移除；
- HTTP / Realtime 不产生重复；
- 其他 mutation 原有 pending 行为不回退；
- 全身份写入只经过访问解析 RPC + mutation RPC；
- Server-Timing 能区分 access、write、hydrate 和总耗时；
- 新函数权限、锁顺序、迁移账本与线上函数版本均已验证。
