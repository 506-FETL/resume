# 仓库说明

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