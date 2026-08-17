# 实时协作彻底修复 + ATS 图与定位高亮 — 设计文档

日期：2026-08-18
背景：上一轮（commit a733afe）对协作时序的改动未修复协作者空文档，反而加重竞态并引入"编辑器刷新一遍"。已将协作核心回退到 4d9f5b2 基线，本设计用正确方案重做。

---

## 问题一：ATS 趋势图横坐标被遮挡 + 不该显示"月日"

现状：上一轮把 XAxis 改为数字轴 + tickFormatter 显示 `formatRelativeTime`，但 8 个刻度全量显示（interval=0）导致标签相互重叠/被裁切；且最早的点落在 >7 天显示成"2026年6月3日"（月日）。

方案：
1. 不再强制 `interval={0}` 全量刻度；让 recharts 自动抽稀（`interval="preserveStartEnd"` 或按点数控制），并给 `XAxis` 适当 `minTickGap`，避免标签重叠。
2. x 轴文案统一用简洁相对时间（不出现"YYYY年M月D日"）：为趋势点生成始终相对的短标签（如"6天前"、"1天前"，同一相对时间多点加"HH:mm"）。tooltip 仍显示完整时间。
3. 保留数字轴 + 唯一 index 修复（避免类目轴塌陷）。

## 问题二：实时协作协作者空文档（彻底修复）

根因（automerge 运行时机制）：
- guest `repo.find(docUrl)` 在零 peer 时被 `DocSynchronizer.#checkDocUnavailable` 的空 peers 数组 `.every()===true` **立即**判定 unavailable，回退新建空白文档。
- guest 在 handle 建立前 `localDocumentId=null`，`registerSyncBroadcast` 把 host 的 sync 消息丢进 `pendingMessages`，且回退后新建文档的 documentId ≠ docUrl 的 documentId，`emitSyncMessage` 用本地 id 改写来源 documentId，导致同步错乱、正文恒空。

关键事实：host 分享的 `docUrl` 的 documentId === host handle 的 documentId（`getDocumentUrl()` 返回 host handle.url）。因此 guest 若能 find 到该 docUrl，会得到**相同 documentId** 的 handle，automerge 原生 sync 即可工作，无需 documentId 转译。

方案（"先连接、等对端、再 find"，让 guest 与 host 共用 documentId）：
1. `CollaborationSessionManager.enable` 增加可选 `sharedDocumentUrl`。guest 场景（有 sharedDocumentUrl 且当前无 handle）：
   - 挂载 adapter 后，用 `parseAutomergeUrl(sharedDocumentUrl).documentId` **预置** `adapter.setLocalDocumentId(documentId)`——使 host 早期 sync 消息不被丢弃、且路由到正确 documentId。
   - `await adapter.whenReady()`（基线语义：等 `peer-candidate`，即 host presence join）+ 超时兜底，确保有对端后再查找。
   - `repo.find(sharedDocumentUrl)` 得到与 host 相同 documentId 的 handle，`attachHandle`。
2. `DocumentManager`：新增 `sharedDocumentUrl` + guest 初始化路径。`initialize` 在 guest 场景优先走"session 先 enable→find"，成功则用该 handle，失败再回退基线逻辑（loadPersistedHandle→新建空白）。
3. 加载入口（use-resume-loader / document.ts）把 `collabSessionParam` 与 presence 传入，触发 guest 初始化路径。
4. 超时常量：`SHARED_DOCUMENT_ADAPTER_READY_TIMEOUT_MS`。

与上一轮的区别（避免重蹈覆辙）：
- 就绪信号用 `whenReady()`（peer-candidate）而非 `whenChannelReady()`（仅 SUBSCRIBED）。
- 不提前把 `adapter.ready=true`，保留 automerge `networkSubsystem.whenReady()` 等 peer 的闸门。
- find 前预置 localDocumentId，解 pending 死锁。

## 问题三：编辑器"刷新一遍"

根因：协作会话激活后 `useRichTextCollab` 从 undefined 变为真实配置，`SimpleEditor` 的 `useEditor` 依赖 `[isCollab, collab?.fragment]` 变化 → Tiptap 编辑器实例整体重建。

方案：评估最小侵入的消除方式——避免因 `isCollab` 翻转而重建整个编辑器实例。优先方案：稳定 useEditor 的依赖（协作配置就绪前后不改变 editor 实例，改用 extension 动态挂载或让 fragment 引用稳定）。若风险过高，则至少确保重建不丢用户输入且不可见闪烁。以运行走查 + 构建为准，具体实现时择优。

## 问题四：定位高亮改为简历评论同款黄色

现状：上一轮用主色 ring 脉冲，用户反馈难看、无 padding、且滚动移动窗口造成遮挡。

方案：
1. 复用简历评论的高亮视觉（评论锚点高亮用黄色）。查其 class/CSS 变量，定位高亮改为同款黄色底 + 圆角 + 内边距（padding），更醒目协调。
2. 滚动：不再用 `scrollIntoView` 移动窗口造成遮挡。改为仅在目标不在可视区时做**容器内偏移滚动**并保留 `scroll-margin`；或完全不滚动、只高亮。以"高亮后目标完整可见且不被 sticky 标题栏遮挡"为验收。

---

## 交付
- 不涉及 DB 迁移/Edge Function（纯前端）。
- 构建校验 `pnpm build`；协作逻辑走查；运行时双端验证由用户验收。
