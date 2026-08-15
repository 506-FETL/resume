# 评论线程已读与划词按钮稳定性实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现持久化的线程级未读提醒，并保证划词评论按钮只在选择手势结束后出现。

**架构：** 数据库新增 thread/principal 游标，bootstrap 一次返回每个线程的最新评论事件与已读游标，Edge Function 提供 `mark_thread_read` 与现有 `mark_read`。客户端 store 从线程游标派生未读列表，线程点击与“全部已读”进行乐观更新；选区按钮用全局捕获监听和 generation 令牌实现完整手势状态机。

**技术栈：** Supabase Postgres、Edge Functions/Deno、React、Zustand、IndexedDB、Selection API、Pointer/Keyboard Events。

---

### 任务 1：增加线程已读数据库能力

**文件：**
- 创建：`supabase/migrations/20260816000002_add_resume_comment_thread_read_states.sql`

- [ ] **步骤 1：创建私有线程游标表**

创建 `private.resume_comment_thread_read_states`，包含 `scope_id`、`thread_id`、actor kind、user/anonymous principal、`last_read_event_seq`、`updated_at`；外键级联到 scope/thread，检查 principal 与 actor kind 匹配，并用两个部分唯一索引分别约束用户与匿名访问者。

- [ ] **步骤 2：创建未读快照函数**

私有函数按 `thread_created` 与 `comment_replied` 聚合每个线程 `latest_comment_event_seq`，再左连接线程游标和 scope 全局游标，返回：

```sql
thread_id uuid,
latest_comment_event_seq bigint,
last_read_event_seq bigint,
unread boolean
```

- [ ] **步骤 3：创建 mark_thread_read 事务函数**

函数校验 scope/thread/principal 权限后使用 `GREATEST` upsert 指定线程游标；若不存在其他未读线程，同一事务推进 `resume_comment_read_states` 的 scope 游标。

- [ ] **步骤 4：调整写入副作用与 bootstrap**

通过保留现有签名的包装层，让 `thread_created` / `comment_replied` 的作者只推进对应线程游标，`document_synced` 不推进 scope 游标；扩展 `build_resume_comment_bootstrap_v1` 在原 RPC 中返回 `threadReadStates`。

- [ ] **步骤 5：锁定权限**

新表和私有函数撤销 `PUBLIC`、`anon`、`authenticated` 权限，仅向 `service_role` 授予所需执行/读写权限。

### 任务 2：扩展 Edge Function 协议

**文件：**
- 修改：`supabase/functions/resume-comments/index.ts`
- 修改：`scripts/verify-resume-comment-service.ts`

- [ ] **步骤 1：验证 bootstrap 新字段**

新增协议结构：

```ts
interface ThreadReadStatePayload {
  threadId: string
  latestCommentEventSeq: number
  lastReadEventSeq: number
  unread: boolean
}
```

`validateBootstrapPayload` 必须拒绝重复 threadId、越界序号和与 scope 不匹配的线程。

- [ ] **步骤 2：支持 mark_thread_read**

写操作白名单加入 `mark_thread_read`，要求 `threadId` 和非负安全整数 `eventSeq`，调用数据库事务函数并返回最终 `lastReadEventSeq` 与 `scopeLastReadEventSeq`。

- [ ] **步骤 3：保留 mark_read 作为全部已读**

`mark_read` 继续推进 scope 游标，并让 bootstrap 将被全局游标覆盖的线程视为已读。

- [ ] **步骤 4：扩展服务 verifier**

断言 bootstrap 返回 thread read state、未知线程无法标记、线程游标只前进、最后一个未读线程会推进 scope 游标。

### 任务 3：扩展客户端协议、缓存与 store

**文件：**
- 修改：`src/features/resume-comments/api/client.ts`
- 修改：`src/features/resume-comments/api/cache.ts`
- 修改：`src/features/resume-comments/store/types.ts`
- 修改：`src/features/resume-comments/store/create-store.ts`
- 修改：`src/features/resume-comments/types.ts`
- 修改：`scripts/verify-resume-comment-client.ts`

- [ ] **步骤 1：增加客户端线程已读类型和 API**

`CommentBootstrapResult` 加入 `threadReadStates`，client 增加：

```ts
markThreadRead(threadId: string, eventSeq: number) {
  return this.writeRaw('mark_thread_read', { threadId, eventSeq })
}
```

- [ ] **步骤 2：store 保存并派生线程未读**

新增 `threadReadStateById`、`markThreadReadLocally`、`markAllReadLocally`、`restoreThreadReadSnapshot`。合并策略始终对 latest/read 序号取最大值，未读由 `latest > max(threadRead, scopeRead)` 派生。

- [ ] **步骤 3：缓存保存线程游标**

IndexedDB bootstrap value 增加线程游标 map；缓存兼容检查接受缺失字段并归一化为空对象，防止旧缓存导致启动失败。

- [ ] **步骤 4：bootstrap 补偿领先的本地游标**

服务端与缓存合并后，对本地领先的线程逐个调用 `markThreadRead`；scope 全部已读仍使用 `markRead`。补偿失败不回退本地确认，等待下次 bootstrap 重试。

- [ ] **步骤 5：执行客户端 verifier**

运行：

```bash
pnpm verify:comment-client
```

预期：协议归一化、缓存兼容和线程游标单调合并断言全部通过。

### 任务 4：实现评论面板 B 方案交互

**文件：**
- 修改：`src/features/resume-comments/context.tsx`
- 修改：`src/features/resume-comments/hooks/use-comment-realtime.ts`
- 修改：`src/features/resume-comments/hooks/use-comment-actions.ts`
- 修改：`src/features/resume-comments/components/comments-panel.tsx`
- 修改：`src/features/resume-comments/components/thread-list.tsx`
- 修改：`src/features/resume-comments/components/comment-bookmark.tsx`
- 修改：`src/features/resume-comments/components/comment-source-selector.tsx`

- [ ] **步骤 1：删除打开面板自动已读**

移除 `visible + 500ms` 的 `useCommentReadReceipt` 调用与 effect；打开面板只影响可见性。

- [ ] **步骤 2：增加线程与全部已读动作**

点击线程时先保存快照、乐观 `markThreadReadLocally`、打开详情，再调用 `client.markThreadRead`；失败恢复快照并显示非阻塞错误。全部已读同理调用 `client.markRead(lastEventSeq)`。

- [ ] **步骤 3：只高亮最外层线程卡片**

`ThreadList` 接收 `unreadThreadIds`，仅在线程容器添加背景、边框和“新评论”徽标；详情和回复树不添加逐条高亮。

- [ ] **步骤 4：增加标题区未读计数与全部已读按钮**

未读数大于 0 时显示“新评论 N”和“全部已读”，动作执行期间禁用按钮。

- [ ] **步骤 5：外层圆点与来源提示使用派生状态**

`CommentBookmark` 使用当前 scope 是否存在未读线程；来源选择器继续读取 scope 全局游标，最后一个线程被读后由服务端原子推进保证提示清除。

### 任务 5：实现完整划词手势状态机

**文件：**
- 修改：`src/features/resume-comments/hooks/use-comment-selection.ts`
- 修改：`scripts/verify-resume-comment-client.ts`

- [ ] **步骤 1：用 ref 保存活跃手势和 generation**

```ts
const pointerSelectingRef = useRef(false)
const keyboardSelectingRef = useRef(false)
const generationRef = useRef(0)
const scheduledFrameRef = useRef<number | null>(null)
```

- [ ] **步骤 2：捕获全局指针生命周期**

`pointerdown` / `selectstart` 隐藏按钮并使旧 generation 失效；window 的 `pointerup` / `pointercancel` 结束手势并在两个 animation frame 后评估最终选区。

- [ ] **步骤 3：捕获键盘扩选生命周期**

Shift 与方向键、Home、End、PageUp、PageDown 的组合在 `keydown` 进入选择中，`keyup` 后稳定评估；普通键盘输入不触发。

- [ ] **步骤 4：selectionchange 只在空闲期防抖评估**

活跃手势期间立即清除 selection action；空闲期通过 generation 令牌合并连续事件。最终评估再次检查唯一 range、根节点归属、非折叠和可见矩形。

- [ ] **步骤 5：处理取消生命周期**

`blur`、`visibilitychange(hidden)`、`Escape` 和卸载都取消 frame/timer、递增 generation 并清空按钮。

### 任务 6：部署与综合验证

**文件：**
- 部署：`supabase/migrations/20260816000002_add_resume_comment_thread_read_states.sql`
- 部署：`supabase/functions/resume-comments/index.ts`

- [ ] **步骤 1：部署数据库迁移与 Edge Function**

先迁移数据库，再部署 `resume-comments`，避免新函数读取不存在的表。

- [ ] **步骤 2：运行自动验证**

运行：

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
pnpm exec eslint src/features/resume-comments supabase/functions/resume-comments/index.ts
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

预期：三个 verifier、目标 lint 与构建通过；类型检查不新增本任务错误。

- [ ] **步骤 3：浏览器交互验证**

创建两个未读线程，依次验证：打开面板不清除圆点；点击一个线程只清除该线程高亮；点击最后一个线程清除圆点；新回复使已读线程重新高亮；“全部已读”可一次清除；刷新后状态保持。

- [ ] **步骤 4：验证划词时序**

分别使用鼠标拖选并停顿、拖出根节点释放、触摸选择手柄和 Shift 键盘扩选，确认手势进行中按钮不出现，结束后只显示一次并固定在最终选区。

