# 业务代码审查修复实施计划

> 面向 AI 代理：使用 subagent-driven-development 顺序执行，每项完成后审查规格合规性与代码质量。用户已授权实施全部 16 项建议，不在任务间重复请求批准。

**目标：** 修复上一轮 16 项业务缺陷并验证、部署必要的 Supabase 变更。

**架构：** 保留当前 React/Zustand、Automerge 和 Supabase 边界。客户端保留精确快照与请求身份，数据库/Edge 承担授权与公开数据保护。

**技术栈：** React 19、TypeScript、Zustand、Supabase Postgres/Realtime/Edge、Automerge。

## 全局约束

在当前分支工作，不推送远端。只修改 16 项修复直接需要的文件，排除 Tiptap 实现。所有新增交互动画支持 useReducedMotion。新页面遵循 history-style 目录结构。保留已有改动。数据库迁移通过 Supabase CLI 创建；全部开发验证后部署当前链接项目。优先源码行为验证，不强制 TDD。

## 顺序任务与验收

- [x] 1. 协作鉴权：修改 `src/lib/automerge/collaboration/supabase-network-adapter.ts` 及会话接口，新增 Realtime 授权迁移。核对会话/成员租约表的最终定义，私有频道必须拒绝 anon、非成员、过期/撤销租约，允许有效 owner/member。验证连接失败清理及授权生命周期。
- [x] 2. 分享脱敏：修改 `src/lib/supabase/resume/share.ts`、`supabase/functions/resume-share/index.ts` 及共享纯函数。覆盖整节隐藏、逐项隐藏、嵌套隐藏字段与历史 release；验证公开响应不含被隐藏文本且可见条目保留。
- [x] 3. 自动保存：修改 `src/store/resume/helpers/sync-service.ts`、`slices/document.ts`、`slices/sync.ts` 和编辑器 loader。捕获目标快照并在卸载时持久化；验证离线快切、在线快切、失败和旧请求晚返回。
- [x] 4. JD 映射：修改 `src/components/jd-variant/utils/apply-changes.ts`、`editable-view.ts` 及在线/离线调用方。映射 items、entryId、真实内容字段，拒绝非法路径和 before 不匹配。验证四种经历、求职意向、技能、自我评价及无效输入。
- [x] 5. 历史保存：修改 `src/lib/supabase/resume/history/queries.ts` 必要类型，查询 template_binding。验证自定义/官方绑定经历史页快照完整保留。
- [x] 6. 历史恢复：修改 `src/lib/automerge/document/sync.ts`，补齐文档字段和数据库映射。验证历史绑定替换当前绑定、返回快照和恢复记录一致。
- [x] 7. 模板竞态：修改 `src/pages/template/store/editor.ts`、`workbench/template-publisher.ts`。记录保存请求的草稿身份/版本，仅确认相应保存结果。验证保存中继续编辑、切模板、另存副本和失败。
- [x] 8. 聊天持久化：修改 `src/lib/supabase/ai/messages.ts`、`src/pages/assistant/hooks/use-chat-stream.ts`，必要时新增受 owner 限制的消息截断 RPC。先成功持久化再替换本地消息；验证 edit/retry/regenerate、失败、分页边界和身份隔离。
- [x] 9. 评论游标：修改 `supabase/functions/resume-comments/index.ts`、客户端 API/实时 hook。按最后实际交付事件返回游标，补齐分页。验证 501 条积压、并发新事件、过滤事件和无事件。
- [x] 10. 面试轮次：修改 `src/pages/tracker/components/drawer/use-stage-detail.ts`。验证单次新增、删除、保存和取消。
- [x] 11. 部分同步：修改 `src/pages/resume/store/resume-sync.ts` 及迁移返回类型或重读本地列表。验证一成功一失败、全部失败、云列表刷新失败。
- [x] 12. 密码恢复：创建 `src/pages/reset-password/` 的页面/组件/hooks/store/类型/常量/utils，修改忘记密码回调和必要的认证事件处理。验证有效恢复会话、过期链接、两次密码不一致及成功反馈；同步配置要求到 README。
- [x] 13. 离线匹配率：修改 `src/store/jd-variant/generate.ts`、离线应用函数返回值。验证改写新增关键词后得分更新。
- [x] 14. 头像替换：修改 `src/lib/supabase/user/profile.ts`。新头像上传、资料同步成功后删除旧文件；验证上传失败、资料更新失败和旧文件删除失败。
- [x] 15. 额度身份：修改 `src/store/ai-quota.ts`。捕获用户/请求版本并隔离 finally；验证 A/B 响应逆序、登出与并发去重。
- [x] 16. 实时刷新：修改 `src/features/resume-comments/api/realtime.ts` 与必要服务端到期字段。相同 topic 保持连接，到期后再取新 topic；验证桶末、失败重试、销毁和重新连接。
- [x] 17. 集成验证：运行 `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --pretty false`、变更文件 ESLint、相关回归和生产构建。修复阻塞验证的 LF/CRLF 断言，复核最终 diff 仅包含本规格范围。
- [x] 18. Supabase 部署：核对当前链接项目与迁移漂移，应用经过验证的新迁移，部署变更 Edge Functions；检查迁移账本、函数版本和授权/合法路径线上 smoke。

## 验证实现约定

行为验证使用实际源码与可控的存储/请求替身，重点断言业务结果而非源码文本。数据库验证以事务回滚隔离 fixture，线上 smoke 优先只读和无副作用请求；确需创建 fixture 时仅操作本轮专用记录并清理。每项记录实际执行命令与结果，不把构建通过等同于行为正确。
