# 编辑页内部加载优化实现计划

> 面向执行代理：按 dispatching-parallel-agents 分离表单/工具栏、文档读取、页面功能边界；主代理负责集成与审查。用户已授权本期，当前分支、不改暂存区、不提交或推送。仓库不强制 TDD，临时测试完成后删除。

**目标：** 减少进入编辑页到准确正文出现的等待，同时保证首次编辑和导出可用。
**架构：** 轻量栏目与入口常驻，业务 UI 按需加载；只读请求先发、必要引擎并行加载，副作用仍遵循既有门禁。
**技术栈：** React 19、Vite 7、Zustand、Automerge、Supabase SDK。

## 1. 基线

- [x] 阅读防回归清单及输入性能、弹窗退出、前期加载验收记录。
- [x] 保存暂存差异校验值；生产 build-report 输出 tests/editor-startup/.artifacts/baseline-dist 和依赖图。
- [x] 使用真实默认模板和合成简历，在独立浏览器记录 owner/离线冷启动及首次打开编辑栏。

## 2. 表单与工具栏

文件：editor/const.ts、types.ts、components/edit-panel、sidebar、toolbar、preparation、export、template-switch-dialog，以及可复用 deferred-content 边界。

- [x] 使用模块级按需表单，栏目排序只消费轻量信息；异步内容不替换外层 Accordion/Drawer/Tab。
- [x] 加载边界复用既有状态组件与 Button；本地重试重建失败的 lazy 组件，成功模块复用，不刷新页面。
- [x] 工具栏控制层保留，重内容按首次打开加载；保留 query 自动打开、焦点、退出期间内容和模板会话失效。
- [x] 验证字段定位在慢模块完成后落到真实输入；必要时以明确就绪信号替换固定等待窗口。

## 3. 文档与模板

文件：store/resume/slices/document.ts、sync.ts，lib/automerge 的实际静态入口，editor/hooks/use-resume-loader.ts，以及必要的轻量只读模块。

- [x] 消除 owner 读取前的非必要 WASM 静态等待；采用 dynamic import 与现有两个只读请求并行，结果在原门禁后交给 initialize。
- [x] 普通路由不触发协作 URL 校验；同步解析使用官方 slim 入口，已有 guest/bootstrap 语义不变。
- [x] 精确模板绑定一旦已知，复用现有资源缓存预取；缺失绑定沿原初始化路径，不猜测默认版本。
- [x] 回归缺失/失败零不当写入、保存后重开、账户/目标切换与 guest。

## 4. 页面功能

文件：editor/index.tsx、components/check-workspace、评论/协作展示组件及已有页面 store。

- [x] 评论面板与检查列表按需加载；保留 unread、权限复查、文档同步与检查计数需要的运行逻辑。
- [x] 保留 forceMount 的外壳，首次使用后保留有状态内容；退出不提前拆除。
- [x] 主页面仅组合已有边界，不把控制逻辑藏到尚未加载的按钮或面板里。

## 5. 集成验证

- [x] 最终生产依赖图确认：未打开表单无 Tiptap，未打开重面板无对应展示模块；文档 GET 不等待额外 WASM 延迟。
- [x] 同机测量冷/热及路由重入，记录正文与首次操作两组耗时，防止只把等待挪到点击后。
- [x] 真实 UI 普通输入、富文本连续输入/粘贴、保存重开、检查定位、工具栏与 PDF；桌面/390px、两轮开关/反向/减少动效。
- [x] 复跑 app/node TypeScript、定向 ESLint、pnpm build、pnpm format:check；交叉审查处理实际问题。
- [x] 记录验收与长期约束，删除本轮临时测试、数据、产物；校验原暂存区未变，用户最终审查单独记录。

实施完成；验证完成；用户审查待进行。具体测量、边界与未覆盖项见 [验收记录](../specs/2026-11-02-editor-startup-acceptance.md)。
