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
