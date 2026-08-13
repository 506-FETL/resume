# 评论已读与移动端嵌套 Drawer 稳定性设计

## 1. 背景与目标

本轮解决六个相互关联的交互稳定性问题：

1. 分享页打开评论后，“有新评论”没有在当前界面消失，刷新后也可能继续出现；
2. 编辑页桌面评论 Drawer 没有像分享页一样让背景变暗；
3. 移动端“调整模块顺序”仍使用 Radix Sheet，并嵌套在 Base UI Drawer 内，打开时可能让仍持有焦点的父 Drawer Portal 被 `aria-hidden`，触发无障碍警告。
4. 移动端分享管理仍使用 Dialog，而不是底部 Drawer；
5. 历史版本提示参与预览布局且视觉上横向铺开，没有固定在视口顶部；
6. Drawer 下滑关闭、正文滚动与旧拖拽 Touch Sensor 竞争，导致首拖失败、不可取消 `touchend` 警告及正文无法滚动。

成功标准：

- 评论面板打开并稳定可见 500ms 后，当前界面的新评论提示立即消失，不依赖刷新；
- 同一浏览器刷新后仍保持已读；登录用户的已读继续同步服务端，供其他设备读取；
- 新评论到达后，如果面板仍处于可见状态，应继续推进到新的事件序号；
- 编辑页与分享页桌面评论统一使用 modal Drawer，背景仅变暗、不模糊；
- 移动端排序层改用项目 `@/components/ui/drawer`，父子 Drawer 使用同一套 Base UI 焦点与嵌套管理；
- 移动端分享管理使用默认 Base UI 底部 Drawer；评论保留默认 Drawer 外观，只额外固定移动端 `60vh`；
- 历史提示固定在视口顶部并按内容宽度收缩，不占正文布局；
- Drawer 正文原生滚动与顶部拖动柄关闭手势分区，编辑、评论、分享、排序均可上下滚动；
- 排序首拖在 Drawer 入场期间即可生效，不再出现焦点或不可取消触摸事件警告。

## 2. 根因证据

### 2.1 已读游标被旧数据回退

`useCommentReadReceipt` 当前只在 `mark_read` 成功后更新 Zustand；`replaceScope` 则无条件用 bootstrap/cache 的 `lastReadEventSeq` 覆盖当前值。当缓存先提供未读数据、用户打开评论并完成 `mark_read`、而更早发出的 bootstrap 较晚返回时，旧游标会覆盖新游标。

远端迁移状态与本地一致，目标版本的用户已读记录也已推进到当前事件序号，说明服务端事务能够落库；当前界面仍显示提示的关键断点在客户端游标合并与缓存更新。

纯匿名浏览者没有服务端 principal，当前 `mark_read` 会失败并被静默忽略。匿名已读因此采用“当前浏览器持久化”：清除浏览器数据或更换设备后可以重新出现提示，不为只读访问者额外创建服务端匿名身份。

### 2.2 编辑页主动关闭了 modal

编辑页 `WorkingResumeComments` 传入 `presentation="docked"`，使桌面 `CommentsPanel` 设置 `modal={false}`，不会渲染 Drawer Overlay。分享页传入 `overlay`，所以背景会变暗。

### 2.3 两套弹层库争夺 aria-hidden 与焦点

移动编辑器本身是 Base UI Drawer；排序层由 `mobile-sort-dialog.tsx` 使用 Radix Sheet。第二套 modal 打开时会把父 Base UI Portal 标为 `aria-hidden`，但触发按钮仍在父 Portal 内持有焦点，因此浏览器阻止该操作并报告警告。

## 3. 已读状态设计

### 3.1 即时反馈

保留 500ms 稳定可见阈值，避免误触即算已读。阈值到达后按以下顺序执行：

1. 立即调用 `markReadLocally(eventSeq)`，当前 Badge 和书签未读点同步消失；
2. 同步写入当前 principal 对应的 localStorage 轻量游标，再异步合并到 IndexedDB bootstrap 缓存；
3. 若存在服务端 principal，则后台调用 `mark_read`：owner/collaborator 总是用户 principal，分享页登录用户使用 user principal，已有匿名评论身份使用 anonymous principal；
4. 无身份的匿名浏览者只保留浏览器缓存，不发送必然失败的服务端请求。

已读写入不显示 Toast。网络失败不撤销当前浏览器已经确认的阅读行为；后续 bootstrap 如果发现本机游标领先服务端，会补偿调用 `mark_read`。

### 3.2 单调合并

同一 `scope.id` 下，`replaceScope` 使用：

```ts
Math.max(state.lastReadEventSeq, input.lastReadEventSeq)
```

切换到不同 scope 时只使用新 scope 自身的输入游标，禁止把旧版本的读状态带过去。

缓存写入也使用有效游标的最大值，并同步更新 `accessibleScopes` 中当前 scope 的 `lastReadEventSeq`。因此以下顺序都不会回退：

- cache → 本地已读 → bootstrap；
- bootstrap → 本地已读 → cache 写回；
- 已读期间 Realtime 又到达新事件。

### 3.3 身份边界

- 登录用户：当前浏览器即时反馈 + localStorage/IndexedDB 持久化 + 服务端跨设备同步；
- 已有匿名评论身份：当前浏览器即时反馈 + localStorage/IndexedDB 持久化 + 服务端匿名 principal 同步；
- 纯匿名浏览者：当前浏览器即时反馈 + localStorage/IndexedDB 持久化；不创建只读身份记录。

缓存键继续按稳定 `versionId + principalKey` 隔离，不包含 access token 或 release secret。

## 4. 评论统一 Drawer 与编辑页遮罩

编辑页和分享页的评论入口始终复用同一个 Base UI `CommentsPanel` Drawer，不得用 Dialog、Sheet、普通侧栏或条件分支替代。仅根据设备改变进入方向：

- 移动端：`swipeDirection="down"`，从底部进入，固定 `60vh`；
- 桌面端：`swipeDirection="right"`，从右侧进入，宽度约 400px。

删除 `presentation` 分支，两类页面无条件使用 modal Drawer：

- Overlay 使用现有 `bg-black/30`；
- 评论专用 `overlayClassName` 保持 `backdrop-blur-none`；
- 打开评论时继续收起编辑面板，关闭后按现有逻辑恢复；
- 移动评论保留 Drawer 默认圆角、边框、阴影和内缩，只额外固定 `60vh`；桌面端仍是默认右侧 Drawer。

## 5. 移动端排序嵌套 Drawer

将 `mobile-sort-dialog.tsx` 替换为 `mobile-sort-drawer.tsx`：

- 使用 `Drawer`、`DrawerContent`、`DrawerTitle`、`DrawerDescription`；
- `modal`、`swipeDirection="down"`、`showSwipeHandle`；
- 作为移动编辑 Drawer 内容树中的受控嵌套 Drawer 渲染，让 Base UI 识别父子关系；
- 内容高度固定为 `min(80dvh, 42rem)`，列表区域 `min-h-0 flex-1 overflow-y-auto`；
- 标题区和底部取消/确认按钮 `shrink-0`，处理底部 safe area；
- 打开时让 Base UI 把焦点移入子 Drawer，关闭时回到原触发按钮；不使用 `preventDefault()` 阻止自动聚焦；
- 排序改用项目已有的 Motion `Reorder` 与 `useDragControls`，仅拖动柄启动指针排序；
- 排序列表和拖动柄加 `data-base-ui-swipe-ignore`，避免和 Drawer 下滑识别竞争；
- 移除旧 `@hello-pangea/dnd` Touch Sensor，保留草稿顺序、取消不写入、确认后以 `basics` 开头写入，并支持键盘上下换序。

父 Drawer 保持打开。子 Drawer 关闭后仍停留在简历编辑面板，不联动关闭父层。

## 6. Drawer 通用滚动与附属界面

`DrawerPrimitive.Content` 统一标记 `data-base-ui-swipe-ignore`：正文区交还浏览器原生滚动，位于 Content 外的顶部拖动柄仍负责下滑关闭。业务滚动容器继续使用 `min-h-0 flex-1 overflow-y-auto`，嵌套 Drawer 关闭后父层滚动立即恢复。

移动快速分享改为默认底部 Drawer，长表单在固定头部下独立滚动。历史审阅提示使用 `position: fixed`、`left: 50%` 和内容宽度卡片，桌面不铺满，移动端受视口最大宽度约束。

## 7. 验证

自动验证：

- Store：同 scope 的较小 bootstrap 游标不能覆盖本地较大游标；切 scope 不串读状态；
- Cache：更新游标后 `lastReadEventSeq` 与当前 scope 摘要都单调递增；
- 源码约束：评论不存在 `presentation` 分支；移动排序不再导入 Sheet 或 hello-pangea，必须使用 Base UI Drawer + Motion；
- `pnpm verify:comment-client`、`pnpm exec tsc --noEmit`、目标 ESLint、`pnpm build`、`git diff --check`。

交互验证：

1. 分享页登录访问：打开评论，500ms 后 Badge 当场消失，关闭再开不恢复，刷新后不恢复；
2. 分享页匿名访问：同一浏览器执行相同步骤；清除站点数据属于新的匿名浏览环境；
3. 编辑页桌面：打开评论后背景变暗但不模糊；
4. 移动端：在编辑 Drawer 内点击“调整模块顺序”，子 Drawer 从底部进入；取消、确认、手势关闭后父 Drawer 保持打开；
5. 全程观察 Console，不出现 `Blocked aria-hidden ... descendant retained focus`。
6. 移动端在排序 Drawer 入场期间执行第一次拖动，顺序当场变化；
7. 编辑、评论、分享、排序四类 Drawer 的滚动容器均能实际推进 `scrollTop`，Console 不出现不可取消 `touchend` 警告；
8. 历史提示桌面按内容宽度固定在视口顶部，返回当前版本后消失。
