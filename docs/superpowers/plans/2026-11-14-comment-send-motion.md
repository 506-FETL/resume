# 评论发送动画修复计划

使用 writing-plans 拆分并在当前会话内联执行；用户授权本期实施，不新增分支、不执行 TDD、不提交或推送。

**目标：** 同一条评论发送、确认与重试只入场一次。

**架构：** 既有响应中的评论身份经客户端归一化进入 scope 内渲染映射，评论树与线程列表按该映射复用节点；反馈栏复用 AnimatedContent。

**技术栈：** React 19、Zustand、Motion、现有 Vite 与浏览器验收工具。

- [x] 在 `tests/comment-send-motion/` 挂载真实 ThreadDetail、CommentTree 和 provider，HTTP 边界返回合成数据；记录原实现成功后更换 DOM 的证据。
- [x] `types.ts` 与 `api/client.ts` 读取事件既有 `sanitized_payload.commentId`、写入响应 `comment.id` / 旧 `commentId`，归一为 `event.commentId`。
- [x] `store/types.ts` 与 `store/create-store.ts` 增加 scope 内 `commentRenderKeys`；完成时写入 `[event.commentId]: pending.commentId`，覆盖响应与实时通知，scope 切换清空。
- [x] `components/comment-tree.tsx` 各层使用 `commentRenderKeys[id] ?? id`；`thread-list.tsx` 用根评论同一身份作为列表 key。
- [x] 评论反馈改用已有 `AnimatedContent`，保留单行最小高度；正文不随 delivery 整段变淡，重试前将焦点交给常驻反馈容器。
- [x] 用户追加：抽出 `components/comment-body.tsx`，用真实正文高度/行高判断 6 行溢出，复用 Button 展开和收起；公共时长与减少动效驱动局部高度过渡，验证链接、宽度变化、快速反向和确认后展开状态。
- [x] 浏览器覆盖设计中的完成顺序、失败重试、新线程、刷新、两轮操作、嵌套、窄屏和动态减少动效；用 review-animations 审查最终差异。
- [x] 执行局部 Prettier、ESLint layout、TypeScript、构建与全仓 format:check；清理临时测试，更新防回归与验收证据。

组件检索：已检查 CommentComposer、Spinner、Button、AnimatedContent，现有封装足够；不新增 UI primitive 或动画依赖。

长文预览另外核对现有 Collapsible 与官方文档。默认 0 高度的收起会隐藏全部正文，不能保留 6 行预览；局部裁切由正文容器实现，按钮继续复用现有组件。

实施和验证完成；最终用户审查待进行。结果见[验收记录](../specs/2026-11-14-comment-send-motion-acceptance.md)。

## 本人头像补充

- [x] 查明临时作者被写死为空头像；新线程与回复从现有 user store 同步捕获作者资料，pending 记录及刷新重建沿用该快照。
- [x] 真实组件与动作验证首次可见头像、昵称、新线程、回复、失败重试、确认图片身份、账户资料变化与原写入协议。
- [x] 完成最新类型、构建、格式检查与临时夹具清理，记录最终结果。
