# 个人应用布局优化实现计划

> 面向 AI 代理：按已授权范围执行；运用 dispatching-parallel-agents 将互不交叉的页面问题独立处理，主代理统一集成与验收。当前分支工作，不提交、不推送，不执行 TDD。用户明确排除首页。

**目标：** 消除其余页面无差别卡片结构，以文档库、链接列表及诊断报告建立主次。

**架构：** 仅改业务组件布局与样式，不更改 store、数据入口、模板或公共 Card。已有控件组合满足需求，无需新增组件库。保留各页原有模块结构与动作。

**技术栈：** React、TypeScript、Tailwind、shadcn/ui、现有 Motion 封装。

## 任务 1：简历文档列表

文件：src/pages/resume/index.tsx、src/pages/resume/components/resume-card/index.tsx。

- [x] 阅读实际列表、动作与相关防回归约束。
- [x] 网格改为单列连续文档条目，重排主次动作及元信息，同步骨架、创建空态。
- [x] 保留类型语义、整行入口与所有操作，局部格式及 ESLint 检查。

## 任务 2：诊断报告

文件：src/pages/optimize/index.tsx 及 components/ 内 dashboard、analysis、repair-checklist、advanced-tools 的展示组件。不得修改 hooks、store、评分 / AI / 写入逻辑。

- [x] 读取概览、问题、依据和工具的实际嵌套关系。
- [x] 建立报告主区 / 辅助区，拆除重复外框，问题与维度采用章节，工具采用轻量入口。
- [x] 工具内部保留有意义的前后对比、告警、输入边界；去掉包裹它们的多余卡片。
- [x] 局部格式及 ESLint 检查，提供可隔离渲染的组件清单。

## 任务 3：分享链接列表

文件：src/pages/share/const.ts、components/card、card-actions、grid、content、empty-state。

- [x] 连续条目、左右主辅结构和响应式布局；不改变用途 / 名称映射。
- [x] 操作改为独立主次按钮，保留菜单焦点交接和全部操作。
- [x] 同步骨架、失败、空态，局部格式及 ESLint 检查。

## 任务 4：辅助页面容器

文件：src/pages/resume/editor/components/edit-panel/section-row.tsx、src/pages/profile/index.tsx、src/components/quota/quota-card.tsx、src/pages/tracker/components/list/{index.tsx,job-card.tsx,job-table.tsx}。

同类补充：src/pages/history/components/detail-panel/{current-overview.tsx,history-overview.tsx}，只整理指标 / 说明 / 标签及编辑态外围容器，不改时间线与预览。

- [x] 侧栏章节改连续折叠区；仅样式变更。
- [x] 额度和设置骨架匹配开放分区。
- [x] 手机岗位改连续行，桌面表格去重复外框，保留表头及选中态。
- [x] 局部格式及 ESLint 检查。

## 任务 5：集成与验收

- [x] 审查各模块差异，确认首页文件本轮未改、未变数据或正文布局。
- [x] tests/ 下建真实组件隔离验收，覆盖桌面、320 / 390 px、长文、加载 / 空 / 错误、深色。
- [x] 菜单焦点、折叠重复开关、减少动效和控制台检查；检查实际页面文案。
- [x] 类型检查、构建、格式与差异检查；复核布局检测和视觉层级。
- [x] 更新设计约束、验收记录，删除临时测试文件；交用户审查，不提交或推送。

实施完成；静态与浏览器验证通过；用户审查待完成。详见[验收记录](../specs/2026-10-31-personal-app-layout-acceptance.md)。
