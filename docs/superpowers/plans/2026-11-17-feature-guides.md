# 隐藏功能首次引导实现计划

> 面向 AI 代理：按 subagent-driven-development 的任务拆分与审查方式完成；当前分支工作，用户已授权调研后实施，不重复询问。不执行 TDD、不自动 commit 或 push。

**目标：** 为划词评论、助手划词引用及排序提供一次性、可打断的引导。

**架构：** Driver.js headless 管步骤和目标，现有 Popover/Drawer 承载界面；局部演示层不连接业务写入。Zustand 保存账户级关闭状态，GSAP 编排动作。

**技术栈：** React 19、TypeScript、Driver.js 1.14、Zustand、GSAP、shadcn、Floating UI。

## 文件职责

- `src/store/feature-guides.ts`：三项引导的关闭状态与当前引导互斥。
- `src/features/feature-guides/types.ts`、`motion.ts`：协议与公共 GSAP 配置。
- `src/features/feature-guides/components/guide-popover/`：组合现有 Popover/Button，显示步骤、关闭和下一步。
- `src/features/feature-guides/components/guide-arrow/`：标准 Lucide 小箭头的定位与淡入，不改变入口样式。
- `src/features/feature-guides/selection/`：读取可见正文的 Range 几何、演示划词与动作按钮，不写正文。
- `src/features/feature-guides/comment-demo/`：非模态评论示范抽屉及“666”的输入发送动画。
- `src/features/feature-guides/use-feature-guide.ts`：Driver 生命周期、步骤切换、外部操作让路、清理。
- `src/features/feature-guides/comment-guide/`、`assistant-guide/`、`sorting-guide/`：三项真实入口适配与步骤定义。
- 编辑器工作区、排序控件和助手画布：增加稳定标识和按需引导挂载，保持现有状态动作。
- `tests/feature-guides/`：临时浏览器验收与合成数据，交付时删除。

## 任务

- [x] 1. 安装并核对 `pnpm add driver.js@1.14.0`，检查实际声明的 headless API。保存选择依据于规格。
- [x] 2. 建立状态和共享协议；账户 key 与 guide ID 共同决定 `dismissed`，运行状态不持久化。Driver 用 `drive()/moveNext()/destroy()` 控制步骤，目标缺失由库等待并结束。
- [x] 3. 完成提示 Popover、紧凑提示、标准小箭头及 GSAP 轻量淡入，按最新反馈移除高亮和图标缩放；`modal={false}`，禁用自动聚焦，不加遮罩；只关闭引导自身。
- [x] 4. 实现 Range 选择覆盖层和评论演示。所有效果在 body 的专属 portal 中；固定屏幕矩形由实际可见正文计算。用 GSAP 显示选区、指针、点击、666 输入与发送。
- [x] 5. 接入编辑器首次评论提示与排序提示，验证新建/离线/隐藏入口条件；正式评论 client/store 不注入演示数据。
- [x] 6. 接入助手画布与输入区的引用演示，原草稿和引用保持原样；演示打开的这次手机画布保持非模态，直到真正关闭。
- [x] 7. 实际浏览器覆盖桌面、手机、深色、重复开关、反向、中断、重载、账户切换、减少动效；核对零写入与零模型请求，以及正文几何和原生 Selection 不变。
- [x] 8. 动效审查后修正，执行格式、类型、lint、生产构建；补验收记录和防回归约束，删除临时 tests 内容。

## 检查命令与完成依据

```sh
pnpm exec prettier <本期改动文件> --write
pnpm exec eslint <本期改动源码> --fix --fix-type layout
pnpm exec tsc --noEmit
pnpm format:check
pnpm build
```

浏览器断言面向真实组件和入口：关闭后同账户刷新不出现；A/B 各自记忆；页面按钮仍接收点击且输入不丢失；评论和助手演示完整到最后一步；进行中的动画可结束且退出层不可交互。录下实际中间帧而非仅看最终截图。实施、验证、用户审查分别登记。

## 完成状态

- 实施完成：三项引导、库接入、用户反馈后的视觉收敛及边界修正已完成。
- 验证完成：真实页面与正式组件验收、独立代码与动效复核、类型与生产构建通过；完整记录见[验收](../specs/2026-11-17-feature-guides-acceptance.md)。
- 用户审查：初版未通过；修订版待审查。未提交、推送或发布前端。

## 追加修正：外部操作保留引导、所有账户重新首次

- [x] 移除全局点击、输入、Escape 与 Driver 的自动接管退出；只让引导自身操作推进/关闭，保留上下文清理。
- [x] 引导 Popover、评论演示 Drawer、手机画布阻止非主动关闭，沿用当前非模态和动效。
- [x] 使用 persist 版本迁移一次性重置所有账户与游客的旧引导记录；后续主动关闭继续记忆。
- [x] 验证三项引导、外部操作、手机、键盘、减少动效与迁移/刷新/账户隔离，执行格式、类型和构建；记录结果并清理本期 tests。

追加修正实施完成；浏览器、类型、构建与全仓格式验证完成，临时验收文件和隔离浏览器已清理；用户审查待进行。前端未发布，未提交或推送。
