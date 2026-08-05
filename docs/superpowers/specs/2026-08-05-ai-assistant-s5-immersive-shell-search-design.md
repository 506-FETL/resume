# AI 助手 · S5 沉浸式入口与历史搜索 — 设计规格

- 日期：2026-08-05
- 子项目：S5（S1 数据层 ✓ → S2 对话骨架 ✓ → S3 Agent 引擎 ✓ → S4 内部工具与确认 ✓ → **S5 沉浸式入口与历史搜索** → S6 图片理解）
- 目标：把现有 `/assistant` 从 Dashboard 内嵌页面升级为独立的 ChatGPT 式沉浸工作区，并补齐高识别度全局入口、来源页返回、会话恢复、侧栏折叠与历史正文搜索。
- 范围：全局页面外壳、Dashboard AI 入口、`src/pages/assistant/**`、AI 会话查询数据层，以及一条 Supabase 搜索 migration。

## 背景与现状

S1–S4 已交付会话与消息持久化、流式对话、DeepSeek Function Calling、内部信息读取、写操作确认和 Agent loop。当前 `/assistant` 仍嵌套在 Dashboard 的全局侧栏、顶部栏和页面留白内，并通过 `useFillHeight` 计算剩余高度；这与已经确认的“侧栏只是入口，进入后就是网页版 ChatGPT 形态”不一致。

现有 Dashboard 侧栏已经有普通的“AI 助手”菜单项，但它与首页、简历、看板等业务模块同级，识别度不足。现有助手会话栏支持新建、切换、重命名和删除，但不支持折叠、恢复上次会话或检索历史正文。

## 已确认决策

1. `/assistant` 使用独立沉浸式外壳，隐藏 Dashboard 的 `AppSidebar`、`SiteHeader` 和外层页面留白。
2. Dashboard 中的 AI 助手入口提升为独立高优先级入口，与普通业务模块分隔。
3. 桌面助手侧栏默认展开、可折叠为窄栏并持久化；移动端继续使用全高 Sheet。
4. “返回工作台”返回进入助手前的完整站内地址；没有有效来源时返回首页。
5. 进入助手时恢复上次打开的有效会话，不自动新建空会话。
6. 历史搜索覆盖会话标题和用户可见的消息正文，结果可定位到具体消息。
7. 采用“独立外壳 + Supabase 服务端搜索”方案，不在浏览器下载全量历史消息。
8. 优先复用 GAIA 组件；GAIA 没有对应能力时，使用仓库现有 shadcn/Radix primitives，不为统一外观强行套用不匹配的组件。

## 非目标

S5 不包含以下能力：

- 图片上传与图片理解；
- 联网搜索与 Link Preview 搜索结果；
- 模型切换、语音输入、`@` 提及；
- 日期、角色、工具类型等高级搜索筛选；
- 修改 Agent loop、Function Calling 协议或 S4 写操作确认语义；
- 将所有路由重构为 React Router 嵌套路由。

以上能力分别留给 S6 或后续独立子项目。

## 1. 页面外壳架构

### 1.1 外壳拆分

将当前集中在 `src/App.tsx` 的页面框架拆成两个职责单一的外壳：

```text
src/components/layout/
├── dashboard-shell.tsx
└── assistant-shell.tsx
```

- `DashboardShell`：承载现有 `SidebarProvider`、`AppSidebar`、`SiteHeader`、页面 padding、路由转场和 Dashboard 内容区。
- `AssistantShell`：承载完整视口的 AI 助手工作区，只保留全局 Theme Provider 和 Toaster 等跨页面基础设施。
- `App.tsx`：只负责获取路由元素、判断当前是否为 `/assistant` 或未来的 `/assistant/*` 子路由，并选择对应外壳；不承载助手业务状态。

此拆分不改写 `vite-plugin-pages` 的文件系统路由，不波及其他业务页面。

### 1.2 助手工作区布局

`AssistantShell` 使用 `height: 100dvh` 和 `overflow: hidden`。页面分为：

1. **Assistant Sidebar**
   - 桌面默认宽度约 `280px`；
   - 折叠后约 `64px`；
   - 宽度状态写入 `localStorage`；
   - 折叠后仍保留返回、新建、搜索和展开按钮，不完全隐藏。
2. **Chat Workspace**
   - 顶部固定会话信息栏；
   - 中间是页面唯一滚动区域；
   - 底部固定 GAIA Composer。

助手页面不再依赖 Dashboard 高度，因此删除 `useFillHeight` 及对应运行时测量逻辑。

### 1.3 响应式行为

- 桌面端：会话侧栏常驻，使用 `motion/react` 平滑切换展开和折叠宽度。
- 移动端：不显示折叠窄栏；顶部按钮打开全高左侧 Sheet，关闭后聊天区恢复全宽。
- Composer、顶部栏和桌面侧栏本身均不随消息滚动。
- 继续保证只有消息内容区域滚动，避免恢复此前整页滚动的问题。

### 1.4 动效与无障碍

- 侧栏宽度、搜索结果进入、空态切换和消息命中高亮使用 `motion/react`。
- 不对流式输出的每个 token 添加动效。
- `prefers-reduced-motion` 开启时取消位移和宽度过渡，状态立即切换。
- 折叠、返回、新建、搜索等纯图标按钮必须有中文 `aria-label` 和 Tooltip。
- 快捷键：
  - `Cmd/Ctrl + K`：打开历史搜索；
  - `Cmd/Ctrl + Shift + O`：进入新对话空态。
- Dialog 和 Sheet 必须包含可访问的 Title 与 Description，不得产生 Radix 无障碍警告。

## 2. 全局入口与返回链路

### 2.1 Dashboard 主入口

将“AI 助手”从 `Data.modules` 普通业务菜单中移出，在 Dashboard 品牌区下方渲染独立入口：

- 使用独立容器、强调色和 `Sparkles` 标识；
- 与首页、我的简历、求职看板等模块视觉分隔；
- Dashboard 侧栏折叠时仅显示图标，并通过 Tooltip 展示名称；
- 点击后进入 `/assistant`，不在业务页面侧边展开聊天面板。

入口组件只负责导航与来源记录，不直接读写助手会话状态。

### 2.2 来源地址记录

点击 AI 助手入口时记录当前完整站内地址：

```text
pathname + search + hash
```

同时写入：

1. React Router `location.state.from`：保证本次导航来源精确；
2. `sessionStorage`：保证助手页面刷新后仍可返回。

来源地址必须通过统一 helper 校验：

- 必须以单个 `/` 开头；
- 不允许 `//`、协议地址或其他外部 URL；
- 不允许把 `/assistant` 或 `/assistant/*` 作为返回目标。

### 2.3 返回优先级

“返回工作台”按以下顺序解析：

1. 当前路由存在合法 `state.from`；
2. `sessionStorage` 中存在最近一次合法业务地址；
3. 回到 `/`。

不使用 `navigate(-1)` 作为主逻辑，避免直接访问、刷新或外部跳转后返回错误页面。

### 2.4 侧栏底部能力

助手沉浸外壳仍需提供账户菜单和主题切换。若现有 `NavUser` 与 Dashboard `SidebarProvider` 强耦合，则抽取可复用的用户菜单内容，而不是复制认证和退出逻辑。

## 3. 会话恢复与生命周期

### 3.1 初始化恢复

新增 `useAssistantBootstrap` 统一编排初始化，避免初始化逻辑继续堆在页面 `index.tsx`。

进入 `/assistant` 后：

1. 加载会话列表；
2. 按顺序选择恢复目标：
   - Store 中仍存在且属于当前列表的 `activeConversationId`；
   - `localStorage` 中记录的上次会话 ID，且仍存在；
   - 最近更新的一条会话；
   - 无历史记录时展示欢迎空态。
3. 加载目标会话消息；
4. 成功后一次性提交 active ID 和消息列表。

加载期间同时展示会话栏 Skeleton 和消息区 Skeleton，不先闪现欢迎空态。

### 3.2 状态提交原则

- 切换历史会话时先加载目标消息，再原子更新 active ID 与 messages。
- 目标会话加载失败时保留当前会话与消息，不提前清空工作区。
- 每次成功切换会话，或首次发送创建会话后，更新上次会话 ID。
- 持久化 ID 只作为恢复提示，必须与服务端返回的 owner-only 会话列表校验。

### 3.3 新建与删除

- “新建对话”只进入本地欢迎/空白状态；
- 用户发送第一条消息时才创建数据库会话，避免产生空记录；
- 删除当前会话前先根据当前排序确定候选会话：
  - 优先当前项之后的一条；
  - 否则使用之前的一条；
  - 没有候选则进入欢迎空态；
- 删除后清理失效的持久化会话 ID，并在候选会话加载成功后写入新 ID。

### 3.4 进行中任务清理

流式生成或等待写操作确认时，以下行为必须先停止当前 Agent loop：

- 切换会话；
- 新建对话；
- 返回工作台；
- 页面卸载。

待确认写操作视为取消，不允许在后台继续执行。未完整结束的 assistant 回复不落库，沿用 S2–S4 规则。

## 4. 历史全文搜索

### 4.1 搜索数据范围

新增 owner-only RPC：

```text
search_ai_conversations(search_query, result_limit, result_offset)
```

搜索范围仅包含：

- `ai_conversations.title`；
- `ai_messages.parts` 数组中 `type = 'text'` 的 `text`；
- 消息角色限定为 `user` 和 `assistant`。

以下内容不参与搜索：

- `reasoning`；
- `tool-call` 的工具名、参数和结果；
- `image` 路径；
- `system` 消息；
- JSONB 的其他内部字段。

这既减少噪声，也避免把用户不可见的推理或工具过程暴露在搜索结果中。

### 4.2 SQL 与索引方向

新增 migration：

```text
supabase/migrations/20260805000001_add_ai_conversation_search.sql
```

迁移包括：

1. 通过 migration 启用 `pg_trgm` 扩展，并显式安装到 Supabase 的 `extensions` schema；
2. 增加不可变 helper，将 `parts` 中所有 `type = 'text'` 的内容拼接为可搜索文本；
3. 为会话标题创建 trigram GIN 索引；
4. 为消息“可见文本 helper 表达式”创建 trigram GIN 索引；
5. 创建 `search_ai_conversations` RPC；
6. RPC 使用 `SECURITY INVOKER SET search_path = ''`，所有表、helper 和 `auth.uid()` 均使用完整 schema 名；
7. 在函数内部显式限制 `user_id = auth.uid()`，前端不能传入 `user_id`；
8. 显式执行 `REVOKE EXECUTE ... FROM PUBLIC, anon`，再只向 `authenticated` 授予执行权限。

中文内容不依赖英文分词器，使用精确子串命中与 trigram 相关性排序。匹配条件使用转义后的 `ILIKE` pattern，使查询中的反斜线、`%`、`_` 按普通文本处理，不能改变查询语义；相关性函数只参与排序，不用相似度阈值排除精确子串命中。

PostgreSQL 官方文档说明：trigram GIN 索引支持 `LIKE`/`ILIKE`，但无法从 pattern 提取 trigram 时会退化为全索引扫描。S5 仍允许两个字符的中文查询以符合实际使用习惯；RPC 必须限制 owner、分页大小和最大返回数，实施验证需对两字符与三字符以上查询分别执行 `EXPLAIN`，记录短查询的性能边界，不误称所有查询都稳定命中索引。

### 4.3 RPC 返回契约

每条结果返回：

```ts
interface AiConversationSearchResult {
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

- 标题命中时 `messageId` 与 `role` 为 `null`；
- 消息命中摘要截取关键词附近的有限长度文本；
- 同一消息只返回一条结果；
- 默认每页 20 条；
- 排序先按相关性，再按命中时间和会话更新时间；
- `result_limit` 在数据库端设置安全上限，防止任意大查询。
- `search_query` 在数据库端执行 `trim` 并设置最大长度；空字符串返回空结果，不允许触发全表查询。

### 4.4 搜索交互

使用现有 `CommandDialog`/`cmdk` primitives 组合历史搜索界面：

- `shouldFilter={false}`，结果由服务端排序，不再由 cmdk 二次过滤；
- 输入防抖约 `250ms`；
- 少于 2 个字符时展示最近会话，不调用 RPC；
- 搜索结果显示会话标题、命中摘要、角色和相对时间；
- 关键词在客户端做安全的文本分段高亮，不使用 `dangerouslySetInnerHTML`；
- 支持键盘上下选择、Enter 跳转；
- 首次展示 20 条，可继续加载下一页；
- 查询变化或 Dialog 关闭时取消过期请求，旧结果不得覆盖新查询。

GAIA 当前没有专用会话搜索组件，因此不引入不匹配的 GAIA 卡片；搜索继续遵守项目主题、圆角、间距和可访问性规范。

### 4.5 结果定位

点击结果后：

1. 关闭搜索弹层和移动端会话 Sheet；
2. 加载目标会话；
3. 原子更新 active ID 与消息列表；
4. 如果 `messageId` 有效，将消息滚动到视区中部；
5. 对目标气泡施加短暂、柔和且支持 reduced motion 的高亮；
6. 标题命中或消息已不存在时，正常进入会话并定位底部。

消息 DOM 需要稳定的 `data-message-id` 或等价 ref 映射。定位状态只保存短期目标，不写入数据库或持久化存储。

## 5. 页面模块与状态边界

### 5.1 页面目录

S5 完成后的目标结构：

```text
src/pages/assistant/
├── index.tsx
├── const.ts
├── store.ts
├── types.ts
├── hooks/
│   ├── use-assistant-bootstrap.ts
│   ├── use-assistant-navigation.ts
│   ├── use-conversation-search.ts
│   └── use-chat-stream.ts
└── components/
    ├── assistant-sidebar/
    │   ├── index.tsx
    │   ├── sidebar-header.tsx
    │   ├── sidebar-actions.tsx
    │   └── sidebar-footer.tsx
    ├── conversation-list/
    ├── conversation-search/
    │   ├── index.tsx
    │   ├── search-result.tsx
    │   └── search-empty.tsx
    ├── chat-header/
    ├── message-list/
    ├── message-bubble/
    ├── confirm-card/
    └── composer/
```

文件名使用 kebab-case；组件文件夹通过 `index.tsx` 导出，遵守仓库页面组织规范。

### 5.2 职责划分

- `index.tsx`：只装配 Assistant Sidebar、Chat Header、Message List、Composer 和移动端 Sheet。
- `use-assistant-bootstrap`：会话列表初始化、恢复目标选择和初次消息加载。
- `use-assistant-navigation`：来源地址记录、返回工作台、会话切换前清理和快捷键。
- `use-conversation-search`：查询、防抖、分页、取消过期请求和搜索错误。
- `use-chat-stream`：继续负责消息发送和 Agent 流式编排，不吸收 S5 导航职责。
- `src/lib/supabase/ai/conversations.ts`：新增 typed RPC 调用，不把 Supabase 查询写入组件。

### 5.3 Zustand 状态

以下跨组件共享状态进入页面 Store：

- `activeConversationId` 与当前 messages；
- `pendingConversationId` 或等价的会话加载状态；
- 侧栏展开/折叠状态；
- 搜索弹层开关；
- 待定位和待高亮的 message ID；
- 现有 streaming、pending confirm 和 abort controller。

搜索输入、单次结果列表和局部菜单开关保留在对应 hook/组件内。任何值若需要跨两层以上传递，优先由 Store 或专用 hook 提供，禁止通过布局组件无脑 props 下钻。

### 5.4 视觉层级

- Assistant Sidebar 使用低对比背景，与聊天画布形成稳定分层。
- 当前会话使用强调色侧标与背景，不能只靠文字加粗。
- Chat Header 展示当前会话标题和必要控制；欢迎空态展示产品价值与可执行示例。
- 消息正文保持适合阅读的最大宽度，Composer 与正文主轴对齐，避免内容过度集中或左右失衡。
- 移动端会话项不依赖 hover；重命名和删除放入常驻 overflow 菜单。
- 现有 GAIA `Composer`、`MessageBubble`、`WaveSpinner` 和 `ToolCallsSection` 继续作为对应功能的首选组件。

## 6. 错误处理与降级

- 搜索 RPC 缺失或 migration 未执行：搜索面板显示“历史搜索尚未启用”和重试提示；最近会话、聊天和 Agent 能力不受影响。
- 不允许在 RPC 失败时降级为浏览器下载全部历史消息。
- 历史搜索失败只影响搜索面板，不清空当前对话。
- 目标会话加载失败：保留当前工作区，显示 toast 或面板内重试状态。
- 来源地址、持久化会话 ID 或消息 ID 非法/失效：按既定优先级安全回退，不显示空白页。
- 删除会话、切换会话和返回工作台期间发生中止时，必须同步清理 pending confirm 和 streaming 临时状态。
- S5 不改变当前数据库 owner-only RLS；新增函数不得接受客户端提供的 owner ID。
- helper 函数只负责从单条 JSONB `parts` 中提取可见文本，不访问表、不使用 `SECURITY DEFINER`，并撤销不需要的外部执行权限。

## 7. 验证与验收

本仓库不新增测试文件。实现后必须依次运行：

```bash
pnpm exec eslint <S5 修改文件>
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

### 7.1 桌面验收

- 从首页、求职看板和具体简历编辑 URL 进入助手，返回后恢复原始 pathname、query 和 hash。
- 直接打开 `/assistant` 时返回首页。
- `/assistant` 不显示 Dashboard 的全局侧栏、顶部栏或页面 padding。
- Assistant Sidebar 默认展开，可折叠为窄栏，刷新后保持选择。
- 折叠窄栏仍能返回、新建、搜索和重新展开。
- 只有消息区滚动，Chat Header、Sidebar 和 Composer 固定。
- 进入助手自动恢复上次有效会话；失效 ID 回退最近会话。
- 新建空态不会产生数据库空记录。
- 删除当前会话后按相邻顺序选择下一条，全部删除后进入欢迎空态。

### 7.2 搜索验收

- 会话标题可搜索。
- 用户和助手的可见正文可搜索。
- reasoning、工具参数、工具结果和系统内容不会出现在结果中。
- 中文关键词、英文关键词和包含 `%`/`_` 的普通文本查询行为正确。
- 使用目标 Supabase 环境对两字符中文、三字符以上中文和英文查询运行 `EXPLAIN`；确认长查询可利用 trigram 索引，并记录短查询可能退化扫描的事实。
- 少于 2 个字符不调用 RPC，只显示最近会话。
- 搜索结果可分页，快速连续输入不会出现旧结果覆盖新结果。
- 点击消息命中可进入正确会话、滚动到对应气泡并短暂高亮。
- 标题命中或消息已删除时进入会话并定位底部。
- migration 缺失时只降级搜索，不影响聊天。

### 7.3 Agent 与生命周期回归

- 流式输出仍可向上阅读，只有位于底部时自动跟随新内容。
- 切换会话、新建对话、返回工作台和卸载页面都会停止未完成的 Agent loop。
- 待确认写操作在离开当前会话时取消，不发生后台写入。
- 已完成工具调用、确认卡和 Markdown 内容刷新后仍可正确重现。
- 桌面与移动端均无 Dialog/Sheet ARIA 警告。
- `prefers-reduced-motion` 下不执行侧栏位移和命中高亮动画。

## 8. 实施边界

S5 应作为一个独立实施计划完成，但按以下顺序分阶段验证：

1. 拆分全局外壳并建立沉浸式 `/assistant`；
2. 重构主入口、来源记录和返回链路；
3. 重构助手侧栏、折叠状态和会话恢复；
4. 增加搜索 migration、typed RPC 与搜索面板；
5. 接入消息定位、动效、移动端细节和生命周期清理；
6. 完成静态检查、构建和桌面/移动端人工验收。

不得为了 S5 顺带重构其他业务页面，也不得把 S6 图片理解或后续联网搜索混入本计划。
