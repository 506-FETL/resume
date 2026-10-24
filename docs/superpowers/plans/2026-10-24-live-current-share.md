# 当前简历分享自动同步实现计划

> 面向 AI 代理：使用 subagent-driven-development 分工实现，主代理负责集成、云端部署和验收。当前分支工作，不提交或推送。保留已有未提交修改。

**目标：** 当前分享自动跟随已保存简历，历史分享固定。
**架构：** 云端按 source_kind 解析内容，当前链接跟随当前工作版本；前端条件轮询并保留预览。
**技术栈：** React、TypeScript、Supabase Edge Functions、PostgreSQL。

## 任务

- [x] 数据库：`supabase/migrations/20261024024424_live_current_resume_shares.sql`。增加 current 分享跟随工作版本触发器并回填已有指针；增加 service_role 专用的配置版本校验同步 RPC，复用现有评论事务，不改历史 release。
- [x] 服务端：`supabase/functions/resume-share/live-source.ts` 负责当前快照、精确模板、评论同步；`index.ts` 保留授权入口，按 current/history 分流，响应 revision/not_modified，支持密码刷新凭据，设置 no-store。
- [x] 前端：`src/lib/supabase/resume/share.types.ts` 与 `share.ts` 解析 sourceKind/contentRevision/notModified；共享请求传 knownContentRevision/accessToken；分享阅读区按 history-style 组织，加入可见性轮询、退避和请求时序，复用预览对象；文案区分自动同步与固定版本。
- [x] 验证：`tests/live-current-share/` 放隔离 SQL、服务端和前端回归。当前链接修改正文/模板/外观后返回新 revision，历史返回旧内容；过期、密码修改拒绝旧凭据；版本冻结后 current 指针跟随新工作版本；网络失败保留预览且恢复后更新；无变化不重建预览。
- [x] 检查：`pnpm exec tsc -p tsconfig.app.json --noEmit`、定向 eslint、`pnpm build`、Edge 类型检查和隔离数据库事务验证。
- [x] 部署：将迁移与 resume-share Edge 部署到已链接 resume 项目，核对迁移账本与 Edge 版本，使用隔离数据在线完成 current/history/条件刷新 smoke，删除测试数据和 tests 下临时脚本。

## 完成记录

- 数据库审查补充统一发布、换版与历史删除的锁序，拒绝冻结前发起的迟到 current 发布；事务回滚回归通过，包括旧配置拒绝、评论同步、换版跟随及删除历史不影响 current 链接。
- 前端 46 条断言及服务端来源解析回归通过。应用 TypeScript、定向 ESLint、Edge Deno 2.2.12 类型检查与生产构建通过；构建仍有既有分包循环和体积提示。
- 迁移 `20261024024424_live_current_resume_shares` 已部署并核对账本；`resume-share` 已部署为 ACTIVE v43，函数内保留原授权校验。线上 current 指向不一致记录为 0。
- 使用独立虚拟简历完成 23 项线上检查：内容、标题、精确模板、外观、照片、隐藏信息、条件响应、评论版本/权限、换工作版本、历史固定、密码凭据/密码更改、关闭/过期、访问统计、发布记录数量。
- 生产构建浏览器验收：无变化响应复用同一预览 DOM；后台换正文及模板无整页加载动画；禁用阅读区原生滚动锚定后，更新前后 scrollY 均为 250。保留现有页面进退场动画。
- 从真实下载 PDF 按钮进入打印校验，分别输出当前与历史 PDF（各 2 页）；文本检查和页面图像确认当前使用更新后的正文及外观，历史保持原内容，隐藏正文未泄露。
- 独立代码审查问题均已修复。云端虚拟简历、其分享和版本已清理为 0；本轮 tests 下临时脚本及数据已删除。未提交或推送。
