# 数据库可重放基线与迁移 CI 设计

## 背景

当前 `supabase/migrations/init_table.sql` 不符合 Supabase CLI 的 `<timestamp>_<name>.sql` 命名，CLI 会直接跳过。即使手工执行，该文件也不能作为可靠基线：

- `ats` 在 `resume_config` 之前创建并引用后者。
- `ats` 完整定义重复两次。
- 多个 trigger 引用尚未定义的 `update_updated_at_column()` 或 `set_resume_config_version_no()`。
- `resume_config_updated` 是 AFTER trigger，却调用只修改 `NEW.updated_at` 的通用函数；AFTER trigger 的返回行不会再写回，属于无效触发器。
- 文件只覆盖部分早期表，不包含当时在线上手工形成的完整 RLS/ACL。

Git 历史提供了更可信的恢复来源：2026-02 至 2026-04 的 8 个真实时间戳迁移曾创建基础简历、ATS、Automerge、公司、历史版本、外观和模板对象，随后在 2026-04-10 被删除并由 `table.sql`、后来 `init_table.sql` 取代。线上迁移账本目前从 `20260528000001` 开始，因此空库执行首条有效迁移就会 ALTER 一个不存在的 `resume_config`。

## 目标

- 恢复一条从空 Supabase 项目可执行到当前 schema 的完整迁移链。
- 使用真实 Git 历史恢复早期迁移，不把当前线上最终 schema 粗暴伪装成最早基线。
- 删除无效 `init_table.sql`，不再维护第二套初始化入口。
- 将线上已经存在但迁移账本缺失的历史版本安全登记为 applied，不重复执行建表 SQL。
- 在 CI 中自动执行空库 reset、数据库测试和 schema 安全门禁。
- 保持生产数据不变，迁移历史修复可审计、可复核。

## 非目标

- 不使用 `db dump` 生成的当前最终 schema 替换全部历史迁移。
- 不在生产库 drop/recreate 基础表，也不通过 `migration repair --status reverted` 重放已存在对象。
- 不承诺本地 Supabase 能模拟全部托管平台性能或 Auth/Edge 行为；CI 主要证明 schema/migration/contract 可重放。

## 方案比较

### 方案 A：把 `init_table.sql` 政名并修几处顺序

仍会与后续迁移重复创建当前态对象，并遗漏早期函数、RLS 与演进边界；无法证明历史链正确。

### 方案 B：恢复 8 条历史迁移并清理缺失依赖（采用）

从删除前的 Git tree 恢复原时间戳文件，补齐早期依赖函数、删除无效 trigger，并让后续 May–August 迁移按真实顺序演进。线上只登记这些版本已应用。该方案最接近真实历史，diff 小且便于定位失败迁移。

### 方案 C：把全部迁移 squash 成一个当前基线

空库最简单，但会重写已有生产迁移账本并吞掉每次安全演进；当前仓库仍处于快速变化期，不值得承担远端历史重构风险。

## 恢复的历史迁移

从 commit `8767b5b` 删除前版本恢复：

- `20260220021550_create_resume_config.sql`
- `20260220021702_create_ats.sql`
- `20260220021731_automerge_documents.sql`
- `20260220021810_company.sql`
- `20260321000100_create_resume_config_versions.sql`
- `20260328090000_add_resume_appearance_to_resume_config.sql`
- `20260408130000_create_resume_templates.sql`
- `20260409093000_add_template_binding_to_resume_config.sql`

保留真实版本号与职责边界。允许为“空库必然失败”的缺失依赖做最小修复，但每项偏离历史内容都必须有注释和契约测试。

## 早期依赖修复

### 通用更新时间函数

在第一条迁移创建表之前定义 `public.update_updated_at_column()`，使用 `SET search_path=''` 与 `pg_catalog.now()`。撤销 `PUBLIC/anon/authenticated` 的直接执行权；trigger 仍能调用。

只保留 BEFORE UPDATE trigger。删除无效的 `resume_config_updated` AFTER INSERT/DELETE/UPDATE trigger。

### 版本号 trigger

`set_resume_config_version_no()` 必须在 trigger 之前创建，使用全限定表名与空 search_path。并发下 `max(version_no)+1` 不是可靠唯一分配，后续现有迁移/并发规格将用 root 行锁或原子序列化路径保护；基线只需保证初始定义可执行。

### UUID

早期 Automerge 表使用 `extensions.uuid_generate_v4()`。基线优先改为 PostgreSQL 可用的 `gen_random_uuid()`，避免为单个默认值引入 `uuid-ossp`；如果目标本地版本需要扩展，则显式 `CREATE EXTENSION IF NOT EXISTS` 且不固定版本号。

### RLS 与 ACL

历史 SQL 未完整记录线上手工策略。基础表创建后立即启用 RLS；最终 owner-only 策略与 grants 由独立 P0 RLS 安全迁移统一定义。Fresh reset 的最终态必须与该安全迁移一致，不能复制线上当前的宽松历史策略。

## 线上迁移账本对齐

分两类处理：

1. 已确认仅时间戳不同的 2026-08-15 两条迁移，按 P0 权限规格把本地文件名对齐线上版本。
2. 恢复的 8 条 2026-02 至 2026-04 迁移，逐项验证其目标对象已存在且关键列/约束/函数不缺失后，使用 Supabase CLI `migration repair --status applied` 登记版本。

repair 只修改 `supabase_migrations.schema_migrations`，不执行历史 SQL。执行前导出远端 migration list，执行后必须达到 local/remote 一一对应。任何对象核验不通过时停止 repair，先补充独立 forward migration；不得把“对象不存在”伪装为“已应用”。

## Fresh Reset

标准本地验收：

1. 启动全新 Supabase local stack。
2. `supabase db reset --local` 从第一条迁移顺序执行到最新。
3. 运行 seed（如存在）和 pgTAP。
4. 运行 catalog 安全脚本，核对 RLS、ACL、函数 search_path、唯一函数签名和 trigger。
5. 再执行一次 reset，证明流程无隐藏手工步骤。

不以迁移文件“包含 IF NOT EXISTS”作为可重放证明；必须使用真实空库进程退出码。

## CI 设计

新增数据库工作流，在影响 `supabase/migrations/**`、`supabase/tests/**`、数据库验证脚本或 Edge RPC 契约时运行：

- checkout。
- 安装固定版本 Supabase CLI；升级由单独依赖变更完成，不使用 latest。
- `supabase start`。
- `supabase db reset --local`。
- `supabase test db`。
- 运行数据库 catalog/contracts 验证脚本。
- 输出 migration list 和失败 migration 名称。
- finally 停止本地 stack。

CI 不需要生产数据库密码或 service-role secret。联网的 remote migration drift/advisor 检查作为部署前人工/受保护工作流，不放到不可信 PR 环境。

## Schema 差异验证

Fresh reset 后对关键 catalog 生成稳定摘要，而不是提交包含平台内部对象的巨型 raw dump：

- public/private 业务表、列、约束、索引、trigger。
- 函数完整签名、security mode、search_path 与 ACL。
- RLS 开关、policy role/cmd/qual/with_check。
- 已启用的业务扩展。

摘要按稳定字段排序，并与受审阅的 snapshot 对比。Auth、Storage、Realtime 等 Supabase 平台 schema 不进入业务 snapshot。

## 验证与验收

- `supabase migration list --local/--linked` 不再出现被跳过文件、local-only 或 remote-only 记录。
- 连续两次全新 `supabase db reset --local` 成功。
- 第一条迁移不引用尚不存在的表/函数。
- `ats` 只创建一次；无效 `resume_config_updated` trigger 不存在；有效 BEFORE UPDATE trigger 正常更新时间。
- 最终 schema 的业务 catalog 摘要与预期一致。
- pgTAP、RLS 双用户矩阵、AI quota contract 与并发 smoke 均能在 reset 后运行。
- CI 在故意加入无效迁移、宽松 RLS 或 public definer 时会失败。

## 回滚

- 恢复历史文件和删除 `init_table.sql` 先在本地验证；未通过前不 repair 远端。
- repair 前保存完整 migration list。若登记了错误版本，使用精确版本的 `migration repair --status reverted` 修正账本，但不对业务表执行破坏性回滚。
- 已成功登记且对象核验一致的历史版本不随代码回退删除；后续问题用 forward migration 修复。
- CI workflow 可回退，但不能恢复无效 `init_table.sql` 作为初始化入口。

## 参考

- [Supabase Local Development and Database Migrations](https://supabase.com/docs/guides/local-development/overview)
- [Supabase CLI Migration Commands](https://supabase.com/docs/reference/cli/supabase-migration)
- [Supabase Database Testing](https://supabase.com/docs/guides/database/testing)
