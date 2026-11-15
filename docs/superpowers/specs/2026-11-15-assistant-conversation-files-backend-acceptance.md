# 当前对话附件后端验收

日期：2026-11-15。依据[本期设计](2026-11-15-assistant-conversation-files-design.md)和[实现计划](../plans/2026-11-15-assistant-conversation-files.md)。

## 状态

- 后端实施完成：归属、保存去重、关系限制、列表投影与删除入口已接通。
- 本地验证通过：PostgreSQL 17 的 38 项真实 SQL 检查、10 项请求契约检查和 7 项 Edge 处理器检查通过；Deno、局部 ESLint、Prettier 与 diff 空白检查通过。
- 本记录不代表已部署云端，也不代表前端浏览器验收完成。主任务负责部署与联调，并在总验收中记录实际迁移账本、函数版本、真实原件与页面结果。
- 用户审查待进行；没有 commit 或 push。

## 实现与协议

迁移由 `supabase migration new assistant_conversation_files` 创建，文件为 `20261115102101_assistant_conversation_files.sql`。

`experience_sources.conversation_id` 为空表示职业档案，非空表示所属对话。原记录保持空值，不改写现有版本、原件或文字。新增 authenticated 对该列的 SELECT 权限，未授予直接写入权限；账户 RLS 保持不变。

复合外键 `(conversation_id, owner_id)` 指向 `ai_conversations(id, user_id)`，同时约束对话存在和所有者一致。采用 `NO ACTION DEFERRABLE INITIALLY DEFERRED`：单独删除仍有附件的对话会失败；删除 auth 用户时，原有两条级联路径可以一起完成。此选择按 [Supabase 的级联删除说明](https://supabase.com/docs/guides/database/postgres/cascade-deletes)核对，并验证实际数据库行为。

`reserve_experience_source` 只保留一个九参数签名，末尾 `p_conversation uuid default null`。旧八参数调用继续保存职业档案，不留下可能令 PostgREST 解析含糊的重载。新建、同 operation 重试及指定 source 更新都核对保存归属。去重保留原有名称、格式、内容与账户条件，并加入对话范围；同内容在档案、对话 A、对话 B 中分别持久化。

`set_experience_source_relations` 允许职业档案按原规则用于本人会话或简历；对话附件仅能关联所属对话，不能关联其他对话或简历。

Edge 继续使用现有鉴权、私有 bucket、文件识别与删除流程：

- `save` 接收可选 `conversationId`，并传入保存 RPC。共享哈希只在归属非空时加入该字段，旧档案哈希完全兼容。
- `ExperienceSource` 与 `ExperienceSourceMetadata` 返回可选 `conversationId`；`metadata` 继续按 source ID 轻读，不返回正文。
- `list` 固定筛选 `conversation_id is null`，数量与分页使用同一查询。
- 新增 `{ action: 'delete-conversation', conversationId }`，成功返回 `{ deleted: true }`。先确认本人会话，再每批读取至多 100 个附件 ID，通过既有 `begin_delete_experience_source` 与 Storage remove 清理所有版本原件，删除附件记录后才删会话。不会遍历或删除引用的职业档案。
- 会话已不存在时仍返回删除成功，支持成功响应丢失后的重试。查询始终限定 owner，其他账户不会产生删除副作用。原件清理失败返回 `delete_failed` 并保留失败状态；仍在上传返回 `upload_in_progress`；最终外键发现尚有附件返回 `conversation_files_remaining`。

## 验证证据

### 真实 PostgreSQL 17

使用独立 Docker 容器与临时数据库，应用真实的会话、消息、搜索、上下文检查点、auth 级联修复、经历资料、名称去重、文件预览及本次迁移。测试初始化仅提供必要的 auth/storage/resume 依赖表和角色，不冒充完整 Supabase 云端环境。

38 项检查全部通过，覆盖：

- 迁移前已保存 Unicode 版本原值不变；旧八参数保存、既有名称去重及同会话更新版本继续有效。
- 档案/A/B 各自保存；同范围同文同名复用；异名保留各自名称；跨账户不复用。
- 同 operation 重试稳定；哈希改变、伪造相同哈希但换对话、改为职业档案、换指定 source 均拒绝。
- 不存在或不属于本人的对话拒绝新建；跨账户指定来源拒绝；复合外键拒绝错误 owner 直接写入。
- 当前会话可关联自己的附件和档案；其他对话与简历拒绝该附件；职业档案原关联能力保留。
- service_role 和 authenticated 直接删除带附件会话均被真实外键阻止。清完附件后可删会话，引用的职业档案和其他对话保留。
- 上传未收尾不能删除；失败操作进入删除后保留原件路径；delete-failed 再次删除可取得相同路径。
- 图片继续只允许真实零文字、零段落；虚构图片文字与空普通文档被数据库拒绝。
- 单一九参数签名及一项默认值；RPC 仅授予 service_role；新列仅增加 SELECT；RLS 不暴露另一账户资料。
- 使用无业务表权限的 `supabase_auth_admin` 删除测试账户，真实消息检查点触发器与外键级联一起成功；本人业务记录全部清空，另一账户保持。

### 共享契约与 Edge

10 项契约检查直接导入当前解析器、哈希函数，并与 Git 中真实旧版哈希实现比较。验证旧哈希相等、A/B/档案三种哈希不同、同对话哈希稳定、归属输入合法性、删除编号及既有图片/文档约束。

7 项 Edge 检查直接导入真实 `experience-sources/index.ts`，使用真实 Supabase SDK 和处理器；只在 HTTP 传输层提供受控响应以验证删除次序、Storage 失败、上传未完成、最终 FK 拒绝、成功响应丢失重试、list 实际过滤条件及 metadata 轻读字段。这部分没有连接真实云端 Storage，不能替代主任务的线上保存、下载哈希和删除核验。

通过的工程命令：

```text
pnpm dlx deno check --no-config --no-lock --node-modules-dir=none supabase/functions/experience-sources/index.ts
pnpm exec eslint supabase/functions/shared/experience-source-contract.ts supabase/functions/experience-sources/input.ts supabase/functions/experience-sources/index.ts
pnpm exec prettier supabase/functions/shared/experience-source-contract.ts supabase/functions/experience-sources/input.ts supabase/functions/experience-sources/index.ts --check
git diff --check -- supabase
```

已先对改动 TS 文件执行 Prettier 写入和 ESLint layout 修复。最初 Deno 检查沿用项目 node_modules 模式时未解析到 Edge 的 npm 依赖，改用独立 Deno 缓存模式后完整检查通过；未修改项目依赖或锁文件。

## 长期约束与清理

触发场景是助手上传复用了档案保存入口，来源缺少对话归属，导致默认目录、去重和删除都无法区分用途。后续不得只在前端隐藏附件；保存、去重、关系和删除必须继续遵守数据库归属。验证至少覆盖档案/A/B 同字节、operation 重试、跨账户、直接删会话与 auth 级联删除。

临时验收脚本和数据位于 `tests/conversation-files-backend/`，验证后已删除；独立 PostgreSQL 容器已清理。未访问或修改真实用户数据，未停止原有开发服务。
