# 简历全文划词评论设计规格

- 日期：2026-08-13
- 主题：resume-full-text-comments
- 状态：已完成头脑风暴并获用户批准
- 范围：编辑器右侧简历画布、历史版本审阅、公开分享页、分享反馈归档
- 关联规格：
  - docs/superpowers/specs/2026-08-11-resume-share-link-design.md
  - docs/superpowers/specs/2026-08-12-resume-share-version-design.md
  - docs/superpowers/specs/2026-08-11-resume-preview-print-consistency-design.md

## 1. 背景

当前编辑器右侧预览与公开分享页都通过 ResumeTemplateRuntime 和统一分页组件渲染简历，但它们是只读运行时，不是一个完整文档编辑器。左侧表单中的部分字段使用 Tiptap，无法覆盖姓名、职位、时间、标题等非富文本字段，因此不能把已有 Tiptap BubbleMenu 或 mark 直接当作全文评论基础。

现有分享使用独立快照：每个链接保存一个脱敏简历快照和模板 Manifest，所有者可在 URL 不变的情况下重新发布当前内容或历史版本。重新发布目前覆盖分享记录中的快照。全文评论要求旧版本评论永久保留，因此必须把“分享链接”与“不可变发布批次”分开。

目标产品形态参考文档类划词评论：

1. 选择简历中的可见文字后出现评论入口。
2. 桌面端使用右侧 Drawer，移动端使用底部 Drawer。
3. 公开分享允许匿名评论；已登录访客使用当前账号身份。
4. 评论严格区分当前工作版本、历史版本和每条分享链接的每次发布批次。
5. 评论与简历正文、快照、PDF 和打印完全分离。

## 2. 目标与成功标准

### 2.1 目标

- 在编辑器右侧最终简历画布和公开分享页提供一致的全文划词评论能力。
- 覆盖所有可见文字，不限于 Tiptap 富文本。
- 支持主评论、单层回复、解决、重新打开、编辑、删除和手动重新关联。
- 支持登录用户与无需填写昵称的匿名访客。
- 支持实时同步、站内未读、分享级评论开关和所有者归档。
- 在当前工作内容变化后安全重定位锚点；无法可靠定位时明确失效，绝不误挂。

### 2.2 成功标准

1. 姓名、标题、时间、普通文本和富文本正文均能建立评论。
2. 单次选区不能跨语义字段、经历条目或分页边界。
3. 桌面端在选区附近出现评论气泡；移动端出现固定底部操作条。
4. 评论 Drawer 能查看未解决、已解决和失去锚点线程。
5. 当前工作版本、历史版本、不同分享链接和不同发布批次的评论互不串联。
6. 同一链接重新发布后，外部只看到新批次；旧批次及评论只对所有者可见。
7. 匿名访客可在原浏览器管理自己的评论；清理浏览器数据后不能恢复管理权。
8. 新评论、回复、解决状态和未读数量实时同步。
9. 字体、缩放、分页和模板布局变化后，高亮仍绑定正确语义文字或进入失效状态。
10. PDF 与打印结果不含高亮、标记、Drawer 或评论内容。

## 3. 已确认产品决策

| 决策点 | 结论 |
|---|---|
| 评论表面 | 编辑器右侧简历画布 + 公开分享页 |
| 桌面形态 | 选区气泡 + 右侧约 400px Drawer |
| 移动形态 | 底部选区操作条 + 可上拉底部 Drawer |
| 全局入口 | 编辑页和分享页均有评论按钮与未读数量 |
| 锚点展示 | 未解决线程低强度常驻高亮，当前线程加强，可临时隐藏 |
| 解决后展示 | 默认隐藏高亮，保留在“已解决”列表 |
| 评论结构 | 一条主评论 + 单层回复；不做嵌套回复 |
| 解决权限 | 简历所有者或主评论作者 |
| 内容格式 | 纯文本、多行、自动识别安全链接 |
| 匿名身份 | 无需登录和昵称，统一显示“匿名用户” |
| 登录身份 | 使用当前账号名称与头像 |
| 匿名管理 | 原浏览器秘密凭证，可编辑/删除自己的内容 |
| 身份认领 | 登录后不自动认领旧匿名评论 |
| 评论可见性 | 同一公开发布批次内，全部访问者可见 |
| 实时性 | 新建、回复、编辑、删除、解决与未读实时更新 |
| 当前工作版本 | 可直接评论，正文变化后重定位或失效 |
| 历史版本 | 独立评论空间；保存历史版本时不复制当前评论 |
| 分享版本 | 绑定具体分享链接的具体发布批次 |
| 不同分享链接 | 即使发布同一简历版本，评论仍不互通 |
| 重新发布 | 新批次评论为空，旧批次只对所有者可见 |
| 删除分享 | 对外失效并转内部归档；永久删除另行确认 |
| 评论开关 | 每条分享链接独立设置，默认开启 |
| 导出 | 评论永不进入 PDF 或打印 |

## 4. 非目标

首版不包含以下能力：

- 图片、文件、富文本格式或 @ 提及；
- 点赞、表情、翻译、举报；
- 邮件、短信或系统推送；
- 跨设备恢复匿名身份；
- 匿名评论自动认领到登录账号；
- 评论跨版本自动复制或迁移；
- 外部访问者切换旧发布版本；
- 带批注 PDF；
- 任意跨字段、跨条目或跨页选区；
- 多层嵌套回复；
- 将评论 mark 写回 Tiptap、HTML 或简历快照。

## 5. 领域模型

### 5.1 评论空间

评论空间是最高隔离边界，类型为：

- working：某份简历的当前工作版本；每份简历唯一。
- history：某个不可变历史版本；每个历史版本唯一。
- share_release：某条分享链接的某次不可变发布批次；每个批次唯一。

所有线程、未读游标和实时订阅都必须带评论空间 ID。客户端不能只凭 resume_id 或 share_id 查询评论。

### 5.2 分享链接与发布批次

分享链接继续负责：

- token / URL；
- 密码；
- 有效期；
- 激活状态；
- allow_comments；
- 当前发布批次指针；
- 归档状态。

发布批次负责：

- 不可变脱敏 snapshot；
- 不可变 template_manifest；
- display_name；
- current/history 来源元数据；
- 批次序号；
- 创建时间和创建者。

同一链接每次“发布所选版本”都创建新批次，即使来源版本相同。创建批次和切换当前指针必须在同一数据库事务中完成。

### 5.3 线程、评论与回复

线程包含：

- 评论空间 ID；
- 语义锚点；
- anchor_status：anchored 或 detached；
- resolved_at / resolved_by；
- last_activity_at；
- 并发版本号 revision；
- deleted_at（仅整线程永久删除流程使用）。

评论记录包含：

- thread_id；
- parent_id：主评论为空，回复指向主评论；
- author_kind：user 或 anonymous；
- author_user_id 或 author_anonymous_id；
- body；
- edited_at；
- deleted_at；
- created_at / updated_at。

回复只允许一个层级。主评论无回复时，作者删除可彻底移除线程；已有回复时主评论变成 tombstone，正文显示“该评论已删除”，回复继续保留。所有者删除整条线程时使用软删除并写入审计事件；永久删除归档时才物理清理。

### 5.4 身份

登录用户以 Supabase auth user ID 为稳定身份。

匿名访客首次打开某条可评论分享时，为该 share_id 单独生成：

- 随机 anonymous_id；
- 256-bit 随机 secret；
- 基于 anonymous_id 的稳定中性头像样式。

浏览器保存 anonymous_id 和 secret。服务端只保存 secret 的摘要，不保存原文。匿名身份不能跨不同分享链接复用，避免服务端或稳定头像把不同评审场景关联起来。所有匿名作者名称统一返回“匿名用户”。登录后新评论使用登录身份，但请求仍可附带旧匿名凭证，以便管理该浏览器以前发布的匿名内容；两种身份不合并。

## 6. 数据模型

### 6.1 resume_share_releases

新增不可变发布表：

- id uuid primary key；
- share_id uuid not null references resume_shares on delete cascade；
- release_no integer not null；
- snapshot jsonb not null；
- template_manifest jsonb not null；
- display_name text；
- source_kind current/history；
- source_version_id bigint null；
- source_version_no / source_version_label / source_version_created_at 冗余来源字段；
- created_by uuid not null；
- created_at timestamptz not null；
- unique (share_id, release_no)。

resume_shares 新增：

- current_release_id uuid；
- allow_comments boolean not null default true；
- archived_at timestamptz null。

本功能迁移不删除既有 snapshot、template_manifest 和来源字段。迁移为每条既有分享回填 release_no = 1 的发布批次并设置 current_release_id；读取链路切换到发布表后，旧快照列不再作为真源。只有生产环境确认全部读取与写入均已使用发布表后，才能通过后续独立迁移删除旧列。

### 6.2 resume_comment_scopes

- id uuid primary key；
- kind working/history/share_release；
- owner_user_id uuid not null；
- resume_id uuid not null；
- history_version_id bigint null；
- share_release_id uuid null；
- anchor_document jsonb not null；
- document_hash text not null；
- document_revision integer not null default 1；
- created_at timestamptz not null；
- archived_at timestamptz null。

数据库检查约束保证三种 kind 只填写对应外键。唯一约束保证：

- 每个 resume_id 只有一个 working scope；
- 每个 history_version_id 只有一个 history scope；
- 每个 share_release_id 只有一个 share_release scope。

anchor_document 只保存 nodeKey、规范化文本和富文本块边界，不保存布局或评论。working 和 history scope 懒创建；share_release scope 与发布批次在同一事务中创建。

### 6.3 resume_comment_threads

- id uuid primary key；
- scope_id uuid not null；
- anchor jsonb not null；
- anchor_status anchored/detached；
- original_page_index integer null，仅用于界面提示，不参与重定位；
- revision integer not null default 1；
- resolved_at / resolved_by_kind / resolved_by_id；
- last_activity_at；
- deleted_at；
- created_at / updated_at。

anchor 必须通过服务端 schema 校验，不能接受任意 JSON。

### 6.4 resume_comments

- id uuid primary key；
- thread_id uuid not null；
- parent_id uuid null；
- author_kind user/anonymous；
- author_user_id uuid null；
- author_anonymous_id uuid null；
- body text not null；
- edited_at / deleted_at；
- created_at / updated_at。

body 去除首尾空白后长度为 1–2,000 个 Unicode 字素簇。数据库约束和服务端均校验作者字段互斥。parent_id 必须指向同一线程的主评论，禁止回复回复。数据库建立部分唯一索引，保证每个 thread_id 最多只有一条 parent_id 为空的主评论。

### 6.5 匿名身份、阅读状态和审计

resume_comment_anonymous_identities：

- id uuid primary key；
- share_id uuid not null；
- secret_hash text not null；
- created_at / last_seen_at；
- revoked_at。

评论服务每次都校验 identity.share_id 与目标发布批次所属 share_id 一致；anonymous_id 不能用于访问其他分享链接。

resume_comment_read_states：

- scope_id；
- principal_kind user/anonymous；
- principal_user_id 或 principal_anonymous_id；
- last_read_event_seq bigint；
- updated_at；
- 每个 scope + principal 唯一。

resume_comment_events：

- scope_id；
- thread_id；
- event_seq bigint；
- type；
- actor；
- sanitized_payload jsonb；
- created_at。

数据库对 (scope_id, event_seq) 建立唯一约束。event_seq 在评论空间内单调递增，用于未读、实时补偿和并发恢复。审计事件至少覆盖创建、编辑、删除、解决、重新打开、重新关联和所有者整线程删除。

## 7. 权限模型

### 7.1 所有者

所有者可以：

- 查看当前工作、全部历史版本、全部分享发布批次和归档；
- 创建、回复、编辑和删除自己的内容；
- 删除任意评论或整条线程；
- 解决、重新打开和重新关联任意线程；
- 管理 allow_comments；
- 归档或永久删除分享及评论。

### 7.2 实时编辑协作者

持有有效现有协作会话的登录用户可以：

- 访问当前 working scope；
- 创建评论、回复、编辑和删除自己的内容；
- 解决、重新打开和重新关联自己发起的线程。

协作者不能查看 history scope、share_release scope、分享反馈或归档，也不能删除他人内容。开始或加入现有实时协作会话时，服务端必须签发绑定 session_id、resume_id、user_id 和 role 的短期协作评论令牌；评论服务只校验该令牌，不能相信客户端自行声明的 role。

### 7.3 分享访问者

访问者必须先通过现有分享链接状态、有效期和密码校验。有效访问会获得短期、仅绑定 share_id + current_release_id 的评论访问令牌。

访问者可以：

- 读取当前发布批次全部未删除评论；
- allow_comments 为 true 时创建主评论或回复；
- 管理自己身份创建的内容；
- 主评论作者可解决、重新打开和重新关联自己的线程。

链接重新发布后，旧令牌因 release_id 不匹配立即失效。旧发布批次不再对外提供读取接口。

### 7.4 评论关闭

allow_comments = false 时：

- 外部仍能读取当前批次已有评论；
- 外部不能创建、回复、编辑、删除、解决、重新打开或重新关联；
- 所有者内部管理权限不变；
- 已打开页面收到实时设置变化后立即进入只读状态，并保留未发送本地草稿。

## 8. 语义锚点

### 8.1 可评论节点

ResumeTemplateRuntime 的所有可评论字段必须暴露稳定语义元数据。节点键由以下信息组合：

- section order key；
- 稳定条目 ID；无持久 ID 的单值字段使用固定 singleton；
- field key。

示例：

- basics / singleton / name；
- work_experience / entry-id / company；
- work_experience / entry-id / duration；
- work_experience / entry-id / content。

模板只决定布局，不能重新定义节点身份。所有模板 renderer 必须使用共享 CommentableText / CommentableRichText 边界，避免各模板自行拼接节点键。

普通字段整体是一个语义块。富文本字段以段落、列表项、标题或引用块作为可选择块；内联粗体、斜体、链接等样式不会拆分可选择块。选区可以跨同一块内的多个 DOM Text 节点，但不能跨两个富文本块。持久 nodeKey 保持在字段级，blockOrdinal 只用于快速定位和选区合法性检查，不作为跨编辑稳定身份。

### 8.2 AnchorSchema

锚点保存：

- nodeKey；
- startGraphemeOffset；
- endGraphemeOffset；
- blockOrdinal；
- exactQuote；
- prefix：最多 32 个 Unicode 字素簇；
- suffix：最多 32 个 Unicode 字素簇；
- nodeTextHash；
- createdAtContentHash。

字段文本先规范化为 NFC，再使用 Intl.Segmenter 的 grapheme 粒度建立 DOM Text offset 与字素偏移的双向映射。exactQuote 长度必须大于 0，startGraphemeOffset < endGraphemeOffset。选区必须完全位于同一 nodeKey 和同一富文本块。跨节点、跨富文本块、跨条目或跨页选区直接拒绝。

### 8.3 重定位

工作版本内容变化时按固定顺序重定位：

1. nodeKey 存在，原字素偏移仍等于 exactQuote：保持锚点。
2. 在同一 nodeKey 内查找 exactQuote，只有一个候选且 prefix/suffix 一致：更新字素偏移和 blockOrdinal。
3. 只有一个 exactQuote 候选但上下文变化：允许恢复，但记录低级 anchor_moved 事件。
4. 没有候选或多个候选：anchor_status = detached。

禁止跨 nodeKey、跨条目或全简历模糊匹配。系统不以文本相似度猜测锚点。

### 8.4 手动重新关联

所有者或主评论作者在当前目标空间选择新的合法文字后，可执行“重新关联”。操作要求提交线程 revision；服务端成功后：

- 替换 anchor；
- anchor_status 恢复 anchored；
- revision + 1；
- 写入 anchor_relinked 审计事件；
- 保留主评论和全部回复。

### 8.5 权威锚点文档与工作版本重定位

共享纯函数 buildCommentAnchorDocument 从结构化简历数据生成字段级 nodeKey、NFC 文本和富文本块边界。历史版本和分享发布批次创建 scope 时只生成一次；working scope 在简历内容成功同步后更新。

working scope 更新使用 document_revision 做比较并交换：

1. 编辑器同步成功后提交新的 anchor_document、document_hash 和 expected_document_revision。
2. 服务端在同一事务中更新文档、执行全部未解决锚点的确定性重定位并生成事件。
3. 多个客户端同时提交时，只有 revision 匹配者成功；失败者拉取最新文档，不重复覆盖。
4. 未同步的本地编辑只生成临时高亮投影，不直接修改服务端 anchor_status。
5. 在未同步内容上创建评论时，客户端先同步工作版本及 anchor_document；同步失败则保留评论草稿，不把评论写入过期文档。

创建线程和重新关联都必须携带 document_hash。服务端只接受与目标 scope 当前 document_hash 一致的锚点，从而避免选区来自 V1、线程却落到 V2。

## 9. 分页、高亮与打印

CanonicalPagedDocument 会在不同页面的裁剪容器中重复渲染内容。评论层必须：

1. 从用户实际选择的可见 data-resume-page 解析 nodeKey；
2. 只对该页面可见副本调用 Range.getClientRects；
3. 把视口坐标转换到当前页面的评论 Overlay；
4. 在分页完成、字体加载、缩放、ResizeObserver 更新、版本切换后重新计算；
5. 过滤被 overflow 裁剪到页面外的矩形。

高亮使用独立绝对定位 Overlay，不向正文插入 span 或 mark。默认样式：

- 未解决：低透明度暖黄色背景 + 细下边线；
- 当前线程：提高背景和边线对比度；
- 重叠锚点：合并几何高亮，点击后显示线程选择器；
- 已解决和 detached：不在画布绘制。

评论层不挂载到测量 source、打印 DOM 或 PDF 导出容器。print media 下额外强制隐藏评论 UI，形成双重保护。

## 10. 交互设计

### 10.1 桌面端

- 合法选区完成后，在选区附近显示“评论”气泡。
- 点击后展开右侧 400px Drawer。
- 可用宽度足够时为 Drawer 预留空间；不足时覆盖右侧。
- 点击已有高亮直接打开线程。
- Esc 先关闭临时气泡，再关闭线程详情；不删除草稿。

### 10.2 移动端

- 使用浏览器原生长按选区，不替换系统复制菜单。
- 合法选区后在底部显示“已选择 N 个字 + 评论”操作条。
- 点击后打开底部 Drawer，提供约 56% 和 92% 两个 snap point。
- Drawer 打开时保留画布滚动位置；关闭后回到原锚点。
- 不复用桌面浮动气泡，避免与原生菜单和选区手柄冲突。

### 10.3 全局 Drawer

全局评论按钮在编辑页和分享页可见，展示当前可访问上下文的未读数。

编辑器来源：

- 当前工作版本；
- 历史版本；
- 分享反馈；
- 已归档分享。

分享页只显示当前发布批次。

状态筛选：

- 未解决；
- 已解决；
- 失去锚点。

未解决列表按文档节点顺序和锚点起点排序，detached 单独列出；分享反馈来源按最后活动时间倒序。选择历史版本或分享反馈时，画布切换到对应不可变快照的只读审阅模式；退出后恢复当前工作版本和原编辑状态。

### 10.4 新建与重叠

- 完全相同 nodeKey + startGraphemeOffset + endGraphemeOffset 的未删除线程存在时，不创建新线程，直接打开原线程。
- 部分重叠允许新建线程。
- 点击重叠高亮时显示引用、作者和最近活动，供用户选择目标线程。
- 关闭 composer 且未发送时不创建空线程。
- 发送成功后清除选区和本地草稿。

### 10.5 线程操作

- 主评论和回复支持编辑，编辑后显示“已编辑”。
- 主评论作者和所有者可解决/重新打开。
- 解决后默认隐藏高亮并进入“已解决”列表。
- 重新打开后恢复高亮。
- detached 线程展示原引用和原语义字段名称，并提供重新关联入口。

## 11. 实时同步与未读

数据库和 resume_comment_events 是真源，Realtime 只承担低延迟通知：

1. 写操作成功提交数据库事务；
2. 生成单调 event_seq；
3. 广播脱敏事件；
4. 客户端按 event_seq 增量应用；
5. 发现序号缺口、断线重连或 schema 版本不匹配时重新拉取。

公开频道必须使用服务端签发、有效期 15 分钟的短期评论访问令牌，不能使用可枚举 scope_id 直接订阅。令牌只允许当前发布批次；链接重发、关闭、过期、归档或密码变更后，服务端不再续签，已签发令牌最迟 15 分钟失效。客户端每 60 秒重新校验分享状态，使关闭评论和归档能更快转为只读或不可用。

未读规则：

- 自己产生的事件不计入自己的未读；
- 新主评论对所有者计未读；
- 回复对所有者、主评论作者和已参与线程的其他身份计未读；
- 重新打开对所有者和线程参与者计未读；
- 删除、解决和编辑更新列表，但不单独增加未读；
- 线程进入 Drawer 可视区域并稳定显示后推进 last_read_event_seq；
- 所有者在编辑器和分享管理页看到跨分享反馈汇总；
- 匿名阅读状态绑定 anonymous_id，只在原浏览器恢复。

## 12. 服务端接口边界

新增 resume-comments Edge Function，按 op 分支处理：

- create_anonymous_identity；
- bootstrap_scope；
- sync_working_document；
- list_threads；
- create_thread；
- create_reply；
- edit_comment；
- delete_comment；
- delete_thread；
- resolve_thread；
- reopen_thread；
- relink_anchor；
- mark_read；
- issue_realtime_token。

所有写请求必须携带：

- scope 或 share token；
- actor 凭证；
- 客户端 request_id，保证幂等；
- 线程变更携带 expected_revision；
- 创建线程与重新关联携带当前 document_hash；
- share_release 写请求携带预期 release_id。

错误响应使用稳定错误码：

- unauthorized；
- share_unavailable；
- comments_disabled；
- stale_release；
- stale_document；
- stale_revision；
- invalid_selection；
- anchor_detached；
- rate_limited；
- content_too_long；
- not_found；
- unexpected。

stale_release、stale_document 和 stale_revision 必须返回可恢复提示，客户端保留草稿并重新拉取，不能静默重试到另一个版本。

## 13. 防滥用与安全

### 13.1 初始限流

初始服务端限流值：

- 登录身份：每分钟最多 30 次评论写操作；
- 匿名身份：每分钟最多 10 次评论写操作；
- 同一网络来源 + 分享链接：每分钟最多 30 次评论写操作；
- 同一线程：同一身份 10 秒内最多 5 次写操作；
- 超限后阻止 60 秒，并返回 retry_after_seconds。

网络来源只保存带服务端 pepper 的哈希，不保存原始 IP。限流记录不向客户端暴露。

### 13.2 内容安全

- body 始终按纯文本存储和渲染；
- 自动链接只允许 http、https 和 mailto；
- 禁止 javascript、data 和自定义协议；
- React 渲染不使用 dangerouslySetInnerHTML；
- 服务端再次执行长度、控制字符和协议校验；
- 实时事件只返回渲染所需字段，不返回 secret_hash、内部限流键或私有用户信息。

### 13.3 访问控制

- 评论表启用 RLS，但不向 anon/authenticated 直接授予读写权限；
- 公共分享读写统一经 Edge Function service role；
- 所有者内部查询必须同时校验 owner_user_id；
- 历史版本和归档永不通过公开 token 读取；
- 分享密码验证成功后签发短期访问凭证，评论接口不重复接收明文密码。

## 14. 分享迁移与归档

实施顺序必须保证兼容：

1. 创建 resume_share_releases 和评论领域表。
2. 为 resume_shares 增加 current_release_id、allow_comments、archived_at。
3. 为每条现有分享回填 release_no = 1。
4. 校验所有非归档分享都有 current_release_id。
5. 更新 owner 管理接口和匿名读取接口，从 current release 读取快照。
6. 更新重新发布逻辑为“创建 release + scope + 切换指针”的原子 RPC。
7. 最后启用评论入口。

归档分享时：

- archived_at 写入；
- is_active 置 false；
- 外部访问与评论令牌失效；
- release、scope、thread 和 comment 保留；
- 所有者内部仍可读取。

永久删除必须在单独确认操作中级联删除分享、发布批次、评论空间、线程、评论、事件和阅读状态。UI 明确提示不可恢复。

永久删除历史版本时，确认界面必须明确说明该版本的内部评论也会删除。删除操作级联清理对应 history scope、线程、评论、事件和阅读状态。由该历史版本创建的分享发布批次保存独立快照和独立评论空间，不受历史版本删除影响。

## 15. 异常与并发

- 发布过程中评论提交：写请求携带 release_id；指针已切换则返回 stale_release。
- 评论开关关闭：外部页面实时转为只读；草稿保留在本地。
- 网络中断：不后台无限重试写操作；保留草稿，恢复后先同步事件。
- 重复发送：request_id 在 actor 范围内唯一，服务端返回首次结果。
- 并发编辑线程：expected_revision 不匹配返回 stale_revision。
- 匿名凭证丢失：仍可读取公开评论，不能管理旧匿名内容。
- 模板变化导致 nodeKey 不存在时标记为 detached；nodeKey 仍存在但分页或几何计算暂时失败时只显示“暂时无法定位”，不改变 anchor_status，也不阻塞评论列表。
- 来源历史版本删除：发布批次快照和评论不受影响；所有者仍可审阅。
- 历史版本删除：对应 history scope 和内部评论一并永久删除，不转入归档。
- 分享归档期间页面仍打开：下一次心跳、实时设置事件或写请求使页面进入不可用/只读状态。

## 16. 状态与代码边界

评论能力作为共享领域模块，而不是塞入 Tiptap 或某个页面：

- src/features/resume-comments/
  - components/：气泡、移动操作条、Drawer、线程、筛选、高亮 Overlay；
  - hooks/：选区解析、几何计算、实时订阅、未读；
  - store/：Zustand 领域状态，按 scope 隔离 threads、selection、draft、connection；
  - anchors/：AnchorSchema、node key、重定位和重叠判断；
  - api/：Edge Function 请求与领域映射；
  - types.ts / const.ts / utils.ts。

共享简历 Runtime 只承担：

- 暴露稳定 comment node 元数据；
- 提供评论 Overlay 挂载边界；
- 不直接读取评论 store 或调用后端。

编辑页和分享页分别提供：

- 当前 scope；
- 当前 actor 权限；
- Drawer 容器；
- 版本/发布批次切换；
- 全局未读入口。

Composer 输入、临时菜单和 Drawer snap 状态使用组件本地状态；跨组件线程、未读、当前 scope、实时状态和草稿使用 Zustand。不得通过 ResumeTemplateRuntime 多层 prop 传递完整评论列表。

## 17. 验证方案

仓库当前没有统一测试脚本，因此不要求 TDD，也不引入大型测试框架作为本功能前置条件。验证分为：

### 17.1 静态验证

- pnpm exec tsc --noEmit；
- 对新增和修改文件执行定向 ESLint；
- pnpm build；
- git diff --check。

### 17.2 纯逻辑验证

用可重复执行的小型 TypeScript 验证脚本覆盖：

- nodeKey 构造；
- DOM offset 与 Unicode 字素偏移转换；
- 唯一 quote 重定位；
- 重复文本失效；
- anchor_document 构造与 document revision 冲突；
- 跨节点选区拒绝；
- 完全相同与部分重叠判断；
- 权限矩阵；
- 未读 event_seq 推进。

### 17.3 数据与接口验证

在本地 Supabase 或隔离测试项目验证：

- 既有分享回填；
- release + scope + 指针原子切换；
- 不同链接、不同 release、不同 history scope 隔离；
- 旧 release 令牌失效；
- allow_comments 只读；
- 匿名 secret 摘要校验；
- request_id 幂等；
- expected_revision 冲突；
- 归档与永久删除；
- 删除历史版本时级联删除 history scope，但保留独立 share release；
- 限流 RPC。

### 17.4 浏览器与真实设备验证

必须区分静态通过与真实交互通过。至少验证：

- 桌面 Chromium：选区气泡、右侧 Drawer、重叠线程、多窗口实时；
- iOS Safari：原生长按、底部操作条、底部 Drawer、匿名管理；
- Android Chrome：同上；
- 768px 断点两侧；
- 单页和多页简历；
- 缩放小于 1；
- 内置和自定义模板；
- 中文、英文、emoji 和组合字符；
- 字体加载前后、窗口 resize、重新分页；
- 打印预览和 PDF 无评论层；
- 密码分享、关闭评论、重新发布、归档中的已打开页面。

只有真实设备或等价浏览器自动化确认后，才能声称移动端交互可用。

## 18. 验收清单

1. 编辑页和分享页均能对同一语义块内的任意可见文字评论。
2. 非法跨块选区有提示且不创建空线程。
3. 桌面与移动入口符合已批准的响应式形态。
4. 全局入口、未读、筛选、隐藏高亮正常。
5. 完全相同选区复用线程，部分重叠可独立创建。
6. 已解决、重新打开、删除 tombstone 和手动重新关联符合权限。
7. 当前内容变化只在同一语义节点内重定位，歧义进入 detached。
8. 历史版本不继承当前评论。
9. 不同分享链接和不同发布批次严格隔离。
10. 重新发布后旧外部评论不可访问，所有者内部可审阅。
11. 删除历史版本会同步删除其内部评论，但不影响独立分享发布批次。
12. 匿名、登录、所有者和协作者权限矩阵无越权。
13. allow_comments 关闭后外部只读。
14. 实时断线恢复不丢数据、不重复写。
15. 限流和纯文本安全规则生效。
16. 分享归档保留内部评论，永久删除明确且可验证。
17. PDF 和打印永远不包含评论 UI。

## 19. 实施拆分建议

本功能涉及分享数据迁移、语义锚点、公共权限、实时评论和双端交互，不能作为一个无检查点的大改动。实现计划应拆为：

1. 发布批次与迁移基础；
2. 评论领域表、权限和 Edge Function；
3. Runtime 语义节点与锚点纯逻辑；
4. 桌面评论层与 Drawer；
5. 分享匿名身份、访问令牌和实时；
6. 移动端操作条与底部 Drawer；
7. 所有者版本审阅、分享反馈和归档；
8. 完整验证、兼容与文档。

每个阶段都必须保持现有分享读取、编辑器预览和 PDF 导出可用。
