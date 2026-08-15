# 新建简历分享列级权限修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让已登录用户能够在新建分享时写入 `allow_comments`，同时维持最小列级授权。

**架构：** 只新增一条可审计的数据库迁移，为 `authenticated` 增加 `resume_shares.allow_comments` 的 INSERT 列权限；不改 RLS、表结构、发布 RPC 或匿名权限。部署后通过权限探针、advisor 与真实创建流程共同验证。

**技术栈：** Supabase Postgres、RLS、PostgREST、Supabase migration API。

---

### 任务 1：新增最小权限迁移

**文件：**
- 创建：`supabase/migrations/20260816000001_grant_resume_share_allow_comments_insert.sql`

- [ ] **步骤 1：写入列级授权**

迁移完整内容为：

```sql
GRANT INSERT (allow_comments)
ON TABLE public.resume_shares
TO authenticated;
```

- [ ] **步骤 2：检查迁移差异**

运行：

```bash
git diff --check -- supabase/migrations/20260816000001_grant_resume_share_allow_comments_insert.sql
rg -n "GRANT INSERT|allow_comments|authenticated" supabase/migrations/20260816000001_grant_resume_share_allow_comments_insert.sql
```

预期：只出现单列 INSERT 授权，不出现整表授权或匿名角色。

### 任务 2：部署并验证线上权限

**文件：**
- 部署：`supabase/migrations/20260816000001_grant_resume_share_allow_comments_insert.sql`

- [ ] **步骤 1：通过 Supabase migration 接口应用迁移**

迁移名使用 `grant_resume_share_allow_comments_insert`，部署 SQL 与仓库文件完全一致。

- [ ] **步骤 2：执行权限探针**

验证以下表达式：

```sql
SELECT
  has_column_privilege('authenticated', 'public.resume_shares', 'allow_comments', 'INSERT') AS allow_comments_insert,
  has_table_privilege('authenticated', 'public.resume_shares', 'INSERT') AS whole_table_insert;
```

预期：`allow_comments_insert=true`，`whole_table_insert=false`。

- [ ] **步骤 3：复查 RLS 与 advisors**

确认 owner 的 SELECT、INSERT、UPDATE、DELETE 策略仍存在；security/performance advisors 没有由本迁移引入的新告警。

- [ ] **步骤 4：浏览器业务验证**

用已登录账号创建开启评论的分享，确认 `resume_shares` 插入、release 发布和最终分享读取均成功，不再返回 `42501`。

