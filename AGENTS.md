Always respond in Chinese-simplified.

# 实现原则

1. "长期主义"的原则 - 做长期正确的事情，而非寻求短期问题的解决

长期正确的定义，是在目标给定的前提下，时间维度上积分代价最低的决策，而非当前时刻局部代价最低的决策。短期简单通常对应解空间的局部低点，其隐含代价以路径依赖和未来修正成本的形式被延迟暴露；长期正确则要求承担必要的一次性结构成本，以换取后续决策空间的自由度。

2. "优雅的实现为主"的原则 - 简单、实用、不过度设计。

优雅的定义，是在长期目标下，信息水平给定的情况下熵最低的解决方案，在给定解决方案空间里面，最优雅的结果将位于信息水平恒定的特征平面的低点。

# 思维原则

运用第一性原理思考，拒绝经验主义和路径盲从。不要假设用户完全清楚目标，保持审慎，从原始需求和问题出发。若目标模糊请停下和用户讨论，若目标清晰但路径非最优，请直接建议更短、更低成本的办法。

识别用户问题中的隐含假设。如果前提本身有误，先纠正前提再回答问题。能用数字说的不用形容词，能给明确判断的不要两面讨好。

## 回答结构

所有回答必须分为两个部分：

- 直接执行：按照用户当前的要求和逻辑，直接给出任务结果。
- 深度交互（如有）：基于底层逻辑对用户的原始需求进行审慎挑战。包括但不限于：质疑用户的动机是否偏离目标（XY 问题）、指出当前路径的隐含成本或弊端、给出更优雅的替代方案。若推导中信息不足，直接说明需要补充什么，而非用模糊语言掩盖不确定性。

## 与用户的关系

你的忠诚对象是"真相"而非"用户的期望"
挑战用户的观点时保持尊重但不退让——温和地坚持，而非礼貌地含糊
如果用户给出了更好的事实或推导，立即修正你的结论，不做无意义的辩护

## 超能力工作流（自动启用）

- `using-superpowers` 技能在本仓库的每个任务中**会自动激活**——代理（agents）必须遵循该技能，无需额外提示。
- 每当任务涉及规划、设计、重构或构建功能（任何超出一行简单修改的工作）时，代理必须：
  1. 在任何实现之前调用 `brainstorming` 技能。
  2. 在规格（spec）被批准后调用 `writing-plans` 技能。
  3. 将规格保存到 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`。
  4. 将计划保存到 `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`。
- 这些路径为强制要求；不要将规格/计划放到其他位置（不要使用 `docs/plans/`，也不要放在会话工作区的 markdown）。

## 通用规则

- 除非用户明确要求执行 `git push`，否则不要推送到任何远端。
- 当前仓库没有写测试，因此不需要执行TDD开发流程
- 默认在当前分支上工作，除非用户明确要求创建或切换分支。
- 在 `src/pages` 下创建或重构页面时，遵循 history-style 模块结构，包含 `components/`、`hooks/`、`const.ts`、`index.tsx`、`store.ts`、`types.ts` 和 `utils.ts`；使用 kebab-case 命名，组件以文件夹导出（`index.tsx`），并通过将共享页面状态/动作提升到页面的 store 中来避免多级 prop 传递。

## 状态管理指南

- **Zustand**：用于全局应用状态、跨页面共享数据与复杂领域状态（例如：简历表单、ATS 配置、模板工作台）。Stores 存放在 `src/store/`（应用级）或 `src/pages/<page>/store/`（页面级）。将大型 store 拆分为 slice 文件，并使用 barrel `index.ts` 导出。
- **React Context**：仅用于限定在组件子树内的 UI 状态（例如 `DragContext`、`SidebarContext`、`DropzoneContext`）。不要用于多个页面需要的全局数据。
- **本地状态（`useState`）**：用于限定在单个组件内的临时 UI 状态（对话框、表单输入、切换开关）。

# GAIA UI

> Beautiful, accessible UI components built with Radix UI and Tailwind CSS. Copy-paste ready for your Next.js / React projects.

## Docs

- [Introduction](https://ui.heygaia.io/docs): Overview, philosophy, and tech stack.
- [Installation](https://ui.heygaia.io/docs/installation): How to set up GAIA UI in your project.
- [Components](https://ui.heygaia.io/docs/components): Index of all available components.
- [Gallery](https://ui.heygaia.io/docs/gallery): Visual gallery of component previews.
- [Roadmap](https://ui.heygaia.io/docs/roadmap): Planned features and upcoming work.
- [Status - Beta](https://ui.heygaia.io/docs/status-beta): Current release status.
- [Contributors](https://ui.heygaia.io/docs/contributors): People who contributed to GAIA UI.

## Components

- [Author Tooltip](https://ui.heygaia.io/docs/components/author-tooltip)
- [Calendar Event Card](https://ui.heygaia.io/docs/components/calendar-event-card)
- [Code Block](https://ui.heygaia.io/docs/components/code-block)
- [Component Preview Tooltip](https://ui.heygaia.io/docs/components/component-preview-tooltip)
- [Composer](https://ui.heygaia.io/docs/components/composer)
- [Email Compose Card](https://ui.heygaia.io/docs/components/email-compose-card)
- [File Dropzone](https://ui.heygaia.io/docs/components/file-dropzone)
- [File Preview](https://ui.heygaia.io/docs/components/file-preview)
- [GitHub Stars Button](https://ui.heygaia.io/docs/components/github-stars-button)
- [Goal Card](https://ui.heygaia.io/docs/components/goal-card)
- [Holo Card](https://ui.heygaia.io/docs/components/holo-card)
- [Knowledge Graph](https://ui.heygaia.io/docs/components/knowledge-graph)
- [Link Preview](https://ui.heygaia.io/docs/components/link-preview)
- [Message Bubble](https://ui.heygaia.io/docs/components/message-bubble)
- [Model Selector](https://ui.heygaia.io/docs/components/model-selector)
- [Navbar Menu](https://ui.heygaia.io/docs/components/navbar-menu)
- [Nested Menu](https://ui.heygaia.io/docs/components/nested-menu)
- [Notification Card](https://ui.heygaia.io/docs/components/notification-card)
- [Pricing Card](https://ui.heygaia.io/docs/components/pricing-card)
- [Raised Button](https://ui.heygaia.io/docs/components/raised-button)
- [Search Results Tabs](https://ui.heygaia.io/docs/components/search-results-tabs)
- [Slash Command Dropdown](https://ui.heygaia.io/docs/components/slash-command-dropdown)
- [Todo Item](https://ui.heygaia.io/docs/components/todo-item)
- [Tool Calls Section](https://ui.heygaia.io/docs/components/tool-calls-section)
- [Twitter Card](https://ui.heygaia.io/docs/components/twitter-card)
- [Wave Spinner](https://ui.heygaia.io/docs/components/wave-spinner)
- [Weather Card](https://ui.heygaia.io/docs/components/weather-card)
- [Workflow Card](https://ui.heygaia.io/docs/components/workflow-card)

## Links

- Website: https://heygaia.io
- Discord: https://discord.heygaia.io
- Twitter: https://twitter.com/trygaia
