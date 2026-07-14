# 协作编辑字段级同步与光标保持设计（子项目 A）

- 状态：待确认
- 日期：2026-07-14
- 范围：简历编辑器中本地表单 → Automerge 的写路径，以及 Automerge → 本地表单的读路径中普通文本输入框的字符级合并与光标保持
- 后续：本设计是子项目 A。富文本（Tiptap）结构化 CRDT 与编辑器内远端光标属于子项目 B，另立 spec。

## 1. 背景

简历编辑器基于 Automerge CRDT 文档协作。每个表单区块（section）用 React Hook Form（RHF）承载编辑，通过两条路径与协作文档同步：

- **写路径**：`form.watch` 订阅本地表单变化，调用 `updateForm(sectionKey, value)`，经 `applyResumeChange` 做乐观本地状态更新并把变更写入 Automerge 文档。
- **读路径**：`useFormRemoteSync` 监听 store 中的 section 数据，通过 `planRemoteFormSync` 做增量 diff，再用 `form.setValue` / `useFieldArray` 结构操作把远端变更同步进 RHF，避免整表 `reset` 造成的失焦。

读路径在 2026-06-11 的焦点保持设计中已改为增量同步。但用户实测仍存在三个问题：

1. **改不同字段也互相抢占、吞输入**：写路径每次击键都把**整个 section 对象**回写 Automerge（`updateForm(sectionKey, 整段 value)` → `applyPatch` 对每个字段 `doc[section][field] = value`）。当协作者 A 编辑 `name`、B 编辑 `email` 时，A 的每次击键都用 A 手中**过期的 `email`** 覆盖文档，吞掉 B 的输入；反之亦然。
2. **改同一字段无法合并**：文本字段以整段字符串写入，属于 last-writer-wins（后写覆盖）。两人改同一字段时来回覆盖，本地输入被吞。
3. **同字段被远端修改时光标丢失**：读路径对当前聚焦的普通输入框执行 `setValue` 后，受控 input 重渲染使光标跳到末尾。

根因集中在写路径的**写入粒度过粗**（整段覆盖），以及读路径对**同字段并发**缺少光标保持。

## 2. 目标与非目标

### 2.1 目标

- 写路径改为**字段级（叶子路径）写入**：只把本地实际变化的叶子写入 Automerge，彻底消除对未编辑字段的覆盖。
- 普通文本输入框的字符串写入改用 Automerge **字符级文本合并**（`updateText`），使两人同改同一普通字段时按字符无冲突合并、互不覆盖。
- 读路径在**同字段并发**场景保持当前聚焦普通输入框的光标位置（按文本 diff 映射 selection）。
- 字段数组的新增/删除通过 Automerge **原生数组结构操作**（尾部 push / deleteAt）表达，而非整段数组覆盖，保持其他项的 CRDT 身份稳定。
- 不破坏现有回环抑制：远端同步期间本地 `watch` 不得触发回写。
- 所有区块统一受益：写/读路径逻辑集中到共享 hook，5 处调用点统一改造。

### 2.2 非目标

- 不改造富文本（Tiptap）为结构化 CRDT，不做编辑器内远端光标 —— 属于子项目 B。
- 富文本（HTML 字符串）字段在 A 中保持**整段 LWW 写入**（不做字符级合并，避免 HTML 标签在并发下交错损坏）。这与当前行为一致，无回归。
- 不在普通输入框内渲染远端协作者光标叠层（子项目 C，YAGNI）。
- 不改动 Automerge / Supabase 网络协议、文档持久化或存量数据结构。
- 不引入字段数组的 move/reorder 协作语义（现有 UI 无 move 调用；tail append/remove + 索引级叶子更新即可保证最终一致）。

## 3. 方案

采用**基于 diff 的字段级写入 + 读路径光标保持**，与已有读路径的 `planRemoteFormSync` 对称。

### 3.1 写路径：字段级 diff → Automerge 原生操作

本地表单变化时（`form.watch` 回调，`isResettingRef` 为真时跳过）：

1. 读取 store 中该 section 的**当前值**（变更前）作为 base。
2. 用现有 `planRemoteFormSync(base, newFormValue, fieldArrayPaths)` 计算最小 diff，产出 `fieldUpdates`（叶子路径 + 新值）与 `fieldArrayOperations`（尾部 append / remove）。
3. **乐观本地状态**：把 store 中该 section 直接设为 `newFormValue`（普通 JS 状态引用替换，无 CRDT 身份问题）。
4. **写入文档**：`docManager.change(doc => …)` 内，对该 section 应用 diff：
   - 叶子为**普通文本字符串**：`Automerge.updateText(doc, path, newText)` —— 字符级合并。
   - 叶子为**富文本字符串**（见 3.3 注册表）：`setLeaf(doc, path, html)` —— 整段 LWW。
   - 叶子为**非字符串**（number/boolean/null/日期元组等）：`setLeaf(doc, path, value)`。
   - 字段数组 **append**：对 `doc[...arrayPath]` 执行 `push(value)`。
   - 字段数组 **remove（尾部）**：对 `doc[...arrayPath]` 执行 `deleteAt(index)`。

`planRemoteFormSync` 现有语义正好满足：字段数组变长 → 尾部 append；变短 → 尾部 remove；长度不变 → 逐索引叶子更新；非字段数组（如日期元组）长度变化时更新其根路径。写路径复用同一规划器，与读路径完全对称，避免依赖 RHF 的 watch `{ name }` 元数据。

结构性数组增删由用户点击「添加/删除项」触发，同样经上述 diff 表达为 push/deleteAt，无需单独通路。

### 3.2 读路径：同字段并发下的光标保持

`useFormRemoteSync` 继续做增量 `setValue`。新增：当某个 `fieldUpdate` 的路径**正是当前聚焦的普通文本输入框**、且新旧值均为字符串时：

1. 在 `setValue` 前捕获该 input 的 `selectionStart` / `selectionEnd` 与旧字符串。
2. 执行 `setValue`（不触发 dirty/touched/validate，维持现有回环抑制）。
3. 在 DOM 更新后（`requestAnimationFrame` 或等价时机）用 **公共前缀 / 公共后缀 diff** 把旧 caret 偏移映射到新字符串上的等价偏移，并对该 input 恢复 `setSelectionRange`。

聚焦判定：用一个轻量的「当前聚焦字段」注册（基于 input 的 `onFocus`/`onBlur` 或 `document.activeElement` + RHF field name 反查）。仅对普通文本输入框生效；`Select`、日期选择器、Tiptap 不参与。

若当前聚焦字段**未被远端修改**（`planRemoteFormSync` 不会为其产出 `setValue`），则控件不重渲染、光标天然保持 —— 覆盖「改不同字段」的绝大多数场景，无需额外处理。

### 3.3 富文本 vs 普通文本判定

维护一个显式注册表，标记每个 section 下哪些叶子是富文本（HTML）：

- section 级：`self_evaluation.content`、`hobbies.description`、`honors_certificates.description`、`skill_specialty.description`
- 数组项级：`work_experience.items.*.workInfo`、`internship_experience.items.*.internshipInfo`、`project_experience.items.*.projectInfo`、`edu_background.items.*.eduInfo`、`campus_experience.items.*.campusInfo`

写路径据此对富文本叶子走 LWW（`setLeaf`），对其余字符串叶子走 `updateText`。判定按「路径末段字段名 + 所属 section」匹配，数组索引段规范化后匹配 `*`。

### 3.4 循环抑制

沿用 `isResettingRef`：读路径增量 `setValue` 期间置为 `true`，`watch` 回调据此跳过写回。光标恢复发生在 `setValue` 之后的 DOM 帧，此时 `isResettingRef` 的恢复继续放在当前事件循环之后（覆盖 RHF 同步订阅通知），effect 清理时取消未执行的恢复任务。`updateText` 对相同文本计算为空 diff，不产生多余变更，天然避免写路径自激。

### 3.5 结构组织

将写路径逻辑从 4 处内联 `watch` 和 `use-resume-field-form` 中抽出，集中到共享 hook（例如 `useResumeFormSync(form, sectionKey, storeData, fieldArrays)`，内部组合现有 `useFormRemoteSync` 读路径 + 新增写路径 diff），5 处调用点统一改用。新增纯函数模块（写路径 applier、文本 caret diff、富文本注册表）便于单测。

## 4. 组件与数据流

- `src/hooks/form-remote-sync.ts`：已有读路径 diff 规划器 `planRemoteFormSync`。新增写路径 applier `applyRemoteWritePlan(plan, docSection, fieldArrayPaths, richTextMatcher)`，将 plan 翻译为 `updateText` / `setLeaf` / `push` / `deleteAt`。
- 新增 `src/hooks/text-caret-diff.ts`（或同类）：`mapCaretByDiff(oldStr, newStr, caret) => newCaret`，纯函数，公共前后缀。
- 新增富文本路径注册表：`RICH_TEXT_LEAVES: Record<sectionKey, string[]>` + `isRichTextPath(sectionKey, relativePath)`。
- `src/store/resume/form.ts`：新增/改造 store 动作 `updateFormFields`，接受一个 section 的新值 + 已算好的 doc 写操作回调，做乐观状态更新并经 `applyResumeChange` 应用 doc 操作。
- 共享 hook `useResumeFormSync`：整合读（`useFormRemoteSync`）+ 写（diff → store 动作）。
- 5 处调用点：`basic-resume/index.tsx`、`job-intent/index.tsx`、`self-evaluation/index.tsx`、`application-info/index.tsx`、`forms/hooks/use-resume-field-form.ts`。

## 5. 错误处理

- `updateText` 要求目标路径已是字符串。若文档中该路径缺失或类型不符（如首次赋值、类型从非字符串变字符串），回退为 `setLeaf` 赋值。
- 文档写入异常沿用 `applyResumeChange` 的 `try/catch`，置 `syncError`，不崩溃编辑器。
- caret 恢复时若 `activeElement` 已改变或不是原 input，则跳过恢复，不抛错。

## 6. 测试

用 Node 内置测试运行器（`node --test`，Node 22）为纯函数写回归测试；用浏览器验证真实焦点/光标与并发合并：

单元测试（纯函数）：
- `applyRemoteWritePlan`：普通字符串叶子 → 产生 `updateText`；富文本叶子 → 产生 `setLeaf`；非字符串 → `setLeaf`；数组变长 → 尾部 push；数组变短 → 尾部 deleteAt；无变化 → 无操作。
- `mapCaretByDiff`：中间插入、删除、纯追加、纯前插、无变化下 caret 正确映射；选区（start≠end）两端分别映射。
- `isRichTextPath`：section 级与数组项级富文本路径命中；普通字段（`name`/`companyName`/`certificates.*.name` 等）不命中。

集成 / 浏览器验证：
- A 改 `name`、B 改 `email`：双方均不丢字符、互不覆盖。
- A、B 同改 `name`：字符级合并、无覆盖、A 光标保持在原位。
- A 编辑某普通字段时 B 改**其他**字段：A 光标不动、B 值即时显示。
- 连续远端更新时 A 可持续输入。
- 数组新增/删除项：文档以 push/deleteAt 表达，其他项不被整体重建。
- 富文本字段并发：不做字符级合并（LWW），但不破坏 HTML；未被并发编辑时保持焦点。
- 远端同步不经 `watch` 触发本地回写。

最后运行：定向单测、`npx tsc --noEmit`、`pnpm lint`、`pnpm build`；浏览器双窗口验证普通字段并发合并与光标保持。

## 7. 成功标准

- 复现路径中，A、B 编辑不同字段互不覆盖、均不丢输入。
- 两人同改同一普通字段时按字符合并，聚焦方光标保持在原位、可持续输入。
- 编辑不同字段时聚焦控件 `document.activeElement` 与光标不变。
- 数组增删不整段覆盖，其他项不重建。
- 无新增同步循环、重复广播、类型错误或构建错误。
- 富文本行为不回归（并发仍为 LWW，但不产生损坏 HTML）。
