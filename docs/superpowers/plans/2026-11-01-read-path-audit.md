# 全站读取链路优化计划

> 使用 subagent-driven-development 分模块实现和审查。用户已授权本期修复，保持当前分支，不提交或推送；仓库不要求 TDD。

**目标：** 修复已确认的过量查询、重复读取和串行阻塞。
**架构：** 复用已有数据访问与页面 store，按用途精简投影，资源按账户、目标和修订复用。
**技术栈：** React、Zustand、Supabase、IndexedDB、Playwright。

- [x] 1. 求职详情资源：修改 tracker/store/submissions.ts、store.ts 和 submission-list/preview 组件，所有资源有 revision；同 revision 的 data/loading 直接复用，失败不缓存为成功。更正历史仅 historyOpen 时加载；资源订阅直接驱动真实 UI。测试同时调用两次只一次请求，重开零请求、revision 更新、失败重试、账户切换；原件 URL 每次卸载释放。
- [x] 2. 简历与分享列表：在 lib/supabase/resume/form.ts 增加最小选项读取，share 和 tracker options 使用 `id,resume_id,display_name,type`；按消费者进一步精简首页和本地摘要。复核 resume 库分页与 preview 缓存，不引入全量正文。测试请求投影与实际列表、统计、选择及预览。
- [x] 3. 历史快照：history/store/history-data.ts 合并同版本在途 Promise；沿用目标代次并核对账户，失败/切换清除请求，旧结果不回填。测试预览和导出同时调用一次、失败后重试、换简历及换账户。
- [x] 4. 助手与优化：收紧岗位摘要和工具查询，独立上下文并发；优化只查最新报告与需要的分析正文，初始化去重。必要数据库迁移执行隔离权限验证、linked 部署与线上 smoke。测试实际 query 过滤/数量，报告最新选择、加载失败和刷新，画布重开与变更失效。
- [x] 5. 集成验收与审查：生成本期 diff 给独立审查，修复重要问题；运行 `pnpm exec tsc --noEmit -p tsconfig.app.json`、node 类型、`pnpm build`、`pnpm format:check`。实际组件检查历史开关、加载、空态、失败与动态减少动效；汇总请求数与响应量。补充防回归清单和验收文档，最后删除 tests/read-path-audit。

## 执行记录

全部模块实施完成、三组独立审查通过；两项迁移已部署 linked 项目并完成权限与 REST 核验，最终格式检查通过，临时测试和隔离容器已清理。实施完成、验证通过，用户审查待进行。优化冷载的实测发现串行拆分增加等待，追加最新报告 invoker 视图和冷载并行；临时测试覆盖实际在途阶段同时发出两个请求。其他现有未提交修改属于上一轮已完成工作，全部保留。
