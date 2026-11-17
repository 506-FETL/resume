# 职业档案原件与全文读取后端验收

日期：2026-11-17。依据[设计](2026-11-17-career-archive-originals-design.md)和[计划](../plans/2026-11-17-career-archive-originals.md)。

## 状态

- 后端实施完成；本地隔离验证和局部工程检查通过。
- 本文记录隔离后端证据；云端部署、浏览器与真实 Supabase JWT/Storage 验收已在集成阶段完成，详见[完整验收](2026-11-17-career-archive-originals-acceptance.md)。
- 用户审查待进行；未 commit 或 push，未改真实用户数据。

## 改动与约束

共享 kind 新增 `file`。入口要求此类型 `text=''`、`blocks=[]`，实际文件仅核对 10 MB 大小上限和名称对应关系，允许零字节、任意格式，不读取内容或调用解析器。旧类型继续保留原有格式、正文和内容一致性校验。PDF/DOCX 的旧校验依赖改为仅在旧类型分支加载。简历导入不修改。

CLI 创建迁移，部署后本地编号对齐为 `20261117053149_career_archive_original_files.sql`：新增 file kind；该类型只允许零正文、零字数、零段落且必须有原件名称、路径、大小；允许 file 的 0–10485760 字节，旧类型原有非零大小约束保留。原件桶保持私有、10 MB，MIME 白名单置空。既有去重 RPC 的 source_kind 条件已区分 file 与历史类型，无需重写事务、操作账本或历史内容。

新增 `{ action: 'text', sourceId, versionId }`，versionId 必填。沿用 ownedSource 的 owner/status 校验与版本查询的 owner/source/version 条件；只投影指定版本的 id/object_key/extracted_text，拒绝有原件版本，返回原样 `{ text }`，不查询或拼接 blocks。返回前再次核对来源可用状态。沿用统一 handler 的认证、错误与 JSON 响应，通过 operations 分发，无需修改 handler。

## 本地证据

独立 Docker PostgreSQL 17 应用真实经历资料、名称去重、文件预览、对话附件历史迁移与本次迁移；只提供必要 auth/storage/resume 前置表和角色，不冒充完整 Supabase 环境。12 项 SQL 检查通过：零字节、10 MB、超限、负大小、缺原件/大小、虚构文字/字数/段落、旧图片零字节拒绝、旧文档空正文拒绝及桶配置。

独立 PostgREST v16.4 使用 service_role 连接同一隔离数据库，Deno 测试导入真实 SDK、输入解析、文件校验、operations/read 和 RPC。HTTP 仅去掉 Supabase 路由前缀和本地占位 Authorization，实际查询均执行真实数据库，不 mock 业务层。9 组检查通过：新 file 协议；任意格式、零字节、60001 字节及 10 MB 文件不读取内容；超限与协议错配拒绝；旧粘贴/图片/文档约束；全文版本必填；25 段全文和历史缩进空行；文件、跨 owner、错配版本及非 ready 拒绝；kind 哈希隔离；真实 RPC 新旧同字节不复用、新 file 去重、operation hash 冲突、跨账户拒绝和旧正文保留。

通过命令：

```text
pnpm dlx deno check --no-config --no-lock --node-modules-dir=none supabase/functions/experience-sources/index.ts
LOCAL_REST_URL=http://127.0.0.1:53593 pnpm dlx deno test --no-config --no-lock --node-modules-dir=none --allow-net --allow-env tests/career-archive-originals/backend/backend.test.ts
pnpm exec eslint supabase/functions/shared/experience-source-contract.ts supabase/functions/experience-sources/{input,files,read,operations}.ts
pnpm exec prettier supabase/functions/shared/experience-source-contract.ts supabase/functions/experience-sources/{input,files,read,operations}.ts --check
git diff --check -- supabase
```

已先执行改动源文件 Prettier 写入，再执行 ESLint layout 修复。各源码文件均不超过 400 行。测试初次遇到夹具相对路径和本地 PostgREST 无 JWT secret 配置问题，修正测试传输配置后通过；重复运行曾受上次去重夹具影响，增加仅针对隔离夹具的清理后重新通过，不修改产品行为。

临时脚本原位于 `tests/career-archive-originals/backend/`，隔离容器为 `career-originals-backend-pg` 与 `career-originals-backend-rest`。集成验收后已删除脚本和容器，长期仅保留此非敏感记录。
