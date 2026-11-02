# 全项目请求链路优化实现计划

用户已授权本期，按独立范围并行实施，不重复索要批准；当前分支，不提交或推送，不强制 TDD。

**目标：** 缩短已证实的请求关键路径，减少无用正文、重复查询和跨区等待。
**架构：** 轻量共用区域配置、复用现有授权的窄响应 RPC、页面 store 请求共享、依赖成立后局部并发。
**技术栈：** React/Zustand、Supabase SDK/Postgres/Edge、现有 CLI 与 Playwright。

- [x] 阅读历史与全项目请求入口，核实 SDK/官方区域文档，获取非个人内容的日志/SQL统计，列明不改的必要依赖。
- [x] 主代理：src/lib/supabase/edge-functions.ts 统一三类数据库函数区域；接入分享、评论、协作和投递。修改 src/lib/job-context.ts 使用外键摘要和 UPDATE 返回值；更新 self-hosting 配置说明。
- [x] 数据库代理：CLI 创建迁移，增加 get_resume_library_counts 调用者权限聚合及 resolve_resume_comment_access_v2 服务端薄包装；修改 src/lib/supabase/resume/library.ts 计数调用。隔离验证权限、计数条件、v1兼容和v2正文裁剪。
- [x] Edge 代理：resume-comments 的空线程早退、续期窄读、同步并行与v2元信息消费；job-submissions下载投影。真实 handler/SDK 边界验证权限与返回行为，不自行部署。
- [x] 前端代理：history岗位选项复用和失败状态；首页轻选项；resume/store/library.ts 首批并行；tracker投递后按目标重读；派生完成去重复metadata GET；助手首轮去重复PATCH。验证真实消费者、分页、失效与保存顺序，不重构页面UI。
- [x] 主代理集成与交叉审查，运行 pnpm exec tsc -p tsconfig.app.json --noEmit、node配置类型、Edge Deno check、pnpm build；修改文件 Prettier→ESLint layout，全仓 pnpm format:check。
- [x] 在独立合成数据上对照真实地区耗时；隔离验证通过后部署本期迁移及Edge，核对账本、函数版本、线上smoke及旧协议。
- [x] 更新验收与防回归清单，清理测试账户、临时容器/服务与 tests/request-audit；分别记录实施、验证和用户审查状态。

状态：实施完成；验证通过；用户审查待进行。后端已部署，前端未推送或发布。证据见[验收记录](../specs/2026-11-02-request-path-performance-acceptance.md)。
