# 首页与手机编辑体验返修计划

> 使用 dispatching-parallel-agents 与 subagent-driven-development 按独立文件范围实施，主代理负责集成与浏览器验证。用户本期返修已授权，不重复请求实施批准；仓库无 TDD 要求。

**目标：** 完成最新八项返修，保留业务行为。

**架构：** 原组件内局部调整响应式布局与过渡，复用原 store、shadcn、公共 motion。

**全局约束：** 先读 AGENTS.md、防回归清单及相关历史规格。当前分支，不提交、不推送，不回退已有改动。限定文件归属，不改共享 Button、后端、模板正文与 PDF。主代理统一操作浏览器；使用真实组件的合成隔离数据。测试只放 tests/responsive-refinement，完成删除。

## 任务 1：首页和简历网格

范围：src/pages/index/components/job-priorities/index.tsx、statistical-card/index.tsx、src/pages/resume/index.tsx 及对应 skeleton（如需要）。

- [x] 提醒父网格取消 items-start，Card 使用 h-full；header 为标题与查看全部两列，保留 loading/error/empty、语义装饰和数量。Link 使用已有 tracker 路由及已支持筛选。
- [x] 统计块以统一的标题行、数字行、说明行组织，取消标题与数字 justify-between；保留 NumberTicker、占位值和引导动作。
- [x] 简历网格改为有上限的列宽，例如 `repeat(auto-fill,minmax(min(100%,20rem),24rem))`，起点对齐；对实际内容检查三个操作能否保持合理宽度。
- [x] 局部格式与源码审查，记录根因及变更文件。

## 任务 2：桌面直接披露

范围：src/pages/tracker/components/drawer/document/index.tsx；src/pages/optimize/components/dashboard/assessment-basis-card.tsx、可读性建议所在组件。

- [x] 求职准备区用普通 section/header 组合替换外部 Collapsible，保留内部绑定 Select、数据加载/预览/失败和所有操作。
- [x] 优化两个外层与维度理由：桌面显示内容和静态标题；手机使用原折叠组件；复用同一正文，不复制挂载图表。使用已有 useIsMobile，必要时控件 `open={!isMobile || open}`，桌面不放可点击的收起触发器。
- [x] 保留原数据字段、操作和动态减少动效；局部格式并报告状态覆盖。

## 任务 3：手机历史过渡

范围：src/pages/history/components/workspace/index.tsx 及必要历史局部组件，不改 store 数据语义。

- [x] 调查目前 opacity、visibility、display、窄屏分支与 focus 的执行顺序，记录确切根因。
- [x] 使用公共 DURATION/EASE 或 CONTENT_SWITCH 衔接退出/进入和轻位移。常驻面板保留 DOM、状态与 scrollTop，退出前交接焦点，退出后不可交互；快速反向从当前画面接续。
- [x] 所有动效动态 useReducedMotion；不把 isMobile 当作减动画信号。格式与源码审查，提供真实组件隔离验收入口建议。

## 任务 4：手机编辑按钮、格式与规范（主代理）

- [x] 查 src/pages/resume/editor/components/toolbar、collaboration/collaboration-controls、sidebar、editor/index.tsx，移除局部强制 size-11 并统一 36px 图标控件，调整 gap 与重复边线；保存业务 props。
- [x] 只用 Prettier 处理上轮剩余 8 文件，先保存原文，随后比较 JSON 解析值和 Markdown 非空白内容，确保内容不变。
- [x] AGENTS.md 与防回归清单明确手机不自动减动画；保留系统减少动效。

## 任务 5：验证与交付

- [x] 真实组件隔离浏览器验证规格列出的尺寸、状态与快速切换，保存截图和必要帧采样。
- [x] 本轮 delta 独立审查；修复确定问题，用户审查保持待确认。
- [x] `pnpm exec tsc -b`、`pnpm build`、`pnpm format:check`、`git diff --check`，对改动先 Prettier 再 ESLint layout。
- [x] 清理 tests/responsive-refinement，更新规格/计划/验收记录与长期约束，不提交或推送。
