# 分享联系方式占位实现计划

> 按 executing-plans 执行；loading_hints 负责独立投影实现和接口验收，主代理审阅、部署与整体页面验收。用户已明确授权，当前分支，不提交不推送。

**目标：** 隐藏联系方式保留 `XXXXXXX`，公开响应没有隐藏原值，评论与附件访问限制保持。

**架构：** 仅改变既有服务端公开投影的显式字段处理，所有消费者继续使用原快照和内容哈希。

**技术栈：** TypeScript、Deno、Supabase Edge、既有模板渲染。

- [x] 确认根因与调用链：`supabase/functions/shared/resume-share-privacy.ts` → `resume-share/index.ts` → 分享快照 → 模板适配和 PDF。
- [x] 对已填显式联系方式返回七个 X，空字段仍空；保留重复正文清洗和 `canReadShareComments` 原逻辑。
- [x] 临时验证放 `tests/resume-workflow/privacy/`，直接调用真实函数，覆盖组合、空值、别名、重复敏感值、原对象不变和权限；11 项通过。
- [x] 通过真实线上来源与设置协议验证 current/history、内容修订、切换、评论凭据及合成数据清理；完整 handler Deno 2.1.4 检查通过，部署 ACTIVE v48，线上 13 组通过，区域 us-east-1。
- [ ] 浏览器恢复后验证分享字段占位及实际导出；检查改动格式、Deno、前端类型与构建，更新防回归和验收记录，删除临时脚本与数据。
