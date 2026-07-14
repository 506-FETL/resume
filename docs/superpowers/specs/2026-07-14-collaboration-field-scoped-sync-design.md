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
- **自由文本输入框**（明确登记的 `<Input>` 纯文本字段）的字符串写入改用 Automerge **字符级文本合并**（`updateText`），使两人同改同一自由文本字段时按字符无冲突合并、互不覆盖。
- 读路径在**同字段并发**场景保持当前聚焦自由文本输入框的光标位置（按文本 diff 映射 selection）。
- 字段数组的**尾部新增/删除**通过 Automerge **原生数组结构操作**（push / 尾部 deleteAt）表达，而非整段数组覆盖，保持其他项的 CRDT 身份稳定。
- 不破坏现有回环抑制：远端同步期间本地 `watch` 不得触发回写。
- 所有区块统一受益：写/读路径逻辑集中到共享 hook，5 处调用点统一改造。

### 2.2 非目标

- 不改造富文本（Tiptap）为结构化 CRDT，不做编辑器内远端光标 —— 属于子项目 B。
- 富文本（HTML 字符串）字段在 A 中保持**整段 LWW 写入**（不做字符级合并，避免 HTML 标签在并发下交错损坏）。这与当前行为一致，无回归。
- 不在普通输入框内渲染远端协作者光标叠层（子项目 C，YAGNI）。
- 不改动 Automerge / Supabase 网络协议、文档持久化或存量数据结构。
- 不实现字段数组**项级稳定身份**的 CRDT 合并（stable item id / 中间插入删除的按身份合并）。A 只保证：尾部增删与就地叶子编辑不重建其他项；**中间删除**退化为「按位置叶子平移 + 尾部裁剪」，最终一致但被平移覆盖的尾部项不保持 CRDT 身份（见 §3.6）。项级身份合并归入子项目 B。
- 不引入字段数组的 move/reorder 协作语义（现有 UI 无 move 调用）。

## 3. 方案

采用**基于 diff 的字段级写入 + 读路径光标保持**，与已有读路径的 `planRemoteFormSync` 对称。

### 3.1 写路径：字段级 diff → Automerge 原生操作

本地表单变化时（`form.watch` 回调，`isResettingRef` 为真时跳过）：

1. 读取 store 中该 section 的**当前值**（变更前）作为 base。base 必须在 watch 触发时**实时读取**（`useResumeStore.getState()[sectionKey]` 或 ref），不得使用渲染闭包里过期的 `storeData`，否则 diff 会基于陈旧 base 计算。
2. 用现有 `planRemoteFormSync(base, newFormValue, fieldArrayPaths)` 计算最小 diff，产出 `fieldUpdates`（叶子路径 + 新值）与 `fieldArrayOperations`（尾部 append / remove）。
3. **乐观本地状态**：把 store 中该 section 直接设为 `newFormValue`（普通 JS 状态引用替换，与 Automerge CRDT 是两套存储，引用替换无身份问题）。
4. **写入文档**：`docManager.change(doc => …)` 内，对该 section 应用 diff。文本操作 `updateText` / `splice` 是**根级函数**，需要从 `doc` 根传入**完整 Prop 路径**；因此 applier 接收根 `doc` + section base 路径，把相对叶子路径拼成完整路径，并将数字段（数组索引）规范化为 number（`items.0.companyName` → `['work_experience','items',0,'companyName']`）：
   - 叶子被登记为**自由文本**（见 3.3 分类）且新旧值均为字符串：`Automerge.updateText(doc, fullPath, newText)` —— 字符级合并。
   - 叶子被登记为**富文本**（HTML）：`setLeaf(doc, fullPath, html)` —— 整段 LWW。
   - 其余所有叶子（Select 枚举、日期字符串/元组、number、boolean、null、未登记字符串等）：`setLeaf(doc, fullPath, value)` —— 原子赋值。
   - 字段数组 **append**：对该数组的子代理执行 `push(value)`（子代理可用，非文本操作不受根级限制）。
   - 字段数组 **remove（尾部）**：对该数组的子代理执行 `deleteAt(index)`。

`planRemoteFormSync` 现有语义正好满足：字段数组变长 → 尾部 append；变短 → 尾部 remove；长度不变 → 逐索引叶子更新；非字段数组（如日期元组）长度变化时更新其根路径。写路径复用同一规划器，与读路径完全对称，避免依赖 RHF 的 watch `{ name }` 元数据。

结构性数组增删由用户点击「添加/删除项」触发，同样经上述 diff 表达为 push/deleteAt，无需单独通路。中间删除的行为与代价见 §3.6。

### 3.2 读路径：同字段并发下的光标保持

`useFormRemoteSync` 继续做增量 `setValue`。新增：当某个 `fieldUpdate` 的路径**正是当前聚焦的自由文本输入框**、且新旧值均为字符串时：

1. 在 `setValue` 前捕获该 input 的 `selectionStart` / `selectionEnd` 与旧字符串。
2. 执行 `setValue`（不触发 dirty/touched/validate，维持现有回环抑制）。
3. 在 DOM 更新后（`requestAnimationFrame` 或等价时机）用 **公共前缀 / 公共后缀 diff** 把旧 caret 偏移映射到新字符串上的等价偏移，并对该 input 恢复 `setSelectionRange`。

聚焦判定：用一个轻量的「当前聚焦字段」注册（基于 input 的 `onFocus`/`onBlur` 或 `document.activeElement` + RHF field name 反查）。仅对**自由文本输入框**生效；`Select`、日期选择器、Tiptap 不参与。

若当前聚焦字段**未被远端修改**（`planRemoteFormSync` 不会为其产出 `setValue`），则控件不重渲染、光标天然保持 —— 覆盖「改不同字段」的绝大多数场景，无需额外处理。

### 3.3 字段分类：自由文本 / 富文本 / 原子

维护一个显式分类，写路径据此决定字符串叶子的合并策略。默认策略为 **LWW 原子赋值**（`setLeaf`），字符级合并是**opt-in 白名单**，从而保证 Select 枚举、日期字符串/元组、number 等**绝不**被 `updateText` 拆分损坏，且未登记字段零回归。

- **富文本（HTML，LWW）**：`self_evaluation.content`、`hobbies.description`、`honors_certificates.description`、`skill_specialty.description`、`work_experience.items.*.workInfo`、`internship_experience.items.*.internshipInfo`、`project_experience.items.*.projectInfo`、`edu_background.items.*.eduInfo`、`campus_experience.items.*.campusInfo`。
- **自由文本（`<Input>` 纯文本，字符级合并）**：登记明确为自由文本录入的单行字段。按 section 明确列出（示例）：`basics.name`、`basics.email`、`basics.phone`、`basics.nation`、`basics.nativePlace` 等 `<Input>` 文本项、`job_intent.jobIntent`、`job_intent.intentionalCity`、`application_info.applicationSchool`、`application_info.applicationMajor`，以及经历数组内的 `companyName`、`position`、`projectName`、`schoolName`、`experienceName`、`role`、`participantRole`、`professional` 等自由文本 `<Input>` 项。**仅纳入真正的自由文本 `<Input>`，不纳入枚举/日期/仅在新增时赋值的展示型字段**（如 `edu_background.items.*.degree` 为 Select 枚举 → 原子；`skill_specialty.skills.*.label` 仅在添加技能时赋值并以 `<span>` 展示 → 不纳入）。`basics.birthMonth` 等日期字符串归原子。
- **原子（默认，LWW）**：其余全部 —— Select 枚举（`job_intent.dateEntry`、`edu_background.items.*.degree`、`skill_specialty.skills.*.proficiencyLevel`、`skill_specialty.skills.*.displayType`）、日期字符串与日期元组（`*.workDuration`、`*.internshipDuration`、`*.projectDuration`、`*.duration`、`basics.birthMonth`）、`job_intent.expectedSalary`（number）、以及任何未显式登记的字符串。

分类接口：`classifyLeaf(sectionKey, relativePath) => 'rich' | 'freeText' | 'atomic'`，数组索引段规范化后按字段名匹配。applier 从 `sectionBasePath` 的首段取得 `sectionKey`（或调用方按 section 预绑定 `classifyLeaf`）。写 applier 只在 `'freeText'` 且新旧均为字符串时调用 `updateText`，其余一律 `setLeaf`。

### 3.4 循环抑制

沿用 `isResettingRef`：读路径增量 `setValue` 期间置为 `true`，`watch` 回调据此跳过写回。光标恢复发生在 `setValue` 之后的 DOM 帧，此时 `isResettingRef` 的恢复继续放在当前事件循环之后（覆盖 RHF 同步订阅通知），effect 清理时取消未执行的恢复任务。`updateText` 对相同文本计算为空 diff，不产生多余变更，天然避免写路径自激。

### 3.5 结构组织

将写路径逻辑从 4 处内联 `watch` 和 `use-resume-field-form` 中抽出，集中到共享 hook（例如 `useResumeFormSync(form, sectionKey, storeData, fieldArrays)`，内部组合现有 `useFormRemoteSync` 读路径 + 新增写路径 diff），5 处调用点统一改用。新增纯函数模块（写路径 applier、文本 caret diff、字段分类表）便于单测。

### 3.6 字段数组中间删除的行为与边界

删除按钮对任意项调用 `remove(index)`，因此中间删除是可达操作。`planRemoteFormSync` 对 `[A,B,C] → [A,C]` 的处理是：逐索引比较 → 索引 1 的叶子从 B 改写为 C（就地 `setLeaf` 覆盖）→ 尾部 `deleteAt(2)`。即被删项之后的项按位置**平移覆盖**，尾部裁剪。

代价与边界（A 明确接受）：

- **最终一致性成立**：本地与远端最终数组内容一致。
- **身份不保**：被平移覆盖的尾部项其 CRDT 节点身份改变；若某协作者正**并发编辑被平移覆盖的那个尾部项**，其未合并编辑可能丢失。这是 A 的已知局限，比现状（每次击键整段覆盖）严格更好，但未达到 Google Docs 的项级无冲突。
- **尾部删除与就地编辑不受影响**：这两类是绝大多数操作，完全保持其他项身份。

项级稳定身份（stable item id + 按身份 diff 的中间插入/删除无冲突合并）归入子项目 B，本设计不实现。§7 成功标准据此限定为「尾部增删与就地编辑不重建其他项」。

## 4. 组件与数据流

- `src/hooks/form-remote-sync.ts`：已有读路径 diff 规划器 `planRemoteFormSync`。新增写路径 applier `applyRemoteWritePlan(plan, doc, sectionBasePath, fieldArrayPaths, classifyLeaf)`：接收根 `doc` 与 section base 路径，将相对叶子路径拼成完整 Prop 路径（数组索引段规范化为 number），把 plan 翻译为根级 `updateText`（仅 `freeText` 且新旧均字符串）/ `setLeaf`（`rich` 与 `atomic`）/ 数组子代理 `push` / `deleteAt`。
- 新增 `src/hooks/text-caret-diff.ts`（或同类）：`mapCaretByDiff(oldStr, newStr, caret) => newCaret`，纯函数，公共前后缀。
- 新增字段分类表：`classifyLeaf(sectionKey, relativePath) => 'rich' | 'freeText' | 'atomic'`（含富文本、自由文本白名单，默认 atomic）。
- `src/store/resume/form.ts`：新增/改造 store 动作 `updateFormFields`，接受一个 section 的新值 + 已算好的 doc 写操作回调，做乐观状态更新并经 `applyResumeChange` 应用 doc 操作。
- 共享 hook `useResumeFormSync`：整合读（`useFormRemoteSync`）+ 写（diff → store 动作），写路径 base 在 watch 时实时读取 store。
- 5 处调用点：`basic-resume/index.tsx`、`job-intent/index.tsx`、`self-evaluation/index.tsx`、`application-info/index.tsx`、`forms/hooks/use-resume-field-form.ts`。

## 5. 错误处理

- `updateText` 要求目标路径已是字符串。若文档中该路径缺失或类型不符（如首次赋值、类型从非字符串变字符串），回退为 `setLeaf` 赋值。存量文档由 `next` API 的普通赋值写入，其字符串在 v3 中即为 text 类型、`updateText` 兼容；实现时以此回退作为兜底并在早期验证。
- 文档写入异常沿用 `applyResumeChange` 的 `try/catch`，置 `syncError`，不崩溃编辑器。
- caret 恢复时若 `activeElement` 已改变或不是原 input，则跳过恢复，不抛错。

## 6. 测试

用 Node 内置测试运行器（`node --test`，Node 22）为纯函数写回归测试；用浏览器验证真实焦点/光标与并发合并：

单元测试（纯函数）：
- `applyRemoteWritePlan`：自由文本叶子 → `updateText`；富文本叶子 → `setLeaf`；原子叶子（枚举/日期/number）→ `setLeaf`（**不** `updateText`）；数组变长 → 尾部 push；数组尾部变短 → 尾部 deleteAt；`[A,B,C]→[A,C]` 中间删除 → 索引 1 叶子改写 + 尾部 deleteAt（记录该退化行为）；无变化 → 无操作；路径含数组索引时正确规范化为 number。
- `mapCaretByDiff`：中间插入、删除、纯追加、纯前插、无变化下 caret 正确映射；选区（start≠end）两端分别映射。
- `classifyLeaf`：富文本路径 → `'rich'`；自由文本白名单（`name`/`companyName` 等）→ `'freeText'`；枚举（`proficiencyLevel`/`displayType`/`dateEntry`）、日期（`workDuration`）、未登记字段 → `'atomic'`；数组项级路径按 `*` 命中。

集成 / 浏览器验证：
- A 改 `name`、B 改 `email`：双方均不丢字符、互不覆盖。
- A、B 同改 `name`（自由文本）：字符级合并、无覆盖、A 光标保持在原位。
- A、B 同改同一 Select 枚举 / 日期：值不被拆分损坏（原子 LWW，取后写者）。
- A 编辑某字段时 B 改**其他**字段：A 光标不动、B 值即时显示。
- 连续远端更新时 A 可持续输入。
- 数组尾部新增/删除项：文档以 push/deleteAt 表达，其他项不被整体重建。
- 富文本字段并发：不做字符级合并（LWW），但不破坏 HTML；未被并发编辑时保持焦点。
- 远端同步不经 `watch` 触发本地回写。

最后运行：定向单测、`npx tsc --noEmit`、`pnpm lint`、`pnpm build`；浏览器双窗口验证自由文本并发合并与光标保持。

## 7. 成功标准

- 复现路径中，A、B 编辑不同字段互不覆盖、均不丢输入。
- 两人同改同一自由文本字段时按字符合并，聚焦方光标保持在原位、可持续输入。
- 同改同一原子字段（枚举/日期/number）时值不被 `updateText` 拆分损坏。
- 编辑不同字段时聚焦控件 `document.activeElement` 与光标不变。
- 字段数组**尾部增删与就地编辑**不整段覆盖、不重建其他项（中间删除的平移退化见 §3.6，属已知边界）。
- 无新增同步循环、重复广播、类型错误或构建错误。
- 富文本行为不回归（并发仍为 LWW，但不产生损坏 HTML）。
