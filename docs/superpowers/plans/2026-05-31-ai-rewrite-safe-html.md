# AI Rewrite 安全 HTML 渲染实施计划

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 移除 AI rewrite 候选卡中的 `dangerouslySetInnerHTML`，改用项目统一的安全 HTML 渲染工具。

**架构：** 保持 `CandidateCard` 展示职责不变，只把候选 HTML 的渲染入口从 React 原生危险 API 切换到 `src/lib/safe-html.ts` 的 `parseSanitizedHtml()`。

**技术栈：** React、DOMPurify、html-react-parser、TypeScript、ESLint。

---

### 任务 1：建立危险渲染基线

**文件：**

- 检查：`src/components/ai-rewrite`

- [x] **步骤 1：确认当前存在 `dangerouslySetInnerHTML`**

```bash
rg -n "dangerouslySetInnerHTML" src/components/ai-rewrite
```

执行记录：命中 `src/components/ai-rewrite/components/candidate-card.tsx`。

### 任务 2：改用安全 HTML 渲染

**文件：**

- 修改：`src/components/ai-rewrite/components/candidate-card.tsx`

- [x] **步骤 1：引入 `parseSanitizedHtml`**

从 `@/lib/safe-html` 引入项目已有安全渲染工具。

- [x] **步骤 2：替换危险渲染 API**

用 `{parseSanitizedHtml(candidate.html)}` 替换 `dangerouslySetInnerHTML`。

### 任务 3：验证

**文件：**

- 检查：`src/components/ai-rewrite`

- [x] **步骤 1：确认不再使用 `dangerouslySetInnerHTML`**

```bash
! rg -n "dangerouslySetInnerHTML" src/components/ai-rewrite
```

执行记录：通过，命令退出码为 0。

- [x] **步骤 2：运行类型检查**

```bash
./node_modules/.bin/tsc --noEmit
```

执行记录：通过，命令退出码为 0。

- [x] **步骤 3：运行 lint**

```bash
./node_modules/.bin/eslint src/components/ai-rewrite --max-warnings=0
```

执行记录：通过，命令退出码为 0。
