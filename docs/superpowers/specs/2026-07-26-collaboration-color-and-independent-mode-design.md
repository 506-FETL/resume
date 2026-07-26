# 协作者颜色统一与独立浏览双向隔离设计

- 状态：已确认
- 日期：2026-07-26
- 范围：协作者颜色生成与传播、协作 UI 跟随模式的收发边界

## 1. 背景与根因

### 1.1 同一协作者颜色不一致

当前存在三套独立颜色来源：

- 协作会话通过 `createParticipantColor()` 随机生成 presence / 富文本光标颜色；
- 鼠标光标 Hook 通过 `createCursorColor()` 再随机生成一次；
- UI 协作 Hook 通过 `createParticipantColor()` 第三次随机生成。

同一个登录用户因此会在鼠标光标、富文本竖线、在线成员和 UI 操作中显示不同颜色，刷新或重新
进入会话后颜色也会变化。

### 1.2 独立浏览只有单向隔离

`followMode=false` 目前只阻止 `CollaborationUISync` 应用远端 UI action。本地滚动、Tab、抽屉、
字体、间距和主题变化仍调用 `broadcastUIAction`，会继续控制其他处于跟随模式的协作者。
此外，独立浏览期间到达的最后一条远端 action 会保留在 store，重新开启跟随后可能被补应用。

## 2. 目标与非目标

目标：

- 根据登录用户 ID 稳定生成颜色，同一账号跨刷新、跨会话保持一致；
- 鼠标光标、富文本竖线、成员 presence、在线成员和 UI action 复用会话层同一 `selfColor`；
- 独立浏览时既不应用远端 UI action，也不广播本地 UI action；
- 独立期间收到的 action 立即丢弃，恢复跟随后不补执行旧动作；
- 保持协作内容编辑、鼠标位置、点击提示、在线状态和成员列表正常工作。

非目标：

- 不关闭 Automerge/Yjs 内容协作；
- 不让独立浏览用户从 presence 中离线；
- 不屏蔽鼠标光标或点击可视化，因为它们不控制另一端 UI；
- 不为不同用户做全局颜色唯一性分配，仅保证由 ID 确定且稳定；
- 按用户要求不新增测试文件。

## 3. 稳定颜色设计

`createParticipantColor` 改为接收必填登录 `userId`。使用确定性的 32 位字符串哈希把 ID 映射到
`0..359` 色相，饱和度和亮度使用固定值，输出 CSS `hsl(...)`。函数不得读取随机数、时间、
sessionId 或组件挂载状态。

会话启动时始终通过当前登录 `userId` 重新计算颜色并写入 `selfColor`，不复用可能属于旧账号的
内存缓存。之后颜色沿一条数据流传播：

```text
登录 userId → createParticipantColor(userId) → session.selfColor
  ├─ session presence / participant 列表
  ├─ Yjs awareness → 富文本竖线
  ├─ RealtimeCursors → 鼠标光标
  └─ CollaborationUISync → UI presence / state / action / click
```

`RealtimeCursors`、`useRealtimeCursors`、`CollaborationUISync` 和 `useRealtimeCollabUI` 增加必填
`color` 参数，只消费 `selfColor`，不再创建内部颜色状态。删除已无调用方的 `createCursorColor`。

## 4. 独立浏览设计

`CollaborationUISync` 把 `followMode` 作为 UI action 广播开关传给 `useRealtimeCollabUI`。
所有滚动、Tab、抽屉和配置 Hook 仍调用统一的 `broadcastUIAction`，但该中心函数在独立浏览时
直接返回，避免把模式判断散落到各个功能 Hook。

状态和事件边界：

- `broadcastUIAction`：独立浏览时阻断；跟随模式时正常发送；
- `broadcastState`：继续发送，用于在线成员与状态展示，不会驱动远端界面；
- `broadcastClick`：继续发送，只用于点击可视化；
- 远端 UI action：独立浏览时立即从 `latestRemoteAction` 清除，不应用；
- 远端滚动动画：沿用已有逻辑，在关闭跟随时立即取消；
- 恢复跟随：只响应恢复之后到达的新 action，不回放独立期间的旧 action。

按钮提示文字同步调整为“独立浏览时既不跟随协作者，也不会把本地 UI 操作同步给协作者”。

## 5. 验证与验收

自动验证：

- 全局扫描确认颜色只在会话启动处生成一次，业务 Hook 不再调用随机颜色函数；
- 相关源码 ESLint；
- `pnpm exec tsc --noEmit` 与 `npx tsc --noEmit`，单独记录已有基线错误；
- `pnpm build`；
- `git diff --check`；
- 全局扫描确认仍不存在测试代码文件。

双账号人工验收：

- 同一账号的鼠标光标、富文本竖线、在线成员色点和 UI 点击/操作颜色完全一致；
- 刷新页面或重新建立协作会话后，同一账号颜色不变；
- A、B 都跟随时，UI 操作按现状双向同步；
- A 切到独立浏览后，B 的操作不改变 A，A 的滚动/Tab/抽屉/主题/字体/间距也不改变 B；
- A 恢复跟随后，不执行独立期间最后一条旧操作，只响应新操作；
- 独立浏览期间内容编辑、鼠标光标、点击提示和在线成员仍可见。
