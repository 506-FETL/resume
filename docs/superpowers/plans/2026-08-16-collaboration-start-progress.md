# 实时协作开启阶段反馈实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让实时协作按钮从点击首帧起展示真实、可理解的连接阶段。

**架构：** 协作 store 新增统一 `connectionPhase`，由 orchestrator 在每个异步边界之前同步推进。底层连接服务不再独占设置笼统加载态，UI 直接把阶段映射为语义化文案，并在阶段非空时阻止重复提交与关闭确认框。

**技术栈：** TypeScript、Zustand、React、Automerge collaboration adapter。

---

### 任务 1：扩展协作连接状态模型

**文件：**
- 修改：`src/lib/collaboration/session/types.ts`
- 修改：`src/lib/collaboration/session/state.ts`
- 修改：`src/lib/collaboration/session/service.ts`

- [ ] **步骤 1：定义阶段类型与状态字段**

```ts
export type CollaborationConnectionPhase
  = | 'registering'
    | 'connecting'
    | 'syncing'
    | null

export interface CollaborationSessionState {
  isConnecting: boolean
  connectionPhase: CollaborationConnectionPhase
}
```

- [ ] **步骤 2：所有初始/停止/已连接状态清空阶段**

在 `createInitialSessionState`、`createConnectedSessionState` 和停止会话返回值中加入：

```ts
connectionPhase: null,
```

- [ ] **步骤 3：底层服务只消费 orchestrator 提供的阶段**

删除 `enableCollaborationSession` 开头重复设置的笼统加载态；错误路径仍由上层统一复位，底层资源清理逻辑保持不变。

### 任务 2：在真实异步边界推进阶段

**文件：**
- 修改：`src/lib/collaboration/session/store.ts`
- 修改：`src/lib/collaboration/session/service.ts`

- [ ] **步骤 1：添加原子阶段设置器**

```ts
function setConnectionPhase(
  set: CollaborationSessionStoreSet,
  phase: Exclude<CollaborationConnectionPhase, null>,
) {
  set({ isConnecting: true, connectionPhase: phase, error: null })
}
```

- [ ] **步骤 2：注册评论会话前进入 registering**

`activateSession` 在 `registerCollaborationCommentSession` 之前同步设置 `registering`，注册成功后设置 `connecting`。

- [ ] **步骤 3：初始快照写入前进入 syncing**

把可选 `onPhaseChange` 传入 `enableCollaborationSession`，在 host 初始快照保存前执行：

```ts
options.onPhaseChange?.('syncing')
```

- [ ] **步骤 4：所有失败路径完整复位**

三个入口的 catch 都设置：

```ts
set({ isConnecting: false, connectionPhase: null, error: message })
```

### 任务 3：展示语义化按钮反馈

**文件：**
- 修改：`src/pages/resume/editor/hooks/use-collaboration-panel-value.ts`
- 修改：`src/pages/resume/editor/components/collaboration/collaboration-dialog/index.tsx`

- [ ] **步骤 1：向界面暴露阶段文案**

```ts
const CONNECTION_PHASE_LABELS = {
  registering: '正在创建协作会话',
  connecting: '正在连接协作服务',
  syncing: '正在同步当前简历',
} as const
```

panel value 提供当前阶段与文案，未连接时返回 `null`。

- [ ] **步骤 2：确认按钮立即显示 spinner 与阶段文本**

连接期间按钮禁用并显示 `LoaderCircle`，按钮文本使用阶段文案；取消按钮禁用。

- [ ] **步骤 3：阻止连接期间关闭对话框**

`onOpenChange(false)` 在 `isCollabConnecting` 时直接返回，成功或失败后恢复现有关闭行为。

- [ ] **步骤 4：运行目标验证**

运行：

```bash
pnpm exec eslint src/lib/collaboration/session src/pages/resume/editor/hooks/use-collaboration-panel-value.ts src/pages/resume/editor/components/collaboration/collaboration-dialog/index.tsx
pnpm exec tsc --noEmit
pnpm build
```

预期：目标 lint 与构建通过；类型检查不新增协作模块错误。

