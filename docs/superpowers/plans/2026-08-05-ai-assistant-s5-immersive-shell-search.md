# AI 助手 S5 沉浸式入口与历史搜索实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `/assistant` 升级为独立的 ChatGPT 式沉浸工作区，并补齐高优先级全局入口、来源页返回、会话恢复、可折叠历史侧栏、服务端历史正文搜索和命中消息定位。

**架构：** 顶层拆为 `DashboardShell` 与 `AssistantShell`，保持现有文件系统路由不变；助手页的初始化、导航、搜索和流式发送分别由专用 hook 编排，共享页面状态放在 Zustand。历史搜索由 owner-only Supabase RPC 完成，只检索标题与 `parts[type=text]`，前端通过 Command Dialog 展示结果并定位消息。

**技术栈：** React 19、TypeScript、React Router、vite-plugin-pages、Zustand、Supabase/PostgreSQL、`pg_trgm`、motion/react、GAIA UI、shadcn/Radix、Tailwind CSS。

**规格：** `docs/superpowers/specs/2026-08-05-ai-assistant-s5-immersive-shell-search-design.md`

**仓库覆盖规则：**

- 本仓库不新增或维护测试文件；验证使用 ESLint、TypeScript、生产构建、SQL dry-run/人工 SQL 验证和浏览器人工验收。
- 当前工作区已有未提交的 S4 变更；不得 reset、checkout、覆盖或拆散这些改动。
- S5 完成并通过最终验证前保持改动未提交；不得执行 `git commit` 或 `git push`。
- migration 先写入仓库。未经用户明确确认，不执行会修改远端数据库的 `supabase db push`；允许在执行阶段先运行只读的 `supabase db push --dry-run`。

---

## 文件结构与职责

### 新建

- `src/components/layout/dashboard-shell.tsx`
  - 承载现有 Dashboard 侧栏、顶部栏、路由转场和页面留白。
- `src/components/layout/assistant-shell.tsx`
  - 提供 `100dvh`、无 Dashboard chrome 的助手全屏容器。
- `src/components/dashboard/assistant-entry.tsx`
  - 高优先级 AI 主入口；记录来源地址后导航到 `/assistant`。
- `src/components/dashboard/account-menu.tsx`
  - 从 `NavUser` 抽出的无 SidebarProvider 依赖账户菜单，供 Dashboard 与助手复用。
- `src/lib/ai/navigation.ts`
  - 站内来源地址校验、保存与返回目标解析。
- `src/pages/assistant/utils.ts`
  - 助手页面持久化键、候选会话选择、当前 Agent run 中止等纯函数。
- `src/pages/assistant/hooks/use-write-confirm-bridge.ts`
  - 只挂载一次的 S4 写确认桥，消除多个 `useChatStream` 实例重复注册。
- `src/pages/assistant/hooks/use-assistant-bootstrap.ts`
  - 首次加载会话、恢复上次会话并原子提交工作区状态。
- `src/pages/assistant/hooks/use-assistant-navigation.ts`
  - 返回工作台、新建、会话切换、删除后的相邻选择、快捷键和退出清理。
- `src/pages/assistant/hooks/use-conversation-search.ts`
  - 250ms 防抖、请求取消、分页和搜索不可用状态。
- `src/pages/assistant/components/assistant-sidebar/index.tsx`
  - 桌面 motion 侧栏与移动端 Sheet 的共用内容装配。
- `src/pages/assistant/components/assistant-sidebar/sidebar-header.tsx`
  - 产品标识、折叠/展开操作。
- `src/pages/assistant/components/assistant-sidebar/sidebar-actions.tsx`
  - 返回、新建、搜索三个高频操作。
- `src/pages/assistant/components/assistant-sidebar/sidebar-footer.tsx`
  - 主题切换与复用账户菜单。
- `src/pages/assistant/components/chat-header/index.tsx`
  - 当前会话标题、移动端历史入口和桌面折叠入口。
- `src/pages/assistant/components/conversation-search/index.tsx`
  - 可访问的 Command Dialog 搜索壳与结果列表。
- `src/pages/assistant/components/conversation-search/search-result.tsx`
  - 单条结果、关键词安全高亮、角色和时间展示。
- `src/pages/assistant/components/conversation-search/search-empty.tsx`
  - 初始、无结果、失败、RPC 未启用等状态。
- `supabase/migrations/20260805000001_add_ai_conversation_search.sql`
  - 可见文本 helper、trigram 索引、owner-only 搜索 RPC 和执行权限。

### 修改

- `src/App.tsx`
  - 仅选择外壳、挂载 ThemeProvider/Toaster 和统一 Suspense。
- `src/components/dashboard/app-sidebar.tsx`
  - 插入独立 AI 入口并继续渲染普通模块。
- `src/components/dashboard/const.ts`
  - 从普通模块数组移除 `/assistant`。
- `src/components/dashboard/nav-user.tsx`
  - 改为 Sidebar trigger 包装复用 `AccountMenu`。
- `src/components/ui/command.tsx`
  - 允许 `CommandDialog` 透传 `shouldFilter={false}` 等 Command props。
- `src/lib/ai/types.ts`
  - 增加历史搜索结果类型。
- `src/lib/supabase/ai/conversations.ts`
  - 增加 typed RPC 调用与“搜索尚未启用”错误识别。
- `src/pages/assistant/const.ts`
  - 增加 storage key、搜索分页和动画常量。
- `src/pages/assistant/types.ts`
  - 增加导航、搜索 hook 的页面类型。
- `src/pages/assistant/store.ts`
  - 增加初始化、侧栏、移动端、搜索、请求竞态和消息定位状态。
- `src/pages/assistant/index.tsx`
  - 收敛为页面组件装配，不再直接加载会话或测量高度。
- `src/pages/assistant/hooks/use-chat-stream.ts`
  - 移出确认桥 effect，增加 run 身份守卫、会话 ID 持久化和安全中止。
- `src/pages/assistant/components/conversation-list/index.tsx`
  - 使用统一导航 hook，不再提前切 active ID。
- `src/pages/assistant/components/conversation-list/conversation-item.tsx`
  - 当前态视觉增强；移动端操作改为可触达 overflow 菜单。
- `src/pages/assistant/components/message-list/index.tsx`
  - 添加稳定消息 DOM 标识、搜索定位和 reduced-motion 高亮。
- `src/pages/assistant/components/composer/index.tsx`
  - 保持 GAIA Composer，适配全屏内容主轴和页面初始化状态。
- `README.md`
  - 更新最新进展、AI 助手功能、数据库 migration 说明和项目结构。

### 删除

- `src/pages/assistant/hooks/use-fill-height.ts`
  - 独立 `100dvh` 外壳不再需要运行时剩余高度计算。

---

## 任务 1：建立安全的来源地址与助手持久化基础

**文件：**

- 创建：`src/lib/ai/navigation.ts`
- 创建：`src/pages/assistant/utils.ts`
- 修改：`src/pages/assistant/const.ts:1-3`
- 修改：`src/pages/assistant/types.ts:1-8`

- [ ] **步骤 1：定义稳定的 storage key 与分页常量**

在 `src/pages/assistant/const.ts` 保留现有文案，并增加：

```ts
export const ASSISTANT_SIDEBAR_STORAGE_KEY = 'gresume:assistant:sidebar-expanded'
export const ASSISTANT_LAST_CONVERSATION_STORAGE_KEY = 'gresume:assistant:last-conversation'
export const ASSISTANT_RETURN_TO_STORAGE_KEY = 'gresume:assistant:return-to'
export const CONVERSATION_SEARCH_MIN_LENGTH = 2
export const CONVERSATION_SEARCH_PAGE_SIZE = 20
export const CONVERSATION_SEARCH_DEBOUNCE_MS = 250
export const MESSAGE_HIGHLIGHT_DURATION_MS = 1800
```

不要把 search query 或搜索结果写入持久化存储。

- [ ] **步骤 2：实现站内来源地址校验与回退**

`src/lib/ai/navigation.ts` 提供以下契约：

```ts
import { ASSISTANT_RETURN_TO_STORAGE_KEY } from '@/pages/assistant/const'

export interface InternalLocationLike {
  pathname: string
  search?: string
  hash?: string
}

export function serializeInternalLocation(location: InternalLocationLike): string {
  return `${location.pathname}${location.search ?? ''}${location.hash ?? ''}`
}

export function isSafeWorkspacePath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
    return false

  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin
      && !url.pathname.startsWith('/assistant')
  }
  catch {
    return false
  }
}

export function rememberAssistantReturnPath(path: string): void {
  if (!isSafeWorkspacePath(path))
    return
  sessionStorage.setItem(ASSISTANT_RETURN_TO_STORAGE_KEY, path)
}

export function resolveAssistantReturnPath(routeStateFrom: unknown): string {
  if (isSafeWorkspacePath(routeStateFrom))
    return routeStateFrom
  const stored = sessionStorage.getItem(ASSISTANT_RETURN_TO_STORAGE_KEY)
  return isSafeWorkspacePath(stored) ? stored : '/'
}
```

所有 storage 访问使用 `try/catch` 包装，使禁用 storage 的浏览器仍回退 `/`。

- [ ] **步骤 3：实现助手页面纯函数**

`src/pages/assistant/utils.ts` 至少包含：

```ts
export function readStoredBoolean(key: string, fallback: boolean): boolean
export function writeStoredBoolean(key: string, value: boolean): void
export function readLastConversationId(): string | null
export function writeLastConversationId(id: string): void
export function clearLastConversationId(id?: string): void
export function chooseRestoredConversation(
  conversations: AiConversation[],
  activeConversationId: string | null,
  storedConversationId: string | null,
): AiConversation | null
export function cancelActiveAssistantRun(): void
```

`cancelActiveAssistantRun` 的顺序固定为：

```ts
const state = useAssistantStore.getState()
state.pendingConfirm?.resolve(false)
state.abortController?.abort()
```

不要在这个函数中清空历史 messages；最终 run 的 catch/finally 使用控制器身份守卫清理 streaming 状态。

- [ ] **步骤 4：补齐页面类型**

在 `src/pages/assistant/types.ts` 增加：

```ts
export interface AssistantRouteState {
  from?: string
}

export interface OpenConversationOptions {
  targetMessageId?: string | null
  closeOverlays?: boolean
}

export type ConversationSearchStatus
  = 'idle'
    | 'loading'
    | 'ready'
    | 'empty'
    | 'error'
    | 'unavailable'
```

- [ ] **步骤 5：运行基础静态验证**

运行：

```bash
pnpm exec eslint src/lib/ai/navigation.ts src/pages/assistant/const.ts src/pages/assistant/types.ts src/pages/assistant/utils.ts
pnpm exec tsc --noEmit
git diff --check
```

预期：三个命令退出码均为 0；不得出现新增 TypeScript 错误。

---

## 任务 2：拆分全局外壳并提升 Dashboard AI 主入口

**文件：**

- 创建：`src/components/layout/dashboard-shell.tsx`
- 创建：`src/components/layout/assistant-shell.tsx`
- 创建：`src/components/dashboard/assistant-entry.tsx`
- 修改：`src/App.tsx:1-70`
- 修改：`src/components/dashboard/app-sidebar.tsx:1-32`
- 修改：`src/components/dashboard/const.ts:1-53`

- [ ] **步骤 1：把现有 Dashboard chrome 原样迁入 `DashboardShell`**

`DashboardShell` 接收 `children` 与 `routeKey`，内部保留现有 Sidebar 状态持久化和路由转场：

```tsx
interface DashboardShellProps {
  children: React.ReactNode
  routeKey: string
}

export function DashboardShell({ children, routeKey }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    localStorage.getItem('sidebarOpen') !== 'false',
  )

  return (
    <SidebarProvider
      defaultOpen={sidebarOpen}
      open={sidebarOpen}
      onOpenChange={(open) => {
        setSidebarOpen(open)
        localStorage.setItem('sidebarOpen', String(open))
      }}
    >
      <AppSidebar variant="floating" />
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-1 border-b bg-background/95 p-2 backdrop-blur transition-[width,height] ease-linear supports-backdrop-filter:bg-background/60 group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
          <SiteHeader />
        </header>
        <div className="min-w-0 flex-1 overflow-clip p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={routeKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

保持现有 motion 参数和视觉样式，不顺带改其他页面布局。

- [ ] **步骤 2：实现无 Dashboard chrome 的 `AssistantShell`**

```tsx
export function AssistantShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="h-dvh w-full overflow-hidden bg-background text-foreground">
      {children}
    </main>
  )
}
```

`AssistantShell` 不创建第二个 ThemeProvider、SidebarProvider 或 Toaster。

- [ ] **步骤 3：让 `App.tsx` 只负责选壳**

核心分支：

```tsx
const isAssistantRoute
  = location.pathname === '/assistant'
    || location.pathname.startsWith('/assistant/')

return (
  <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
    {isAssistantRoute
      ? <AssistantShell><Suspense fallback={<Loading />}>{element}</Suspense></AssistantShell>
      : <DashboardShell routeKey={location.pathname}><Suspense fallback={<Loading />}>{element}</Suspense></DashboardShell>}
    <Toaster position="top-right" richColors />
  </ThemeProvider>
)
```

删除 `App.tsx` 中已经迁走的 sidebar state 和 Dashboard imports。

- [ ] **步骤 4：创建高优先级 `AssistantEntry`**

`src/components/dashboard/assistant-entry.tsx`：

```tsx
export function AssistantEntry() {
  const location = useLocation()
  const from = serializeInternalLocation(location)

  return (
    <SidebarGroup className="pb-1">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="lg"
            tooltip="AI 助手"
            className="border border-primary/20 bg-primary/8 text-primary shadow-xs hover:bg-primary/12"
          >
            <Link
              to="/assistant"
              state={{ from }}
              onClick={() => rememberAssistantReturnPath(from)}
            >
              <Sparkles />
              <span className="font-semibold">AI 助手</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
```

入口折叠时继续由现有 Sidebar Tooltip 展示名称。

- [ ] **步骤 5：从普通模块移除助手并装配新入口**

- 从 `Data.modules` 删除 `/assistant` 项及不再需要的 `Sparkles` import。
- 在 `AppSidebar` 的品牌区之后、`NavOptions` 之前渲染 `<AssistantEntry />`。
- 保持业务模块原顺序不变。

- [ ] **步骤 6：验证外壳没有影响其他路由**

运行：

```bash
pnpm exec eslint src/App.tsx src/components/layout src/components/dashboard/app-sidebar.tsx src/components/dashboard/assistant-entry.tsx src/components/dashboard/const.ts
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

预期：

- `/assistant` 的构建产物不依赖 Dashboard DOM 外壳；
- 其他页面仍通过 `DashboardShell`；
- 构建成功，仅允许已有的 Vite chunk-size warning。

---

## 任务 3：集中助手状态、初始化恢复与 Agent 生命周期

**文件：**

- 创建：`src/pages/assistant/hooks/use-write-confirm-bridge.ts`
- 创建：`src/pages/assistant/hooks/use-assistant-bootstrap.ts`
- 创建：`src/pages/assistant/hooks/use-assistant-navigation.ts`
- 修改：`src/pages/assistant/store.ts:1-81`
- 修改：`src/pages/assistant/hooks/use-chat-stream.ts:1-220`

- [ ] **步骤 1：扩展 Zustand 状态并提供原子工作区 action**

在 `AssistantStore` 增加：

```ts
initializing: boolean
sidebarExpanded: boolean
mobileSidebarOpen: boolean
searchOpen: boolean
pendingConversationId: string | null
conversationLoadRequestId: string | null
targetMessageId: string | null

setConversationView: (
  conversationId: string | null,
  messages: AiMessage[],
  targetMessageId?: string | null,
) => void
setSidebarExpanded: (expanded: boolean) => void
setMobileSidebarOpen: (open: boolean) => void
setSearchOpen: (open: boolean) => void
setTargetMessageId: (id: string | null) => void
```

`setConversationView` 必须一次更新 active ID、messages、loading 状态和 target：

```ts
sidebarExpanded: readStoredBoolean(ASSISTANT_SIDEBAR_STORAGE_KEY, true),
setConversationView: (conversationId, messages, targetMessageId = null) =>
  set({
    activeConversationId: conversationId,
    messages,
    targetMessageId,
    pendingConversationId: null,
    loadingMessages: false,
  }),
setSidebarExpanded: (expanded) => {
  writeStoredBoolean(ASSISTANT_SIDEBAR_STORAGE_KEY, expanded)
  set({ sidebarExpanded: expanded })
},
```

不要在 `setActiveConversationId` 时自动清 messages，避免加载失败导致当前工作区丢失。

- [ ] **步骤 2：把写确认桥从 `useChatStream` 移到单例 hook**

`use-write-confirm-bridge.ts` 只包含现有 `setConfirmHandler` effect。页面根组件只调用一次：

```ts
export function useWriteConfirmBridge() {
  useEffect(() => {
    setConfirmHandler(request => new Promise((resolve) => {
      useAssistantStore.getState().setPendingConfirm({
        id: request.id,
        toolName: request.toolName,
        preview: request.preview,
        resolve: async (confirmed) => {
          useAssistantStore.getState().setPendingConfirm(null)
          if (!confirmed) {
            resolve({ confirmed: false })
            return
          }
          try {
            resolve({ confirmed: true, result: await request.apply() })
          }
          catch (error) {
            resolve({ confirmed: true, result: { error: getErrorMessage(error) } })
          }
        },
      })
    }))
    return () => setConfirmHandler(null)
  }, [])
}
```

从 `use-chat-stream.ts` 删除对应 effect 和不再使用的 import。

- [ ] **步骤 3：实现初始化恢复**

`useAssistantBootstrap`：

1. 设置 `initializing/loadingConversations`；
2. `listConversations()`；
3. 用 `chooseRestoredConversation` 选择 Store active → storage ID → 最近会话；
4. 有候选时 `listMessages(candidate.id)`；
5. 在 effect 未取消时一次性写入 conversations + conversation view；
6. 写入最后会话 ID；
7. 无候选时进入空态；
8. unmount 时调用 `cancelActiveAssistantRun()`。

不要先设置 active ID 再 await messages。

- [ ] **步骤 4：实现统一会话导航**

`useAssistantNavigation` 暴露：

```ts
return {
  openConversation,
  startNewConversation,
  deleteAndSelectConversation,
  returnToWorkspace,
  toggleSidebar,
}
```

`openConversation` 使用 request ID 防止竞态：

```ts
const requestId = crypto.randomUUID()
cancelActiveAssistantRun()
useAssistantStore.setState({
  pendingConversationId: id,
  conversationLoadRequestId: requestId,
  loadingMessages: true,
})

const messages = await listMessages(id)
if (useAssistantStore.getState().conversationLoadRequestId !== requestId)
  return false

useAssistantStore.getState().setConversationView(
  id,
  messages,
  options.targetMessageId ?? null,
)
writeLastConversationId(id)
```

失败时只清理属于当前 request 的 pending 状态，保留原 active/messages 并 toast。

- [ ] **步骤 5：实现删除后的相邻会话选择**

删除前先从当前排序计算候选，删除成功后再打开候选：

```ts
async function deleteAndSelectConversation(id: string) {
  const { conversations, activeConversationId } = useAssistantStore.getState()
  const deletedIndex = conversations.findIndex(conversation => conversation.id === id)
  const candidate = conversations[deletedIndex + 1]
    ?? conversations[deletedIndex - 1]
    ?? null

  await deleteConversation(id)
  useAssistantStore.getState().removeConversationLocal(id)

  if (activeConversationId !== id)
    return

  clearLastConversationId(id)
  if (candidate)
    await openConversation(candidate.id)
  else
    useAssistantStore.getState().setConversationView(null, [])
}
```

删除失败时保留当前工作区；候选消息加载失败时使用 `openConversation` 的保留当前工作区规则并提示重试。

- [ ] **步骤 6：实现新建、返回和快捷键**

- `startNewConversation`：中止 run，进入 `activeConversationId:null/messages:[]`，关闭移动 Sheet 与搜索；不创建数据库记录。
- `returnToWorkspace`：中止 run，读取 route state/sessionStorage，`navigate(target)`。
- 注册：
  - `Cmd/Ctrl + K` → `setSearchOpen(true)`；
  - `Cmd/Ctrl + Shift + O` → `startNewConversation()`。
- 输入法组合期间和事件目标为 input/textarea/contenteditable 时，不拦截新建快捷键；搜索快捷键可在 Composer 中工作，但必须 `preventDefault()`。

- [ ] **步骤 7：修复流式 run 的跨会话竞态**

在 `runSend` 中保存当前 `controller` 和最终 `conversationId`。所有结束态更新都检查身份：

```ts
function isCurrentRun(controller: AbortController, conversationId: string) {
  const state = useAssistantStore.getState()
  return state.abortController === controller
    && state.activeConversationId === conversationId
}
```

- 新会话创建后立即 `writeLastConversationId(conv.id)`。
- assistant 落库后，只有 `isCurrentRun(controller, conversationId)` 才 append 到当前 messages 并清 streaming。
- 已经切走时允许服务端已完成的旧会话消息保留在旧会话中，但不得串入当前 UI。
- catch/finally 只有在 `state.abortController === controller` 时清 streaming，不能覆盖新 run。
- `stopStreaming` 复用 `cancelActiveAssistantRun()`。

- [ ] **步骤 8：验证状态与 Agent 基线**

运行：

```bash
pnpm exec eslint src/pages/assistant/store.ts src/pages/assistant/utils.ts src/pages/assistant/hooks
pnpm exec tsc --noEmit
git diff --check
```

人工代码检查：

- `setConfirmHandler` 只剩一个页面根 hook 注册点；
- 任意消息加载失败不会提前替换当前 active/messages；
- 旧 run 的 catch 不会清理新 run；
- `createConversation` 成功后会持久化最近会话 ID。
- 来源返回优先读取 React Router `location.state.from`，再读取 `sessionStorage`，最后回退 `/`。

---

## 任务 4：构建沉浸式助手侧栏、顶部栏和账户区

**文件：**

- 创建：`src/components/dashboard/account-menu.tsx`
- 创建：`src/pages/assistant/components/assistant-sidebar/index.tsx`
- 创建：`src/pages/assistant/components/assistant-sidebar/sidebar-header.tsx`
- 创建：`src/pages/assistant/components/assistant-sidebar/sidebar-actions.tsx`
- 创建：`src/pages/assistant/components/assistant-sidebar/sidebar-footer.tsx`
- 创建：`src/pages/assistant/components/chat-header/index.tsx`
- 修改：`src/components/dashboard/nav-user.tsx:1-100`
- 修改：`src/pages/assistant/index.tsx:1-85`
- 修改：`src/pages/assistant/components/conversation-list/index.tsx:1-93`
- 修改：`src/pages/assistant/components/conversation-list/conversation-item.tsx:1-104`
- 修改：`src/pages/assistant/components/composer/index.tsx:1-29`
- 删除：`src/pages/assistant/hooks/use-fill-height.ts`

- [ ] **步骤 1：抽取无 SidebarProvider 依赖的账户菜单**

`AccountMenu` 接受 trigger 与浮层方向：

```tsx
interface AccountMenuProps {
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}
```

把 `NavUser` 中账户、设置、更新日志、登录/登出逻辑迁入该组件。菜单项直接使用 `DropdownMenuItem + navigate`，不要复用依赖 `useSidebar` 的 `NavSecondary`。

`NavUser` 只负责：

```tsx
const user = useCurrentUser()
const { isMobile } = useSidebar()

<SidebarMenu>
  <SidebarMenuItem>
    <AccountMenu side={isMobile ? 'bottom' : 'right'}>
      <SidebarMenuButton
        size="lg"
        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      >
        <CurrentUserAvatar />
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">
            {user ? user.user_metadata.full_name : '未登录'}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {user ? user.email : 'resume'}
          </span>
        </div>
        <EllipsisVertical className="ml-auto size-4" />
      </SidebarMenuButton>
    </AccountMenu>
  </SidebarMenuItem>
</SidebarMenu>
```

- [ ] **步骤 2：实现桌面侧栏头部与高频操作**

`SidebarHeader`：

- 展开态显示产品标识“GResume AI”与折叠按钮；
- 折叠态只显示展开按钮；
- 图标按钮使用 Tooltip 和中文 `aria-label`。

`SidebarActions`：

- 返回工作台；
- 新建对话；
- 搜索历史，显示 `⌘K`/`Ctrl K` 提示；
- 展开态为完整按钮，折叠态为三个图标按钮。

- [ ] **步骤 3：实现 motion 桌面侧栏**

`AssistantSidebar` 使用：

```tsx
const shouldReduceMotion = useReducedMotion()

<motion.aside
  initial={false}
  animate={{ width: sidebarExpanded ? 280 : 64 }}
  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
  className="hidden h-dvh shrink-0 flex-col overflow-hidden border-r bg-muted/25 md:flex"
>
  <AssistantSidebarHeader
    expanded={sidebarExpanded}
    onToggle={toggleSidebar}
  />
  <AssistantSidebarActions expanded={sidebarExpanded} />
  {sidebarExpanded && (
    <div className="min-h-0 flex-1 px-3 pb-3">
      <ConversationList />
    </div>
  )}
  <AssistantSidebarFooter expanded={sidebarExpanded} />
</motion.aside>
```

展开态中间渲染 ConversationList；折叠态不渲染标题列表，避免文本挤压。底部始终保留主题切换与 AccountMenu。
同时通过 `useReducedMotion()` 尊重系统 `prefers-reduced-motion` 设置。

- [ ] **步骤 4：实现移动端全高 Sheet 和 Chat Header**

移动端 Sheet：

- `SheetContent side="left"`，宽度 `min(88vw, 320px)`；
- 必须有 `SheetTitle` 和 `SheetDescription`；
- 内部顺序与桌面一致；
- 会话导航后关闭 Sheet。

`ChatHeader`：

- 移动端显示打开历史按钮；
- 展示当前会话标题，空态为“新对话”；
- 桌面端可提供折叠/展开入口但不重复所有 sidebar actions；
- 使用 `border-b bg-background/80 backdrop-blur` 固定在聊天工作区顶部。

- [ ] **步骤 5：重构 ConversationList 使用统一导航**

删除组件内直接调用 `listMessages` 的逻辑，改为：

```ts
const { openConversation, startNewConversation, deleteAndSelectConversation }
  = useAssistantNavigation()
```

- 点击会话只调用 `openConversation`；
- pending 会话显示轻量 spinner/skeleton，但当前会话仍可见；
- 当前项使用明确的 `border-l-2 border-primary bg-primary/8`，不只加粗；
- 重命名继续调用数据层，成功后 upsert。

- [ ] **步骤 6：修复移动端会话操作可达性**

`ConversationItem` 使用 `useIsMobile()`：

- 桌面：保留 hover 编辑/删除；
- 移动：常驻 `MoreHorizontal`，DropdownMenu 中提供“重命名”“删除”；
- 删除仍使用现有 AlertDialog；
- 所有 Dialog/Dropdown trigger 均阻止触发会话选择。

- [ ] **步骤 7：让 Assistant 页面只负责装配**

`src/pages/assistant/index.tsx` 最终结构：

```tsx
export default function Assistant() {
  useWriteConfirmBridge()
  useAssistantBootstrap()
  useAssistantNavigation()

  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-background">
      <AssistantSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader />
        <div className="min-h-0 flex-1 overflow-hidden">
          <MessageList />
        </div>
        <div className="shrink-0 border-t bg-background/90 py-3 backdrop-blur">
          <Composer />
        </div>
      </div>
      <ConversationSearch />
    </div>
  )
}
```

删除 `useFillHeight` import、ref、style、圆角外框和旧移动顶栏，并删除 hook 文件。

- [ ] **步骤 8：对齐 Composer 与正文主轴**

- 保持 GAIA `Composer`，不替换为手写 textarea；
- 初始化或消息加载时禁用提交；
- 内容宽度与 MessageList 使用同一 `max-w-4xl`；
- 手机端水平 padding 使用 `px-3`，桌面使用 `sm:px-6 lg:px-8`。

- [ ] **步骤 9：验证组件粒度与响应式静态检查**

运行：

```bash
pnpm exec eslint src/components/dashboard/account-menu.tsx src/components/dashboard/nav-user.tsx src/pages/assistant
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

检查：

- 页面 `index.tsx` 不再包含数据加载与 Sheet 细节；
- 不存在跨两层的业务 props 下钻；
- `use-fill-height.ts` 已删除且无引用；
- 移动 Sheet 有 Title/Description；
- Assistant 页面只有消息区可滚动。

---

## 任务 5：增加 owner-only 历史搜索 migration 与 typed 数据层

**文件：**

- 创建：`supabase/migrations/20260805000001_add_ai_conversation_search.sql`
- 修改：`src/lib/ai/types.ts:21-36`
- 修改：`src/lib/supabase/ai/conversations.ts:1-98`
- 修改：`src/lib/supabase/ai/index.ts:1-2`（仅在需要显式导出时调整）

- [ ] **步骤 1：增加搜索结果类型**

在 `src/lib/ai/types.ts` 增加：

```ts
export interface AiConversationSearchResult {
  conversationId: string
  conversationTitle: string
  messageId: string | null
  excerpt: string
  role: 'user' | 'assistant' | null
  matchedAt: string
  conversationUpdatedAt: string
  matchType: 'title' | 'message'
  relevance: number
}
```

- [ ] **步骤 2：编写可见文本 helper 与索引**

migration 前半段使用事务，核心 SQL：

```sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.ai_message_visible_text(message_parts jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.string_agg(part.item ->> 'text', E'\n' ORDER BY part.ordinality),
    ''
  )
  FROM pg_catalog.jsonb_array_elements(message_parts)
    WITH ORDINALITY AS part(item, ordinality)
  WHERE part.item ->> 'type' = 'text'
$$;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_title_trgm
  ON public.ai_conversations
  USING gin (title extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ai_messages_visible_text_trgm
  ON public.ai_messages
  USING gin (
    public.ai_message_visible_text(parts) extensions.gin_trgm_ops
  );
```

helper 不读取表、不使用 `SECURITY DEFINER`。

- [ ] **步骤 3：编写安全 RPC**

函数签名：

```sql
CREATE OR REPLACE FUNCTION public.search_ai_conversations(
  p_search_query text,
  p_result_limit integer DEFAULT 20,
  p_result_offset integer DEFAULT 0
)
RETURNS TABLE (
  conversation_id uuid,
  conversation_title text,
  message_id uuid,
  excerpt text,
  role text,
  matched_at timestamptz,
  conversation_updated_at timestamptz,
  match_type text,
  relevance real
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  normalized_query text := pg_catalog.left(pg_catalog.btrim(p_search_query), 200);
  escaped_query text;
  search_pattern text;
  safe_limit integer := pg_catalog.least(pg_catalog.greatest(p_result_limit, 1), 50);
  safe_offset integer := pg_catalog.greatest(p_result_offset, 0);
BEGIN
  IF auth.uid() IS NULL OR normalized_query = '' THEN
    RETURN;
  END IF;

  escaped_query := pg_catalog.replace(normalized_query, E'\\', E'\\\\');
  escaped_query := pg_catalog.replace(escaped_query, '%', E'\\%');
  escaped_query := pg_catalog.replace(escaped_query, '_', E'\\_');
  search_pattern := '%' || escaped_query || '%';

  RETURN QUERY
  WITH message_texts AS (
    SELECT
      m.id,
      m.conversation_id,
      m.role,
      m.created_at,
      public.ai_message_visible_text(m.parts) AS visible_text
    FROM public.ai_messages AS m
    WHERE m.user_id = auth.uid()
      AND m.role IN ('user', 'assistant')
  ),
  title_hits AS (
    SELECT
      c.id AS conversation_id,
      c.title AS conversation_title,
      NULL::uuid AS message_id,
      c.title AS excerpt,
      NULL::text AS role,
      c.updated_at AS matched_at,
      c.updated_at AS conversation_updated_at,
      'title'::text AS match_type,
      (
        2
        + CASE
            WHEN pg_catalog.lower(c.title) = pg_catalog.lower(normalized_query) THEN 1
            ELSE 0
          END
        + extensions.similarity(c.title, normalized_query)
      )::real AS relevance
    FROM public.ai_conversations AS c
    WHERE c.user_id = auth.uid()
      AND c.title ILIKE search_pattern ESCAPE E'\\'
  ),
  message_hits AS (
    SELECT
      c.id AS conversation_id,
      c.title AS conversation_title,
      mt.id AS message_id,
      pg_catalog.substr(
        mt.visible_text,
        pg_catalog.greatest(
          pg_catalog.strpos(
            pg_catalog.lower(mt.visible_text),
            pg_catalog.lower(normalized_query)
          ) - 60,
          1
        ),
        180
      ) AS excerpt,
      mt.role,
      mt.created_at AS matched_at,
      c.updated_at AS conversation_updated_at,
      'message'::text AS match_type,
      (1 + extensions.similarity(mt.visible_text, normalized_query))::real AS relevance
    FROM message_texts AS mt
    JOIN public.ai_conversations AS c ON c.id = mt.conversation_id
    WHERE c.user_id = auth.uid()
      AND mt.visible_text ILIKE search_pattern ESCAPE E'\\'
  ),
  combined AS (
    SELECT * FROM title_hits
    UNION ALL
    SELECT * FROM message_hits
  )
  SELECT *
  FROM combined
  ORDER BY relevance DESC, matched_at DESC, conversation_updated_at DESC
  LIMIT safe_limit
  OFFSET safe_offset;
END;
$$;
```

这里使用可显式 schema-qualified 的 `pg_catalog.substr` 与 `pg_catalog.strpos`，避免空 `search_path` 下依赖特殊语法解析；migration 必须通过 dry-run 解析后才进入后续任务。不得通过取消空 `search_path` 或 owner 过滤来规避 SQL 错误。

- [ ] **步骤 4：锁定函数执行权限**

migration 尾部：

```sql
REVOKE EXECUTE ON FUNCTION public.ai_message_visible_text(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_message_visible_text(jsonb)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.search_ai_conversations(text, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_ai_conversations(text, integer, integer)
  TO authenticated;

COMMIT;
```

helper 必须向 `authenticated` 授权，因为 `SECURITY INVOKER` RPC 运行时需要调用它。

- [ ] **步骤 5：实现 typed RPC 调用**

`conversations.ts` 增加：

```ts
interface SearchConversationOptions {
  query: string
  limit?: number
  offset?: number
  signal?: AbortSignal
}

export async function searchConversations({
  query,
  limit = 20,
  offset = 0,
  signal,
}: SearchConversationOptions): Promise<AiConversationSearchResult[]> {
  let request = supabase.rpc('search_ai_conversations', {
    p_search_query: query,
    p_result_limit: limit,
    p_result_offset: offset,
  })
  if (signal)
    request = request.abortSignal(signal)

  const { data, error } = await request
  if (error)
    throw error

  return (data ?? []).map(mapConversationSearchResult)
}
```

`mapConversationSearchResult` 完成 snake_case → camelCase，且只接受 `role` 为 `user/assistant/null`、`match_type` 为 `title/message`。

增加：

```ts
export function isConversationSearchUnavailable(error: unknown): boolean {
  const candidate = error as { code?: string, message?: string }
  return candidate.code === 'PGRST202'
    || candidate.message?.includes('search_ai_conversations') === true
}
```

- [ ] **步骤 6：验证 SQL 资产与 TypeScript**

先运行不修改远端数据库的命令：

```bash
supabase db push --dry-run
pnpm exec eslint src/lib/ai/types.ts src/lib/supabase/ai
pnpm exec tsc --noEmit
git diff --check
```

预期：

- dry-run 能解析 migration 并列出待应用文件，不实际执行远端写入；
- TypeScript 和 ESLint 退出码 0。

如果 dry-run 因远端 migration history 或登录状态失败，记录完整错误，不擅自执行 `supabase db push`；改为在实施报告中要求用户通过 Supabase SQL Editor 应用该文件。

---

## 任务 6：实现历史搜索 hook 与可访问 Command Dialog

**文件：**

- 创建：`src/pages/assistant/hooks/use-conversation-search.ts`
- 创建：`src/pages/assistant/components/conversation-search/index.tsx`
- 创建：`src/pages/assistant/components/conversation-search/search-result.tsx`
- 创建：`src/pages/assistant/components/conversation-search/search-empty.tsx`
- 修改：`src/components/ui/command.tsx:25-42`
- 修改：`src/pages/assistant/index.tsx`

- [ ] **步骤 1：让 `CommandDialog` 支持服务端过滤**

扩展 props：

```tsx
function CommandDialog({
  children,
  title = 'Command',
  description = 'Search for a command',
  commandProps,
  ...props
}: DialogProps & {
  title?: string
  description?: string
  commandProps?: React.ComponentProps<typeof Command>
}) {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <Command
          className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:border-b [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3"
          {...commandProps}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}
```

保持默认行为不变，避免影响其他 CommandDialog 调用点。

- [ ] **步骤 2：实现搜索 hook 的状态机**

`useConversationSearch` 返回：

```ts
{
  query,
  setQuery,
  results,
  status,
  hasMore,
  loadMore,
  retry,
  reset,
}
```

实现约束：

- query trim 后少于 2 字符：取消请求、清远端结果、状态回到 idle；
- 250ms debounce 后调用 RPC；
- 每次查询创建新的 AbortController；
- effect cleanup abort；
- 只有当前 query/request ID 才能提交结果；
- `loadMore` 使用当前结果长度作为 offset，并 append；
- RPC 缺失 → `unavailable`；
- AbortError 不进入 error；
- 其他异常 → `error`。

- [ ] **步骤 3：实现关键词安全高亮**

`search-result.tsx` 不使用 HTML 注入。实现：

```tsx
function HighlightedText({ text, query }: { text: string, query: string }) {
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
  if (index < 0)
    return text
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  )
}
```

结果项展示：

- 会话标题；
- `title/message` 类型；
- user → “你”，assistant → “AI 助手”；
- `formatRelativeTime(matchedAt)`；
- 最多两行摘要。

- [ ] **步骤 4：实现搜索空态与错误态**

`SearchEmpty` 显式区分：

- idle：提示输入至少 2 个字符；下方展示最近会话；
- loading：3 条 Skeleton；
- empty：没有匹配历史；
- error：错误文案 + 重试按钮；
- unavailable：“历史搜索尚未启用，请先应用 S5 数据库迁移”；不影响最近会话选择。

- [ ] **步骤 5：装配 Command Dialog**

```tsx
<CommandDialog
  open={searchOpen}
  onOpenChange={setSearchOpen}
  title="搜索对话历史"
  description="搜索会话标题和历史消息正文"
  commandProps={{ shouldFilter: false }}
>
  <CommandInput value={query} onValueChange={setQuery} placeholder="搜索对话与消息…" />
  <CommandList className="max-h-[min(60vh,480px)]">
    {query.trim().length < CONVERSATION_SEARCH_MIN_LENGTH
      ? (
          <CommandGroup heading="最近对话">
            {conversations.slice(0, 8).map(conversation => (
              <CommandItem
                key={conversation.id}
                value={conversation.id}
                onSelect={() => openConversation(conversation.id)}
              >
                <MessageSquare className="size-4" />
                <span className="truncate">{conversation.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )
      : (
          <CommandGroup heading="搜索结果">
            {results.map(result => (
              <ConversationSearchResult
                key={`${result.matchType}:${result.conversationId}:${result.messageId ?? 'title'}`}
                query={query}
                result={result}
                onSelect={() => selectResult(result)}
              />
            ))}
          </CommandGroup>
        )}
    <ConversationSearchEmpty status={status} onRetry={retry} />
  </CommandList>
</CommandDialog>
```

选择结果：

```ts
await openConversation(result.conversationId, {
  targetMessageId: result.messageId,
  closeOverlays: true,
})
```

标题命中传 `null`，进入后定位底部。

- [ ] **步骤 6：实现分页入口**

结果数达到页大小时，在列表底部渲染“加载更多” CommandItem/Button：

- loading more 时禁用并显示 WaveSpinner 或小型 spinner；
- append 时按 `conversationId + messageId + matchType` 去重；
- query 改变时清空旧页。

- [ ] **步骤 7：验证搜索 UI 静态行为**

运行：

```bash
pnpm exec eslint src/components/ui/command.tsx src/pages/assistant/hooks/use-conversation-search.ts src/pages/assistant/components/conversation-search
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

预期：无类型错误；Dialog 具备 Title/Description；cmdk 不二次过滤服务端结果。

---

## 任务 7：接入消息定位、高亮和滚动协作

**文件：**

- 修改：`src/pages/assistant/components/message-list/index.tsx:1-85`
- 修改：`src/pages/assistant/components/message-bubble/index.tsx:1-67`（仅在需要 className/DOM 属性透传时）
- 修改：`src/pages/assistant/store.ts`

- [ ] **步骤 1：为落库消息增加稳定 DOM 标识**

每条消息外包一层：

```tsx
<motion.div
  key={message.id}
  id={`assistant-message-${message.id}`}
  data-message-id={message.id}
  className="scroll-mt-20 rounded-2xl"
>
  <MessageBubble
    message={message}
    onEdit={current => handleEdit(
      current.parts
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n'),
    )}
    onRetry={message.id === lastAssistantId ? retryLast : undefined}
  />
</motion.div>
```

本地 optimistic 与 `streaming` 临时消息也可渲染 wrapper，但不得成为搜索 target。

- [ ] **步骤 2：实现命中定位 effect**

```ts
const targetMessageId = useAssistantStore(s => s.targetMessageId)
const shouldReduceMotion = useReducedMotion()

useEffect(() => {
  if (!targetMessageId || loading)
    return
  const element = document.getElementById(`assistant-message-${targetMessageId}`)
  if (!element) {
    useAssistantStore.getState().setTargetMessageId(null)
    return
  }

  element.scrollIntoView({
    block: 'center',
    behavior: shouldReduceMotion ? 'auto' : 'smooth',
  })

  const timer = window.setTimeout(
    () => useAssistantStore.getState().setTargetMessageId(null),
    MESSAGE_HIGHLIGHT_DURATION_MS,
  )
  return () => window.clearTimeout(timer)
}, [loading, messages, shouldReduceMotion, targetMessageId])
```

- [ ] **步骤 3：实现柔和高亮且不破坏自动跟随**

目标 wrapper 使用 motion：

```tsx
animate={isTarget
  ? { backgroundColor: ['transparent', 'var(--color-primary-10)', 'transparent'] }
  : { backgroundColor: 'transparent' }}
transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.8 }}
```

若 Tailwind/CSS 变量不适合 motion 直接插值，改用 `ring-2 ring-primary/20 bg-primary/5` + CSS transition。不要把 `targetMessageId` 加到 `AutoScrollContainer` 的 dependency，以免清除 target 时跳回底部。

- [ ] **步骤 4：区分普通恢复和搜索恢复**

- `targetMessageId === null`：加载历史会话后保持现有 AutoScrollContainer 的首次到底行为；
- 有 target：AutoScrollContainer 先完成普通布局，再由定位 effect 滚到中部；
- target 消息已删除/不可见：清 target，工作区保持可用。

- [ ] **步骤 5：回归流式阅读行为**

保持现有规则：

- 用户在底部时，流式输出自动跟随；
- 用户向上滚动后暂停跟随；
- 用户滚回底部后恢复；
- 搜索定位完成后，如果用户没有回到底部，不应被后续无关状态强制拉到底部。

必要时只在 Assistant 调用点调整 `dependency`，不破坏 `AutoScrollContainer` 在 JD/Optimize 页面中的既有行为。

- [ ] **步骤 6：验证定位与滚动代码**

运行：

```bash
pnpm exec eslint src/pages/assistant/components/message-list src/pages/assistant/components/message-bubble src/pages/assistant/store.ts
pnpm exec tsc --noEmit
git diff --check
```

人工检查 target 清理不会触发新的底部滚动 effect。

---

## 任务 8：完成视觉细节、README 同步与全链路验证

**文件：**

- 修改：`README.md`
- 修改：前述 S5 文件中的最终样式与文案
- 仅验证：S1–S4 Agent、工具调用、确认卡和现有业务路由

- [ ] **步骤 1：同步 README 最新进展**

更新 README：

- “最新进展”日期改为 `2026-08-05`；
- 新增“全局 AI 求职助手”条目；
- 特性亮点增加 Agent 能力；
- 新增核心功能小节，说明：
  - ChatGPT 式沉浸页面；
  - DeepSeek V4 流式 Function Calling；
  - 读取简历、ATS、模板、历史版本和求职看板；
  - 当前简历/看板写入前确认；
  - 会话持久化和历史搜索；
- 数据库初始化说明加入 `ai_conversations`、`ai_messages`、`chat-uploads` 和 S5 搜索 migration；
- 项目结构增加 `pages/assistant`、`lib/ai` 与 `components/layout`。

不要在 README 宣称 S6 图片理解或联网搜索已经完成。

- [ ] **步骤 2：执行针对性 ESLint**

运行：

```bash
pnpm exec eslint \
  src/App.tsx \
  src/components/layout \
  src/components/dashboard \
  src/components/ui/command.tsx \
  src/lib/ai \
  src/lib/supabase/ai \
  src/pages/assistant
```

预期：退出码 0。只修复 S5/S4 相关错误，不顺带清理无关目录。

- [ ] **步骤 3：执行类型、构建和 diff 验证**

运行：

```bash
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

预期：

- TypeScript 退出码 0；
- build 显示 `✓ built`；
- 只允许已有 chunk-size warning；
- `git diff --check` 无输出。

- [ ] **步骤 4：启动本地页面并检查路由可达**

运行：

```bash
pnpm dev --host 127.0.0.1
```

在另一个终端至少检查：

```bash
curl -I http://127.0.0.1:5173/
curl -I http://127.0.0.1:5173/tracker
curl -I http://127.0.0.1:5173/assistant
```

预期均返回 `HTTP/1.1 200 OK`。这只证明路由可达，不替代浏览器交互验收。

- [ ] **步骤 5：桌面浏览器验收**

逐项确认：

1. Dashboard AI 入口与普通模块明确分隔，折叠后 Tooltip 正常。
2. 从首页、看板、带 query/hash 的编辑器地址进入助手，再返回原完整地址。
3. 直接打开 `/assistant` 时返回首页。
4. Assistant 无 Dashboard sidebar/header/padding。
5. 助手侧栏展开/折叠平滑，刷新后保持状态。
6. 新建空态不写数据库；首条消息后才出现新会话。
7. 刷新恢复上次有效会话。
8. 删除当前会话后选择相邻会话；全删后进入欢迎空态。
9. Chat Header、Sidebar、Composer 固定，只有消息区滚动。
10. `Cmd/Ctrl + K` 和 `Cmd/Ctrl + Shift + O` 正常。

- [ ] **步骤 6：搜索与 Agent 浏览器验收**

migration 已由用户应用时确认：

1. 标题、用户正文、助手正文都可搜索。
2. reasoning、`tool-call` 参数/结果和 system 消息不会出现在结果中。
3. `%`、`_`、反斜线按普通字符处理。
4. 快速连续输入不会出现旧结果覆盖。
5. 加载更多不重复结果。
6. 消息结果定位到气泡中部并短暂高亮；标题结果定位底部。
7. 两字符中文查询可用；三字符以上查询按预期命中。

migration 未应用时确认：

- 搜索面板显示“历史搜索尚未启用”；
- 最近会话、聊天与 Agent 仍可用。

Agent 回归：

- 流式生成时向上滚动不会被强制拉回底部；
- 切换会话、新建、返回工作台会停止旧 run；
- 待确认写操作离开时取消；
- 旧 run 不会把消息插入新会话；
- 工具图标、确认卡和 Markdown 保持正常。

- [ ] **步骤 7：移动端与无障碍验收**

在窄视口检查：

- 移动端只显示 Chat Header 入口，不显示桌面窄栏；
- Sheet 全高、间距正确、标题清晰；
- 会话重命名/删除可通过 overflow 菜单触达；
- Dialog/Sheet 控制台无 `Missing Description` 或 `aria-describedby` warning；
- 键盘焦点进入 Dialog 后可上下选择和 Enter；
- 浏览器启用 `prefers-reduced-motion: reduce` 时无侧栏宽度/位移动画，消息定位仍完成但不执行平滑滚动或高亮动画。

- [ ] **步骤 8：记录 migration 状态并保持未提交**

最终报告必须明确：

- `20260805000001_add_ai_conversation_search.sql` 是否只写入仓库；
- dry-run 是否成功；
- 是否由用户应用到目标 Supabase；
- 哪些浏览器链路已由代理验证，哪些仍需用户人工确认；
- 未执行 `git commit`、`git push`。

---

## 规格覆盖自检

| 规格要求 | 对应任务 |
| --- | --- |
| Dashboard/Assistant 双外壳 | 任务 2 |
| 高识别度全局 AI 入口 | 任务 2 |
| 来源页返回与刷新恢复 | 任务 1、2、3 |
| 桌面可折叠侧栏与持久化 | 任务 1、3、4 |
| 移动端全高 Sheet 与 ARIA | 任务 4、8 |
| 恢复上次有效会话 | 任务 3 |
| 新建空态不产生脏记录 | 任务 3、4 |
| 删除当前会话选择相邻项 | 任务 3、4 |
| 离开/切换时中止 Agent 与确认 | 任务 3、8 |
| owner-only 服务端历史搜索 | 任务 5 |
| 标题与可见 text part 搜索 | 任务 5、6 |
| reasoning/tool-call/system 不参与搜索 | 任务 5、8 |
| 搜索防抖、取消与分页 | 任务 6 |
| 结果定位与高亮 | 任务 7 |
| 自动滚动协作 | 任务 7、8 |
| GAIA 优先与组件拆分 | 任务 4、6 |
| reduced motion 与快捷键 | 任务 3、4、7、8 |
| README 同步 | 任务 8 |
| 不新增测试、不自动推远端、不提交 | 全计划覆盖规则、任务 8 |

