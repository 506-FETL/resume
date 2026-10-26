# 协作人数修复计划

> 使用 executing-plans 在当前会话内联执行；已获排查修复授权，不重复确认。

**目标：** 同一用户反复退出再进入不累加人数，双方初始成员一致，不再误报旧连接退出。

**架构：** 保留底层 peer 连接，用稳定用户身份展示人数和通知；初始会话使用 adapter 当前成员快照。

**技术栈：** Automerge Repo、Zustand、现有 Supabase 授权 RPC/Realtime、Playwright。

- [x] 在 tests/collaboration-members 复现当前 adapter 首次发现后状态被覆盖、重入三次计数增长及未知退出提示，记录修复前结果。
- [x] 修改 src/lib/automerge/collaboration/supabase-network-adapter.ts，保留 peer 元数据并提供 getPeers() 快照；保持每条 peer 的连接/断开事件及代际隔离。
- [x] 修改 src/lib/collaboration/session/service.ts、types.ts、state.ts，激活结果携带已发现成员，createConnectedSessionState 合并远端和自己；新增按 userId 去重的计数函数。
- [x] 修改 src/lib/collaboration/session/callbacks.ts，按同一用户从无到有、从有到无决定通知；未知连接不生成退出提示。修改 src/pages/resume/editor/hooks/use-collaboration-panel-value.ts 使用用户计数，保留用户已调整的控件位置。
- [x] 验证两页反复进出、同用户多连接、不同用户、旧连接超时和失效回调；确认文档消息仍按 peer 路由，不误断开其他标签页。
- [x] 更新防回归清单；执行 Prettier、ESLint layout、tsc、build、format:check 与 diff 检查。删除临时脚本和数据，记录结果与真实云端验收范围。

## 浏览器回归记录

2026-10-26，使用独立 Chrome 页面加载实际 adapter、连接服务、Zustand、成员回调与协作控件。RPC/Realtime 使用隔离模拟传输，未操作用户云端简历或账号。

| 场景                       | 修复前                     | 修复后                                  |
| -------------------------- | -------------------------- | --------------------------------------- |
| 协作者首次加入             | 新页面仅显示 1 人          | 显示 2 人，与停留页一致                 |
| 同一人退出重入三次         | 停留页 2 → 3 → 4 → 5 人    | 始终 2 人                               |
| 后台清理旧连接             | 连续弹出三条退出提示       | 无误报                                  |
| 未知 peer 退出             | 提示“协作者 y32r 退出协作” | 忽略，无提示                            |
| 同账号两个标签页           | —                          | 共计 1 人，两个标签均收到定向同步消息   |
| 同名不同账号加入           | —                          | 分别计数                                |
| 一个标签关闭，另一标签仍在 | —                          | 不减少人数、不提示该用户退出            |
| 关闭请求失败，旧连接过期   | —                          | 心跳清理旧 peer，新连接仍在，无虚假退出 |
| 最后有效连接离开           | —                          | 人数回落，仅一次正确姓名的退出提示      |
| 过期回调、自己退出回调     | —                          | 不改变当前会话和通知                    |
| 授权尚未返回时退出         | —                          | 迟到 inbox 被关闭，不复活频道或心跳     |
| 完整退出                   | —                          | 无剩余 peer、无后续心跳、无浏览器异常   |

重入回归同时核对 4 次同步消息均收到。超时场景通过模拟服务端将旧连接标为超过 45 秒，再由实际 adapter 的 10 秒心跳触发清理；测试时钟用于推进定时器。本次验证了前端成员生命周期与消息路由，没有将模拟传输等同于真实 Supabase 云端双账号或完整正文 CRDT 验收。

## 静态检查与交付

- 改动源码已执行局部 Prettier 和 ESLint layout 修复。
- `pnpm exec tsc --noEmit`、`pnpm build`、`pnpm format:check`、`git diff --check` 均通过。
- 全量 ESLint 有 73 条警告、0 错误；本次改动源码的局部 ESLint 无警告。构建仍提示 tiptap-editor 与 radix-ui 分包循环以及大 chunk，本次未调整分包配置。
- 已删除 `tests/collaboration-members` 下临时脚本、数据与日志；复现结果保留在本记录中。
- 保留任务开始前已有的协作人数位置调整；未修改数据库或 Edge Functions，未提交或推送。
