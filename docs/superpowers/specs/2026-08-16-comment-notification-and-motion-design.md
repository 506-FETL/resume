# 评论未读语义与交互动效设计

## 背景

评论系统当前存在五个关联问题：作者本人创建评论或回复后仍收到“新评论”提醒；评论列表项没有占满面板；锚点评论选择框无法点击外部关闭且缺少进出动画；新增评论与回复没有进入动画；求职跟进指标选中态在桌面端和移动端误用了黑底样式。

## 目标

- 作者本人创建评论或回复时，本人当前标签页及同一身份的其他标签页都保持已读；其他访问者仍收到未读提醒。
- 评论列表项占满评论面板可用宽度。
- 锚点评论选择框支持点击外部关闭，并具有尊重“减少动态效果”设置的进入与退出动画。
- 新增顶层评论和新增回复均具有轻量进入动画，删除时具有退出动画。
- 求职跟进指标在桌面端与移动端统一为浅色背景、高亮边框和内阴影的选中态。

## 事件语义

Edge Function 将写操作映射为稳定的领域事件：

- `create_thread` → `thread_created`
- `create_reply` → `comment_replied`
- `edit_comment` → `comment_edited`
- `delete_comment` → `comment_deleted`
- `delete_thread` → `thread_deleted`
- `resolve_thread` → `thread_resolved`
- `reopen_thread` → `thread_reopened`
- `relink_anchor` → `anchor_relinked`

Function 在直接写响应、幂等 replay 补全响应、`list_threads` 和 `list_events` 中投影 `is_own`。该字段只表达事件执行者是否等于当前访问身份，不向客户端新增用户标识信息。评论写入 replay 与首次写入共享线程、评论、计数和事件的响应组装；文档同步 replay 加载当前 scope 的完整线程集合以恢复一致客户端状态。所有 replay 都不会重复广播实时失效消息。

客户端把 `is_own` 归一化为 `ResumeCommentEvent.isOwn`。读状态合并规则如下：

- 本人产生的 `thread_created` / `comment_replied`：同时推进 `latestCommentEventSeq` 和 `lastReadEventSeq`。
- 他人产生的上述事件：只推进 `latestCommentEventSeq`，形成未读。
- 编辑、删除、解决等事件不新增评论未读。

数据库现有 RPC 已在创建评论或回复的事务中推进作者的线程已读游标，因此本次不新增数据库迁移。

## 交互与视觉

### 评论列表

列表容器和评论卡片保持 `width: 100%`，避免内容宽度决定卡片宽度。

### 锚点评论选择框

使用覆盖视口的透明点击层承接外部点击；实际面板阻止事件冒泡。面板通过 `AnimatePresence` 与 Motion 完成透明度、轻微位移和缩放动画，退出动画完成后再卸载。

### 新评论动画

顶层评论与递归回复列表分别通过常驻的 `AnimatePresence` 管理。回复级 Presence 不随“是否已有回复”一起卸载，因此第一条回复也能触发进入动画；新建线程的评论树首次展示时同样播放节点进入动画。评论节点继续使用稳定 comment id 作为 key，进入时淡入并轻微上移，退出时淡出；减少动态效果开启时即时展示。

### 求职跟进指标

桌面端与移动端使用同一选中语义：浅色背景、主色高亮边框、内阴影、正常前景文字。只修改选中态，不改变指标尺寸、排列和展开结构。

## 验证边界

- 静态验证覆盖事件映射、本人事件读状态、全宽样式、选择框外部关闭与动画、新评论动画、桌面和移动指标选中态。
- 运行专项 verifier、目标 ESLint、TypeScript、生产构建和 `git diff --check`。
- 部署 `resume-comments` 后核对远端 Function 状态，并执行不包含凭据的鉴权门禁探测。
- 未登录的本地浏览器不能替代多人身份的完整交互验收；最终会明确区分自动验证与真实多人浏览器验证。
