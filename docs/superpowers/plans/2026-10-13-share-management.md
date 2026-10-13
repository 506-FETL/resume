# 分享管理视觉与动效实现计划

> 在当前会话执行，弹窗局部任务使用 subagent-driven-development，结束后审查完整改动；遵循用户当前分支、不推送、无需 TDD 的要求。

**目标：** 保留网格，将分享管理改为信息清晰、响应自然、兼顾桌面与触屏的管理页面。
**架构：** 沿用 share 的 components/hooks/const/store/types/utils 结构，业务数据与行为不变；全宽概览和筛选，统一响应式卡片，局部状态驱动反馈。
**技术栈：** React 19、Zustand、Motion、Tailwind、shadcn/Radix。

## 任务 1：页面与网格

- [x] 修改 index、header、toolbar、content、grid、empty-state、card，增加 overview 和必要局部子组件；数据从已有 store 获取，卡片使用稳定 share.id key。
- [x] 使用 `grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr))` 控制网格，主内容 max-w-7xl；移动端同一张卡片折行。
- [x] 将 const 中动效时长改为 `DURATION.base/fast`、`EASE.out`，沿用 PresenceDiv 保证退出元素 inert；错峰限制前几项，避免长延迟。
- [x] 复制成功用局部状态、清理过期 timer，在按钮内展示勾选；保留错误 toast。筛选重置用页面 store 动作一次更新三个字段。
- [x] 概览使用真实 allShares 指标；列表加载用同结构骨架，空结果可清空筛选。

## 任务 2：分享弹窗交互

- [x] 仅检查并优化 create-dialog、settings-dialog、version-selector、visibility-icon 中与动态字段、退出时机有关的交互；保持标准 Dialog 和现有数据操作，不改共享 primitives。
- [x] 减少动效使用 `useReducedMotion()`；动态条件内容需退出动画且退出后不可交互，避免密码字段关闭瞬间消失。
- [x] 验证操作成功/取消后表单重置不会在退出中闪烁，保持关闭重开的一致性。

## 任务 3：验收与审查

- [x] `pnpm exec tsc -p tsconfig.app.json --noEmit` 无错误。
- [x] 对改动文件执行 `pnpm exec eslint ...`，并 `pnpm build` 确认生产构建。
- [x] 浏览器验证搜索、状态筛选、简历多选、清空、空结果、复制、更多菜单，弹窗至少两轮开关和反向打开；只读验证现有数据。
- [x] 验证宽屏、390px、深色与减少动效，保存真实页面截图。
- [x] 与临时目录 resume-share-before-20261013 对比，只保留本次授权范围；审查后记录结果。


## 验收结果

- 最终 TypeScript 和全部 16 个改动源文件的 ESLint 通过；生产构建成功（保留现有循环分块及大分块提示）。
- 实际登录页面验证搜索空结果、清空恢复、状态筛选、简历选择、复制反馈、完整菜单。
- 设置及创建弹窗均完成至少两轮打开/关闭；取消后原值/空表单恢复正常；退出保留内容。隔离夹具在关闭 60ms 后重新打开，确认重新打开前内容仍处于 closed 退出状态，之后恢复 open 的 0.2s 动画。
- 390px 和 1366px 无页面横向溢出；宽屏单卡 292 × 283.5px，1366px 下自适应为约 327 × 283.5px。
- 隔离夹具验证四种链接状态、超长标题/版本名、深色、加载/空数据/错误，以及减少动效（卡片过渡 0s、Dialog 动画 0s、遮罩无动画）。未写入真实业务数据，夹具已删除。
- 独立只读代码审查未发现阻塞问题；本轮源代码范围仅 src/pages/share，共 16 个文件，其他既有未提交修改保持不变。
