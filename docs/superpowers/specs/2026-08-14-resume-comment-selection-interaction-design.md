# 简历评论划词交互优化设计

## 1. 背景与目标

当前划词评论有三个需要统一收口的交互问题：

1. 动作按钮使用了自定义深色胶囊视觉，和项目现有 Shadcn 组件语言不一致，也没有完整的进入、退出动画。
2. 评论锚点要求选区起点和终点位于同一个富文本块，导致同一经历描述中的跨段落、跨列表项选区被拒绝。
3. 点击动作按钮打开评论 Drawer 后，按钮仍可能显示；关闭 Drawer 后，旧选区对应的按钮还会再次出现。
4. 失去锚点的评论进入“重新关联”后，关闭评论 Drawer 会保留关联状态，但页面没有持续提示，也没有快速取消入口。

本次目标是直接复用 Shadcn `Button`，让动作按钮具备可访问的进出动画；允许同一个富文本描述字段内跨块划词；让一次“划词 → 打开评论 → 关闭或取消”的交互正确结束；并在重新关联期间提供持续、可取消的页面级状态反馈。

## 2. 范围

### 2.1 包含

- 桌面端动作按钮使用 Shadcn `Button` 的 `outline` variant 与内置 `sm` 尺寸。
- 移动端底部动作按钮使用同一 Shadcn `Button` 的 `outline` variant、内置 `lg` 尺寸与全宽布局。
- 使用项目现有 Motion 依赖为动作按钮添加淡入、上浮、轻微缩放和对应退出动画，并遵循 `prefers-reduced-motion`。
- Drawer 或重叠评论选择器打开时隐藏动作按钮；退出动画期间立即禁止按钮交互。
- 关闭或取消评论 Drawer 时清除待评论选区和浏览器原生选区，防止按钮再次出现。
- 在同一个 `data-comment-node-key` 下，允许起点和终点位于不同的 `data-comment-block-ordinal`。
- 更新跨块选区的锚点生成、重叠判断、内容重定位和高亮 Range 重建。
- 重新关联开始后关闭评论 Drawer，在页面顶部居中显示 Shadcn Alert，直至关联成功或用户取消。

### 2.2 不包含

- 不允许跨不同 `nodeKey` 选区。因此项目名称、角色、时间与项目描述之间仍不能跨选。
- 不允许跨两个工作经历或项目经历条目选区。
- 不改变跨页选区限制；起止边界不在同一可见简历页时仍拒绝创建评论。
- 不修改评论数据库字段、API schema 或已有评论 JSON 结构；数据库锚点校验函数需要同步支持同一节点内跨块范围。
- 不修改评论 Drawer、评论编辑、回复、删除和 Realtime 数据流。

## 3. 根因

`resolveCommentSelection()` 当前同时检查 `nodeElement`、`blockElement` 与 `blockOrdinal` 相等。富文本中的每个段落、列表项、标题和引用块都有独立的 `blockOrdinal`，因此图片中同一项目描述里的两个列表项虽然共享同一个 `nodeKey`，仍会在客户端被直接拒绝。

锚点本身已经保存字段级全局 `startGraphemeOffset` 与 `endGraphemeOffset`，字段投影文本也使用换行符连接各块，所以数据结构能够表达跨块范围。真正的限制来自以下三个消费点仍假设锚点只属于一个块：

- 选区解析只用起始块计算两个偏移；
- 高亮重建只在 `blockOrdinal` 指向的单个块内创建 DOM Range；
- 重定位要求完整范围被一个投影块包含。

动作按钮再次出现则是因为 `selection` 同时承担待提交锚点和按钮可见性。打开 Drawer 时不能立即清空它，否则发送评论会丢失锚点；但关闭 Drawer 后必须结束这次待评论选区。

## 4. 设计

### 4.1 动作按钮与生命周期

`SelectionAction` 只组合现有 Shadcn `Button` 和 Motion 容器，不新增按钮组件或自定义视觉系统。

- 桌面：`variant="outline"`、`size="sm"`。
- 移动：`variant="outline"`、`size="lg"`，仅增加 `w-full` 布局类。
- 进入：`opacity 0 → 1`、`y 6 → 0`、`scale 0.96 → 1`。
- 退出：`opacity 1 → 0`、`y 0 → 4`、`scale 1 → 0.98`。
- 动画复用 `COMMENT_MOTION`；减少动态效果时使用 0 时长。
- `AnimatePresence` 位于 `CommentSurface` 的条件渲染外层，确保 selection 消失、Drawer 打开或 picker 打开时可以播放退出动画。
- Motion 节点进入退出态后立即给内部按钮 `disabled`，同时设置 `aria-hidden`，避免淡出期间触发陈旧选区动作。

动作按钮仅在 `selection && !open && !picker` 时显示。Drawer 打开期间保留 `selection` 供 `CommentComposer` 创建线程；Drawer 关闭、取消或创建成功后清除 selection。这样既不会丢失待提交锚点，也不会在关闭后重新显示旧按钮。

### 4.2 跨块选区合法性

合法选区必须满足：

- 起点和终点都能解析到评论边界；
- 起点和终点属于同一个 `data-comment-node-key` 容器；
- 该容器不属于测量副本或隐藏页；
- Range 能产生至少一个当前可见页矩形；
- 规范化后的选中文本非空。

起点与终点不再要求 `blockOrdinal` 相等。`blockOrdinal` 字段继续保留，并定义为“锚点起点所在块序号”，用于兼容已有数据和加速起点定位；终点块由全局 `endGraphemeOffset` 动态推导，不新增 `endBlockOrdinal`。

### 4.3 DOM 文本与偏移映射

对同一 `nodeElement` 下直属的评论块按 `blockOrdinal` 排序，并为每个块建立：

- 规范化文本；
- 字段级起始和结束字素偏移；
- 对应 DOM 元素。

块之间继续使用一个 `\n` 字素作为字段投影分隔符，与服务端 `CommentAnchorDocumentNode.text` 保持一致。

锚点起始偏移使用“起始块的字段级起点 + 块内起点偏移”；结束偏移使用“结束块的字段级起点 + 块内终点偏移”。`exactQuote` 从字段投影文本按这两个全局偏移切片，因此跨列表项的 quote 会包含规范化换行符。

### 4.4 高亮 Range 重建

高亮时不再只读取 `anchor.blockOrdinal` 指向的单个块，而是：

1. 根据字段级全局偏移查找起始块和结束块；
2. 分别换算两个块内的本地字素偏移；
3. 在起始块文本节点设置 Range start，在结束块文本节点设置 Range end；
4. 用同一字段投影文本切片校验 `exactQuote`；
5. 交给现有 `rangeToVisiblePageRects()` 生成多行高亮矩形。

单块旧锚点走同一逻辑，不需要迁移。

### 4.5 重定位与重叠判断

`moveResumeCommentAnchor()` 改为分别验证起点和终点能落入同一字段节点的有效块，不再要求整个范围被单块包含。重定位成功后把 `blockOrdinal` 更新为新起点所在块。

重叠判断使用 `nodeKey + startGraphemeOffset + endGraphemeOffset`。只要 `nodeKey` 不同就不重叠；同一 `nodeKey` 下不再因为起始 `blockOrdinal` 不同而提前返回 `none`。这能正确识别单块锚点与跨块锚点之间的包含和部分重叠关系。

### 4.6 重新关联状态提示

用户在失去锚点的评论中点击“重新关联”后，桌面端和移动端都立即关闭评论 Drawer，让简历正文重新可选。只要 `relinkThreadId` 存在且评论 Drawer 已关闭，页面顶部居中持续显示 Shadcn `Alert`：

- 标题为“正在重新关联评论”；
- 描述为“请在简历中选择新的文字”；
- 提供 Shadcn `Button size="xs" variant="ghost"` 的“取消”动作；
- 使用 Motion 淡入、轻微下移进入及反向退出，并遵循 `prefers-reduced-motion`；
- 外层标记 `data-resume-comment-ui`，点击取消不会被正文选区监听器误判；
- 取消、Escape 或重新关联成功时同时清理 store 选区和浏览器原生选区，恢复普通划词评论态。

Alert 只在 Drawer 关闭时显示；Drawer 内继续使用线程详情已有的关联说明和错误反馈，避免两套提示重叠。

## 5. 兼容性与边界情况

- 现有单块锚点的数据和语义保持不变。
- `CommentAnchor`、API payload 与数据库 JSON 结构不变，无需迁移。
- 数据库函数迁移只调整范围校验语义：`blockOrdinal` 校验起始块，结束偏移单独校验其所在的同节点结束块，并要求结束块序号不早于起始块。
- 文档同步发生安全重定位时，锚点的 `createdAtContentHash` 必须更新为目标文档哈希，否则更新触发器会把合法重定位误判为 `invalid resume comment anchor`。
- 跨块 exactQuote 包含块间换行；后续若用户把文字移动到不同段落结构，重定位可能按现有安全策略变为 detached，不进行跨字段模糊猜测。
- 反向拖选由浏览器 Range 自动规范化为文档顺序，使用相同逻辑。
- 从一个块末尾拖到下一块开头仍以浏览器实际 Range 和规范化投影为准；只要 quote 非空且几何有效即可创建。
- 跨隐藏分页副本、测量副本或不同可见页继续拒绝。
- 退出动画期间按钮不可点击，也不会进入键盘焦点顺序。

## 6. 验证

### 6.1 纯逻辑验证

- 同一 `nodeKey`、不同 `blockOrdinal` 的边界兼容。
- 不同 `nodeKey` 仍不兼容。
- 跨两个块的锚点可以保持、移动和重定位，起始 `blockOrdinal` 正确更新。
- 单块与跨块锚点的 exact、contains、contained_by、partial、none 结果正确。
- 现有 Unicode、块投影、矩形合并与旧锚点断言继续通过。

### 6.2 静态验证

- `pnpm exec tsc --noEmit`
- 评论相关文件定向 ESLint
- `pnpm verify:comments`
- `pnpm build`
- `git diff --check`

### 6.3 浏览器验证

- 单段落划词显示 Shadcn outline 按钮并播放进入动画。
- 同一描述字段跨两个列表项划词能显示按钮。
- 跨项目名称和描述划词仍不显示按钮。
- 点击评论后按钮退出，Drawer 内保留 quote 并可输入评论。
- 关闭或取消 Drawer 后按钮不再次出现，浏览器原生选区被清除。
- 重新划词后按钮能再次正常出现。
- 从失去锚点评论开始重新关联后，评论 Drawer 自动关闭且顶部 Alert 持续可见。
- 点击 Alert 的“取消”或按 Escape 后退出重新关联态，随后普通划词显示“评论”而不是“关联到此处”。
- 重新关联成功后 Alert 自动退出，重新打开对应评论线程。
- 768px 两侧各验证一次，确保桌面与移动动作入口不重复。
- 开启减少动态效果后不出现位移或缩放动画。

若当前浏览器缺少可用登录态、在线简历或评论权限，只能报告静态与纯逻辑验证结果，不能把它们表述为真实评论交互已验证。
