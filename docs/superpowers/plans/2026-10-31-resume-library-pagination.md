# 简历库统一预览与分页实现计划

> 面向 AI 代理：按 dispatching-parallel-agents 将预览缓存和列表取数拆为独立范围，主代理统一页面接入与验收。遵循用户当前分支、免 TDD 和不推送要求，不重复索要本期批准。

**目标：** 每项统一真实预览，重复访问复用成品，每页至多 10 项且云端范围读取。

**架构：** 简历页面组合现有行操作与新增预览缓存；分页查询、缓存及计数由页面 store 管理。保留现有其他页面完整列表调用契约，限制简历库路径上的所有刷新。

**技术栈：** React、Zustand、Supabase JS、IndexedDB、Motion、现有 shadcn Button / Skeleton / Empty。

- [x] 列表数据：新增受限范围查询、本地索引键与按页摘要和页面分页状态；检查筛选、计数、更新、同步、实时与删除的刷新路径。向主代理提供明确 store 接口，保留所有数据隔离。
- [x] 预览：新增页面内缓存 store 和成品首页面展示组件；读取、测量生成受限并发，完成即卸载引擎；命中直接展示。按版本失效及账户清理，图片资源随缓存管理。不修改首页源码或公共分页算法。
- [x] 页面：src/pages/resume/index.tsx 改接分页，resume-card 统一预览格式，head-bars 使用实际全局统计；移除 featured 分类分支，分页导航保留有效焦点。骨架同步。
- [x] 临时验收样本挂载正式页面，超过 20 条，覆盖云端范围参数、本地混合、缓存往返、更新失效、账号隔离、分页及菜单；实际检查桌面、手机、深色和减少动效。
- [x] 源文件 Prettier → ESLint layout，tsc、build、format:check、git diff --check；独立审查关键状态与并发，修复发现的问题。
- [x] 更新设计、防回归与验收，删除临时测试和本地样本；记录实施、验证、用户审查状态。不 commit 或 push。

## 组件检索

现有 Button、Skeleton、Empty、Tabs、DropdownMenu 与真实 ScaledReadonlyPreview 可复用；项目没有 pagination 封装，简单上一页 / 下一页用既有 Button 配合语义 nav，无需重造基础控件或新增依赖。Supabase range 为闭区间，10 项使用 from 到 from+9；精确计数使用 count，纯计数使用 head。官方参考：https://supabase.com/docs/reference/javascript/range 和 https://supabase.com/docs/reference/javascript/select。
