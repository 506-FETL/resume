# AI 助手 · S2 对话页面骨架 — 设计规格

- 日期：2026-08-04
- 子项目：S2（序列第 2 个：S1 数据层 ✓ → **S2 页面骨架** → S3 Agent 引擎 → S4 工具集+确认 → S5 入口集成 → S6 图片理解）
- 范围：`src/pages/assistant/**`、`components.json`（加 GAIA registry）、按需从 GAIA 引入的 `src/components/ui/*`
- 目标：交付一个「能看、能聊、能存」的纯流式对话页面——独立路由 `/assistant`，会话列表 + 消息流 + Composer，接 S1 数据层做真流式对话与持久化。**不含 agent loop / 工具 / 图片**（S3/S4/S6）。

## 背景与依赖

- 依赖 S1 已交付：`src/lib/ai/types.ts`（`AiConversation`/`AiMessage`/`AiMessagePart`）、`src/lib/supabase/ai/`（会话/消息 CRUD、`touchConversation`）、`llm-proxy` 瘦代理（已实测流式可用）。
- 复用现有 `src/lib/llm/call.ts` 的 `callLLM(stream:true)`。
- 全局架构决策（已定，见 S1 规格）：前端 loop、FC（非 MCP）、GAIA UI、权限 C。S2 只落"对话外壳"，不触 agent/工具。

## 关键决策（已与用户确认）

- **页面与 dashboard 外壳关系 = A**：保留 `App.tsx` 的 dashboard 外壳（`AppSidebar`+`SiteHeader`），ChatGPT 布局放在页面主区内部（页面内再有会话列表侧栏）。不改 `App.tsx`（风险最低）。"沉浸全屏"留待 S5 按体验决定是否升级。
- **对话深度 = A**：真流式对话（发送→`llm-proxy` stream→逐字渲染→落库），S3 agent loop 复用此骨架。
- **组件接入 = A**：GAIA UI 走 shadcn registry（`@gaia`）逐个 `add`，落地后把 Hugeicons 统一替换为 lucide、对齐 stone/new-york 主题。

## 页面结构与布局

**路由**：`src/pages/assistant/index.tsx` → `/assistant`（vite-plugin-pages 文件系统路由）。

**桌面布局**（dashboard `SidebarInset` 主区内）：左会话列表（约 260px）+ 右对话区（消息流 + 底部 Composer）。
**移动端**：会话列表收进 Sheet 抽屉，主区全宽。

## 模块结构（遵循 page-organization / history-style）

```
src/pages/assistant/
├── index.tsx              # 页面容器：布局装配 + 初始化加载会话
├── const.ts               # 常量（默认会话标题、标题截断长度、文案）
├── types.ts               # 页面局部类型（复用 @/lib/ai/types）
├── store.ts               # 页面级 Zustand store（会话/消息/流式状态）
├── hooks/
│   └── use-chat-stream.ts # 发送→llm-proxy 流式→增量渲染→落库 编排
└── components/
    ├── conversation-list/
    │   ├── index.tsx        # 左栏容器：列表 + 新建 + 空态 + 移动端 Sheet
    │   └── conversation-item.tsx  # 单行：标题 / 内联重命名 / 删除确认
    ├── message-list/index.tsx     # 消息流：滚动容器 + 自动到底
    ├── message-bubble/
    │   ├── index.tsx        # 气泡壳：role 样式 + 按 part 类型分派渲染
    │   └── text-part.tsx    # text part 渲染器（S3/S4/S6 再加 reasoning/tool/image 渲染器）
    └── composer/
        ├── index.tsx        # 输入区（GAIA Composer 落地）
        └── send-button.tsx  # 发送 / streaming 停止态
```

## 状态设计（页面级 Zustand，`store.ts`）

状态：
- `conversations: AiConversation[]`、`activeConversationId: string | null`
- `messages: AiMessage[]`（当前会话已落库消息）
- `streaming: boolean`、`streamingText: string`（进行中的助手临时文本，未落库）
- `loadingConversations: boolean`、`loadingMessages: boolean`
- `abortController: AbortController | null`（当前流的中断句柄）

actions（纯状态操作；DB 调用在 hook/数据层，store 只存结果）：
- `loadConversations()` / `selectConversation(id)` / `setActiveConversation(id)`
- `newConversation()`（本地占位，真正建库在首次发送时，或立即建——见数据流）
- `renameConversation(id, title)` / `removeConversation(id)`
- `setMessages` / `appendMessage(msg)` / `setStreaming(bool)` / `setStreamingText(text)` / `setAbortController`

## 流式对话数据流（`use-chat-stream.ts` 编排）

`sendMessage(text)`：
1. 无 `activeConversationId` → `createConversation()`(S1)，加入列表并设为 active
2. 乐观追加 user 消息（`parts:[{type:'text',text}]`）→ `insertMessage`(S1) 落库；失败则回滚该条 + toast
3. 置 `streaming:true`、`streamingText:''`，新建 `AbortController` 存入 store
4. 历史 `messages` → DeepSeek `messages`（text part 拼成 content 字符串），调 `callLLM({ stream:true, thinking:{type:'disabled'} }, abortController)`
5. `for await` 读 chunk：累加 `delta.content` 进 `streamingText`，消息流实时渲染"进行中"助手气泡（S2 只取 `content`，忽略 `reasoning_content`）
6. 流结束：`insertMessage`(assistant, 累加文本) 落库 → `appendMessage` → 清 `streamingText` / `streaming:false` → `touchConversation`(S1) 刷新排序
7. 若该会话此前无标题（默认"新对话"）→ 用首条用户消息截断生成标题，`renameConversation` 落库

**thinking**：S2 纯对话，请求传 `thinking:{type:'disabled'}` 关闭思考（实测 V4-pro 默认开，关掉更快省 token）。
**abort**：切换会话 / 离开页面 / 点停止 → `abortController.abort()`；进行中的助手回复**不落库**（不留半截脏数据），清 streaming 态。

## 组件粒度与状态约束（硬性）

1. **超阈值必拆**：单组件 `index.tsx` > ~150 行或承担 >1 职责即拆子件（已预拆 `conversation-item` / `send-button` / part 渲染器）。子件仅父用则就近 co-locate。
2. **禁止无脑 props 下钻**：跨组件共享状态/动作一律从 `store.ts` 取（zustand selector）；props 仅用于真正局部父子传参（如 `conversation-item` 接自己那条数据 + 专属回调）。判定线：值需穿过 ≥2 层即提升到 store。
3. **part 渲染分派**：`message-bubble` 按 `part.type` 分派到渲染器，S2 只实现 `text`；S3/S4/S6 的 `reasoning`/`tool-call`/`image` 加渲染器即可，不改气泡壳。
4. **三层不越界**：`use-chat-stream` 管流式编排；`store` 管状态；DB 读写在 `src/lib/supabase/ai`。SSE 解析只在 hook。

## GAIA UI 接入

- `components.json` 的 `registries` 增加 `"@gaia": "https://ui.heygaia.io/r/{name}.json"`
- 用 shadcn skill 逐个 `add` 需要的：`composer`、`message-bubble`、`wave-spinner`（加载）等
- 落地后：Hugeicons → lucide 统一替换；样式对齐 stone/new-york 主题变量
- 产出为项目自有组件（`src/components/ui/`），非运行时依赖

**已查证的 GAIA 组件 API（落地依据）：**
- `Composer`（`add .../composer.json`）：props `value` / `onChange(value)` / `onSubmit(message, files?)` / `disabled` / `placeholder` / `autoFocus` / `attachedFiles` / `onRemoveFile` / `showToolsButton` / `tools` / `maxRows` 等。S2 只接线 text（`value`/`onChange`/`onSubmit` 取 message、`disabled` 绑 streaming）；`tools`/`attachedFiles`/`onAttachClick` 留给 S4/S6。内部用 Hugeicons → 落地改 lucide。
- `MessageBubble`（`add .../message-bubble.json`）：props `message` / `variant: 'sent' | 'received'` / `grouped` / `className` / `children`（children 覆盖 message）。**用户已确认：消息展示采用 GAIA iMessage 气泡风格**（`user` → `variant="sent"`，`assistant` → `variant="received"`；硬编码 iOS 蓝 `#00bbff` 保留）。part 分派渲染通过 `children` 承载：`message-bubble/index.tsx` 用 GAIA `MessageBubble` 作壳，`children` 内按 `part.type` 分派到 `text-part.tsx`（S2 只实现 text；S3/S4/S6 加 reasoning/tool-call/image 渲染器不改壳）。
- `WaveSpinner`（`add .../wave-spinner.json`）：流式等待/加载指示。

## 错误处理边界

- 流式请求失败 → `toast.error` + 移除"进行中"助手气泡；已落库 user 消息保留供重发
- `createConversation`/`insertMessage` 落库失败 → toast + 回滚乐观追加
- 未登录（S1 数据层抛 `用户未登录`）→ 顶层捕获，提示登录
- 删除当前 active 会话 → 自动切到列表下一个或清空主区
- abort 导致的流中断不算错误，不 toast

## 验证（本仓库不写测试）

1. `pnpm lint` + `pnpm build` 通过
2. 手动清单：
   - 新建 / 切换 / 内联重命名 / 删除会话（删当前 active 会切换）
   - 发消息见助手逐字流式；结束后落库
   - 刷新页面：会话列表与当前会话消息完整重现
   - 流式中切换会话：旧流被 abort，未完成回复不落库、不串台
   - 移动端：会话列表抽屉可开合，主区全宽可用
   - 组件粒度自查：无 >150 行巨组件、无 ≥2 层 props 下钻

## 非目标（YAGNI / 移交）

- agent 多步循环、tool_calls 解析、thinking 展示 → S3
- 工具定义与写操作确认卡片 → S4
- 侧边栏「AI 助手」入口与路由跳转、沉浸全屏升级 → S5
- 图片上传 UI 与 vision → S6
- 不改现有 ATS/JD/改写等既有 AI 功能
