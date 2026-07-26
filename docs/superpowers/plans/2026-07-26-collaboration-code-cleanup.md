# Collaboration Code Cleanup Implementation Plan

**Goal:** 在不改变现有协作体验的前提下，移除死代码、收紧身份类型、消除 UI 动作覆盖风险，并按页面规范重组文件。

**Architecture:** 协作库保留无 UI 状态的协议与会话领域逻辑；Resume Editor 页面 hook 管理 UI 频道局部状态；`collaboration-runtime` 统一连接页面状态与协作能力；当前协作者身份由 session store 的单一 `self` 对象提供。

**Constraints:** 不新增测试文件，不推送远端，不改 Automerge/Yjs 协议语义。

---

### Task 1: 收紧会话身份和 metadata 类型

**Files:**
- Modify: `src/lib/automerge/shared/types.ts`
- Modify: `src/lib/automerge/collaboration/supabase-network-adapter.ts`
- Modify: `src/lib/collaboration/session/types.ts`
- Modify: `src/lib/collaboration/session/state.ts`
- Modify: `src/lib/collaboration/session/service.ts`
- Modify: `src/lib/collaboration/session/store.ts`
- Modify: `src/lib/collaboration/session/callbacks.ts`
- Modify: `src/lib/collaboration/shared/color.ts`
- Modify: `src/lib/collaboration/richtext/use-rich-text-collab.ts`

**Steps:**
1. 将通用 presence metadata 从 `any` 收紧为 `unknown`。
2. 建立协作者 identity、self 和规范化 participant metadata 类型。
3. 用 `self` 对象替换分散的 `selfUserId`、`selfColor`、`selfPeerId`。
4. 在 session 边界兼容旧 `name` 字段，内部只保留 `userName`。
5. 将颜色函数重命名为表达确定性语义的 `getParticipantColor`。
6. 让富文本 awareness 直接消费 session self identity。

### Task 2: 精简协作 UI 协议

**Files:**
- Modify: `src/lib/collaboration/ui/constants.ts`
- Modify: `src/lib/collaboration/ui/types.ts`
- Modify: `src/lib/collaboration/ui/channel.ts`
- Modify: `src/lib/collaboration/ui/state.ts`
- Modify: `src/lib/collaboration/ui/index.ts`
- Delete: `src/lib/collaboration/ui/store.ts`

**Steps:**
1. 删除无人消费的点击事件协议和 payload。
2. 删除远端点击状态、清理定时器和全局 UI Zustand store。
3. 保留 UI state/action payload、频道绑定和在线成员纯状态转换。

### Task 3: 将 UI 频道生命周期收回 Resume Editor

**Files:**
- Add: `src/pages/resume/editor/hooks/use-realtime-collaboration-ui.ts`
- Move/Modify: `src/pages/resume/editor/hooks/use-config-broadcast.ts`
- Move/Modify: `src/pages/resume/editor/hooks/use-scroll-sync.ts`
- Move/Modify: `src/pages/resume/editor/hooks/use-tab-drawer-broadcast.ts`
- Delete: `src/hooks/use-realtime-collab-ui.ts`
- Delete old component-local hook files.

**Steps:**
1. 使用局部 React state 保存远端在线成员。
2. 通过稳定回调逐条交付远端动作，避免单槽覆盖。
3. 保持独立浏览只禁用 UI 动作收发，不影响在线状态。
4. 将页面专用同步 hooks 归位到页面 `hooks/`。

### Task 4: 重组页面协作组件

**Files:**
- Add/Modify: `src/pages/resume/editor/components/collaboration/*/index.tsx`
- Modify: `src/pages/resume/editor/components/collaboration/index.tsx`
- Modify: `src/pages/resume/editor/index.tsx`
- Modify: `src/pages/resume/editor/types.ts`
- Delete: old loose collaboration component files.
- Delete: `src/components/realtime-cursors.tsx`

**Steps:**
1. 将 controls、dialog、UI sync 和 realtime cursors 改为文件夹组件。
2. 新增 collaboration runtime，集中读取 room 和 self identity。
3. 从 Editor 移除协作身份拼装和深层协议依赖。
4. 删除失效类型与陈旧注释。

### Task 5: 验证与提交

**Steps:**
1. 扫描被删除符号和所有测试文件。
2. 对修改文件运行 ESLint。
3. 运行 `tsc --noEmit` 并记录既有错误。
4. 运行生产构建。
5. 检查 diff 和工作区状态，创建本地提交，不推送。

## Verification Record

- 协作范围 ESLint：通过，0 errors / 0 warnings。
- 生产构建：通过，Vite 共转换 5217 个模块；仅保留仓库已有的大 chunk 提示。
- TypeScript：本次协作改动没有新增错误；全库仍被既有的
  `src/components/jd-variant/components/steps/step-parsing.tsx` 未使用 `ScrollArea`
  阻断。
- 死代码扫描：源码中不存在已删除的 UI store、点击广播、旧 self 字段和旧颜色函数引用。
- 测试文件扫描：0 个，符合“不新增/保留测试文件”的明确约束。
