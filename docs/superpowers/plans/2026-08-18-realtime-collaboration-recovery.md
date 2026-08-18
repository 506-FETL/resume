# 实时协作恢复与生命周期加固实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 恢复简历编辑器实时协作的稳定开启、鉴权快照加载、双向持久化与停止共享自动踢出能力，并完成 Supabase 线上部署和三端浏览器验收。

**架构：** guest 先通过 `resume-comments` Edge Function 校验会话并取得 owner 的 Automerge 持久化快照，再按邀请中的 `docId` 导入 Repo，最后建立 Automerge/Yjs/Presence 实时增量层。host 开启时先保存快照再注册会话；停止时先服务端撤销，再发送带 ack 的控制广播，guest 另用 30 秒续租兜底失效检测。编辑器 loader 使用稳定文档键和认证三态，彻底移除共享失败后创建空文档的路径。

**技术栈：** React 19、TypeScript、Zustand、Automerge Repo 2.4、Yjs/Tiptap、Supabase Auth/Edge Functions/Realtime/Postgres、Vite、Node TypeScript verifier

**规格：** `docs/superpowers/specs/2026-08-18-realtime-collaboration-recovery-design.md`

**仓库约束：** 本仓库明确不新增测试套件，因此本计划不用 TDD；使用确定性 verifier、定向 ESLint、生产构建、线上 smoke 与隔离浏览器业务验收。继续在当前分支执行，不创建 worktree。

---

## 文件结构

### 新建文件

- `src/lib/auth/redirect.ts`：清洗登录后的站内返回地址，拒绝协议相对地址、跨域地址和反斜杠变体。
- `src/lib/collaboration/session/lease.ts`：guest 会话 30 秒续租、页面恢复可见补租、权威撤销与临时错误分流。
- `scripts/verify-realtime-collaboration.ts`：动态验证指定 docId 快照导入、BYTEA/Base64 解码和 redirect 清洗；静态验证 Edge/loader/stop 的关键不变量。
- `docs/superpowers/verification/2026-08-18-realtime-collaboration-recovery.md`：记录本地检查、Edge 版本、迁移账本、线上 smoke 和三端浏览器证据。

### 修改文件

- `supabase/functions/resume-comments/index.ts`：`join_collaboration_session` 返回持久化 Automerge bootstrap，并用 `owner_must_host` 区分所有者恢复。
- `src/lib/automerge/shared/types.ts`：定义共享快照 bootstrap 与 fail-closed 错误类型使用的数据形状。
- `src/lib/automerge/shared/utils.ts`：修正 `\\x` BYTEA 的十六进制解码，保留 Base64 解码。
- `src/lib/automerge/shared/constants.ts`：删除 peer 等待超时，增加共享导入错误码/控制广播超时常量时仅放真实共享常量。
- `src/lib/automerge/document/persistence.ts`：按邀请 docId 导入服务端快照；共享失败直接抛错，不再 `repo.find` 或 owner fallback。
- `src/lib/automerge/document/manager.ts`：以 owner/collaboration 互斥 source 初始化，暴露 `canPersist()`，控制广播返回 Promise。
- `src/lib/automerge/collaboration/session-manager.ts`：删除“等待 peer 再 find”，复用 adapter 时刷新 callbacks，控制广播向上传递结果。
- `src/lib/automerge/collaboration/supabase-network-adapter.ts`：启用 Broadcast ack、callbacks 可更新、控制消息可等待、断开清理监听和 pending 数据。
- `src/lib/collaboration/session/types.ts`：增加完整 phase、guest authorization、prepare/connect 动作和异步 stop 签名。
- `src/lib/collaboration/session/service.ts`：扩展 join/leave 返回类型，拆开“服务端授权”和“文档实时连接”。
- `src/lib/collaboration/session/state.ts`：统一 idle/connected/stopped/error 状态创建器。
- `src/lib/collaboration/session/store.ts`：实现 generation 防串写、host/guest 分阶段激活、续租、幂等清理和权威 stop 顺序。
- `src/lib/collaboration/session/index.ts`：导出 lease helper。
- `src/store/user.ts`：增加 `unknown/authenticated/anonymous` 认证三态。
- `src/store/resume/slices/document.ts`：接受共享 bootstrap，跳过 guest 云端外观读取，host 对远端 change 调度持久化。
- `src/store/resume/slices/sync.ts`：guest 禁止写 owner-only 的 `resume_config`；owner 保存 CRDT 合并结果。
- `src/pages/resume/editor/hooks/use-resume-loader.ts`：稳定加载键、登录跳转、guest prepare→hydrate→connect、owner 恢复和单次失败导航。
- `src/pages/resume/editor/hooks/use-collaboration-panel-value.ts`：移除文档加载后的二次自动 join，异步停止完成后再清 URL。
- `src/pages/resume/editor/types.ts`：同步新的 phase 和异步 stop 类型。
- `src/pages/resume/editor/components/collaboration/collaboration-dialog/index.tsx`：停止中禁用关闭/重复点击并显示加载状态。
- `src/pages/login/index.tsx`：读取清洗后的 redirect。
- `src/pages/login/components/login-form/index.tsx`：登录成功 replace 回到邀请地址。
- `src/hooks/use-redirect.ts`：已登录访问登录页时使用相同清洗结果和 replace 导航。
- `package.json`：增加 `verify:collab`。

---

### 任务 1：扩展服务端鉴权快照契约

**文件：**
- 修改：`supabase/functions/resume-comments/index.ts`
- 修改：`src/lib/collaboration/session/types.ts`
- 修改：`src/lib/collaboration/session/service.ts`

- [ ] **步骤 1：定义共享 bootstrap 和 guest authorization 类型**

在 `src/lib/collaboration/session/types.ts` 增加并统一使用以下类型：

```ts
export interface CollaborationDocumentBootstrap {
  documentData: string
  updatedAt: string
  documentVersion: number
  heads: string[]
}

export interface CollaborationGuestAuthorization {
  commentAccess: CollaborationCommentAccess
  bootstrap: CollaborationDocumentBootstrap
}
```

保持 `CollaborationCommentAccess` 只包含评论/续租字段，避免 `renew_collaboration_session` 重复传输大快照。

- [ ] **步骤 2：让 Edge Function 只按服务端 session 身份读取快照**

在 `resume-comments/index.ts` 增加数据库行类型和加载函数：

```ts
interface CollaborationDocumentRow {
  document_data: string
  heads: string[]
  document_version: number
  updated_at: string
}

async function loadCollaborationDocumentBootstrap(
  admin: AdminClient,
  session: CollaborationSessionRow,
) {
  const { data, error } = await admin
    .from('automerge_documents')
    .select('document_data,heads,document_version,updated_at')
    .eq('resume_id', session.resume_id)
    .eq('user_id', session.owner_user_id)
    .maybeSingle()

  if (error) {
    throw error
  }

  const row = data as CollaborationDocumentRow | null
  if (!row || typeof row.document_data !== 'string' || row.document_data.length === 0) {
    throw new CommentApiError(
      'collaboration_snapshot_unavailable',
      '共享简历快照暂时不可用',
      409,
    )
  }

  return {
    documentData: row.document_data,
    heads: Array.isArray(row.heads) ? row.heads : [],
    documentVersion: Number.isFinite(row.document_version) ? row.document_version : 1,
    updatedAt: row.updated_at,
  }
}
```

禁止从 request body 读取 owner ID 或快照 resume ID。

- [ ] **步骤 3：区分所有者恢复并组合 guest 响应**

把 join 的 owner 分支改为：

```ts
if (session.owner_user_id === userId) {
  throw new CommentApiError(
    'owner_must_host',
    '简历所有者应恢复为协作发起者',
    409,
  )
}
```

在 member 校验完成后先签发 access；renew 直接返回，只有 join 加载 bootstrap：

```ts
const commentAccess = await issueCollaboratorToken({
  session,
  member,
  versionId: scope.version_id,
  collaboratorSecret,
})
if (op === 'renew_collaboration_session') {
  return commentAccess
}
const bootstrap = await loadCollaborationDocumentBootstrap(admin, session)

return { ...commentAccess, bootstrap }
```

`renew_collaboration_session` 仍只返回 `issueCollaboratorToken()` 结果。

- [ ] **步骤 4：更新客户端 service 返回类型和 leave 结果**

`joinCollaborationCommentSession()` 将 Edge 返回值拆成稳定结构：

```ts
export async function joinCollaborationCommentSession(input: {
  sessionId: string
  resumeId: string
}): Promise<CollaborationGuestAuthorization> {
  const result = await callCollaborationCommentOperation<
    CollaborationCommentAccess & { bootstrap: CollaborationDocumentBootstrap }
  >('join_collaboration_session', input)

  const { bootstrap, ...commentAccess } = result
  if (!bootstrap?.documentData) {
    throw new CollaborationOperationError('协作服务未返回共享简历快照', {
      code: 'collaboration_snapshot_unavailable',
    })
  }
  return { commentAccess, bootstrap }
}
```

`leaveCollaborationCommentSession()` 返回 `{ sessionId, revoked }`，供 host 判断服务端是否真正撤销，而不是吞掉结果。

- [ ] **步骤 5：执行服务端与类型定向检查**

运行：

```bash
pnpm exec eslint src/lib/collaboration/session/types.ts src/lib/collaboration/session/service.ts
deno check supabase/functions/resume-comments/index.ts
```

预期：两个命令退出码均为 0；如果本机没有 `deno`，记录环境缺口，并在任务 8 使用 Supabase deploy bundling 作为 Edge 编译门禁。

- [ ] **步骤 6：提交服务端契约**

```bash
git add supabase/functions/resume-comments/index.ts src/lib/collaboration/session/types.ts src/lib/collaboration/session/service.ts
git commit -m "feat(collab): 增加鉴权快照引导契约"
```

---

### 任务 2：实现 Automerge 快照确定性导入与 fail-closed

**文件：**
- 修改：`src/lib/automerge/shared/types.ts`
- 修改：`src/lib/automerge/shared/utils.ts`
- 修改：`src/lib/automerge/shared/constants.ts`
- 修改：`src/lib/automerge/document/persistence.ts`
- 修改：`src/lib/automerge/document/manager.ts`
- 修改：`src/lib/automerge/collaboration/session-manager.ts`

- [ ] **步骤 1：修正 BYTEA 与 Base64 双格式解码**

将 `decodeDocumentData()` 的字符串分支改为直接返回十六进制 bytes，不能把二进制字符再次当 Base64：

```ts
if (typeof raw === 'string') {
  if (raw.startsWith('\\x')) {
    const hex = raw.slice(2)
    if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/iu.test(hex)) {
      return null
    }
    const bytes = new Uint8Array(hex.length / 2)
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
    }
    return bytes
  }
  return decodeBase64ToBytes(raw)
}
```

- [ ] **步骤 2：增加共享文档加载错误和初始化 source**

在 `src/lib/automerge/shared/types.ts` 增加：

```ts
export type DocumentInitializationSource =
  | { kind: 'owner' }
  | {
      kind: 'collaboration'
      documentUrl: string
      documentData: string
      sessionId: string
    }

export class CollaborationDocumentLoadError extends Error {
  readonly code = 'collaboration_document_invalid'

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CollaborationDocumentLoadError'
  }
}
```

`DocumentManagerOptions` 改为持有 `source?: DocumentInitializationSource`，默认 `{ kind: 'owner' }`。

- [ ] **步骤 3：在持久化层按邀请 docId 导入快照**

删除 `loadHandleByUrl()` 和 shared URL 的 `repo.find()` 回退。增加：

```ts
async importCollaborationHandle(
  repo: Repo,
  documentUrl: string,
  documentData: string,
): Promise<DocHandle<AutomergeResumeDocument>> {
  try {
    const { documentId } = parseAutomergeUrl(documentUrl as AutomergeUrl)
    const bytes = decodeDocumentData(documentData)
    if (!bytes?.length) {
      throw new Error('共享快照为空')
    }

    const handle = repo.import<AutomergeResumeDocument>(bytes, { docId: documentId })
    await handle.whenReady()
    const doc = handle.doc()
    if (!doc || doc._metadata?.resumeId !== this.resumeId) {
      throw new Error('共享快照与简历身份不匹配')
    }
    return handle
  }
  catch (error) {
    throw new CollaborationDocumentLoadError('共享简历文档无效', { cause: error })
  }
}
```

collaboration source 构造时立刻令 `canPersistToSupabase = false`；owner source 保持现有读写能力。

- [ ] **步骤 4：让 DocumentManager 的两种初始化路径完全互斥**

`initialize()` 在 repo 创建后先分支：

```ts
if (this.source.kind === 'collaboration') {
  const handle = await this.persistence.importCollaborationHandle(
    repo,
    this.source.documentUrl,
    this.source.documentData,
  )
  return this.attachHandle(handle)
}
```

只有 owner 分支才能执行 `loadPersistedHandle()`、`loadResumeConfig()` 和 `createResumeDocument()`。增加：

```ts
canPersist() {
  return this.persistence.canPersist()
}

async broadcastCollaborationEvent(type: string, data: Record<string, unknown> = {}) {
  if (!this.collaboration) {
    throw new Error('协作连接尚未建立')
  }
  return this.collaboration.broadcastControlMessage(type, data)
}
```

- [ ] **步骤 5：删除 peer-first 初始化链路**

从 `CollaborationSessionManager` 删除 `prepareSharedDocument()` 和 `loadPersistedHandle` option；从 `shared/constants.ts` 删除 `SHARED_DOCUMENT_PEER_WAIT_TIMEOUT_MS`，并增加 `export const COLLABORATION_CONTROL_ACK_TIMEOUT_MS = 2_000`。`enable()` 必须在已有 handle 时工作，不再替 loader 读取或创建文档：

```ts
async enable(sessionId: string, callbacks: CollaborationCallbacks = {}) {
  const handle = this.options.getHandle()
  if (!handle) {
    throw new Error('Automerge 文档尚未初始化')
  }
  if (this.adapter && this.currentSessionId === sessionId) {
    this.adapter.setCallbacks(callbacks)
    this.syncHandle(handle)
    return this.adapter
  }

  this.disable()
  const adapter = new SupabaseNetworkAdapter(this.options.resumeId, sessionId, callbacks)
  this.options.repo.networkSubsystem.addNetworkAdapter(adapter)
  this.adapter = adapter
  this.currentSessionId = sessionId
  this.syncHandle(handle)
  return adapter
}
```

- [ ] **步骤 6：运行 Automerge 定向检查**

```bash
pnpm exec eslint src/lib/automerge
pnpm build
```

预期：目标 lint 退出 0；生产构建退出 0，或只出现已确认的无关基线错误并记录其路径。

- [ ] **步骤 7：提交快照导入边界**

```bash
git add src/lib/automerge
git commit -m "fix(collab): 使用鉴权快照引导共享文档"
```

---

### 任务 3：让控制广播可确认且 adapter 生命周期可复用

**文件：**
- 修改：`src/lib/automerge/collaboration/supabase-network-adapter.ts`
- 修改：`src/lib/automerge/collaboration/session-manager.ts`
- 修改：`src/lib/automerge/document/manager.ts`

- [ ] **步骤 1：把 callbacks 和 presence metadata 改为可更新状态**

`SupabaseNetworkAdapter` 中将 callbacks 从 readonly 改为普通字段，并增加：

```ts
setCallbacks(callbacks: CollaborationCallbacks) {
  this.callbacks = callbacks
  this.presenceMetadata = callbacks.presenceMetadata ?? {}
}
```

构造函数调用 `setCallbacks(callbacks)`；复用同一 session 时 `CollaborationSessionManager.enable()` 必须调用它，保证 `onControlMessage` 不会丢失。

- [ ] **步骤 2：启用 Broadcast ack 并等待控制消息结果**

创建频道时使用：

```ts
this.channel = supabase.channel(this.channelName, {
  config: {
    broadcast: { ack: true, self: false },
  },
})
```

控制消息方法改为：

```ts
async broadcastControlMessage(type: string, data: Record<string, unknown> = {}) {
  if (!this.channel || !this.ready) {
    throw new Error('协作控制频道尚未就绪')
  }
  const result = await this.channel.send({
    type: 'broadcast',
    event: 'automerge-control',
    payload: {
      type,
      data,
      senderId: this.peerId,
      sessionId: this.sessionId,
    },
  })
  if (result !== 'ok') {
    throw new Error(`协作控制消息发送失败: ${result}`)
  }
}
```

`SessionManager` 和 `DocumentManager` 原样返回这个 Promise。

- [ ] **步骤 3：让 disconnect 完整且幂等**

断开时先保存 channel 引用，再清空本地状态并释放 Supabase 订阅：

```ts
disconnect() {
  const channel = this.channel
  this.channel = null
  this.ready = false
  this.localDocumentId = null
  this.pendingMessages = []
  if (channel) {
    void channel.unsubscribe()
  }
}
```

现有 `close`/peer 事件仍由 NetworkAdapter 生命周期发出；重复 disconnect 不抛错。

- [ ] **步骤 4：执行 adapter 定向检查并提交**

```bash
pnpm exec eslint src/lib/automerge/collaboration src/lib/automerge/document/manager.ts
git add src/lib/automerge/collaboration src/lib/automerge/document/manager.ts
git commit -m "fix(collab): 确认控制广播送达后再断链"
```

预期：ESLint 退出码 0，提交只包含 adapter 生命周期相关文件。

---

### 任务 4：重构协作 session 状态机、续租与停止顺序

**文件：**
- 创建：`src/lib/collaboration/session/lease.ts`
- 修改：`src/lib/collaboration/session/types.ts`
- 修改：`src/lib/collaboration/session/state.ts`
- 修改：`src/lib/collaboration/session/store.ts`
- 修改：`src/lib/collaboration/session/service.ts`
- 修改：`src/lib/collaboration/session/index.ts`

- [ ] **步骤 1：定义完整 phase 和分阶段动作**

在 `types.ts` 定义：

```ts
export type CollaborationPhase =
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

export interface PreparedGuestSession extends JoinShareParams {
  generation: number
  authorization: CollaborationGuestAuthorization
}
```

actions 使用一致签名：

```ts
markInviteAuthenticating: () => void
prepareGuestSession: (params: JoinShareParams) => Promise<PreparedGuestSession>
markGuestSessionHydrating: (prepared: PreparedGuestSession) => void
connectPreparedGuestSession: (prepared: PreparedGuestSession) => Promise<void>
abortPreparedGuestSession: (prepared: PreparedGuestSession) => Promise<void>
stopSharing: (options?: { silent?: boolean, bestEffort?: boolean }) => Promise<void>
```

保留 `isSharing`/`isConnecting` 作为 UI 便捷字段，但只由状态创建器统一赋值。
`CollaborationSessionState` 用 `phase: CollaborationPhase` 替换旧 `connectionPhase`；`src/pages/resume/editor/types.ts` 的 `collaborationConnectionPhase` 字段改为 `CollaborationPhase`，避免同时维护两套阶段类型。

- [ ] **步骤 2：实现可停止的 30 秒 lease monitor**

`lease.ts` 使用一个闭包控制定时器和 visibility listener：

```ts
export const COLLABORATION_LEASE_INTERVAL_MS = 30_000

export function startCollaborationLeaseMonitor(options: {
  renew: () => Promise<void>
  onRevoked: (error: unknown) => void
  onTransientError: (error: unknown) => void
}) {
  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const schedule = () => {
    if (timer)
      clearTimeout(timer)
    if (!stopped) {
      timer = setTimeout(tick, COLLABORATION_LEASE_INTERVAL_MS)
    }
  }
  const tick = async () => {
    if (stopped || running)
      return
    timer = null
    running = true
    try {
      await options.renew()
    }
    catch (error) {
      if (isCollaborationRevokedError(error)) {
        stopped = true
        options.onRevoked(error)
      }
      else {
        options.onTransientError(error)
      }
    }
    finally {
      running = false
      schedule()
    }
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (timer)
        clearTimeout(timer)
      timer = null
      void tick()
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  schedule()
  return () => {
    stopped = true
    if (timer)
      clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
```

`isCollaborationRevokedError()` 只把 `CollaborationOperationError` 的 `unauthorized` 和 HTTP 401 判为权威撤销，不能把网络错误误报为宿主停止。

- [ ] **步骤 3：拆分 guest prepare、document hydrate 和 connect**

store 中：

- `prepareGuestSession()`：增加 generation，phase=`authorizing`，只调用 Edge join 并返回 authorization。
- loader 开始导入时调用 store 的 phase setter进入 `hydrating`。
- `connectPreparedGuestSession()`：核对 generation/session，调用 `enableCollaborationSession()`，写 connected state，记住 guest role，启动 Yjs 与 lease monitor。
- 任一阶段失败调用 `abortPreparedGuestSession()` leave member、停止 monitor、释放 adapter 并进入 error。

连接函数只接收已经存在的 `DocumentManager`，不能触发任何文档 fallback。

- [ ] **步骤 4：重排 host start 与 owner resume**

`startSharing()` 的固定顺序：

```ts
const docManager = useResumeStore.getState().docManager
if (!docManager?.getHandle())
  throw new Error('文档尚未初始化，无法开启协作')

await docManager.saveToSupabase()
const registration = await registerCollaborationCommentSession({ sessionId, resumeId })
await connectDocumentSession({
  sessionId,
  resumeId,
  userId,
  userName,
  role: 'host',
  commentHostLeaseId: registration.hostLeaseId,
})
```

`resumeHosting()` 不新建 session ID；重新 register 同一 session 取得新 lease，再连接已有 owner handle。

- [ ] **步骤 5：实现权威 stop 与幂等 remote cleanup**

正常 host stop：

1. phase=`stopping` 且保持当前文档可见。
2. `await leaveCollaborationCommentSession()`；若 `revoked !== true` 抛错并恢复 connected。
3. 使用 `COLLABORATION_CONTROL_ACK_TIMEOUT_MS = 2_000` 执行 `await Promise.race([broadcastCollaborationEvent('share-ended'), timeout])`；ack 失败只记录 warning，因为服务端已撤销。
4. 调用一个 `cleanupSession({ remote: false })`，停止 lease/Yjs/Automerge、清 storage、清参与者并回到 idle。

`bestEffort` 仅用于路由卸载：发起 leave 后立即本地 cleanup，不承诺广播，guest 由续租发现撤销。`handleRemoteShareEnd()` 和 lease `onRevoked` 复用 `cleanupSession({ remote: true })`，通过 generation 保证只执行一次。

- [ ] **步骤 6：执行 session 定向检查并提交**

```bash
pnpm exec eslint src/lib/collaboration/session
git add src/lib/collaboration/session
git commit -m "refactor(collab): 收敛协作会话生命周期状态机"
```

预期：ESLint 退出 0；store 内不存在把任意 `unauthorized` 都转 host 的旧 catch。

---

### 任务 5：增加认证三态与安全登录返回

**文件：**
- 创建：`src/lib/auth/redirect.ts`
- 修改：`src/store/user.ts`
- 修改：`src/pages/login/index.tsx`
- 修改：`src/pages/login/components/login-form/index.tsx`
- 修改：`src/hooks/use-redirect.ts`

- [ ] **步骤 1：实现认证三态**

`src/store/user.ts` 改为：

```ts
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'

interface UserStore {
  currentUser: SupabaseUser
  authStatus: AuthStatus
  setCurrentUser: (user: SupabaseUser) => void
}

const useUserStore = create<UserStore>()(set => ({
  currentUser: null,
  authStatus: 'unknown',
  setCurrentUser: user => set({
    currentUser: user,
    authStatus: user ? 'authenticated' : 'anonymous',
  }),
}))
```

- [ ] **步骤 2：实现同源 redirect 清洗**

`src/lib/auth/redirect.ts`：

```ts
const REDIRECT_BASE = 'https://resume.local'

export function sanitizeAppRedirect(value: string | null | undefined, fallback = '/resume') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return fallback
  try {
    const parsed = new URL(value, REDIRECT_BASE)
    if (parsed.origin !== REDIRECT_BASE)
      return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  }
  catch {
    return fallback
  }
}
```

- [ ] **步骤 3：让登录页所有出口使用同一个 redirect**

`Login` 从 `useSearchParams()` 读取并清洗 redirect，传给 hook 和表单：

```tsx
const [searchParams] = useSearchParams()
const redirect = sanitizeAppRedirect(searchParams.get('redirect'))
useAlreadyLoggedRedirect(redirect)
<LoginForm redirect={redirect} className="max-w-lg mx-auto" />
```

`LoginForm` 增加 `redirect: string`，登录后执行 `navigate(redirect, { replace: true })`；`useAlreadyLoggedRedirect` 也使用 `{ replace: true }`。

- [ ] **步骤 4：运行认证与登录定向检查并提交**

```bash
pnpm exec eslint src/lib/auth/redirect.ts src/store/user.ts src/pages/login src/hooks/use-redirect.ts
git add src/lib/auth/redirect.ts src/store/user.ts src/pages/login src/hooks/use-redirect.ts
git commit -m "fix(auth): 登录后安全返回协作邀请"
```

预期：ESLint 退出 0；`//evil.example`、`/\\evil.example` 和绝对 URL 都回退 `/resume`。

---

### 任务 6：重写编辑器邀请加载编排并消除 host 重载

**文件：**
- 修改：`src/store/resume/slices/document.ts`
- 修改：`src/pages/resume/editor/hooks/use-resume-loader.ts`
- 修改：`src/pages/resume/editor/hooks/use-collaboration-panel-value.ts`
- 修改：`src/pages/resume/editor/types.ts`
- 修改：`src/pages/resume/editor/components/collaboration/collaboration-dialog/index.tsx`

- [ ] **步骤 1：让 document slice 接受互斥 source**

`loadResumeData` 的 options 改为：

```ts
interface ResumeLoadOptions {
  source?: DocumentInitializationSource
}
```

collaboration source 下：

- 不调用 `getCloudAppearanceSource()`。
- 用 bootstrap 构造 `DocumentManager`。
- `cloudAppearanceStatus='not_applicable'`，外观直接来自共享 doc snapshot。
- 任何 import/schema/identity 错误向上传递，不能调用 owner fallback。

owner source 保持现有 resume existence 检查与云端外观合并。

- [ ] **步骤 2：构造稳定文档加载键**

在 loader 中把 URL 安全解析成四种路由状态：普通简历、完整邀请、宿主 session 恢复、非法组合。解析函数内部捕获 `parseAutomergeUrl()` 异常：

```ts
type CollaborationRoute =
  | { kind: 'none' }
  | { kind: 'invite', resumeId: string, sessionId: string, documentUrl: string, documentId: string }
  | { kind: 'host-recovery', resumeId: string, sessionId: string }
  | { kind: 'invalid' }

function parseCollaborationRoute(params: URLSearchParams): CollaborationRoute {
  const resumeId = params.get('resumeId')
  const sessionId = params.get('collabSession')
  const documentUrl = params.get('docUrl')
  if (!sessionId && !documentUrl)
    return { kind: 'none' }
  if (resumeId && sessionId && !documentUrl)
    return { kind: 'host-recovery', resumeId, sessionId }
  if (!resumeId || !sessionId || !documentUrl)
    return { kind: 'invalid' }
  try {
    const { documentId } = parseAutomergeUrl(documentUrl as AutomergeUrl)
    return { kind: 'invite', resumeId, sessionId, documentUrl, documentId }
  }
  catch {
    return { kind: 'invalid' }
  }
}

const loadKey = collaborationRoute.kind === 'invite'
  ? `collab:${collaborationRoute.resumeId}:${collaborationRoute.sessionId}:${collaborationRoute.documentId}`
  : activeResumeId
    ? `resume:${activeResumeId}`
    : 'empty'
```

加载 effect 依赖 `loadKey` 和认证完成所需的 `authStatus/currentUser.id`，不直接依赖原始 `collabSessionParam`。host 开启时 URL 只有 session 变化，`resume:<id>` 不变，因此不能重跑 `loadResumeData()`。

非法组合直接显示“协作链接无效”并 replace 到 `/resume`。`host-recovery` 用于当前 host 刷新：有可信 stored host role 时直接 owner load→resumeHosting；无标记时调用 prepare 判定身份，只有 `owner_must_host` 才恢复 host。如果服务端返回普通 guest authorization，立即 leave/abort 并提示链接缺少 `docUrl`，不能加载空文档。

认证仍为 unknown 且路由属于 invite/host-recovery 时调用 `markInviteAuthenticating()`；认证完成后再进入 authorizing 或 owner load。Panel 的阶段文案使用穷尽映射：authenticating=`正在确认登录状态`、authorizing=`正在验证协作权限`、hydrating=`正在加载共享简历`、connecting=`正在连接协作服务`、syncing=`正在同步当前简历`、stopping=`正在停止共享`，其他 phase 返回 null。

- [ ] **步骤 3：实现 invite 的 prepare→hydrate→connect 顺序**

认证完成后：

```ts
if (isCollaborationInvite && authStatus === 'anonymous') {
  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`
  navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
  return
}
```

已登录时：

1. 读取与 session/resume/user 全匹配的 stored role。
2. stored host：owner source load → `resumeHosting()`。
3. 无 host hint：`prepareGuestSession()`。
4. 若明确抛 `owner_must_host`：owner source load → `resumeHosting()`。
5. 普通 guest：`markGuestSessionHydrating()` → collaboration source load → `connectPreparedGuestSession()`。
6. guest hydrate/connect 失败：`abortPreparedGuestSession()` 后只 toast/navigate 一次。

保持 `latestLoadRequestId` 与 hook cancelled 双层防串写；每个 await 后核对当前 load generation。

- [ ] **步骤 4：删除 CollaborationPanel 的二次自动 join**

从 `use-collaboration-panel-value.ts` 删除 `joinedSessionId`、`lastStoppedSessionId`、`sessionRoleHint` 和自动 `joinSession/resumeHosting` effect。Provider 只负责已连接后的控制 UI 和 remote-end 导航，文档加入顺序完全归 loader。

- [ ] **步骤 5：让停止按钮等待真实结束**

`handleStopSharing` 改为 async，只有 `await stopSharing()` 成功后才删除 `collabSession`/`docUrl`、关闭 dialog 和导航 guest；保留当前 `resumeId`，避免停止共享引发文档身份切换。失败时保留 dialog/连接供重试。

`CollaborationPanelContextValue.onStopSharing` 改为 `() => Promise<void>`。Dialog 在 phase=`stopping` 时按钮显示 Loader2、禁用重复点击和关闭；继续复用现有按钮结构，不新增弹窗。

- [ ] **步骤 6：调整卸载清理顺序**

loader unmount 时先调用 `void stopSharing({ silent: true, bestEffort: true })`，随后清理 resume store。best-effort 不等待广播，但必须发起服务端 leave；正常点击停止仍走权威等待路径。

- [ ] **步骤 7：运行编辑器定向检查并提交**

```bash
pnpm exec eslint src/store/resume/slices/document.ts src/pages/resume/editor/hooks/use-resume-loader.ts src/pages/resume/editor/hooks/use-collaboration-panel-value.ts src/pages/resume/editor/types.ts src/pages/resume/editor/components/collaboration/collaboration-dialog/index.tsx
pnpm build
git add src/store/resume/slices/document.ts src/pages/resume/editor
git commit -m "fix(collab): 按鉴权状态编排共享简历加载"
```

预期：目标 lint 和构建退出 0；开启协作 URL 变化不会调用第二次 `loadResumeData()`。

---

### 任务 7：确保只有 owner 持久化协作合并结果

**文件：**
- 修改：`src/store/resume/slices/document.ts`
- 修改：`src/store/resume/slices/sync.ts`

- [ ] **步骤 1：guest 禁止写 owner-only 云端表**

`syncToSupabase()` 在 online manager 存在后增加：

```ts
if (!state.docManager.canPersist()) {
  set({
    isSyncing: false,
    pendingChanges: false,
    syncError: null,
    lastSyncTime: getTimestamp(),
  })
  return
}
```

该分支发生在 `saveToSupabase()`、`updateResumeConfig()` 和 working comment snapshot 之前；guest 的 Automerge change 已经由 handle/adapter 实时发送，不需要也不能直接写 owner 行。

- [ ] **步骤 2：owner 收到任何 CRDT change 后调度合并持久化**

在 document slice 的 handle change handler 更新 Zustand 后：

```ts
if (manager?.canPersist()) {
  scheduleOnlinePersist(() => get().syncToSupabase())
}
```

从 `sync-service.ts` 导入 `scheduleOnlinePersist`。本地 change 已有同一调度器，重复调用只会重置同一个 timer；远端 guest change 因此也会由 owner 保存到 `automerge_documents` 和 `resume_config`。

- [ ] **步骤 3：运行持久化边界检查并提交**

```bash
pnpm exec eslint src/store/resume/slices/document.ts src/store/resume/slices/sync.ts
git add src/store/resume/slices/document.ts src/store/resume/slices/sync.ts
git commit -m "fix(collab): 由宿主持久化协作合并结果"
```

预期：guest 路径不调用 `updateResumeConfig`，host 远端 change 会进入同一在线保存调度器。

---

### 任务 8：建立确定性协作 verifier 并完成本地总检

**文件：**
- 创建：`scripts/verify-realtime-collaboration.ts`
- 修改：`package.json`

- [ ] **步骤 1：实现动态快照与 redirect 验证**

verifier 使用 Node assert：

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { next as Automerge } from '@automerge/automerge'
import { parseAutomergeUrl, Repo } from '@automerge/automerge-repo'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const { sanitizeAppRedirect } = await jiti.import<
  typeof import('../src/lib/auth/redirect.ts')
>('../src/lib/auth/redirect.ts')
const { decodeDocumentData, encodeBytesToBase64 } = await jiti.import<
  typeof import('../src/lib/automerge/shared/utils.ts')
>('../src/lib/automerge/shared/utils.ts')

const sourceRepo = new Repo()
const sourceHandle = sourceRepo.create<{ value: string }>()
sourceHandle.change((doc) => { doc.value = '协作快照' })
const binary = Automerge.save(sourceHandle.doc()!)
const { documentId } = parseAutomergeUrl(sourceHandle.url)
const targetRepo = new Repo()
const imported = targetRepo.import<{ value: string }>(binary, { docId: documentId })
await imported.whenReady()

assert.equal(imported.documentId, documentId)
assert.equal(imported.doc()?.value, '协作快照')
assert.deepEqual(decodeDocumentData(encodeBytesToBase64(binary)), binary)
assert.deepEqual(decodeDocumentData(`\\x${Buffer.from(binary).toString('hex')}`), binary)
assert.equal(sanitizeAppRedirect('/resume/editor?x=1'), '/resume/editor?x=1')
assert.equal(sanitizeAppRedirect('//evil.example'), '/resume')
assert.equal(sanitizeAppRedirect('/\\evil.example'), '/resume')
```

- [ ] **步骤 2：加入关键源码不变量扫描**

同一脚本读取目标源码并断言：

- Edge join 查询 `automerge_documents` 且同时过滤 `session.resume_id` 与 `session.owner_user_id`。
- owner 使用 `owner_must_host`，不再靠通用 unauthorized 推断。
- collaboration manager 使用 `repo.import(..., { docId })`，且共享分支不调用 `createResumeDocument()`。
- loader 存在稳定 `loadKey`、登录 redirect 和 prepare→hydrate→connect 调用。
- host stop 在 broadcast 前 await leave，adapter channel 启用 `ack: true`。
- lease 间隔为 30 秒，unauthorized 进入 remote cleanup。
- guest sync 的 `canPersist()` guard 位于 `updateResumeConfig()` 之前。

每个断言带明确失败说明，脚本结束输出 `Realtime collaboration verification passed.`。

- [ ] **步骤 3：注册并运行 verifier**

在 `package.json` scripts 增加：

```json
"verify:collab": "node --experimental-strip-types scripts/verify-realtime-collaboration.ts"
```

运行：

```bash
pnpm verify:collab
pnpm exec eslint src/lib/auth src/lib/automerge src/lib/collaboration/session src/store/user.ts src/store/resume/slices/document.ts src/store/resume/slices/sync.ts src/pages/login src/hooks/use-redirect.ts src/pages/resume/editor/hooks/use-resume-loader.ts src/pages/resume/editor/hooks/use-collaboration-panel-value.ts src/pages/resume/editor/components/collaboration/collaboration-dialog/index.tsx scripts/verify-realtime-collaboration.ts
pnpm build
git diff --check
```

预期：verifier 输出通过，目标 ESLint/构建/diff check 退出码均为 0；无关基线错误必须记录实际文件与命令，不能写成通过。

- [ ] **步骤 4：提交 verifier**

```bash
git add scripts/verify-realtime-collaboration.ts package.json
git commit -m "test(collab): 增加协作生命周期确定性校验"
```

---

### 任务 9：部署 Edge Function 并完成线上与三端验收

**文件：**
- 创建：`docs/superpowers/verification/2026-08-18-realtime-collaboration-recovery.md`

- [ ] **步骤 1：记录部署前基线**

在验证报告写入：

- 当前 Git HEAD 与 worktree 状态。
- 当前已链接 Supabase project ref。
- `resume-comments` 部署前版本。
- `supabase migration list --linked` 的最新本地/远端账本；确认 `20260818051900` 只存在本地、尚未进入远端账本。
- 本地 verifier、ESLint、build 的完整命令和退出码。

- [ ] **步骤 2：按 migration → dual-protocol Edge 顺序部署后端**

运行：

```bash
supabase db push --linked --dry-run
supabase db push --linked --yes
supabase migration list --linked
supabase functions deploy resume-comments --project-ref bitxrpdtlohlnywgusfw
supabase functions list --project-ref bitxrpdtlohlnywgusfw
```

预期：dry-run 只包含目标前向 migration；远端账本出现 `20260818051900` 后才允许部署 Edge。`resume-comments` 版本递增且 ACTIVE。若 CLI 缺少凭据，使用已连接的 Supabase 工具按相同顺序完成 migration、函数部署与账本/版本核验；不得先部署依赖新列/RPC 的 Edge。

随后发布支持 `[1, 2]` 协商、但 `VITE_COLLABORATION_PROTOCOL_V2_ENABLED` 保持关闭的兼容前端。确认 capable 前端已稳定覆盖后，用 `supabase secrets set COLLABORATION_LEGACY_REGISTER_CUTOFF_AT=<UTC_ISO_TIMESTAMP> --project-ref bitxrpdtlohlnywgusfw` 配置明确 UTC cutoff：cutoff 后无 capability 的旧 host 只能重试既有 v1 session，创建新 v1 session必须返回 HTTP 426 + `upgrade_required` 并要求刷新；既有 v1 join/renew/leave 继续 drain。自 cutoff 起完整等待 8 小时且遥测确认没有 active v1 session 后，才打开前端开关发布 v2 新建。旧前端不能加入 v2，不能宣称完全跨版本兼容。

- [ ] **步骤 3：执行服务端操作 smoke**

使用隔离测试会话验证：

1. v2 owner register 返回 host lease；相同请求重试返回同 lease，并发 register 只能产生一个 winner。
2. active session 的不同 register 请求不能旋转 lease；session revoked/expired 后相同 session ID 返回 `session_id_retired`。
3. 兼容前端使用同一邀请加入既有 v1 session 时，register/join 响应协商为 v1，store 保存实际协议，后续 renew/leave 都发送 v1；旧无 capability 客户端仍不能操作 v2 行。
4. v2 guest join 返回同一个 `memberLeaseId`、带 lease 的 JWT 和非空 bootstrap；相同 token 在 120 秒 TTL 内重试幂等，不同 token 在 active projection 上返回 `member_lease_conflict`。
5. v2 guest renew 通过原子 RPC 同时把 attempt ledger 与 member projection 延长到 `min(session expiry, now + 120s)`；旧 token、已撤销 token或任一行过期均返回 HTTP 401 + `unauthorized`。v1 renew 继续保持 session 级有效期。
6. 先发送 token A leave、后发送 token A join：leave 即使早于 projection 也返回 `revoked: true` 并写 tombstone，迟到 join 稳定返回 `member_lease_retired`。
7. token A 正常加入/取消后由 B 接管，B 再退出；重复发送旧 A join 仍返回 `member_lease_retired`。让 A projection 自然超过 120 秒后，B 可接管，A attempt 不能复活。
8. guest leave 相同 token 首次与重试都返回 `revoked: true`；旧 token 的迟到 leave 只更新自己的 tombstone，不能撤销随后建立的新 token。
9. owner leave 首次与同 host lease 重试都返回 `revoked: true`，session、members 与 v2 attempt ledger 在同次事务结果中全部 revoked；不匹配 host lease 返回 `false`。
10. 模拟 host 首次 register 响应丢失：同 resume 的新客户端重试复用同 session ID并取回 winner host lease；只有 rollback 已确认 revoked 或 `session_id_retired` 后才生成新 ID。
11. 模拟 generation A register 已返回、generation B 接管同 pending session 后 A 才进入 catch：B 原子取得 `ownerGeneration`，A 不调用 Edge revoke、不清 pending，B 可继续取回同 host lease。
12. 设置 legacy cutoff 前后分别验证：无 capability host 在 cutoff 前可新建 v1；cutoff 后只能对既有同 session ID 重试，新 session 返回 HTTP 426 + `upgrade_required`；capable 前端仍能新建协商协议，既有 v1 join/renew/leave 不受影响。
13. 连续创建 32 个不同 v2 token attempt 后，第 33 个新 token 的 claim 与 release 都返回 `attempt_limit` 且 ledger 行数不增长；已有 token 的重复 release/renew 仍按原语义工作，第 33 个 token 的迟到 claim 仍被上限拒绝。
14. v1 请求仍能操作既有 protocol 1 session/member，但无 token 的 v1 leave、旧 JWT、迟到 v1 join 都不能读写 protocol 2 行或 attempt ledger。
15. host leave 后 guest renew 返回 HTTP 401 + `unauthorized`，新 guest join 在下发快照前被拒绝。

查询 Edge/Realtime 日志确认没有服务端 5xx、没有跨 resume 快照读取，结果写入验证报告。

- [ ] **步骤 4：执行三端浏览器验收第一轮**

使用宿主、已登录 guest、未登录 visitor 三个隔离上下文：

1. 宿主打开一份明确非空简历，记录正文标识和 `loadResumeData()` 调用次数。
2. 开启协作，确认无 loading、无内容闪白、正文标识和滚动位置不变。
3. visitor 打开链接，确认直接进入 `/login?redirect=...`；登录后 replace 回原邀请。
4. guest 首屏展示完整正文，控制台没有 `Document ... is unavailable`，Network 顺序为 join 成功后才订阅 Automerge/Yjs。
5. host 和 guest 分别修改一个结构化字段及一个富文本字段，确认双向实时出现。
6. 等待 owner 自动保存，刷新 guest 与 host，确认变更仍存在。
7. host 点击停止共享，guest 立即收到一次提示并自动 replace 到 `/resume`。
8. 重开旧链接，确认服务端拒绝且不显示简历数据。

- [ ] **步骤 5：执行丢广播兜底和第二轮生命周期验收**

第二轮使用新 session：

1. 建立 host/guest 协作。
2. 在 guest 侧临时阻断或忽略 `automerge-control` 的 `share-ended`。
3. host 正常停止共享。
4. 确认 guest 在 30 秒续租周期内因 renew 401 自动退出。
5. 所有者在没有 sessionStorage host 标记的隔离上下文打开自己的邀请，确认收到 `owner_must_host` 后恢复宿主，不出现 guest 空文档。
6. 再完整执行一次开启、加入、编辑、停止，排除首次生命周期偶然成功。

- [ ] **步骤 6：完成验证报告和最终总检**

验证报告逐项写出：操作、预期、实际结果、时间、会话 ID（脱敏）、证据类型和未覆盖边界。运行：

```bash
pnpm verify:collab
pnpm build
git diff --check
git status --short --branch
```

预期：全部本地门禁通过；报告明确区分静态、HTTP、浏览器业务和线上日志证据。

- [ ] **步骤 7：提交验证报告**

```bash
git add docs/superpowers/verification/2026-08-18-realtime-collaboration-recovery.md
git commit -m "docs(collab): 记录实时协作恢复验收"
```

最终不执行 `git push`，除非用户另行明确要求。

---

## 正式审查增补：分布式 lease、fencing 与双协议发布

任务 4 的 phase、lease monitor、generation stop 与 adapter ready 改动保留；服务端安全边界按以下步骤替代早期的无条件 upsert/客户端排队设计：

1. 在尚未部署的 `20260818051900` migration 中为 session/member 增加 `protocol_version`，为 member 增加 `member_lease_id`，创建仅 service role 可访问的 attempt ledger，并定义 host claim、member claim/renew/release、host revoke 原子 RPC。
2. host register 调用 claim RPC：active 同身份重试返回 winner lease，不旋转；revoked/expired ID 永久退休。host leave 调用同事务 revoke RPC，原子撤销 session/members，且同 lease 重试幂等。
3. v2 guest join 调用 member claim RPC，并以持久 attempt ledger 记录 token tombstone 与 120 秒 TTL；release 在上限内先持久化 tombstone，因而 release-before-claim 与 projection 轮换后的旧 token 都不能复活。每个 session/user 最多保留 32 个唯一 attempt，claim/release 对超限新 token 都返回 `attempt_limit`，已有 token 不受影响。active projection 过期后新 token 可接管。
4. v2 renew 改为 session 锁下的原子 RPC，同时延长 attempt 与 member projection TTL；v1 renew 保留旧 session 有效期语义。
5. v2 JWT、普通 resolve 和 bootstrap 快路径都比较 protocol/member lease；旧 token 只能按 v1 访问。兼容客户端声明支持 `[1, 2]` 并保存服务端实际协议，后续 renew/leave 不再硬编码 v2。
6. Automerge callbacks 捕获 expected generation/session/role，所有 participants、toast 和 remote cleanup 写入前门禁；phase overrides 不能覆盖 phase 或派生 flags。
7. pending host attempt 记录 `ownerGeneration`；后继 generation 复用 session ID时原子接管，旧 generation 在 revoke 与清理前均复核身份和 owner，不能撤销接管者会话。
8. `verify:comment-service` 增加 ledger schema/权限、release-before-claim、A→B→late A、短 TTL、原子 renew、过期接管、attempt cap、协议协商、pending host generation 及既有 fencing/JWT/callback 的静态契约断言。
9. 发布严格执行 migration → dual-protocol Edge（cutoff 未配置）→ capable 兼容前端（新建仍 v1）→ 配置 legacy cutoff → 完整 8 小时 drain 且遥测确认 active v1 清零 → 开启 v2 新建。cutoff 后旧 host 新建返回 `upgrade_required`，既有 v1 操作继续 drain；客户端 timeout 只限制等待，不作为远端请求已取消的依据。
