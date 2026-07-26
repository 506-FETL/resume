# 协作者颜色统一与独立浏览双向隔离实施计划

> **给代理执行者：** 必须使用 superpowers:executing-plans 在当前会话按任务逐步实现本计划；不得使用子代理。步骤使用复选框（`- [ ]`）跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 让同一登录用户在所有协作界面跨刷新稳定使用同一种颜色，并让独立浏览同时阻断远端 UI 控制和本地 UI action 广播。

**架构：** 登录 userId 经确定性哈希生成唯一会话 `selfColor`，鼠标光标、富文本 awareness、成员 presence 和 UI 通道全部由编辑器入口注入这一个颜色。独立浏览的发送边界集中在 `useRealtimeCollabUI.broadcastUIAction`，接收边界集中在 `CollaborationUISync` 的 action effect，避免各功能 Hook 分散判断。

**技术栈：** React 19、TypeScript、Zustand、Supabase Realtime、Tiptap/Yjs、pnpm/Vite

**设计规格：** `docs/superpowers/specs/2026-07-26-collaboration-color-and-independent-mode-design.md`

**约束：** 保持当前分支；只做本地提交，不 push；用户已要求全局删除测试文件，故本轮不新增测试，以源码扫描、ESLint、TypeScript、生产构建和双账号人工验收验证。

---

### 任务 1：把颜色生成改为登录用户 ID 的确定性映射

**文件：**

- 修改：`src/lib/collaboration/shared/color.ts`
- 修改：`src/lib/collaboration/session/service.ts`

- [x] 把 `createParticipantColor()` 改为必填 `userId: string`，使用稳定 32 位字符串哈希计算 `0..359` 色相，并返回固定饱和度/亮度的 HSL。
- [x] 删除随机色相函数和 `createCursorColor()`，确保颜色模块不再调用 `Math.random()`。
- [x] 会话启动始终调用 `createParticipantColor(userId)`，不复用可能属于旧账号的 `selfColor`。
- [x] 用 `rg` 确认颜色只在会话 service 中生成一次，且所有调用都传入登录 userId。

执行记录：颜色模块使用 FNV-1a 风格 32 位哈希映射色相；`rg` 确认
`createParticipantColor` 只在 session service 调用且传入 `userId`，`createCursorColor` 已不存在。
协作范围内唯一剩余的 `Math.random()` 用于生成临时 realtime 数字 ID，与颜色无关。

### 任务 2：让所有协作通道复用会话 selfColor

**文件：**

- 修改：`src/lib/collaboration/cursor/types.ts`
- 修改：`src/lib/collaboration/cursor/hook.ts`
- 修改：`src/lib/collaboration/richtext/use-rich-text-collab.ts`
- 修改：`src/components/realtime-cursors.tsx`
- 修改：`src/hooks/use-realtime-collab-ui.ts`
- 修改：`src/pages/resume/editor/components/collaboration/collaboration-ui-sync.tsx`
- 修改：`src/pages/resume/editor/index.tsx`

- [x] 为 `UseRealtimeCursorsOptions`、`RealtimeCursors`、`UseRealtimeCollabUIOptions` 和 `CollaborationUISyncProps` 增加必填 `color`。
- [x] 删除鼠标光标 Hook 与 UI Hook 内部的随机颜色 state，直接使用传入颜色构造 payload 和 presence。
- [x] 编辑器从 collaboration store 读取 `selfColor`，只有 `roomName/currentUser/selfColor` 均就绪时挂载协作可视化，并把同一颜色传入两个入口。
- [x] 确认富文本 `useRichTextCollab`、session participant、鼠标光标和 UI 通道都读取同一个 `selfColor`。

执行记录：Editor 同时向 `RealtimeCursors` 和 `CollaborationUISync` 注入 store 的 `selfColor`；
富文本继续直接读取同一 store，session participant 使用同一次 activation 结果，业务 Hook 不再生成颜色。

### 任务 3：让独立浏览同时阻断 UI action 收发

**文件：**

- 修改：`src/hooks/use-realtime-collab-ui.ts`
- 修改：`src/pages/resume/editor/components/collaboration/collaboration-ui-sync.tsx`

- [x] 为 `useRealtimeCollabUI` 增加 UI action 广播开关，并在 `broadcastUIAction` 的统一入口先判断该开关。
- [x] `CollaborationUISync` 把 `followMode` 传为广播开关；独立浏览下滚动、Tab、抽屉和配置 Hook 的调用全部成为 no-op。
- [x] 修改远端 action effect：存在 action 时始终清除；只有 `followMode=true` 才先应用，独立浏览期间不积压旧 action。
- [x] 保持 `broadcastState`、`broadcastClick`、presence、鼠标光标和内容协作不受开关影响。
- [x] 更新按钮 toast 和 Tooltip，明确独立浏览既不跟随也不广播本地 UI 操作。

执行记录：发送端仅 `broadcastUIAction` 受 `followMode` 控制，state/click 路径无此 guard；
接收 effect 在独立模式丢弃 action，在跟随模式应用后清除，已有远端滚动取消逻辑保持不变。

### 任务 4：验证、记录与本地提交

**文件：**

- 修改：本计划

- [x] 全局扫描 `createParticipantColor`、`createCursorColor`、`Math.random` 与颜色 props，确认颜色单一数据流。

  执行记录：`createParticipantColor(userId)` 只在 session service 调用；`createCursorColor` 和富文本
  备用色已不存在；唯一 `Math.random()` 位于 realtime 临时数字 ID 生成器，与颜色无关。

- [x] 运行相关 ESLint：颜色、session service、cursor、UI Hook、同步组件和编辑器入口；如遇既有忽略/fast-refresh 警告须区分记录。

  执行记录：对计划和全部九个相关源码文件运行 ESLint，使用既有 fast-refresh 规则豁免及
  `--no-warn-ignored` 区分基线配置，退出码 0，0 错误、0 警告。

- [x] 运行 `pnpm exec tsc --noEmit` 与 `npx tsc --noEmit`，如实记录既有 `step-parsing.tsx` 的 `ScrollArea` 错误。

  执行记录：两条命令退出码均为 2，唯一 TypeScript 错误仍为既有
  `src/components/jd-variant/components/steps/step-parsing.tsx:5 TS6133 ScrollArea`；`npx` 另有
  npm `home` 配置弃用警告。本次改动没有新增类型错误。

- [x] 运行 `pnpm build`、`git diff --check`、全局测试文件扫描。

  执行记录：最终 `pnpm build` 退出码 0，转换 5213 个模块，仅有既有 chunk 大小提示；
  `git diff --check` 退出码 0；源码测试文件与测试目录扫描无输出。

- [x] 直接审查最终 diff，确认独立浏览只阻断 UI action，未关闭 presence、鼠标/点击可视化或内容同步。

  执行记录：自查确认广播 guard 只位于 `broadcastUIAction`；`broadcastState`、`broadcastClick` 和
  channel presence 保持原路径。接收端独立模式只丢弃 UI action，滚动取消和内容协作保持不变。

- [x] 更新执行记录后本地提交：`fix(collab): unify colors and isolate independent browsing`。
- [ ] 交给用户双账号验收；未获得真实页面结果前不宣称人工验收通过。
