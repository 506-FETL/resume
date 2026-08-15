# 评论未读语义与交互动效实施计划

> 设计依据：`docs/superpowers/specs/2026-08-16-comment-notification-and-motion-design.md`

## 任务 1：修复服务端事件语义与本人事件投影

修改 `supabase/functions/resume-comments/index.ts`：

- 增加写操作到领域事件类型的集中映射。
- 为 `list_threads`、`list_events` 返回的事件投影 `is_own`。
- 直接写响应使用领域事件类型并返回 `is_own: true`。
- 幂等 replay 复用首次写入的完整响应组装，但不重复发送实时广播。
- 不修改现有数据库表、策略或 RPC。

## 任务 2：客户端识别本人事件并正确合并未读状态

修改：

- `src/features/resume-comments/types.ts`
- `src/features/resume-comments/api/client.ts`
- `src/features/resume-comments/store/read-state.ts`

实现：

- 归一化 `is_own`。
- 本人创建/回复事件同时推进最新与已读游标。
- 他人创建/回复事件只推进最新游标。

## 任务 3：修复评论面板布局与动画

修改：

- `src/features/resume-comments/components/thread-list.tsx`
- `src/features/resume-comments/components/thread-picker.tsx`
- `src/features/resume-comments/components/comment-surface.tsx`
- `src/features/resume-comments/components/comment-tree.tsx`

实现：

- 评论列表项全宽。
- 锚点选择框增加透明点击层、外部关闭和进出动画。
- 顶层评论与回复列表增加插入/移除动画，并保证第一条回复和新建线程首条评论也会进入动画。

## 任务 4：统一求职跟进指标选中态

修改：

- `src/pages/tracker/components/overview-bar/metric-card.tsx`
- `src/pages/tracker/components/overview-bar/index.tsx`

仅替换桌面与移动选中态为浅色背景、高亮边框和内阴影，不调整尺寸与布局。

## 任务 5：补充自动验证

更新评论客户端、评论服务端及求职跟进相关 verifier，覆盖：

- 本人事件不产生未读，他人事件仍产生未读。
- Function 事件类型映射和 `is_own` 投影。
- 评论全宽、选择框外部关闭/动画、评论新增动画。
- 桌面和移动指标不再使用黑底选中态。

执行：

1. 评论相关专项 verifier。
2. 修改文件目标 ESLint。
3. `pnpm exec tsc --noEmit`。
4. `pnpm build`。
5. `git diff --check`。

## 任务 6：发布并验证 Supabase Function

- 按 `supabase/config.toml` 的现有函数配置部署 `resume-comments` 到项目 `bitxrpdtlohlnywgusfw`。
- 通过 CLI 列表核对远端版本为 `ACTIVE`。
- 对线上端点执行无凭据鉴权门禁探测，确认请求抵达新部署且未绕过鉴权。
- 本次没有数据库结构或 RPC 变更，因此不执行数据库推送。
