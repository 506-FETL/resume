# 富文本协作光标原子 Widget 修复设计

- 状态：已确认（修订版）
- 日期：2026-07-26
- 范围：简历编辑器内 Tiptap/Yjs 远端光标 widget 的 DOM、CSS 与回归验证

## 1. 背景与现象

实时协作中，发起者页面可以正常看到协作者的编辑光标；协作者页面看到发起者持续输入时，姓名气泡会在旧位置不断堆叠。发起者调整光标位置后，旧位置仍有气泡残片；停止输入并等待超过 Yjs awareness 的常规超时窗口后，残影仍不会自动消失。

已确认的复现条件：

- 发起者与协作者使用不同账号，排除相同 `userId` 被身份去重逻辑误合并。
- 异常气泡中的昵称属于发起者，问题发生在协作者渲染远端光标的一侧。
- 残影随远端连续输入累积，移动光标后旧位置仍有残片。
- 残影不会在约 30 秒后消失，和单纯的离线 awareness client 超时残留不一致。

## 2. 已完成的诊断与结论边界

### 2.1 排除 U+2060 边界字符假设

最初怀疑自定义 `renderCaret` 缺少 `@tiptap/y-tiptap` 旧默认构造器使用的 `U+2060 WORD JOINER` 文本节点。但上游加入该字符的提交只说明它用于防止姓名内部断词，没有证据表明它负责 widget 节点替换。

随后使用项目当前的 Tiptap、Yjs 和 ProseMirror 依赖搭建了隔离的双编辑器生命周期诊断，逐字输入并移动远端 selection：

- 不含 `U+2060` 时，协作者 DOM 始终只有一个 `.collaboration-carets__caret` 和一个 `.collaboration-carets__label`。
- 加入 `U+2060` 后结果完全相同。
- 扩展到双方各两个富文本字段、同一侧多个编辑器共享一个 awareness 后，正在编辑的字段仍始终只有一个标签，未聚焦字段没有错误标签。

因此不采用 `U+2060` 修复；旧规格中的该因果解释已作废。

### 2.2 当前最小根因边界

`src/lib/collaboration/richtext/collab-extensions.ts` 当前生成如下 widget：

- 外层是默认 `display: inline` 且 `position: relative` 的 `<span>`。
- 唯一子节点是脱离文档流、`position: absolute` 的块级 `<div>` 标签。
- 外层没有普通流内容，也没有明确宽高；其可见竖线依赖透明双边框和负 margin。

该结构不是一个稳定的原子行内盒：`<span>` 的 HTML 内容模型要求 phrasing content，而内部 `<div>` 是 flow content；同时，绝对定位子节点不参与外层尺寸计算。远端事务连续移动 ProseMirror widget 时，逻辑 DecorationSet 和 DOM 可以已经替换正确，但浏览器仍需对这种零内容 inline containing block 反复做行盒、绝对定位和绘制失效计算。

隔离 DOM 生命周期没有发现 awareness 数量或节点清理异常，而用户观察到的是持续的可视堆叠和残片。因此当前证据把问题收敛到 widget 的浏览器布局/绘制边界。由于非绘制型 DOM 模拟器不能验证像素残影，本设计明确把双账号浏览器回归设为完成门槛，而不把推断伪装成已由自动化证明的浏览器根因。

## 3. 目标与非目标

### 3.1 目标

- 发起者连续输入时，协作者侧每位远端用户只显示一个最新姓名气泡。
- 发起者移动光标或切换富文本字段后，旧位置不留下气泡或标签残片。
- 将 caret widget 改为有明确几何边界、合法嵌套的原子行内盒。
- 保持现有姓名、颜色、选区样式和 awareness 去重行为不变。
- 自动验证 DOM 构造与双编辑器节点生命周期，并以真实浏览器双账号回归验证视觉结果。

### 3.2 非目标

- 不改 Yjs 文档同步、Supabase Realtime provider 或 awareness 消息格式。
- 不重构协作身份模型或现有 `caret-dedupe.ts` 算法。
- 不更换 Tiptap/ProseMirror 版本。
- 不实现编辑器外浮层，不引入新的坐标或滚动同步系统。
- 不改鼠标实时光标、普通本地输入光标或 AI 改写气泡。

## 4. 方案选择

采用“合法原子 inline widget”方案：

1. 将远端 caret DOM 构造提取到 `src/lib/collaboration/richtext/caret-dom.ts`，让 DOM 结构可以独立测试。
2. 外层继续使用 `.collaboration-carets__caret` `<span>`，但在 CSS 中改为零宽、具有 `1em` 明确高度的 `inline-block`，并使用 `vertical-align` 对齐当前文字行。
3. 保留现有透明双边框与负 margin 的零净宽布局，使加入 widget 不推动正文；颜色仍由现有 inline style 写入边框。
4. 姓名标签由 `<div>` 改为 `.collaboration-carets__label` `<span>`，继续绝对定位在光标上方。这样外层只包含合法的 phrasing content。
5. `collab-extensions.ts` 继续将构造函数作为 `cursorBuilder` 传给现有 `DedupeCollaborationCaret`；不改变 Decoration key、selection 解析或 awareness 过滤。

未采用的方案：

- `U+2060` 边界字符：隔离生命周期诊断已证明它不改变节点替换结果，上游变更也只解决断词问题。
- 强制回流、定时删除 DOM 或 MutationObserver 清理：只能掩盖绘制症状，容易引入抖动和编辑器状态不一致。
- 编辑器外浮层：能彻底绕开 widget，但需重写坐标、滚动、缩放、换行和生命周期管理，明显超出本缺陷范围。

## 5. 组件与数据流

数据流保持不变：

1. 发起者 selection 写入 Yjs awareness。
2. Supabase provider 将 awareness 更新发送给协作者。
3. 协作者的 `yCursorPlugin` 将相对位置解析为当前 ProseMirror 位置。
4. awareness 去重过滤器选择需要渲染的远端 client。
5. `cursorBuilder` 创建零净宽但有明确高度的原子 inline widget。
6. ProseMirror 后续按现有 clientId key 移动或替换 widget；浏览器只需重新布局和绘制一个边界明确的行内原子盒。

代码职责：

- `caret-dom.ts`：只负责构造 caret 和 label DOM，依赖标准 `document` API，不感知 Yjs。
- `collab-extensions.ts`：只负责组装 Tiptap/Yjs 扩展和传入 `cursorBuilder`。
- `paragraph-node.scss`：只负责 caret 的原子几何边界、标签视觉样式和文字行对齐。
- `caret-dedupe.ts`：保持现状，只负责多个 awareness client 状态的身份去重。

## 6. 错误处理与兼容性

- 姓名缺失时继续渲染空字符串，与现有行为一致。
- 颜色继续由现有 awareness 用户数据提供，不新增格式转换。
- 外层零净宽，不能改变正文字符位置、换行宽度或 selection 映射。
- `height: 1em` 随编辑器当前字号缩放；姓名标签仍使用现有字号和 padding。
- 独立编辑模式不加载 CollaborationCaret，因此不受影响。
- 不修改用户工作区中已有的 `.DS_Store` 变更。

## 7. 测试与验证策略

严格按 TDD 执行，但区分“可自动证明的 DOM 契约”和“必须人工确认的像素结果”。

### 7.1 自动化测试

1. 先为 `caret-dom.ts` 写失败测试，证明当前构造仍产生块级 `<div>`，尚未满足原子 widget 契约。
2. 断言修复后的外层和标签均为 `SPAN`，类名、颜色和姓名文本保持不变，并且只有一个标签节点。
3. 增加真实 Tiptap/Yjs 双编辑器生命周期测试：远端连续输入、移动 selection 后，每个采样点都只能存在一个远端 caret 和一个 label。
4. 增加多字段共享 awareness 场景：活跃字段有一个标签，未聚焦字段没有标签。
5. 运行针对性测试、相关 ESLint、TypeScript 类型检查和生产构建。

生命周期测试用于防止后续代码引入真实 DOM 节点泄漏；它在当前实现下也可能通过，因此是补充回归，不被错误描述为本次 CSS/像素缺陷的 fail-before 测试。真正的红灯来自 DOM 语义和原子盒样式契约。

### 7.2 双账号浏览器回归（完成门槛）

在两个不同账号页面上验证以下场景：

1. 发起者在同一行连续输入不少于 20 个字符，协作者侧始终只有一个完整昵称气泡。
2. 发起者用方向键和鼠标在同一字段内移动，旧位置无残片。
3. 发起者输入多行并跨行移动，旧行无气泡残留。
4. 发起者在两个不同富文本字段间切换焦点，只有当前字段显示气泡。
5. 反向由协作者输入，发起者侧行为仍正常。

若执行环境没有双账号登录态，不能宣称视觉缺陷已完全修复；必须明确记录限制，并请用户完成该项验收。

## 8. 成功标准

- 远端 caret DOM 是合法、边界明确的原子 inline widget，不再使用 inline `<span>` 包含块级 `<div>` 的结构。
- 自动化测试证明连续远端输入、selection 移动及多字段共享 awareness 时，DOM 中没有重复 caret/label 节点。
- 双账号浏览器回归证明协作者侧没有气泡堆叠或旧位置残片。
- 现有 awareness 去重、姓名/颜色更新、选区渲染和协作内容同步均无回归。
- 针对性测试、lint、类型检查和构建全部通过。

## 9. 实施回退条件

如果原子 widget 修改后自动化测试通过，但双账号浏览器仍能复现残影，则停止继续堆叠 CSS workaround，回退本次 DOM/CSS 修改并重新采集以下运行时证据：

- 协作者页面每次异常时 `.collaboration-carets__caret` 的实际 DOM 数量。
- `awareness.getStates()` 中发起者对应的 clientId、`user.id`、cursor 和 `meta.lastUpdated`。
- 每个 caret 的 Decoration key、所在字段和解析后的 ProseMirror 位置。

这些证据将明确区分浏览器绘制残影、重复 awareness 状态和 Decoration 生命周期泄漏，再决定是否进入编辑器外浮层或 provider 修复；本次规格不预先实现未经证实的后备方案。
