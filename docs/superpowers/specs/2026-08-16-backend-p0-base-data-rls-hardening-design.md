# 后端 P0 基础数据 RLS 收敛设计

## 背景与风险证据

在为“空库可重放”设计基线时，对线上 `public` schema 的 RLS 策略做了只读盘点，发现原风险清单未覆盖的 P0 数据越权面。相关表虽然启用了 RLS，但历史策略以 permissive 方式叠加，任意一条宽松策略成立就会放行：

- `resume_config` 存在面向 `PUBLIC` 的 `SELECT true`，以及面向 `authenticated` 的 `ALL USING true WITH CHECK true`。
- `resume_config_versions`、`ats` 存在公开读取与只校验“已登录、不校验 user_id”的插入策略。
- `automerge_documents` 存在 `anon/authenticated` 任意读取、插入和更新策略。
- `resume_templates` 的公开读取没有限制 `visibility/status`，且登录用户可按 `DELETE true` 删除任意模板。
- 这些宽松策略与看似正确的 owner 策略同时存在；RLS permissive 语义不会选择“更严格的那条”，而是用 OR 合并。

当前前端虽然普遍在查询中附加 `.eq('user_id', user.id)`，但客户端过滤不是授权边界。攻击者可以绕过前端直接调用 Data API。

## 目标

- 浏览器角色只能读写当前 `auth.uid()` 拥有的简历、版本、ATS、求职记录和 Automerge 文档。
- 匿名或其他登录用户允许的第一类跨用户访问，是通过分享链接读取该次发布的不可变简历快照，并凭分享评论令牌读写该分享范围内的评论。
- 第二类跨用户访问是实时协作：任何持有效协作链接的登录用户都可加入该会话，默认以 editor 身份编辑该会话绑定的单份 Automerge 简历并读写其评论域；链接不能扩展为 owner 其他简历、历史版本、ATS、公司、模板或账户数据的读取能力。
- 分享快照/评论只能走 `resume-share` / `resume-comments` Edge Function；实时文档经会话绑定的协作传输层同步，协作者评论仍走 `resume-comments`。浏览器角色不能借任一路径直连 owner 基础表或评论表。
- 用户模板和其他基础数据一样只能由 owner 读取和写入；`published` 不再自动构成跨用户读取授权。
- 关联数据写入同时验证父资源归属，不能把自己的 ATS、版本、公司或 Automerge 行挂到他人的简历。
- 删除所有重复、含糊和无条件放行的历史策略，每个角色/操作只保留必要的显式策略。
- 不改变 service-role Edge Function 的既有能力，不让公开分享依赖基础表的匿名直连。

## 非目标

- 本设计不修改分享、评论表的服务端专用 RLS 模型；这些表继续由 Edge Function 和 service-role RPC 管理。
- 不在本批次重构前端数据访问层；现有 `.eq('user_id', ...)` 继续保留为查询缩小条件和纵深防御。
- 现有社区模板跨用户浏览入口会随权限收敛停止返回其他用户模板；若以后恢复，必须作为新的显式分享边界单独设计，不能复用宽松基础表策略。
- 不依赖 CORS 阻止越权；RLS 是独立于浏览器来源的数据库授权边界。

## 方案比较

### 方案 A：只删除最明显的 `true` 策略

改动快，但容易遗漏重复策略、角色继承和缺失的 `WITH CHECK`。未来再新增 permissive 策略时也可能悄悄重新打开越权路径。

### 方案 B：逐表清空历史策略并按访问矩阵重建（采用）

对六张基础表显式删除全部已知历史策略，重建单一来源的角色/操作策略，同时重设表与序列 grants。配套两用户越权契约测试和 catalog 静态检查。这是可审计、可重复且最不容易留下组合漏洞的方案。

### 方案 C：全部浏览器数据访问迁移到 Edge Function

安全边界集中，但会大幅改写当前表单、历史、ATS、Tracker、模板和 Automerge 路径，增加延迟与回归面。现有用例适合使用正确的 RLS，不需要为修复策略而重写全部数据层。

## 访问矩阵

| 表 | `anon` | `authenticated` | `service_role` |
| --- | --- | --- | --- |
| `resume_config` | 无权限 | 仅本人 SELECT/INSERT/UPDATE/DELETE | 保留全权限 |
| `resume_config_versions` | 无权限 | 仅本人；写入时父简历也必须属于本人 | 保留全权限 |
| `ats` | 无权限 | 仅本人；写入时 `resume_id` 必须属于本人 | 保留全权限 |
| `automerge_documents` | 无权限 | 仅本人；`resume_id` 必须属于本人 | 保留全权限 |
| `company` | 无权限 | 仅本人；非空 `resume_id` 必须属于本人 | 保留全权限 |
| `resume_templates` | 无权限 | 仅本人 SELECT/INSERT/UPDATE/DELETE | 保留全权限 |

所有 owner 判断统一使用 `(select auth.uid()) = user_id`。INSERT 与 UPDATE 均使用 `WITH CHECK`，避免用户把 `user_id` 或父资源改为他人。UPDATE 同时包含 `USING` 和 `WITH CHECK`。

## 父资源一致性

仅比较子表 `user_id` 不足以阻止跨租户关联污染，因此写策略增加以下约束：

- `resume_config_versions.resume_id` 必须命中同一用户的 `resume_config.resume_id`。
- `ats.resume_id` 必须命中同一用户的简历。
- `automerge_documents.resume_id` 必须命中同一用户的简历。
- `company.resume_id` 为 NULL 时允许；非 NULL 时必须命中同一用户的简历。

父表 EXISTS 查询使用索引列 `resume_config.resume_id` 与 `user_id`。当前 `resume_id` 已唯一，必要时补充 `(user_id, resume_id)` 索引以让 RLS predicate 保持稳定性能。

## Grants 与序列权限

安全迁移先从 `anon` 与 `authenticated` 撤销六表全部权限，再按访问矩阵显式授予所需操作。这样即使 RLS 策略未来误配，未授权角色也没有表级入口。

带 identity 的表只向 `authenticated` 授予实际插入所需序列权限；`anon` 不获得序列访问。触发器函数撤销 `PUBLIC/anon/authenticated` 的直接 EXECUTE，但触发器本身仍可执行。

`resume_shares`、不可变 `resume_share_releases` 和评论域不是这六张 owner 基础表的公开 RLS 例外。匿名分享读取由 `resume-share` 使用 service role 解析有效分享、密码和发布批次后返回最小快照；评论读写由 `resume-comments` 验证短期签名访问令牌后调用 service-role RPC。相关底层表继续不给 `anon/authenticated` 直连权限。

## 迁移前数据检查

在把可空列改为更严格约束之前先只读检查：

- `ats.user_id` 是否存在 NULL 或与父简历 owner 不一致的记录。
- `resume_config_versions`、`automerge_documents`、`company` 是否存在子表 user 与父简历 user 不一致的孤立/错挂记录。
- 模板的 `visibility/status` 是否都属于既有合法枚举。

本批次不自动把无法确认归属的历史数据“猜测归户”。若存在不一致，先隔离记录并依据父简历 owner 修正；每类修复记录数量，不记录简历内容或用户标识。核验为零后，再考虑把 `ats.user_id` 收紧为 NOT NULL。

## 部署策略

RLS 迁移在单一事务内完成：撤销 grants、删除旧策略、创建新策略、恢复最小 grants。不会出现“旧策略已删、新策略未建”的可见中间态。

上线顺序为：

1. 先运行数据一致性只读检查与两用户预演。
2. 应用 RLS 安全迁移。
3. 立即执行权限矩阵查询和真实登录用户冒烟。
4. 再继续 AI 额度等后续高风险改造。

## 验证与验收

数据库契约测试至少包含两个认证用户 A/B 与匿名角色：

- A 对 B 的简历、版本、ATS、公司、Automerge 行执行 SELECT 均返回 0 行。
- A 对 B 的资源执行 UPDATE/DELETE 均不生效；插入 `user_id=B` 被拒绝。
- A 不能把自己的子记录挂到 B 的 `resume_id`。
- 匿名用户看不到任何基础表；A 也看不到、不能修改或删除 B 的模板，无论模板 visibility/status 为何。
- 有效匿名分享请求只能读取指定分享当前发布批次的最小快照；不能借 share ID、resume ID 或评论 token 查询 owner 的 `resume_config`、其他版本、ATS、Tracker、Automerge 或模板。
- 未持有效协作链接的用户 B 无法注册、加入、续租或使用 owner A 的 `collaborator` 会话；持有效链接并登录后可编辑会话绑定的共享文档并评论，但不能读取 owner A 的其他数据。伪造、过期、撤销或 user/session/scope/version/role 不匹配的 collaborator token 不能读取评论 bootstrap 或实时数据。
- 有效评论 token 只能访问其绑定的 scope，并且不能直接调用评论表 Data API。
- service role 的分享、评论和后台流程仍能读取所需基础数据。
- catalog 查询确认六表不存在 `qual=true` 或 `with_check=true` 的宽松私有数据策略，也不存在同角色同操作的重复 permissive 策略。

业务冒烟覆盖：创建、编辑、删除简历；保存 ATS；Tracker 增删改；Automerge 读取/upsert；历史版本读取与保存；本人模板创建、发布、归档和删除；匿名分享读取与评论；持链接登录用户加入实时协作、编辑共享简历并评论；社区模板入口不再泄露其他用户模板。

上线后重新运行 Supabase Security Advisor 与 Performance Advisor。RLS advisor 的相关越权和重复策略告警必须消失；服务端专用表“RLS 开启但无策略”的 INFO 可保留，因为它们有意只允许 service role 绕过 RLS。

## 回滚原则

- 迁移前把六表策略定义、grants 与一致性统计保存到验证记录，供定位而不是直接整包恢复。
- 如果合法客户端路径被误拦，优先修正对应窄策略或缺少的表/序列 grant；不恢复 `SELECT true`、`ALL true`、匿名任意写或 `DELETE true`。
- 如果父资源约束误判，单独放宽该关联条件并保留 `auth.uid() = user_id`，禁止以取消 owner 检查作为临时恢复手段。

## 参考

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [Supabase Data API 安全](https://supabase.com/docs/guides/api/securing-your-api)
