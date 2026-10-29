# 六项动效补齐实施计划

> **面向 AI 代理的工作者：** 按 dispatching-parallel-agents 将无共享文件的移动端、拖拽、流式任务隔离执行；主代理负责公共切换与验收集成。按 subagent-driven-development 进行实现后的规格核对与代码复核。不得多人编辑同一文件。

**目标：** 完成已授权的六项动效优化，用实际测量验证响应、连续性、焦点和性能。

**架构：** 延续 React、Base UI/Radix、Motion 和 Zustand。公共高频切换在 motion.ts 收口，其余修改留在所属模块；数据协议不变。依据[设计](../specs/2026-10-29-motion-completion-design.md)，本期无需新组件库或 GSAP。

**技术栈：** React 19、TypeScript、Motion、Base UI/Radix、Tailwind、Vite、现有 bundled Playwright。

**完成状态：** 六个方向已实施，浏览器验证、类型检查、生产构建及本轮文件格式检查通过。全仓 format:check 的四份既有代理文档失败单独记录；用户审查尚未进行。完成证据与验证边界见[验收记录](../specs/2026-10-29-motion-completion-acceptance.md)。下方勾选表示已执行对应工作，不把已知全仓检查失败等同通过。

## 任务 1：数字与高频切换（主代理）

文件：src/lib/motion.ts、src/components/ui/number-ticker.tsx、src/components/ui/tabs.tsx、src/pages/tracker/components/view-transition/index.tsx、src/pages/tracker/components/drawer/tab-panel/index.tsx、src/pages/history/components/detail-panel/detail-content.tsx；必要时 src/components/motion/animated-content.tsx。临时验证 tests/motion-finish-core/。

- [x] 读取 transitions-dev 数字/页签参考、历史切换残留规格和实际实现。
- [x] 先用真实 NumberTicker 与 Tabs 夹具采样原完成时间、连续反向、最终内容及长内容挂载。
- [x] 新增共享切换档，保留原标准进入/退出：

  ```ts
  export const CONTENT_SWITCH = {
    enter: { duration: DURATION.fast, ease: EASE.out },
    exit: { duration: DURATION.fast / 2, ease: EASE.out },
  } as const
  ```

- [x] NumberTicker 用 `animate(motionValue, target, { duration: DURATION.slow, ease: EASE.out })` 替代无界 spring；effect 清理停止前次动画，目标变化从当前值继续。保留已可见状态与 delay、小数、down，降级时 jump 目标。
- [x] 页签/视图采用 CONTENT_SWITCH 和 `transform: 'translateY(4px)'`，等待前项退出时使用 exit.duration；复用原 displayed/active 逻辑与焦点隔离，不重构数据状态。
- [x] 验收 0/20/100、小数、负数、down、更新途中反向、减少动效反向；鼠标与方向键快切、旧面板移除、嵌套页签、forceMount 草稿与 scrollTop。每次切换不得同时出现两组可见文字，最终面板可操作。

## 任务 2：移动抽屉（mobile_motion_finish）

文件：src/components/ui/drawer.tsx、src/pages/resume/editor/index.tsx，以及必要的移动编辑专属组件；临时验证 tests/motion-finish-mobile/。

- [x] 复现 390×844、visualViewport 高 500 时输入框仍处于 y632–668 的遮挡；确认实际时长已被全局 CSS 覆盖。
- [x] 对照已有评论抽屉：`<Drawer><DrawerVirtualKeyboardProvider><DrawerContent>…</DrawerContent></DrawerVirtualKeyboardProvider></Drawer>`；provider 读取 Drawer context，必须放在 Root 内部。共享 viewport 使用 primitive 提供的 keyboard inset 和可用高度，不增加新监听库。
- [x] 核对 transition-property，只保留实际需要的 transform/opacity 与必要嵌套行为；useReducedMotion 动态变化时停止位移。
- [x] 独立合成编辑页回归手柄拖动、滚动内容/选字不误关、输入聚焦避让、两轮关闭及反向、关闭焦点、320/390/844 横竖视口和减少动效。明确模拟与实机边界。

## 任务 3：拖拽与自动滚动（drag_motion_finish）

文件：src/components/ui/cross-list-drag.tsx、src/lib/motion-drag.ts（仅必要的复用修复）、src/pages/tracker/components/board/；临时验证 tests/motion-finish-drag/。

- [x] 核对实际取消路径、无限续帧根因和 tracker 状态确认语义。
- [x] pointermove 只保存最新坐标，每帧统一执行预览、命中和自动滚动；`didScroll` 由 scrollLeft/scrollTop 的实际变化计算，另一轴超出范围不滚动。
- [x] Escape 覆盖所有拖拽方式，源移除/blur/cancel 统一清理；保持 `suppressClick` 防止拖后误打开，不能阻止正常按钮点击。
- [x] 保留退出预览，合法提交短淡出，取消回当前源矩形；复用 DURATION/EASE 与减少动效，快速重新拾取取消旧收尾。目标整列高亮过渡，不加虚假的排序落点。
- [x] 用真实 CrossListProvider 合成三列做鼠标/触摸/键盘、取消/边界/卸载/退出重入/运行中减少动效；记录 rAF 是否在边界停止及最终数组。真实 tracker 只读检查，提交回调在夹具内验证。

## 任务 4：助手流式性能（stream_motion_finish）

文件：src/components/ai/shimmer.tsx 与专属样式、src/pages/assistant/components/message-list/、composer/、chat-header/、conversation-list/、工具与技能活动组件；需要画布切换时与主代理共用 CONTENT_SWITCH。临时验证 tests/motion-finish-stream/。

- [x] 定位 backgroundPosition 逐帧样式更新、全 store 订阅、历史消息重复 render 和工具状态复用。
- [x] 先记录真实组件 60 条历史 + 10 秒合成 Markdown 流的基线（React Profiler、帧间隔、LongTask、CDP Paint/Layout）。
- [x] Shimmer 采用小面积静态文字高亮 + opacity 循环，保留 duration 和可读文本，useReducedMotion 实时停止。
- [x] 非流 UI 使用 `useShallow` selector，MessageBubble/文本与推理组件在输入稳定时 memo，保留正在流动的真实依赖，不更改 use-chat-stream 协议。
- [x] 工具状态 key 区分 pending/result/error/cancelled；历史技能不重播，流中新增轻入场；状态切换保留取消与停止按钮焦点。
- [x] 相同数据复测 10 秒流；失败→重试→完成/取消、停止两轮与反向、手动上滚、320/390/1440 和实时减少动效。输出改善与未覆盖项，不写无证据的 FPS 承诺。

## 任务 5：保存、失败与通知（主代理）

文件：src/pages/tracker/components/drawer/workflow-save-feedback/index.tsx、src/components/motion/animated-content.tsx（仅确有共享需要）、src/components/ui/sonner.tsx / src/styles/motion.css（仅实测发现问题时）。临时验证 tests/motion-finish-core/。

- [x] 检查保存、导入/本地同步和 Sonner 的真实状态分支；不改变请求与扣费，不用假延迟模拟成功。
- [x] 保存状态使用即时独立 `role='status'` 文本；视觉文字/图标/重试按钮使用同一语义状态 key 与 CONTENT_SWITCH，避免旧错误和新按钮不同步。
- [x] 点击重试或状态外部变化时，将退出按钮上的焦点移至稳定容器后再隔离；退出内容不可重复提交。与真实 onRetry 配合，不新增业务请求。
- [x] 验收 idle→pending→saving→saved、error→retry→saving→error/saved、快速反向与减少动效；通知 loading→success/error、取消及重复通知不残留活动加载图标。

## 任务 6：集成与最终审查（主代理）

- [x] 对照 review-animations 逐文件复查并修复问题，记录 Before/After/Why 和结论；技能默认与仓库规则冲突时按仓库保持短过渡和减少动效归零。
- [x] 对修改文件执行 `pnpm exec prettier <files> --write`，再 `pnpm exec eslint <source-files> --fix --fix-type layout`，核对无重复导入、属性、JSX 和补丁残留。
- [x] 执行 `pnpm exec tsc -b`、`pnpm build`、`pnpm format:check`、`git diff --check`。既有四份代理文档格式问题与 lint/chunk 警告单独报告，不混入本轮成功结论。
- [x] 真实页面只读抽查首页、跟进、助手、历史、移动编辑，核对本轮组件的文字、焦点和最终布局。
- [x] 证据存入 .superpowers/motion-finish-20261029/；删除本轮 tests/motion-finish-\* 临时脚本、关闭独立浏览器和临时服务，保留用户已有测试/服务。更新防回归清单和验收文档，分别记录实施、验证、用户审查。
