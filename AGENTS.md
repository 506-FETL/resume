Always respond in Chinese-simplified.

# 超能力工作流（自动启用）

- `using-superpowers` 技能在本仓库的每个任务中**会自动激活**——代理（agents）必须遵循该技能，无需额外提示。
- 每当任务涉及规划、设计、重构或构建功能（任何超出一行简单修改的工作）时，代理必须：
  1. 在任何实现之前调用 `brainstorming` 技能。
  2. 根据任务的复杂度来判断是否需要进行spec的编写，如果任务比较轻量级，就不需要写入 spec，直接进行实现即可；如果任务比较复杂，就进入下一步；
  3. 在规格（spec）被批准后调用 `writing-plans` 技能。
  4. 将规格保存到 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`。
  5. 将计划保存到 `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`。
- 这些路径为强制要求；不要将规格/计划放到其他位置（不要使用 `docs/plans/`，也不要放在会话工作区的 markdown）。

# 通用规则

- 除非用户明确要求执行 `git push`，否则不要推送到任何远端。
- 当任务包含 Supabase 数据库迁移或 Edge Functions 变更时，在全部开发与验证完成后，代理必须负责将变更部署到当前已链接的 Supabase 云端项目，并完成迁移账本、函数版本和线上 smoke 核验；不得把部署步骤留给用户手工执行。若部署门禁尚未满足，应继续排除问题或建立等价的隔离验证环境；只有确实缺少用户凭据、项目权限或其他无法自行取得的外部授权时，才请求用户介入。
- 当前仓库没有写测试，因此不需要执行TDD开发流程
- 默认在当前分支上工作，除非用户明确要求创建或切换分支。
- 在 `src/pages` 下创建或重构页面时，遵循 history-style 模块结构，包含 `components/`、`hooks/`、`const.ts`、`index.tsx`、`store.ts`、`types.ts` 和 `utils.ts`；使用 kebab-case 命名，组件以文件夹导出（`index.tsx`），并通过将共享页面状态/动作提升到页面的 store 中来避免多级 prop 传递。

# 状态管理指南

- **Zustand**：用于全局应用状态、跨页面共享数据与复杂领域状态（例如：简历表单、ATS 配置、模板工作台）。Stores 存放在 `src/store/`（应用级）或 `src/pages/<page>/store/`（页面级）。将大型 store 拆分为 slice 文件，并使用 barrel `index.ts` 导出。
- **React Context**：仅用于限定在组件子树内的 UI 状态（例如 `DragContext`、`SidebarContext`、`DropzoneContext`）。不要用于多个页面需要的全局数据。
- **本地状态（`useState`）**：用于限定在单个组件内的临时 UI 状态（对话框、表单输入、切换开关）。

# UI 组件兼容性与加载状态

- 从 shadcn/ui 文档或 registry 同步样式前，必须先确认底层 primitive。Radix 使用 `data-state="open|closed"`，Tailwind 选择器应写为 `data-[state=open]` / `data-[state=closed]`；Base UI 使用 `data-open` / `data-closed`。禁止在两套 primitive 之间直接照搬状态选择器。
- 每个 `DialogContent` 都必须关联 `DialogDescription`；没有可见说明时使用 `className="sr-only"` 提供简短描述，避免无障碍警告。
- 修改共享 Dialog 动画时，必须同时验证遮罩和内容的进入、退出动画，并至少抽查创建简历、创建分享以及简历优化弹窗等代表性调用点。
- 弹窗动画验收必须至少连续执行两轮完整的打开与关闭，并覆盖退出尚未结束时再次打开的反向切换；不得只以首次挂载有动画作为通过依据。
- 首页等聚合页面的异步模块必须使用各自真实依赖对应的加载状态；不同数据源应并发加载，单个模块完成后立即展示，不得用一个跨模块 `Promise.all` 或共享 `loading` 阻塞无关模块。

# 提交信息生成规则

生成中文的提交信息，并且提交格式为：type(scope): description，这个只需要第一行写入，并且有且只有一个，在下方分条写出详细信息，并且注意事项：

- type 只能是 feat、fix、docs、style、refactor、perf、test、chore 这几种类型
- scope 是必选的，可以写模块名称或者功能点
- description 是对提交内容的简短描述，尽量控制在50个字符以内
- 如果有多个修改点，可以分条列出，每条以“-”开头
- 不要包含任何敏感信息或个人信息
- 不要包含任何无关的内容或废话
- 不要包含任何代码片段或文件路径
- 不要包含任何与提交无关的内容
