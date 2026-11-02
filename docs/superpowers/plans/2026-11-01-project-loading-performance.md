# 全项目加载与构建优化实现计划

> 面向 AI 代理：使用 dispatching-parallel-agents 分开审计编辑器、分享后端与配置，主代理负责测量、集成及验证。用户已授权直接实施；当前分支工作，不提交或推送。仓库不要求 TDD，临时测试完成后删除。

**目标：** 减少分享和编辑可用前的重复下载、串行请求与非必要初始化。
**架构：** 公开阅读、管理外壳及编辑功能按真实入口加载；只读数据并发，副作用仍在存在性及身份核验后执行；后端收紧投影，使用既有不可变资源缓存。
**技术栈：** React 19、Vite 7/Rollup、TypeScript、Supabase Edge Functions、Automerge。

## 任务 1：基线与构建图

- [x] 阅读防回归清单及分享、模板、读取审计和编辑性能相关记录。
- [x] `tests/project-performance/trace.mjs` 记录 dev分享的 ResourceTiming、API/Server-Timing、长任务和阅读/PDF就绪时间。
- [x] `tests/project-performance/build-report.mjs baseline` 构建独立产物，记录 chunk imports/modules 和构建时间，保留用于同机对照。
- [x] 用独立浏览器和真实 store 对已有/首建/迁移文档记录请求顺序；所有业务写入限制在隔离边界。

## 任务 2：分享请求

文件：`supabase/functions/resume-share/index.ts`、`live-source.ts`、`src/lib/supabase/resume/share-view.ts`。

- [x] scope查询一次取得id/date/hash/revision；仅scope缺失时读取version snapshot并走既有创建RPC。
- [x] current只读身份元信息、当前配置；history按精确release读正文，与scope并行。模板与scope使用 `Promise.all`，因为二者都是同一正文的必要依赖。
- [x] 访问计数复用 `scheduleBackground`，保留失败日志；最终分享授权复查仍在同步和内容加载完成后执行。
- [x] 浏览器对照 `Content-Type: application/json` 与 `text/plain;charset=UTF-8`，只在响应与权限一致且OPTIONS确实减少时采用后者；密码仍在body。
- [x] 隔离覆盖current/history、scope创建、同步冲突、授权变化、密码与隐私；Deno类型检查后部署已链接项目并记录函数版本及线上只读smoke。

## 任务 3：编辑器读取

文件：`src/store/resume/slices/document.ts`、`src/lib/automerge/document/manager.ts` 与 `persistence.ts`。

- [x] 把持久化的只读加载结果与初始化副作用区分，在上层并发外观与持久文档读取。
- [x] 用明确的预取结果传入初始化，避免成功空结果被误当作未读取而再请求；存在性判断失败不创建或保存文档。
- [x] 保留身份/操作代次、失败状态及配置真源；使用真实store回归已有、首建、迁移、失败和不存在。
- [x] 编辑器完整加载、姓名和富文本输入、保存与刷新回读验证。

## 任务 4：依赖与配置

文件：`vite.config.ts`、`package.json`、`pnpm-lock.yaml`、`vercel.json`、`src/components/dashboard/site-header.tsx`、助手工具模块及实际lodash引用。

- [x] 编辑工具栏改动态导入，只在已有编辑路由条件内渲染。
- [x] 对比自动分包与原手工分组；单独验证移除TLA转换插件、使用Vite现代浏览器基线和默认esbuild压缩的产物与耗时，再选择最终配置。
- [x] 目录排除由 `**/components/*` 等改为 `**/components/**` 等；工具模块移动到components下，验证新增嵌套组件不产生路由。
- [x] lodash使用现有包的逐方法模块，语义不改；不为了包数机械删除依赖。
- [x] HTML保持no-cache；`/assets/:path*`设置 `public,max-age=31536000,immutable`。核对动态路径不会缓存简历内容。
- [x] 对最终修改文件先Prettier，再ESLint layout；不改无关代码或现有设计。

## 任务 5：集成验收与记录

- [x] 同一环境对照dev/prod冷热载，确认轻页面不加载编辑/协作，编辑功能需要时仍可用。
- [x] 真实阅读、评论两轮、缩放、密码、恢复、权限失效、模板与PDF入口；全页面入口及重依赖按需加载检查。
- [x] `pnpm exec tsc -p tsconfig.app.json --noEmit`、`pnpm exec tsc -p tsconfig.node.json --noEmit`、相关Edge检查、`pnpm build`、`pnpm format:check`。
- [x] 后端如有变化，核对迁移账本、函数版本、线上smoke；记录未执行的真实账户或模型流程。
- [x] 写验收与长期约束，删除本轮tests脚本/夹具/生成物；分开记录实施、验证、用户审查状态。
