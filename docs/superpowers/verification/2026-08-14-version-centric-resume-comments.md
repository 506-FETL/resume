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
- 性能观测按目标值与慢请求阈值分级：正常/轻微抖动写入浏览器 Performance Timeline，只有真正超过慢请求阈值才使用 warn；`Server-Timing` 会拆出鉴权、权限解析、线程、已读状态、版本和客户端额外等待。
- 缓存读取与网络 bootstrap 并行启动，缓存晚于网络时不会覆盖新数据；IndexedDB 依赖改为静态加载，bootstrap 复用线程结果计算计数并减少一次数据库往返，已有版本作用域减少一次重复读取。
- 评论列表卡片的主点击区域与“解决/查看回复”快捷按钮是同级交互，不再出现 `<button>` 嵌套导致的 hydration 警告。

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
- 生产构建通过；Vite 仅保留仓库既有的 chunk size 提示。
- linked migration dry-run 返回 0；远端已由外部流程依次应用 `20260814000001` 与前向兼容迁移 `20260814000002`，最终 dry-run 返回 up-to-date。本次代理只执行检查，没有主动执行写入。
- `git diff --check` 通过。
- 全仓 `pnpm exec eslint .` 仍会被旧文档、生成文件和未触及模块中的约 1,879 个既有问题阻断；本次改动范围的定向 ESLint 已通过，未把既有基线问题混入本次修复。
- `src/components/ui/drawer.tsx` 命中仓库既有 ignore 规则；强制 `--no-ignore` 会暴露该上游组件全文件 50 个既有格式问题，类型检查与生产构建均覆盖了本次新增导出。

## 浏览器交互验证

- 在本地开发服务完成未登录首页和“我的简历”页面的启动、加载与导航检查；未复现 `Maximum update depth exceeded`。
- 当前内置浏览器没有登录态，本机也没有可复用的 Chrome/浏览器扩展会话，因此没有声称已完成在线简历评论主链路的真实交互验证。
- 登录态实际测试暴露的 CORS 预检问题已定位为共享白名单遗漏 `x-request-id`；客户端已停止发送该非必要自定义请求头，现有远端白名单的 OPTIONS 实测可通过；共享 CORS 与回归断言也已补齐，后续部署后支持其他追踪调用方。
- 移动端实际测试暴露的 `DrawerVirtualKeyboardProvider` 上下文错误已修正：Provider 现在位于 `Drawer.Root` 内部，并由源码约束验证组件嵌套顺序。
- 桌面编辑页/分享页 Drawer、书签位置、高亮强弱切换、递归回复、快速解决、写入进度反馈留给登录态下的最终人工验收。
- 未登录首页会记录一条既有“加载首页最近动态失败：用户未登陆”日志，与评论模块无关，未纳入本次范围。

## 需要真机验收

- iOS Safari 与 Android Chrome 首次打开移动 Drawer 的高度、底部方向和软键盘顶起。
- 安全区、横屏、长评论树和深层“回复详情”的可滚动边界。
- 弱网下匿名首次评论、失败回滚、重连后增量恢复。

## 评论视觉精修增量验证

本轮源码约束与静态检查已确认：

- 评论面板使用领域专用媒体查询；小于 768px，或 1024px 内无 Hover 的粗指针设备统一使用底部 `swipeDirection="down"` Drawer，编辑页与分享页共用同一实现。
- 移动端评论 Drawer 使用固定 `92dvh` 高度；头部、筛选栏和回复输入区禁止压缩，列表、空状态、评论树与新建评论区在剩余高度内滚动，筛选或详情切换不再依赖内容固有高度。
- `DrawerContent` 仅为评论面板覆盖 Overlay 的 `backdrop-blur`，半透明遮罩仍保留，其他 Drawer 默认样式不变。
- 评论书签收敛为约 36×40px、16px 图标和轻阴影。
- 编辑页桌面与移动布局都在历史评论来源下显示持续可见的只读审阅条，并提供“返回当前版本”动作。
- 评论树主视图最多展示三层，头像主干线和圆角支线使用随层级递增的坐标；第 3 层后代进入路径栈详情，返回只弹出一层。
- 子回复轨道始终以当前内容盒内的头像中心为原点，避免嵌套层重复偏移；相邻线段在盒子边界重叠 1px，避免抗锯齿产生断缝。
- 评论 Drawer 关闭时不再向高亮层传递 active/hovered ID，并忽略关闭态 Hover 写入，避免强高亮反弹。
- 新增源码回归断言覆盖移动 Drawer、无模糊 Overlay、小书签、审阅条、三层树、路径栈与关闭态弱高亮。

本轮执行并返回 0：

```bash
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
pnpm exec tsc --noEmit
pnpm exec eslint scripts/verify-resume-comment-client.ts src/features/resume-comments/components/comment-bookmark.tsx src/features/resume-comments/components/comment-surface.tsx src/features/resume-comments/components/comment-tree.tsx src/features/resume-comments/components/comments-panel.tsx src/features/resume-comments/hooks/use-comment-mobile-layout.ts src/pages/resume/editor/index.tsx src/pages/resume/editor/components/comment-review-banner/index.tsx
pnpm build
git diff --check
```

生产构建仍只有仓库既有的 chunk size 提示。上述结果证明领域逻辑、源码约束、类型与构建成立，不代替以下登录态交互验收：iOS/Android 首次开启的底部方向与高度、三层连接线实际视觉、逐层钻取与返回、历史版本切换时编辑面板恢复、关闭 Drawer 后强弱高亮状态。

## 环境限制

- 当前环境未安装 Docker/Podman，因此未执行本地 `supabase db reset`；迁移会做 linked dry-run 与静态检查，但正式数据库应用仍需部署环境验证。
- 远端 `20260814000001` 与 `20260814000002` 在本次验收过程中由外部流程应用；代理没有执行数据库 push。
- 本次不执行 Edge Function 重新部署或 Git 远端推送。
