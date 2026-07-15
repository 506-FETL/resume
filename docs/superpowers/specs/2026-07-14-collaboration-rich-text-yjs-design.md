# 富文本实时协作（Yjs + Tiptap）设计（子项目 B）

- 状态：待确认
- 日期：2026-07-14
- 范围：简历编辑器中 9 个 Tiptap 富文本编辑器的字符级协作合并 + 编辑器内远端彩色光标/选区
- 前置：子项目 A（字段级同步）已完成。本设计复用 A 的 `rich`→LWW 分类作为 HTML 持久化镜像。

## 1. 背景

简历有 9 个富文本字段（`self_evaluation.content`、`hobbies.description`、`honors_certificates.description`、`skill_specialty.description`，以及 5 类经历数组项的 `workInfo`/`internshipInfo`/`projectInfo`/`eduInfo`/`campusInfo`），均用 Tiptap（`SimpleEditor`）编辑、以 **HTML 字符串**存储，下游 preview/PDF/模板运行时经 `RuntimeRichText`→`parseSanitizedHtml(html)` 消费。

子项目 A 把富文本归类为 `rich`→整段 LWW：并发编辑同一富文本字段时后写覆盖，不做字符级合并，也无编辑器内远端光标。用户要求富文本达到 Google Docs 级体验：**字符级无冲突合并 + 编辑器内彩色远端光标/选区**。

对 HTML 字符串做字符级 CRDT 不安全（并发会撕裂标签）。市面成熟方案是把富文本正文放进结构化 CRDT。经评估选定 **Yjs + Tiptap 官方协作扩展**（`@tiptap/extension-collaboration` + `@tiptap/extension-collaboration-caret`）：与 Tiptap 3 一等公民集成、彩色光标开箱即用、生产验证充分。

## 2. 目标与非目标

### 2.1 目标

- 协作会话开启时，9 个富文本编辑器由 Yjs 驱动，同一字段并发编辑按字符无冲突合并。
- 编辑器内实时显示其他协作者的彩色光标与选区（含姓名标签）。
- 富文本 HTML 仍持续镜像回 Automerge/Supabase，使 preview/PDF/历史/optimize 等 HTML 消费方零改动。
- 传输走现有 Supabase Realtime（新增一个 Yjs provider，与 `SupabaseNetworkAdapter` 平行），不引入新后端。
- 协作**关闭**时，编辑器行为与现状完全一致（普通 HTML `content` prop，无 Yjs、无光标）。
- 首次进入协作、Yjs 文档为空时，从现有 HTML 正确种子化，且不产生跨协作者重复内容。

### 2.2 非目标

- 不改变 A 的表单标量/数组字段同步（那仍由 Automerge 负责）。
- 不改 HTML 持久化格式、preview/PDF/模板运行时、历史快照结构。
- 不做离线（offline 模式）富文本协作——仅在线协作会话内启用 Yjs。
- 不做富文本的图片二进制 CRDT 合并（图片仍走现有上传/URL，作为节点属性）。
- 不替换 A 的 `rich`→LWW 写路径——它继续作为 HTML 镜像的落库通道。

## 3. 架构

### 3.1 双 CRDT 分工

- **Automerge**（A 已建）：表单标量、枚举、日期、数组结构、以及富文本字段的 **HTML 镜像**（`rich`→LWW）。负责持久化、preview、PDF、历史。
- **Yjs**（B 新增）：仅承载 9 个富文本正文的**实时协作编辑状态**（结构化 CRDT）+ awareness（光标/选区/用户）。仅在协作会话期间存在。

两者通过「Tiptap `onUpdate` → `editor.getHTML()` → 现有 `field.onChange` → `useResumeFormSync`（rich=LWW）→ Automerge → Supabase」这条**既有链路**桥接：Yjs 是编辑真源，HTML 是派生镜像。

### 3.2 Yjs 文档与字段映射

- 每个协作会话一个 `Y.Doc`（`resume:<resumeId>` 绑定，会话结束销毁）。
- 每个富文本字段映射到一个 `Y.XmlFragment`，命名键 = 该字段的**稳定路径键**。方案：用组件已知的 section + RHF 字段 `name` 拼成 `fragmentKey`（如 `self_evaluation.content`、`work_experience.items.0.workInfo`）。数组项用索引键，与 A 的位置语义一致（stable-item-id 属未来工作，见 §6）。

### 3.3 传输 Provider（Supabase）

新增 `SupabaseYjsProvider`，平行于 `SupabaseNetworkAdapter`：

- 频道名 `yjs:resume:<resumeId>:<sessionId>`（与 Automerge 频道隔离）。
- **文档同步**：监听 `Y.Doc` 的 `update` 事件，将二进制 update（base64）经 broadcast 发出；收到远端 update 时 `Y.applyUpdate`。初次连接用 y-protocols 的 sync step1/step2 交换状态向量，保证后加入者拿到全量。
- **awareness**：用 `y-protocols/awareness` 的 `Awareness` 实例，编码/广播本地 awareness（光标位置、用户名、颜色）；收到远端 awareness 应用到本地 `Awareness`，供 CollaborationCaret 渲染。
- 复用现有 presence/离开清理逻辑，peer 离开时清除其 awareness。

### 3.4 SimpleEditor 双模式

`SimpleEditor` 增加协作模式开关：

- **standalone（默认，协作关闭）**：现状不变——`content` prop 驱动、`onChange` 回吐 HTML。不加载 Collaboration/Caret 扩展。
- **collaborative（协作开启）**：加载 `Collaboration.configure({ fragment })` 与 `CollaborationCaret.configure({ provider, user })`；**不传 `content`**（Yjs 是真源，Tiptap 要求协作时不设初始 content，否则重复）；`onUpdate` 仍回吐 HTML 到 `field.onChange`（维持镜像）。

两模式通过 key 或独立子组件切换，确保切换时 Tiptap 实例干净重建。

### 3.5 种子化（首次内容注入）

Yjs 字段首次为空时需注入现有 HTML，且避免多人重复注入：

- 仅 **host** 角色在会话建立后、对每个空 `Y.XmlFragment` 用现有 HTML（经 Tiptap `generateJSON`/`ProseMirror` 转换）注入一次。
- guest 不种子化，等待同步。
- 判定「空」以 Yjs 类型长度为准；已同步到非空则跳过，避免覆盖协作者内容。

### 3.6 生命周期接线

在 `enableCollaborationSession`（A 的会话入口）成功后，额外初始化 `SupabaseYjsProvider` + `Y.Doc` + `Awareness`，存入协作 store 供各 `SimpleEditor` 消费（通过 React context 或协作 store 选择器）；`stopSharing`/`handleRemoteShareEnd` 时销毁 provider、Y.Doc、awareness，编辑器回落 standalone。

## 4. 组件与数据流

- 新增 `src/lib/collaboration/richtext/yjs-doc.ts`：会话级 `Y.Doc` + `Awareness` 的创建/销毁 + fragment 取用（`getFieldFragment(key)`）。
- 新增 `src/lib/collaboration/richtext/supabase-yjs-provider.ts`：Supabase broadcast 上的 Yjs 同步 + awareness provider（含 sync step1/2、update 广播、awareness 编解码、离开清理）。
- 新增 `src/lib/collaboration/richtext/fragment-key.ts`：纯函数，`buildFragmentKey(sectionKey, relativePath)`（可单测）。
- 新增 `src/lib/collaboration/richtext/store.ts` 或并入现有协作 store：暴露 `{ ydoc, awareness, provider, isRichTextCollabReady }`。
- 修改 `src/components/tiptap-templates/simple/simple-editor.tsx`：接受可选 `collab?: { fragment, provider, user }`；协作时加载 Collaboration+CollaborationCaret、不传 content。
- 修改 9 个富文本 FormField 处：把当前 `SimpleEditor content=...` 调整为按协作状态传 `collab`（fragment 由 fragmentKey 取用）。
- 修改 `src/lib/collaboration/session/*`：会话开关时创建/销毁 Yjs 层。

## 5. 错误处理

- provider 未就绪或 Yjs 层缺失时，`SimpleEditor` 回落 standalone（HTML content），不崩溃。
- awareness 解析失败忽略单条，不影响文档同步。
- 种子化仅 host 且仅空 fragment，异常时记录并跳过该字段，不阻塞其他字段。
- 会话销毁需解绑 Y.Doc `update` 监听、退订频道、销毁 awareness，避免泄漏与重复应用。

## 6. 已知边界

- 数组项富文本用索引式 fragmentKey：中间插入/删除会错位（与 A §3.6 一致的位置语义）。stable-item-id 关联 fragment 属未来工作。
- 富文本图片仍以节点属性存 URL，不做二进制 CRDT。
- 仅在线协作启用 Yjs；离线仍 HTML LWW。

## 7. 测试

纯函数单测（`node --test`）：
- `buildFragmentKey`：section 级与数组项级 key 生成、稳定、可逆区分。
- provider 的 awareness/update 编解码纯函数（base64、消息封装）若可抽出则单测。

集成/浏览器验证（spec §8 复现清单）：
- 两人同改同一富文本字段：字符级合并、互不覆盖、双方光标可见。
- 编辑器内远端光标随对方输入实时移动、显示姓名与颜色。
- 富文本改动仍镜像为 HTML，preview/PDF/刷新后保留。
- 协作关闭后编辑器回落 standalone，行为如常。
- 首次种子化不产生重复内容（host 注入、guest 接收）。

最后运行：纯函数单测、`npx tsc --noEmit`（对齐 A 的基线）、`pnpm lint`（新增文件清）、`pnpm build`。浏览器双窗口验证光标与合并（环境不可用时注明，用 Yjs 层集成测试兜底 CRDT 合并语义）。

## 8. 成功标准

- 两人同改同一富文本字段按字符合并、互不覆盖、均不丢输入。
- 编辑器内实时显示远端彩色光标/选区 + 姓名。
- HTML 镜像不回归：preview/PDF/历史/刷新内容一致。
- 协作关闭时富文本编辑器行为与现状一致。
- 无内存泄漏（会话反复开关不累积监听/频道）、无类型错误、无构建错误。
