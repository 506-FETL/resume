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

## 追加修正：螺旋绘制与消除回闪

- [x] 在 tests/guide-motion 中挂载正式 MotionProvider 和正式引导组件，采样关闭与换步基线；确认 GSAP 清理与 Radix CSS 二次退出、旧目标提前换内容及箭头样式还原。
- [x] guide-presentation 使用已有 AnimatePresence 等待旧步骤退出；hook/types 分开待展示索引与已定位索引，防止新内容先在旧位置出现。
- [x] guide-popover 依据真实挂载回调 onOpenAutoFocus 与 presence 驱动单次 GSAP 过渡，退出冻结锚点并直接卸载；style.css 局部禁用默认 CSS 动画，不改共享 Popover。零时长完成通知在当前提交后执行，避免 Presence 未登记造成残留。
- [x] guide-arrow 复用已有定位，改成 SVG 螺旋路径与沿切线旋转的箭头尖；从当前状态继续淡入淡出，只有完整退出后清除几何，接入减少动效。引用演示卡同类闪现同步修复，手机虚拟锚点为提示保留完整宽度。
- [x] 正式动效环境中逐帧验证关闭、完成、换步、绘制中关闭、两轮及反向，覆盖评论/助手/排序与手机、减少动效；执行格式、类型、构建，更新验收和防回归约束，清理临时 tests。

本次为用户明确授权的局部返修，沿用当前分支直接实现，不增加审批、TDD 或自动提交。实施完成；浏览器逐帧验收、类型、生产构建和全仓格式检查通过，临时 tests 与隔离浏览器已清理；用户审查待进行。前端未发布，未提交或推送。

## 追加修正：参考图形状与分步演示节奏

- [x] `guide-arrow/index.tsx` 将路径改为三个连续小卷圈，72 × 34 px、1.25 px 线宽；`guide-popover/index.tsx` 首次留出 80 px 间距，并在正式组件中查看实际轮廓。
- [x] `guide-presentation`、`guide-arrow`、`guide-popover` 通过绘制完成回调控制首次显现；隐藏浮层先定位，箭头结束才播放浮层的 280 ms 进入，退出仍沿用同一生命周期。
- [x] `types.ts`、`use-feature-guide.ts` 增加 previous、presentedIndex 与展示完成回调；前后步骤共用 prepare + Driver moveTo，正文提示进入完成后再开始划词；`guide-popover/content.tsx` 组合已有 Button 增加上一步。
- [x] `selection/index.tsx` 每行 840 ms 绘制，结束停留 280 ms；按用户最新要求将指针与选区统一为 EASE.out 贝塞尔曲线，先快后慢。取消旧 timeline 保留当前进度退场。`comment-guide` 和 `assistant-guide` 传入本步展示状态；助手首次记录原画布状态，返回时按真实挂载和动画完成重新取原文。
- [x] 在 `tests/guide-coil/` 使用正式 MotionProvider、正式引导与助手路由，逐帧验收先后顺序、前进/后退/完成、两轮和快速返回、划词耗时、动态减少动效、窄屏布局及零业务写入；保留非敏感截图和记录，清理临时脚本。
- [ ] 执行修改文件 Prettier → ESLint layout、类型检查、全仓格式和生产构建，补齐本轮验收及防回归约束；实施、验证、用户审查分别记录，不提交或发布。

### 最新反馈覆盖

- [x] `guide-presentation` 保留同一个 Popover；按已定位索引展示内容，准备下一目标期间保持当前浮窗。新增局部 `use-popover-travel.ts`，分离首次/最终显隐与步骤间 transform 移动，位移结束才通知本步展示完成。
- [x] `guide-arrow` 启用逐帧追踪与定位外层变更监听，SVG 直接更新 transform；保留三圈绘制，返回首次时待浮窗到位再连接箭头。
- [x] 更新浏览器断言为浮窗 DOM 与透明度持续保留、位置有连续中间帧；验证实际助手折叠跟随、贝塞尔指针/选区同步、手机、前后完整流程、关闭与减少动效。

### 箭头重复绘制返修

- [x] 正式组件逐帧复现：首次完成后路径重新归零、透明度降到 0。明确根因为绘制完成与提示显示完成条件相互影响。
- [x] `guide-presentation` 分开首次绘制、已画完、离开首次三个阶段；完成回调不再关闭箭头，返回首次保持等待浮窗到位。
- [x] 复验首次完整序列、三个宽度评论和助手双向流程、两轮关闭及反向、空正文、折叠逐帧跟随、贝塞尔同步与减少动效；保留非敏感证据。
