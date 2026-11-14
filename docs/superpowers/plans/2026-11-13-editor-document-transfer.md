# 简历打开正文传输优化实现计划

用户已授权本期修复。当前分支执行，不推送，不重复索要方案批准；仓库不执行 TDD。采用 writing-plans 的任务拆分并内联完成实现与验证。

**目标：** 删除正文读取的重复编码，缩短真实打开等待。
**架构：** 新增 invoker 只读 RPC，现有轻量快照入口调用；其他加载与写入链路保持。
**技术栈：** PostgreSQL 17、Supabase SDK、React、Zustand、Automerge。

## 1. 已有证据

- [x] 阅读防回归 23–27 节、编辑启动规格/计划/验收与前期请求审计。
- [x] 两轮真实浏览器分阶段计时，核对云端字节大小、SQL 执行时间、地区与健康状态。
- [x] 对比紧凑 RPC、正文缓存、存储迁移，确定第一项并记录规格。

## 2. 实现

- [x] 使用 `pnpm exec supabase migration new compact_automerge_snapshot` 创建迁移。
- [x] 函数返回 `table(document_data text)`：原生魔数用 `encode(document_data, 'base64')`，否则 `convert_from(document_data, 'UTF8')`；按目标与 owner 过滤，显式 invoker 和权限。
- [x] 修改 `src/lib/automerge/document/read-snapshot.ts` 为 `.rpc('get_automerge_snapshot', { p_resume_id: resumeId, p_user_id: userId }, { get: true }).maybeSingle()`；原错误/null/undefined 行为不变。

## 3. 验证与部署

- [x] tests/editor-opening 使用隔离 PostgreSQL 执行真实迁移和角色矩阵，覆盖原生/历史字节、缺失、损坏及权限。
- [x] 真实应用/SDK 验证成功、失败、保存重开和原加载边界；保留原诊断基线以便同环境比较。
- [x] app/node TypeScript、定向 ESLint 与生产构建通过。
- [x] 只部署本期迁移到 linked 项目，核对账本、线上定义与权限，Edge Functions 版本不变。
- [x] 真浏览器对照读取载荷与耗时，正文可见并打开实际表单；不得修改真实用户正文。

## 4. 交付

- [x] 移除诊断埋点并删除临时测试、数据、服务；执行 Prettier、ESLint layout、format:check 与 diff 检查。
- [x] 更新验收记录与防回归条款，分别标记实施、验证、用户审查。说明本地前端与云端数据库的发布范围。

实施完成；验证结果与未覆盖边界见[验收记录](../specs/2026-11-13-editor-document-transfer-acceptance.md)。用户审查待进行。
