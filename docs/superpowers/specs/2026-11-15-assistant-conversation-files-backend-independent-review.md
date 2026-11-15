# 当前对话附件后端独立审查

日期：2026-11-15。对应 [设计](2026-11-15-assistant-conversation-files-design.md)。结论：本次只读审查没有发现确定的 P1 / P2 问题。

## 实际范围

审查了 `20261115102101_assistant_conversation_files.sql`、`experience-sources/index.ts`、`input.ts`、共享契约，并沿调用链读取原资料表和 reserve / finish / begin_delete / relations 函数、会话 RLS、认证函数与检查点 auth 级联修复。没有修改生产代码，没有操作云端或启动、停止服务；尚在修改的前端不属于本次审查范围。

## 已核对的边界

| 关注点         | 代码依据与结论                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 账户与对话归属 | Edge 使用认证后的 userId 作为 owner；reserve 核对目标对话 owner，复合外键再次约束 `(conversation_id, owner_id)` 与对话身份一致。新增操作没有接受客户端 owner 字段。                                                                  |
| 旧八参数调用   | 旧函数删除后仅保留九参数签名，最后一个参数默认 null；旧档案调用仍落到 null 范围，不产生重载歧义。                                                                                                                                    |
| 去重与更新     | 新建查找同时比较 owner、字节 hash、格式、名称、当前版本及对话范围；指定来源更新和已有操作恢复都校验原来源范围，不能通过 sourceId 改归属。                                                                                            |
| 操作重试       | 非空 conversationId 进入请求 hash；同一 operationId 的 hash 不符被拒绝，已有操作的 source 范围也再次校验。无 conversationId 时保持旧 canonical 内容。                                                                                |
| 关系写入       | 目标先校验 owner；对话附件只允许关联原对话，不能关联另一对话或简历；`conversation_id is null` 的职业档案仍可按原方式复用。函数继续仅授予 service_role 执行。                                                                         |
| 列表与读取     | 库 list 与 count 都限定 conversation_id 为空；metadata 返回归属供运行范围核对。原文、下载、operation、rename、delete 与 search 继续检查 owner，未新增跨账户直读入口。                                                                |
| 删除失败与重试 | begin_delete 保留所有版本和 operation 的原件路径；Storage 删除失败保留来源元数据并中断对话删除。重试可重新获取路径，处理完附件才删除会话；职业档案不在此删除查询内。                                                                 |
| 保存与删除交错 | 现有近期 pending 操作阻止开始删除；已进入 deleting / delete-failed 的来源拒绝完成写入。最后一步若出现新附件，外键使会话删除失败并返回可重试错误，不静默遗失附件归属。                                                                |
| auth 级联      | 新外键为 deferred NO ACTION，原来源 owner 和会话 user 都对 auth.users 使用 CASCADE；定义允许账户删除的两条级联在提交前一起完成，同时仍阻止单独留下附件的会话删除。检查点触发器继续沿用原 SECURITY DEFINER 修复，未扩大普通角色权限。 |

直接原文和下载入口以账户拥有权为边界；同账户不同对话的模型可用范围还依赖前端运行入口与工具中的归属核对。本审查没有将后端 owner 校验等同于已经完成前端范围验收。

## 独立执行的检查

在 Node 24 中直接导入当前共享契约和入口解析器；旧 hash 实现从 HEAD 读取并由仓库已有 TypeScript 转译后执行，没有抄写业务逻辑。14 项检查全部通过，命令退出码为 0：

- 旧档案新增、指定 source 更新两种请求的当前 hash 与旧实现完全相同。
- 同一载荷的档案、对话 A、对话 B 得到不同 hash，同对话重试 hash 稳定。
- 旧 save 无新增必填参数；有效 conversationId 被保留；delete-conversation 正确解析。
- 空字符串、非 UUID、null、数组、对象及缺失删除编号均被入口拒绝。
- 额外 owner 字段不进入解析结果。

所审 Edge 变更的 `git diff --check` 通过。测试文件执行过 Prettier 与 ESLint layout 修复，验收结束后已删除 `tests/assistant-conversation-files-review/`。

## 验收限制

本次没有独立执行数据库迁移、PG17 隔离场景、Deno check、真实 Storage 故障注入或云端部署，也没有将实现者报告的 38 项数据库检查算作自己的执行结果。数据库实测、原件删除重试、线上权限拒绝及部署账本仍以主任务的对应证据为准。本记录不代替前端集成和用户审查。
