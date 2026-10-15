# 求职跟进账号隔离实现计划

**目标：** 在账号切换后隔离职位数据、编辑草稿及全部延迟请求。

**架构：** tracker 账号作用域提供稳定快照与变更订阅；store 同步失效队列并重置页面，读取 hook 负责新账号加载。职位 API 接收可选身份校验回调，覆盖等待会话期间的切换。

**技术栈：** React、Zustand、TypeScript、现有 Supabase 客户端。

按用户要求在当前分支自行执行，复用隔离验证脚本；不执行 TDD、提交、推送或数据库部署。

- [x] 记录本轮基线，复现跨账号残留及队列问题。
- [x] 新建 `src/pages/tracker/lib/account-scope.ts`：身份代次、订阅、校验函数、取消错误；`resume-resources.ts` 复用作用域。
- [x] 修改 `store.ts`、`store/workflow-save.ts`：作用域重置、计时器清理、旧 Promise 与队列失效、归属校验。
- [x] 修改 `hooks/use-tracker-jobs.ts`、`index.tsx`：身份变化加载、局部编辑状态重置、清理回调限制在原会话。
- [x] 修改 `src/lib/supabase/resume/company.ts`：可选身份 guard 在获取用户后、发出请求前执行。更新新增职位和 `src/lib/ai/tools/tracker.ts` 的延迟确认入口，阻止跨账号执行与回填。
- [x] 检查现有异步操作回调，忽略会话切换取消错误，确保不会关闭新账号弹窗或提示旧结果。独立审查补查 `src/lib/ai/tools/crud.ts` 的 AI 删除入口，将其接入同一 scope 与删除队列。
- [x] 在 `.superpowers/sdd/tracker-account-isolation-20261015/` 验证竞态矩阵，并回归原自动保存、缓存及选择器脚本。
- [x] 执行 `pnpm exec eslint`（本轮源码）、`pnpm exec tsc -p tsconfig.app.json --noEmit`、`pnpm build`；审查本轮 diff，记录验证结果。

## 验收结果

- 基线复现：切换后保留 2 个旧职位、选中项和 pending 草稿，随后发出 1 次旧写入。修复后均清空，旧写入为 0。
- 账号隔离 19 组、AI 删除隔离 8 组通过；原保存回归 29 组、防抖/生命周期 12 组、简历缓存 13 组、展示选择器 6 组及笔记编辑器检查通过。
- 真实 tracker 组件配合本地隔离 API 的浏览器验证：A → B → A 清空表单并按身份加载；旧轮次草稿取消且不发请求；旧创建结果不进入新账号；同账号刷新不增加职位读取；B 账号阶段推进和备注关闭刷新成功。浏览器无 error/warn。
- ESLint、TypeScript、构建通过，最终构建 55.20 秒；仅保留既有大分包提示。独立审查未发现剩余阻断项。
- 所有验证使用合成账号与隔离 API，未操作真实账号和云端数据。详细记录、截图和本轮差异位于 `.superpowers/sdd/tracker-account-isolation-20261015/`。
