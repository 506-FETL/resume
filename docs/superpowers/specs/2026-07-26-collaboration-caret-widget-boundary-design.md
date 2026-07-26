# 富文本协作光标气泡残影修复设计

- 状态：已确认
- 日期：2026-07-26
- 范围：简历编辑器内 Tiptap/Yjs 远端光标 widget 的 DOM 构造与回归测试

## 1. 背景与现象

实时协作中，发起者页面可以正常看到协作者的编辑光标；协作者页面看到发起者持续输入时，姓名气泡会在旧位置不断堆叠。发起者调整光标位置后，旧位置仍有气泡残片；停止输入并等待超过 Yjs awareness 的常规超时窗口后，残影仍不会自动消失。

已确认：

- 发起者与协作者使用不同账号，排除相同 `userId` 被去重逻辑误合并。
- 异常气泡中的昵称属于发起者，问题发生在协作者渲染远端光标的一侧。
- 残影随远端连续输入累积，且不会在约 30 秒后被 awareness 回收，排除单纯的离线 client 状态残留。

## 2. 根因

当前 `src/lib/collaboration/richtext/collab-extensions.ts` 中的自定义 `renderCaret` 只在光标 `<span>` 内插入姓名标签 `<div>`，没有保留 `@tiptap/y-tiptap` 默认 `defaultCursorBuilder` 使用的两个 `U+2060 WORD JOINER` 边界文本节点。

Yjs 将远端 selection 转换为 ProseMirror widget decoration，并在远端输入导致文档事务和光标位置变化时持续重建、映射该 widget。边界节点是上游光标 DOM 契约的一部分，用来隔离 widget 标签和两侧正文。缺失边界后，移动中的 inline widget 与正文边界不稳定，旧标签 DOM/绘制结果不能可靠地被替换，最终表现为气泡堆叠和位置残片。

上游 `y-prosemirror` 已在提交 `776fec78ce85e24a4a526065853361aa29273b1d` 中给默认远端光标姓名标签前后加入 `U+2060` 节点。本仓库自定义构造器绕过了这部分默认结构。

最近新增的 awareness 去重逻辑只负责从多个 Yjs client 状态中选择应显示的 client，无法修复单个 client widget 的 DOM 边界问题。因此本次不继续扩大身份去重或网络传输改动。

## 3. 目标与非目标

### 3.1 目标

- 发起者连续输入时，协作者侧始终只显示一个最新的发起者姓名气泡。
- 发起者移动光标或切换富文本字段后，旧位置不留下气泡或标签残片。
- 保持现有姓名、颜色、选区样式和 awareness 去重行为不变。
- 用自动化测试锁定远端光标 widget 的边界结构，防止再次遗漏。

### 3.2 非目标

- 不改 Yjs 文档同步、Supabase Realtime provider 或 awareness 消息格式。
- 不重构协作身份模型或现有 `caret-dedupe.ts` 算法。
- 不更换 Tiptap/ProseMirror 版本。
- 不改鼠标实时光标、普通本地输入光标或 AI 改写气泡。

## 4. 方案选择

采用“补齐上游 widget DOM 边界契约”的最小修复：

1. 将远端 caret DOM 构造提取到 `src/lib/collaboration/richtext/caret-dom.ts`，保持职责单一并便于 Node 环境测试。
2. 姓名标签前后各插入一个内容为 `\u2060` 的文本节点，最终子节点顺序固定为：
   - `Text("\u2060")`
   - `.collaboration-carets__label`
   - `Text("\u2060")`
3. 保持外层 `.collaboration-carets__caret`、标签类名、颜色 style 和姓名文本不变。
4. `collab-extensions.ts` 继续把该构造函数作为 `cursorBuilder` 传给现有 `DedupeCollaborationCaret`。

未采用的方案：

- 直接使用 `defaultCursorBuilder`：能继承上游结构，但需要迁移现有类名和样式，影响面更大。
- 编辑器外浮层：可绕开 widget，但需要重新实现坐标、滚动、换行和生命周期管理，超出本次缺陷范围。

## 5. 组件与数据流

修复后的数据流保持不变：

1. 发起者 selection 写入 Yjs awareness。
2. Supabase provider 将 awareness 更新发送给协作者。
3. 协作者的 `yCursorPlugin` 将相对位置解析为当前 ProseMirror 位置。
4. awareness 去重过滤器选择需要渲染的远端 client。
5. `cursorBuilder` 创建带完整边界节点的 widget DOM。
6. 后续远端文档事务安全替换或移动同一个 client 的 widget，不留下旧标签。

## 6. 错误处理与兼容性

- 姓名缺失时继续渲染空字符串，与现有行为一致。
- 颜色继续由现有 awareness 用户数据提供，不新增格式转换。
- `U+2060` 是不可见边界字符，不改变标签视觉尺寸和可见正文。
- 独立编辑模式不加载 CollaborationCaret，因此不会受到影响。
- 不删除或修改用户工作区中已有的 `.DS_Store` 变更。

## 7. 测试策略

严格按 TDD 执行：

1. 新增失败测试，使用最小 document/element/text-node 测试替身调用真实 caret DOM 构造函数。
2. 断言外层和标签类名、颜色、姓名仍正确。
3. 断言子节点严格为 `U+2060`、标签、`U+2060`，并且只有一个标签节点。
4. 先运行测试确认它因缺失边界节点失败，再写最小实现使其通过。
5. 运行针对性测试、相关 ESLint 和生产构建。
6. 条件允许时执行双账号手工回归：连续输入、同字段移动、跨字段切换，确认协作者侧无堆叠和残片。

## 8. 成功标准

- 自动化测试证明远端 caret DOM 永远包含两个 `U+2060` 边界节点。
- 连续远端输入过程中，协作者侧每位远端用户只显示一个姓名气泡。
- 光标移动或切换富文本字段后，旧位置无残余标签。
- 现有 awareness 去重、姓名/颜色更新、协作内容同步均无回归。
- 针对性测试、lint 和构建全部通过；如双账号环境不可用，明确记录手工验证限制。
