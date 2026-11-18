# 工作台首屏依赖优化实施计划

> 使用 executing-plans 在当前分支逐项执行。用户已授权本轮实现后审查；无需 TDD，不创建 worktree，不提交或推送。

**目标：** 减少工作台真实首屏资源与等待，同时保持预览、权限和交互。

**架构：** 轻量只读数据入口与按需 UI/修复边界；沿用现有组件和模板引擎。

**技术栈：** React 19、Vite 7、Zustand、Radix、Lighthouse、Playwright。

- [x] 保存生产基线与两份固定合成简历，使用现有 Lighthouse/Chrome 工具记录桌面和手机数据；临时文件放 `tests/workspace-performance/`。
- [x] 将 `src/lib/schema/resume` 中简历类型与模板绑定检查拆到独立轻模块；保持旧入口 re-export。将摘要读取从 `src/lib/supabase/resume/form.ts` 和离线 manager 的修复/写入闭包分离，更新首页消费者。
- [x] 首页 ATS/岗位等工具引用具体实现，避免 barrel 引入编辑流程。保持统计口径与校验，不复制业务逻辑。
- [x] 调整 `src/components/route-skeleton` 和 App 启动依赖，仅当前路由下载相应骨架；保持已知标题、布局和失败反馈。
- [x] 将首屏共享 UI 的 `radix-ui` 导入换成已安装的兼容 primitive；检查真实渲染和菜单/侧栏两轮开关及反向。
- [x] 将 `src/index.css` 的 Tailwind 扫描限制到实际源码，比较正式 CSS、页面样式及测试夹具对 CSS 的影响。
- [x] 实测首页重复 GET 的触发条件，用页面 store 或在途共享消除重复，保持失败重试与账户代次隔离；必要时只调整有证据的调用点。
- [x] 对改动文件执行 Prettier、ESLint layout；运行 TypeScript、format:check、build、真实浏览器回归和前后同数据 Lighthouse。最终记录收益、范围和未发布状态；更新防回归清单并清理临时文件/服务。

实施已完成；类型、格式、构建与本轮浏览器验证已通过，用户审查待进行。完整结果见[验收记录](../specs/2026-11-18-workspace-startup-acceptance.md)。
