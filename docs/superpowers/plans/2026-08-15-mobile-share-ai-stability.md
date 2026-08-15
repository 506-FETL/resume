# 手机端求职跟进、分享发布与 AI 助手稳定性实施计划

> **面向 AI 代理的工作者：** 按本计划在当前分支实施；保留工作区中用户已有的暂存和未暂存改动，不执行远端推送或线上部署。

**目标：** 修复分享版本发布 504 和公开快照泄露，压缩手机端求职跟进占位，统一底部 Drawer 为 70% 高度并移除 Drawer 右上角 X，同时修复 AI 搜索与浅色代码块。

**架构：** 分享版本与评论继续绑定数据库冻结版本，公开展示使用独立的脱敏 release snapshot。纵向 Drawer 的高度由共享组件统一，横向 Drawer 保持业务全高。求职跟进在移动断点采用独立的信息层级。cmdk 和 Shiki 问题在共享 UI 组件边界修复。

**技术栈：** React 19、TypeScript、Zustand、Tailwind CSS 4、Base UI Drawer、cmdk、Shiki、Supabase Postgres 与 Edge Functions。

---

## 任务 1：修复分享发布事务与公开快照边界

**文件：**

- 创建 `supabase/migrations/20260815000001_fix_resume_share_public_snapshot.sql`
- 修改 `supabase/functions/resume-share/index.ts`
- 修改 `src/lib/supabase/resume/share.types.ts`
- 修改 `src/lib/supabase/resume/share.ts`

- [ ] 在新的迁移中 `CREATE OR REPLACE` 当前签名的 `publish_resume_share_release`。
- [ ] 保留 owner/share/version/source/comment 校验，移除公开快照与完整版本快照的全量相等比较。
- [ ] 校验 `p_snapshot` 与模板清单为 object；release 和 share 保存 `p_snapshot`。
- [ ] 给函数增加短 `lock_timeout`，保留行锁的原子 release_no 与指针切换。
- [ ] `ResolvedResumeShareRelease` 携带由完整版本生成的评论锚点与 hash；公开 snapshot 继续脱敏。
- [ ] 客户端 RPC 增加按 share id 的 Promise 合并、有限请求超时和中文错误映射。
- [ ] 匿名 Edge Function 返回 `currentRelease.snapshot`，不再返回 `version.snapshot`。

## 任务 2：统一 Drawer 纵向高度与关闭入口

**文件：**

- 修改 `src/components/ui/drawer.tsx`
- 修改 `src/components/ui/responsive-dialog.tsx`
- 修改所有包含纵向 `DrawerContent` 高度覆盖或头部 X 的调用点

- [ ] 共享 Drawer 对 y 轴设置固定 `70dvh` 高度和最大高度，x 轴规则不变。
- [ ] 移除响应式 Dialog、评论、历史详情、问题修复、移动排序、简历编辑、移动分享和职位详情的纵向高度覆盖。
- [ ] 移除评论、AI 侧栏/画布、移动分享、移动排序、职位详情和高级工具 Drawer 的右上角 X。
- [ ] 保留 DrawerFooter 中的文字关闭/取消按钮以及 Dialog 自身关闭入口。
- [ ] 确认横向 Sidebar、AI 侧栏/画布和桌面职位详情继续显式全高。

## 任务 3：实现手机端求职跟进方案 C

**文件：**

- 修改 `src/pages/tracker/components/overview-bar/index.tsx`
- 修改 `src/pages/tracker/components/drawer/index.tsx`

- [ ] 手机端 Overview 渲染一行响应率与三项核心指标，保留指标筛选。
- [ ] 增加可访问的展开按钮，按需显示待跟进；桌面 Overview 不变。
- [ ] 手机端职位头部压缩且不渲染工具栏，桌面头部工具栏不变。
- [ ] 移动端“更多”包含编辑、回退、终止、归档和删除。
- [ ] 增加固定底部主操作；有下一阶段时推进，没有时切换到对应详情。
- [ ] 正文保持独立滚动，底部操作作为 flex sibling，不覆盖内容。

## 任务 4：修复 AI 搜索与代码块主题

**文件：**

- 修改 `src/components/ui/command.tsx`
- 修改 `src/components/ui/code-block.tsx`
- 修改 `src/index.css`

- [ ] `CommandDialog` 接收 `commandProps` 并在 DialogContent 内渲染 `<Command>` Provider。
- [ ] 确保 `commandProps` 不再透传给 Radix Dialog。
- [ ] `CodeBlock` 增加 `not-prose` 和作用域标记。
- [ ] 在作用域内让 Shiki 背景透明，并在 `.dark` 下应用 `--shiki-dark` 文本颜色。

## 任务 5：自动验证与差异审查

**文件：**

- 可创建 `scripts/verify-mobile-share-ai-stability.ts`，用于检查本轮关键安全和 UI 源码约束

- [ ] 运行关键约束脚本，确认公开接口、RPC 快照来源、Drawer 高度和 cmdk Provider。
- [ ] 运行 `pnpm exec tsc --noEmit`。
- [ ] 对本轮修改的 TS/TSX 文件运行 ESLint。
- [ ] 运行 `pnpm build`。
- [ ] 运行 `git diff --check`。
- [ ] 审查 `git diff`，确认未回退用户在 optimize header 与高级工具桌面弹层中的既有改动。
- [ ] 使用本地浏览器验证可进入的手机端与 AI 流程；登录或线上部署阻塞的业务矩阵单独记录，不用静态检查替代。
