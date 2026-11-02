# 分享创建与设置保存性能实现计划

> 用户已授权本期；按 dispatching-parallel-agents 分离数据库、Edge、客户端，主代理集成与部署。当前分支，不提交推送，不强制 TDD。

**目标：** 消除已证实的跨区串行等待与创建重复往返，维持原权限、版本和密码契约。
**架构：** 原子创建 RPC + 同区管理请求 + 同步持久化/后台通知。
**技术栈：** React、Zustand、Supabase Postgres/Edge、现有 CLI 与浏览器验收工具。

- [x] 阅读约束、历史分享契约，比较本地与线上函数，获取匿名化时序与 SQL 统计；保存基线构建。
- [x] 数据库：通过 `supabase migration new` 创建迁移；新增 SECURITY INVOKER `create_resume_share_release`，复用原发布函数及锁序，返回 UUID。隔离 authenticated/anon/跨账户、current/history、事务失败/并发与密码 inactive 验证。
- [x] Edge：`supabase/functions/resume-share/index.ts` 的 settings 更新支持创建阶段明确激活；校验类型，实际 UPDATE 返回元信息，复用通知入口并后台调度；同步错误不返回成功。
- [x] 客户端：`src/lib/supabase/resume/share.ts` 调新 RPC，无密码直接最终回读，有密码 Edge 设置/启用后回读；分享读写共用轻量区域 URL。保持原错误、发布去重、版本检查、来源和账户边界。
- [x] 使用真实 SDK 与隔离账户/合成简历记录旧链路基线和新链路；正式页面创建、设置保存、密码/权限及失败重试，覆盖桌面与手机，不操作真实用户数据。
- [x] 执行 app/node TypeScript、改动文件 Prettier→ESLint layout、生产构建和全仓 `pnpm format:check`；交叉审查修改。
- [x] 全部开发与隔离验证完成后部署新增迁移及 resume-share，核对迁移账本、函数版本、同区线上 smoke 和旧协议；清理测试账户及临时数据。
- [x] 更新防回归约束和永久验收记录，删除 tests/share-write，保留原开发服务；实施完成、验证通过与用户审查状态分别记录。

实施完成；验证通过；用户审查待进行。详见[验收记录](../specs/2026-11-02-share-write-performance-acceptance.md)。
