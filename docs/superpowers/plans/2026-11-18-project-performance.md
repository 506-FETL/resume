# 全项目性能优化实施计划

> 面向 AI 代理：按 systematic-debugging 逐项确认根因；明确独立的性能问题按 dispatching-parallel-agents 分工，主代理集成与真实浏览器验收。

**目标：** 修复真实可复现的加载与交互瓶颈，保存可核对的前后证据。

**架构：** 保持当前路由、store、缓存和 Supabase 协议；在实际消费边界隔离重资源，消除没有数据依赖的串行等待，避免无关模块与后台刷新阻塞已有内容。

**技术栈：** React 19、Vite 7、Zustand、Supabase、Chrome CDP、Lighthouse。

## 任务 1：基线与覆盖

- [x] 阅读防回归清单和历史加载/请求/LCP 验收。
- [x] 建立生产构建及模块图，运行首份 Lighthouse 报告。
- [x] 使用临时账户逐页操作，记录 Network、Performance、实际完成时间与错误。
- [x] 在 tests/performance 保存原始报告、临时工具和合成数据；结束清理。

## 任务 2：共享入口及页面依赖

- [x] 检查 src/workspace-app.tsx、src/App.tsx、src/components/route-skeleton、src/index.css 的静态闭包；只拆已确认无关的资源。
- [x] 检查 src/pages/index 的图表空态和创建入口；保持标题、几何、原请求时机及局部重试。
- [x] 检查 src/pages/template/components/preview-dialog 与 preview-workspace：静态预览列表不应先解析实际分页和创建工作区。
- [x] 用生产模块图和浏览器真实下载核对修复，打开所隔离的入口两轮并快速反向验证。

## 任务 3：真实业务请求与交互

- [x] 检查账户、编辑、保存、列表、档案、分享、岗位、历史和助手的请求瀑布；保持有依赖的授权和持久化顺序。
- [x] 每个确认问题先记录触发、根因，再实施最小范围修复；无慢样本的可疑代码不扩展重构。
- [x] 验证实际保存重开、失败重试、缓存失效、减少动效、手机与桌面。

## 任务 4：对照与交付

- [x] 相同环境重跑 Lighthouse 桌面/手机与 Performance，记录真实指标及限制。
- [x] 对改动文件先 pnpm exec prettier --write，再 pnpm exec eslint --fix --fix-type layout。
- [x] 运行 pnpm exec tsc -p tsconfig.app.json --noEmit、pnpm exec tsc -p tsconfig.node.json --noEmit、pnpm build、pnpm format:check、git diff --check。
- [x] 如有后端变更，部署并验证 linked 项目；区分前端未发布状态。
- [x] 清理临时账户、文件、脚本与服务，写验收及长期防回归约束，分别记录实施、验证、用户审查。

## 交付状态

实施完成，验证范围及限制见[本期验收](../specs/2026-11-18-project-performance-acceptance.md)。用户审查待进行。前端未发布，`llm-proxy` v52 已部署并线上核验，没有数据库迁移；未推送 Git。

额外确认并修复了创建后重复正文读取、ATS 平台时限与流终态、延迟表单提交门禁、助手慢正文搜索定位。临时账号与数据、脚本、凭据和服务均已清理；Lighthouse 和 Performance 报告作为交付附件保留。
