# 全站操作界面与布局修正计划

> 面向 AI 代理：使用 dispatching-parallel-agents 按不重叠模块并行实施；主代理集成、逐任务审查与浏览器验收。

**目标：** 修复用户十项问题及岗位定制全流程布局，深入审查次级操作界面。

**架构：** 页面局部布局和状态修复，现有组件/store/动作继续复用。

**技术栈：** React、TypeScript、Tailwind、Motion、Base UI/Radix、Zustand。

## 全局约束

先读 AGENTS.md、防回归清单和涉及历史。当前分支，不提交不推送，不添加依赖，不改数据库/模板/打印或用户数据。新动效使用公共预设与项目 useReducedMotion。测试只在 tests/ 下按功能分目录，完成删除。不同模块不编辑同一文件；主代理统一浏览器，子代理提交实现证据和待验证场景。

## 任务 1：求职跟进

文件：src/pages/tracker/components/drawer/index.tsx、progress-timeline、document；终态确认相关组件/store。

- [x] 定位预览与状态动作，点击流程图只更新预览状态；右侧按钮调用原状态确认入口。
- [x] 越过阶段用勾及中深色，未记录辅助文字保留。
- [x] 确认框展示目标与 open 分离，关闭保持退出文案；避免计时器猜动画。
- [x] 准备简历区标题、绑定和工具栏分层，预览单层表面；检查联系人、阶段和投递弹层溢出。
- [x] Prettier + ESLint layout，代码自审。

## 任务 2：分享

文件：src/pages/share/components/create-dialog、quick-dialog、关联表单与设置弹层。

- [x] 新建及快速分享改现有 Drawer，标题/正文/操作明确分区，宽度和高度受视口限制。
- [x] 保留全部分享策略、加载失败重试和链接操作；检查弹层焦点/嵌套日历。
- [x] 同模块其他弹层检查滚动和重复边框；格式与自审。

## 任务 3：岗位定制

文件：src/components/jd-variant/components/generator-dialog、generator-step-indicator、steps/\*、tasks-dialog、lineage-dialog。

- [x] 全步骤重排为稳定外框、可收缩滚动正文、固定操作栏。
- [x] 解析与改写反馈使用真实状态，长输出折叠展示；结果前后对照使用单层分区。
- [x] 结果/保存/失败/取消均有可见反馈，任务列表和来源界面一起检查。
- [x] 格式、自审，说明隔离验证输入。
- [x] 按补充反馈保留步骤之间的连接线，覆盖桌面、手机与减少动效。

## 任务 4：主代理

文件：首页 recent/todo、resume/index 与 resume-card、animation 冲突源、确认的全站问题。

- [x] 最近简历强化文档识别、类型和动作；修复待办悬浮圆角。
- [x] 按后续反馈替换为真实已保存内容与精确模板的缩略图，复用 ScaledReadonlyPreview；只加载可见的两份，卡片收紧至约 156px 桌面高度，验证加载、失败重试、深色与窄屏。
- [x] 准备简历绑定立即 loading/disabled，成功/失败语义真实。
- [x] 找到 animation shorthand 冲突源并修复；审查所有 Dialog/Drawer/Popover 的滚动约束。
- [x] 建立真实组件的隔离夹具，逐页及次级入口检查，修复证据支持的问题。

## 任务 5：集成

- [x] 主代理逐任务规格与代码审查，独立最终审查和 review-animations。
- [x] 实际滚轮、桌面/手机、两轮开关/反向、焦点、控制台、减少动效验证。
- [x] pnpm exec tsc -b、pnpm build、pnpm format:check；改动文件 Prettier 后 ESLint --fix --fix-type layout。
- [x] 更新防回归清单与验收记录，清理临时测试，分别记录实施、验证、用户审查。

## 最终状态

实施完成；浏览器验收完成；最终类型、构建与格式检查见验收记录。已按用户补充反馈返修，最终审查待确认。未提交、未推送。
