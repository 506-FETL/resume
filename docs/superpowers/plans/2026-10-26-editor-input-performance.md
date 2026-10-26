# 编辑输入性能修复计划

> 在当前分支内联执行，已获用户授权排查和修复；不重复确认，不提交或推送，不改用户数据。

**目标：** 降低真实输入事件阻塞，保留即时写入、预览、检查、评论和准确导出。

**架构：** 稳定预览数据引用；测量/展示副本共享由不可变数据生成的评论及内容模型；富文本解析按实际输入缓存。

**技术栈：** React、Zustand、现有简历 runtime、Playwright/CDP。

- [x] 隔离浏览器复现并保存 CPU profile，确认输入同步渲染而非检查发布是主要瓶颈。
- [x] `editor/components/preview/index.tsx` 使用 useShallow 选择正文，useMemo 构建 TemplateResumeData；`scaled-readonly-preview.tsx` memo 子树，避免无关状态造成重绘。
- [x] 新增 `runtime/template-projection.ts`，WeakMap 以数据对象/投影日期保存评论节点与 adaptResumeContent；TemplateRuntimeProviders 和 ResumeContent 共用模型。
- [x] `fields/commentable-rich-text/index.tsx` 缓存净化/解析结果，样式或 HTML 真正变化才重算；不得跳过 DOMPurify 或更改最终 DOM。
- [x] 同场景复测事件处理和长任务，检查普通文本、富文本、中文组合输入与远端更新不丢失、不抢光标。依据采样决定是否还需进一步隔离渲染。
- [x] 回归默认和蓝金模板短/临界/多页、真实 PDF 与 Word 入口、打印背景开/关、评论锚点。
- [x] 完成类型、格式、构建检查。
- [x] 将根因、测量结果、长期约束写入防回归清单与本计划；删除临时 tests 目录。

## 实施补充

- 表单同步独立订阅，字段检查仅在问题或条目路径变化时广播；工具栏只订阅具体按钮状态，隐藏浮层不再发送滚动定位事务。
- 预览停笔 180 ms 后合并并低优先级渲染；保存保持原策略，PDF/Word 拒绝落后于当前正文的快照。
- 连续粘贴的关键根因是顶层 sidebar/header 的宽范围 `:has()`，已改为直属子节点查询与显式状态。桌面侧栏两轮开关、inset 背景和 390 px 手机顶部栏均通过。
- 10 秒快打普通输入框 978 字、富文本 879 字，输入期间无长任务；固定 100 次多段粘贴 P95 由约 105 ms 降至 8.3 ms。追加 250 次多段粘贴（约 2.1 万字）P95 6.5 ms，无输入期长任务。完整结果及超长单段的剩余限制见 spec。
- 中文输入、字段更新/光标保持、经历增删重排、保存刷新、格式工具栏、过期导出拒绝与最新正文导出通过。12 份 PDF 的页数、邮箱及尾字均核对通过。远端更新使用 store 模拟，未做双账号云端测试。
- 临时测试与数据已清理，不提交、不推送。

最终验证：`tsc --noEmit`、`pnpm build`、`pnpm format:check`、`git diff --check` 全部通过。ESLint 保留既有 73 条 warning、0 error；构建保留既有循环分块与包体积提示。
