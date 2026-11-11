# 创建入口与求职推进返修计划

> 按 dispatching-parallel-agents 对独立模块分工；本轮已获用户授权，直接完成实现与验证。遵循仓库要求，不采用 TDD、不创建分支、不提交或推送。

**目标：** 统一模板创建信息步骤，修正手机预览、返回定位与加载反馈，并消除求职推进回退和重复保存等待。

**架构：** 模板目录复用当前创建草稿、工作区与创建流水线，保持精确示例。求职前端先修复查看状态与全表重载，再依据实际 Edge 链路做最小必要优化。

**技术栈：** React、Zustand、现有 shadcn 封装、Motion、Supabase。

## 1. 创建入口与手机预览

文件：src/pages/template/hooks/use-template-creation.ts、components/preview-dialog/index.tsx、components/template-card/index.tsx；src/pages/resume/components/create-resume-card/ 下工作区、store、类型及详情表单。

- [x] 查明目录全部创建入口，复用当前详情流程并传递精确模板、示例及存储模式；点击下一步前不调用创建 API。
- [x] 按用户最新纠正，手机保持全宽向下渐隐背景，高度增加到约 320–384px，渐隐起点下移；正文统一滚动、页脚常驻，桌面保持已确认的渐隐背景。
- [x] 返回时仅滚动目录到已选模板并交接焦点；处理异步恢复条目后再定位。
- [x] 增加恢复所选目录条目的加载/失败状态，接通图片解码 Spinner 与重试，保留减少动效。
- [x] 扩展 tests/resume-workflow/creation 合成夹具；11 组目录/flow 与 5 组流水线通过，已完成的独立脚本清理。
- [x] 实际页面核验手机、桌面、返回定位、反向、两轮开关及焦点；修正实际采样发现的滚动投影跳动。
- [ ] 目录入口与各慢资源、失败重试场景的完整页面验收，数据检查与页面检查继续区分。

## 2. 推进与保存关键路径

文件：src/pages/tracker/components/drawer/index.tsx、submission-dialog/index.tsx、store.ts、store/workflow-save.ts、store/submissions.ts、src/lib/supabase/resume/submissions.ts；确有证据才修改 supabase/functions/job-submissions/。

- [x] 不在打开投递弹窗时清除 viewingStage；覆盖取消、失败、成功及换岗位。
- [x] 移除保存成功后的重复 reloadJobs，按目标确认并合并真实结果，保持字段版本、保存队列和账户边界。
- [x] 检查更正、未知结果查询与投递缓存更新，不把已成功提交误报为待重试，不反复拉全表。
- [x] 记录改前/改后请求链路；如涉及服务端改动，验证旧协议、幂等重试、无原件/平台/文件及越权，再部署 linked 项目并线上核验。
- [x] tests/resume-workflow/tracker-followup/ 中使用真实实现验证关键请求与状态，保留非敏感结果于验收文档。

## 3. 集成检查

- [x] 对改动文件先 pnpm exec prettier --write，再 pnpm exec eslint --fix --fix-type layout；执行类型、构建和 pnpm format:check。
- [x] 已按 review-animations 完成静态复核，动态未验收状态记入验收文档。
- [x] 浏览器连接恢复后完成真实手机、焦点、两轮开关及反向动画验收。
- [x] 写验收记录和防回归条目；清理本轮临时账户、数据、凭据及完成的测试脚本。此前仍未完成的验收材料保持可追溯。
- [x] 分别记录实施完成、验证通过和用户审查状态，不把本地改动当成前端已发布。

实施与数据/工程验证完成；手机独立纸张方案被用户否定后，已修正为加高的渐隐背景并完成实际页面复核。保留尚未完成项目所需的页面夹具，详见对应 acceptance 文档。
