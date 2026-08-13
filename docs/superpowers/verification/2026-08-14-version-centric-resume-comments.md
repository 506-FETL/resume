# 版本中心化简历评论验证记录

日期：2026-08-14

## 验证口径

- “脚本验证”表示确定性领域逻辑或源码约束已由本地脚本执行并返回 0。
- “静态验证”表示 TypeScript、ESLint、Deno check、生产构建或 diff 检查通过。
- “浏览器交互验证”只记录实际在浏览器完成的操作，不以静态检查代替。
- “真机验收”由产品验收阶段完成；本记录不会把模拟窄屏等同于真机。

## 已由脚本验证

- 评论锚点对正文前插、前文删除、跨句移动保持可定位；缺失和多义匹配进入 detached。
- Unicode grapheme、富文本投影、跨块选区、重叠判定与页面矩形合并。
- 版本 ID 进入分享/协作访问令牌；同版本 Realtime topic 稳定，时间桶轮换。
- 评论写入使用版本级事务入口，递归回复携带 `parentCommentId`，写后返回受影响线程而非强制 list。
- 缓存 key 不包含 access token、release ID 或匿名 secret；跨版本 key 隔离。
- 乐观操作失败能恢复线程、计数和活动状态；重复 event seq 被去重。
- Realtime 序号断档优先拉取增量事件，不直接全量 bootstrap。

执行命令：

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
```

## 已由静态检查验证

- Edge Function：`resume-share` 与 `resume-comments` 通过 Deno check。
- 前端与领域类型通过 `tsc --noEmit`。
- 评论、编辑页和分享页相关文件通过定向 ESLint。
- 生产构建、迁移 dry-run、`git diff --check` 的最终结果在交付前补录。

## 浏览器交互验证

待最终工程检查后执行并补录：桌面编辑页/分享页 Drawer、书签位置、高亮强弱切换、递归回复、快速解决、写入进度反馈。

## 需要真机验收

- iOS Safari 与 Android Chrome 首次打开移动 Drawer 的高度、底部方向和软键盘顶起。
- 安全区、横屏、长评论树和深层“回复详情”的可滚动边界。
- 弱网下匿名首次评论、失败回滚、重连后增量恢复。

## 环境限制

- 当前环境未安装 Docker/Podman，因此未执行本地 `supabase db reset`；迁移会做 linked dry-run 与静态检查，但正式数据库应用仍需部署环境验证。
- 本次不执行生产数据库迁移、Edge Function 部署或远端推送。
