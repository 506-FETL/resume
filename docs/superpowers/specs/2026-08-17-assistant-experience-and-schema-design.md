# AI 助手体验与简历 Schema 优化 设计文档

- 日期：2026-08-17
- 状态：已批准，待编写实现计划
- 范围：7 个相对独立的改进，统一在一份 spec 中分模块推进

## 背景

用户在使用 AI 助手"修改简历"时遇到一系列体验问题，集中在四个方面：

1. **AI 盲写试错**：模型不知道简历各模块的字段结构，反复出现"字段结构是对象数组（不是字符串数组）被拒绝""技能模块还需要 label / proficiencyLevel / displayType"这类失败重试。
2. **对话体验硬伤**：变更记录以 JSON 代码 diff 呈现、缺快捷操作；长对话全量加载慢；流式输出中途停止自动滚动；工具调用无即时反馈（以为卡住）。
3. **简历显隐**：被隐藏项在渲染器中占据空行；缺少条目级"隐藏但保留内容"能力。

调研确认（详见对应源码）：
- 简历结构的权威定义在 `src/lib/schema/resume/form/`（Zod），根 schema 为 `resumeSchema`。
- AI 写工具 `update_current_resume_field` 的 `value` 参数仅声明为 `{ type: 'object' }`，模型盲写、Zod 事后拒绝（`src/lib/ai/tools/resume.ts`）。
- **项目当前不存在**任何"给 LLM 用的简历结构描述"，需新增。
- 变更 diff 为自研 LCS 行 diff，非字符串值 `JSON.stringify` 后按行红绿高亮（`src/pages/assistant/components/diff/compute-line-diff.ts`）。
- 对话消息全量 `select('*')` 加载、全量渲染，无分页（`src/lib/supabase/ai/messages.ts`）。
- 自动滚动用"距底 30px"判断粘底（`src/components/ui/auto-scroll-container.tsx`）。
- 工具卡在当前 SSE 步完全结束、`parser.result()` 解析出 toolCalls 后才渲染（`src/lib/ai/agent/agent-loop.ts`）。
- 显隐只有板块级、无条目级；`RuntimeEntry` 仅在 `!title` 时返回 null，其余字段全空仍渲染出空 flex 容器被父级 `gap` 撑成空行（`src/components/resume/runtime/renderers/shared.tsx`）。

## 实现顺序

④⑥（快速修 bug）→ ①⑤（AI 准确性与反馈）→ ⑦（与⑥联动）→ ③（分页）→ ②（变更记录重设计，工作量最大）。

---

## A 组 · AI 准确性

### ① 给大模型注入简历 Schema（自动生成）

**根因**：写工具 `value` 只声明为泛化 `object`，模型靠猜结构。

**方案**：从现有 Zod schema **自动派生**一份紧凑的模块结构说明并注入 AI 上下文。

- 新增 `src/lib/ai/schema-doc/`（例如 `build-schema-doc.ts` + `index.ts`）：
  - **不引入 `zod-to-json-schema`**（其输出冗长、耗 token）。改为手写一个**针对本项目 Zod 定义的紧凑描述生成器**，遍历 `resumeSchema.shape[key]` 的 `_def`，产出人类/模型都易读的说明。仍是"从 Zod 自动派生"，schema 一改即同步，**永不脱节**。
  - 输出重点标注三类模型最易错的信息：
    1. 哪些字段是**对象数组**（`skills` / `certificates` / `hobbies` / 各 experience 的 `items` / `basics.customFields`）而非字符串数组，并给出数组元素对象的字段清单。
    2. 各 `xxxDuration`（workDuration / internshipDuration / duration / projectDuration）是**长度固定为 2 的字符串数组** `[开始, 结束]`。
    3. 所有**枚举取值**：`workYears`、`gender`、`maritalStatus`、`politicalStatus`、`degree`、`dateEntry`、`proficiencyLevel`、`displayType` 等。
  - 模块级 memo 缓存（schema 静态，构建一次即可）。
- 注入点：`src/lib/ai/agent/build-context.ts` 的 `buildUserContext()` 末尾追加"简历模块字段结构"段落（拼进 system 头）；同时精简强化 `update_current_resume_field` 的工具描述，指向该结构说明。

**验收**：常规填充/修改简历不再出现"对象数组 vs 字符串数组""缺 label/displayType"类拒绝重试；skills / certificates / experience items 一次写对。

---

## B 组 · 对话体验

### ④ 流式自动滚动失效（bug）

**根因**：`auto-scroll-container.tsx` 用"距底 30px"判断粘底。流式追加大块内容时，程序化 `scrollTop = scrollHeight` 自身触发 scroll 事件，而此刻可能又追加了新内容使距底 > 30px，被误判为"用户已上滑"→ `isAtBottom=false`，从此停止跟随。

**方案**：改为**用户意图检测**（ChatGPT 式）。

- 监听 `wheel` / `touchmove`（及 keydown 上翻类）判定"用户主动向上脱离"，程序化滚动**不**触发脱离。
- 用一个 `programmaticScrollRef` 标记：程序化设置 `scrollTop` 前置位，scroll 事件里若处于程序化则跳过脱离判定。
- 用户滑回底部即恢复跟随；新一轮流式开始时重新粘底。
- 保留"回到底部"悬浮按钮与切换会话重挂逻辑。

**验收**：流式长文本输出全程自动跟随到底；用户手动上滑后暂停跟随并出现回到底部按钮；滑回底部恢复。

### ⑤ 工具调用无即时反馈

**根因**：`onToolCallStart` 要等整个 SSE 步结束、`parser.result()` 解析出 toolCalls 后才触发；参数流式期间页面无反应。

**方案**：流式期间一旦解析出工具**函数名**就立即显示 pending 轨迹行。

- `src/lib/ai/agent/stream-parser.ts`：暴露进行中的 tool_calls 快照（含已到达的 `function.name`）。
- `src/lib/ai/agent/agent-loop.ts`：`for await` 每个 chunk 后检查，新出现工具名即触发新增回调 `onToolCallPending(toolCallId, toolName)`（仅首次触发一次/工具）。
- `src/pages/assistant/hooks/use-chat-stream.ts`：收到 pending 即向 `draft` push 一个 `state: 'call'` 的 tool-call part（带转圈"修改简历"），参数补全/执行完再用现有 `onToolCallStart` / `onToolResult` 更新同一 `toolCallId` 的状态。
- 保持合帧刷新，避免逐 token 重渲染。

**验收**：模型决定调用工具后，"修改简历"轨迹行（转圈）**立即**出现，而非等数秒。

### ③ 对话分页加载

**根因**：`listMessages` 一次性 `select('*')` 拉全量并全量渲染。

**方案**：反向游标分页（最新在底部，向上加载更早）。

- `src/lib/supabase/ai/messages.ts`：`listMessages(conversationId, { limit, before? })`。默认 `limit = 30`，按 `created_at desc` 取最近 N 条后在内存 reverse 为升序；`before` 为已加载最早消息的 `created_at` 游标。返回 `{ messages, hasMore }`。
- store（`src/pages/assistant/store.ts`）：新增 `hasMoreMessages`、`loadingOlder`、`oldestCursor`；`setConversationView` 兼容分页首屏。
- `src/pages/assistant/components/message-list/index.tsx`：顶部哨兵 + IntersectionObserver 触发"加载更早"；**前插旧消息时用 scrollHeight 差值补偿滚动位置**，避免视口跳动。
- 首屏/切换会话只加载最新 30 条；`use-assistant-bootstrap.ts` / `use-assistant-navigation.ts` 相应调整。
- 竞态保护沿用 `conversationLoadRequestId`。

**验收**：长对话首屏秒开；上滑平滑加载更早消息且视口不跳；到达最早后停止请求。

---

## C 组 · 简历显隐（⑥⑦ 联动）

### ⑥ 隐藏项渲染空行（bug） + ⑦ 条目级隐藏按钮（新功能）

**根因**：无条目级显隐字段；`RuntimeEntry` 仅 `!title` 返回 null，title 存在但其余全空仍渲染空 flex 容器被父级 `gap`（entrySpacing）撑成空行；渲染器 `.filter` 与 comment-core 过滤条件不一致。

**方案**：

- **数据模型**：
  - `src/lib/schema/resume/form/shared.ts` 的 `createExperienceSchema` item 增加可选 `hidden?: boolean`（默认不隐藏）。
  - skills / certificates / hobbies 的 item schema（`skillItemSchema` 等）同步增加 `hidden?: boolean`。
  - `src/lib/schema/resume/normalize.ts` 补默认值；`src/store/resume/helpers/transform.ts` 迁移历史数据（缺省视为未隐藏）。
- **渲染器**：各 `*Renderer.tsx` 的 `.filter` 追加 `&& !item.hidden` 从源头剔除；并修 `RuntimeEntry`（`shared.tsx`）在 title / subtitle / duration / content 全为 null 时整体 `return null`，一并清除历史空行。
- **comment-core**：`supabase/functions/shared/resume-comment-core.ts` 的集合构建（如 `projectExperienceCollection` 的 `readArray(entries).forEach`）跳过 `entry.hidden`，保持节点与渲染一致。
- **编辑器 UI**：
  - 经历类（工作/实习/项目/校园/教育）：在 `resume-field-form-section.tsx` 条目头部"删除"按钮旁新增**眼睛图标按钮**（`Eye` / `EyeOff`）。
  - 标签类（技能/证书/爱好）：每个 tag 上 **hover 显示小眼睛**切换。
  - 隐藏后条目在编辑器中**置灰半透明、内容保留、仍可编辑**。
- **store**：新增 `toggleItemVisibility(sectionKey, entryId)`，走现有 `updateFormFields` 管线保证协作同步。

**验收**：隐藏一条经历后，渲染器/预览/PDF 中该条完全不占位（无空行）；内容仍保存在编辑器、可再显示；标签类同理。

---

## ② 变更记录重设计（工作量最大，放最后）

### ②a 字段级中文对比（替代 JSON 代码 diff）

**根因**：`compute-line-diff.ts` 把对象 `JSON.stringify` 成文本做行 diff。

**方案**：新增字段级 diff。

- 新增 `src/pages/assistant/components/diff/compute-field-diff.ts`：对比 before/after 对象，产出 `{ 中文字段名, 原值, 新值, 变更类型(added/removed/changed) }` 列表；items 数组按 `entryId` 配对逐条对比；**隐藏 entryId / hidden 等技术字段**；空值显示为「（空）」。
- 新增字段名中文映射表：复用 `SECTION_LABELS`（`src/lib/ai/tools/resume.ts`）+ 各表单已有 label，集中到一处映射（`field-labels.ts`）。
- 新增 `FieldDiffView` 组件替换：
  - 右侧画布变更记录 `src/pages/assistant/components/assistant-canvas/change-log/index.tsx`；
  - 待确认卡 `src/pages/assistant/components/confirm-card/`（`resume-field-diff.tsx`）——应用前后一致。
- 对话流轨迹行的 `+N -N` 统计改为按字段变更条数统计（沿用 `DiffStat` 视觉）。

### ②b 快捷操作（四项全做）

- **全部应用 / 全部撤销**：对本轮变更组批量应用/撤销。
- **跳转并高亮**：点某条变更 → 右侧简历预览滚动到对应模块/条目并高亮。渲染器为 section/entry 加锚点 id + 高亮机制（复用 `requestCanvasTab` 打开预览页）。
- **单条撤销 / 重做**：现有仅 `markChangeUndone` 撤销，扩展为可**重做**（保留 before/after 双向切换，重做即再次 apply after）。
- **失败项一键重试**：复用现有 `retryToolCall`（`tool-retry.ts`），扩展到 change-log 失败项 + 批量重试本轮失败。

**验收**：变更记录一眼看懂改了哪些字段（中文）；四类快捷操作可用；跳转能定位并高亮到简历对应位置。

---

## 影响文件汇总（预估）

- 新增：`src/lib/ai/schema-doc/*`、`src/pages/assistant/components/diff/compute-field-diff.ts`、`FieldDiffView`、`field-labels.ts`。
- 修改：`build-context.ts`、`resume.ts`（工具描述）、`stream-parser.ts`、`agent-loop.ts`、`use-chat-stream.ts`、`auto-scroll-container.tsx`、`message-list/index.tsx`、`messages.ts`、`store.ts`、`use-assistant-bootstrap.ts`、`use-assistant-navigation.ts`、`schema/resume/form/shared.ts` 及各 item schema、`normalize.ts`、`transform.ts`、各 `*Renderer.tsx`、`runtime/renderers/shared.tsx`、`resume-comment-core.ts`、`resume-field-form-section.tsx`、技能/证书/爱好表单、`store/resume/form.ts`、`change-log/index.tsx`、`confirm-card/*`、`tool-call-part.tsx`。

## 非目标（YAGNI）

- 不引入第三方 diff 库或 `zod-to-json-schema`。
- 不做消息虚拟列表（分页已足够；虚拟列表待数据量确证后再议）。
- 不改动板块级显隐现有语义（`true=隐藏`），条目级 `hidden` 与之语义一致。
- 不改动协作 CRDT 底层同步机制，仅复用现有 `updateFormFields` 管线。
