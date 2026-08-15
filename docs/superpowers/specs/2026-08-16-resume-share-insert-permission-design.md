# 新建简历分享列级权限修复设计

## 背景与证据

浏览器新建分享时，`createResumeShareRelease` 会直接向 `public.resume_shares` 插入 `allow_comments`。线上表已存在 owner 的 SELECT、INSERT、UPDATE、DELETE RLS 策略，`authenticated` 也拥有 `version_id` 的 INSERT 与 `id` 的 SELECT 权限；但线上检查确认 `has_column_privilege(..., 'allow_comments', 'INSERT')` 为 `false`。PostgREST 因此在 RLS 判断前返回 `42501 permission denied for table resume_shares`。

已部署的 `publish_resume_share_release` 是带 `p_expected_document_revision` 的 14 参数版本，`release_no` 已通过表别名限定。本设计不再次替换该函数。

## 目标

- 允许已登录 owner 在新建分享时写入 `allow_comments`。
- 保留现有列级最小权限模型和 owner RLS。
- 不授予匿名角色写权限，不授予 `authenticated` 整表 INSERT。

## 方案

新增独立迁移 `20260816000001_grant_resume_share_allow_comments_insert.sql`，仅执行：

```sql
GRANT INSERT (allow_comments)
ON TABLE public.resume_shares
TO authenticated;
```

迁移不修改表结构、不重写数据、不改变策略，也不为 `allow_comments` 增加浏览器直连 UPDATE；设置更新继续通过现有 Edge Function 执行。

## 部署与验证

- 通过 Supabase migration 接口部署，保留迁移审计记录。
- 部署后验证 `authenticated` 对 `allow_comments` 的 INSERT 列权限为真。
- 复查 `authenticated` 仍没有整表 INSERT 权限。
- 复查四条 owner RLS 策略仍存在。
- 执行 Supabase security 与 performance advisors，确认没有由本迁移引入的新问题。
- 使用已登录浏览器创建一个分享，确认插入、发布批次、启用和最终读取完整成功；测试记录随后通过正常删除入口清理。

## 回滚

如需回滚，只撤销该列权限：

```sql
REVOKE INSERT (allow_comments)
ON TABLE public.resume_shares
FROM authenticated;
```

