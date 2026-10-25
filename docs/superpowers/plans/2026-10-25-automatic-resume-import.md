# 自动导入简历实施计划

> **For agentic workers:** 使用 subagent-driven-development 完成可独立的服务端任务；主代理负责前端整合，完成后分别进行规格与质量审查。用户已授权调研并优化，先实现验证，再交用户审查。

**目标：** 文件选择后自动填入简历，移除逐模块确认，平台承担受控的 AI 辅助识别费用。

**架构：** 浏览器提取与原文持久化；本地解析优先；专用免费 Edge Function 返回可验证原文位置；前端预览与现有模板/幂等创建衔接。现有付费 llm-proxy 保持原样。

**技术：** React/Zustand、现有 shadcn 与 motion、PDF.js/fflate、Supabase Edge Functions/Postgres、DeepSeek Flash JSON。

- [x] 服务端与共享契约：`supabase/functions/shared/resume-import-contract.ts`、`supabase/functions/resume-import/{core,index}.ts`、CLI 创建的迁移。认证、固定 prompt/模型、原文索引校验、原子去重/限额、缓存过期、无用户额度扣减。临时 fixtures 测试不能调用真实用户简历。
- [x] 浏览器识别：`src/lib/resume-import/organize.ts` 与 source-mapping helpers，复用本地 parser；只在必要时调用免费识别；非训练内容不可当成指令；失效和错误退回保留的本地结果。完善可确定的本地姓名/标题/日期解析。
- [x] 创建流程：`hooks/use-creation-flow.ts` 自动串联读取/整理，稳定草稿结果与账户/会话版本；`utils.ts` 以有效正文允许继续，不再依赖 reviewedSections。
- [x] 交互：拆出上传/粘贴组件、已填内容预览，复用现有 Tabs/Collapsible/Button/表单；现有 review 仅作为按需编辑，不再有强制勾选。保持模板步骤、动效、焦点、取消、草稿恢复和本地/云端创建行为。
- [x] 临时验证：中文/英文、公司简称、日期、未分类、恶意模型输出、回退、重复调用及取消；实际文件 PDF/DOCX 回读；账户隔离与创建；桌面/手机及动画/键盘；无个人信息的在线 smoke。
- [x] Prettier、ESLint layout、改动范围 lint、TypeScript、构建；只修本任务问题。
- [x] 部署与确认：云端迁移、函数版本、限额/去重隔离验证、线上 unauthorized/有效解析 smoke、AI 积分无扣减。不可读密钥进日志。
- [x] 审查、删除临时 tests/ 文件、补防回归清单和最终验证记录；不提交、不推送。

组件检查：已有 `components/ui` 包含 Dialog、Button、Tabs、Collapsible、Input、Textarea 等；上传区域组合已有 Button 与隐藏 file input，不添加新的交互组件库。

验证范围和原生文件选择器限制见对应设计文档末尾记录；实现、验证、用户审查状态分开记录。
