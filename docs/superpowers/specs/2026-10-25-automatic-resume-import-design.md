# 简历自动导入优化

后续修订：本地字段非空不能证明分类正确。登录后非空导入的一次免费识别、同源条目与字段合并规则，已由 [真实 PDF 分类修复](2026-10-25-import-source-ownership-design.md) 更新；下文原方案与部署记录作为历史保留。

用户要求调研上传简历自动填充方式并直接优化现有功能；补充要求是判断 AI token 成本，且基础导入消耗不应由用户承担。本期按开发后审查执行，不再逐步请求批准。覆盖旧第二期规格中强制逐模块核对的流程。

## 调研与判断

- [Kickresume 官方说明](https://www.kickresume.com/en/help-center/general/)：上传 PDF/DOCX 后将内容放入新的简历草稿，再在编辑器修改。
- [Rezi 官方指南](https://intercom.help/rezihelp/en/articles/12128962-import-resume)：上传 PDF/DOCX 创建简历，再查看各模块；官方不承诺解析绝对准确。
- [Teal 官方产品页](https://www.tealhq.com/tools/resume-builder)：支持上传现有简历或粘贴内容。其公开说明不足以判断内部模型实现，不将猜测写成事实。
- [Affinda 官方流程](https://docs.affinda.com/docs/document-classification)：文本提取、信息抽取、机器校验后，异常进入人工核验。我们借鉴自动填充与异常提示，不接入其付费服务。
- [DeepSeek 价格](https://api-docs.deepseek.com/quick_start/pricing/)（2026-10-25 核实）：Flash 峰时未缓存输入 $0.30/百万 token、输出 $1.20/百万 token。示例 4000 输入＋1000 输出约 $0.0024；不是实测，服务器与失败重试另计。使用非思考模式、固定输出上限及源文位置索引，避免全文再生成。

现有问题根因是把“读取文字”“按规则整理”“逐模块确认”都暴露成必经步骤，且确定性规则不适配公司简称和复杂布局。仅换上传框不能解决问题；单纯扩大正则也难以适配不同写法。采用本地识别优先＋低成本结构归类辅助，保留原文且不自动润色。

## 用户流程

1. 上传/拖入 PDF、DOCX 为主入口；“粘贴文字”是独立替代入口，不同时展示大块空白输入框。
2. 选择文件后自动读取、整理、回填，显示真实进度并支持取消。完成后直接进入已填好的预览，不停在原文输入框。
3. 预览以姓名、联系方式、教育、工作和项目内容为主，显示识别摘要；主按钮直接“选择模板”。需要修正才打开“修改内容”，原文折叠查看。取消逐模块已核对勾选和全部模块确认门禁，不伪造“已核实”。
4. 未归类内容明确保留在原文，可以稍后调整，不强制用户给每段选归属；没有任何有效内容时不宣称成功。选择模板后沿用现有幂等创建，进入可编辑简历。
5. 原文件不上传。使用 AI 时仅传提取文字，提前在界面用一句话说明“文件在本机读取；复杂内容会发送提取文字进行免费智能识别，不占 AI 额度”。游客使用本地自动填充，识别不足时提示登录后可免费智能识别，不强制登录才能导入。

## 识别与成本边界

- 本地提取继续沿用 10 MB、PDF 30 页、60000 字符、DOCX 展开体积保护和已有中文 PDF 字间距规则；不扩大到 OCR/扫描件或 DOC。
- 完整且可靠的本地解析直接填充；存在未归类段落、没有经历或明显缺失的主体字段时才尝试 AI。原文按行编号；最多 18000 字符、400 行进入 AI，超过限制使用本地结果并解释，不静默截断。
- AI 仅返回模块范围和原文中的短字段，服务端转换为原文行号/字符范围再返回与缓存；正文由浏览器从规范化文本恢复（NFKC 字形与首尾空白规范化，不改写语义），原始提取文字独立完整保存、随时可查看。字段必须可回溯到原文，未知字段留空；输入中的命令只作为简历数据。
- 合并保留本地可靠识别的非空字段和经历。AI 只补空字段、未识别模块或补全同一经历，不能因合法但不完整的映射丢失本地已识别内容；冲突优先保留本地，新增条目去重。未覆盖文字仍进入未归类摘要与原文。
- AI 独立使用 `resume-import` Edge Function、`deepseek-flash`、非思考模式、JSON 输出、最多 2200 输出 token、一次上游调用。模型失败、超时、额度或登录限制均保留本地结果，允许继续或重新选择文件。
- 不调用现有 `llm-proxy`，不预留、不扣减、不伪装更新用户 AI 积分。登录用户免费智能识别默认每天 10 次上游尝试、全站默认每天 1000 次，服务端可配置；这是防滥用上限，不是用户付费额度。
- 服务端按已验证账户＋规范化文字摘要＋协议版本去重，成功结果复用，处理中不会重复请求模型。每日计数和去重预留须原子化；失败重试有界且计入平台限额。仅存摘要、位置索引和计数，不存原文件/原文，缓存有过期清理。前端不能指定任意模型或 prompt。

## 接口约定

请求：`{ text: string }`，Bearer 为当前登录会话。服务器规范化为 `text.replace(/\r\n?/g, '\n').split('\n').map(line => line.normalize('NFKC').trim()).filter(Boolean)`；浏览器使用同样规则解释索引。

成功响应：`{ version: 1, mapping: ImportMapping, cached: boolean }`。协议共用纯 TypeScript 文件 `supabase/functions/shared/resume-import-contract.ts`：

```ts
type SourceSpan = { line: number; start: number; end: number }
type EntrySection =
  | 'edu_background'
  | 'work_experience'
  | 'internship_experience'
  | 'project_experience'
  | 'campus_experience'
type TextSection =
  | 'skill_specialty'
  | 'honors_certificates'
  | 'self_evaluation'
  | 'hobbies'
  | 'job_intent'
type ImportMapping = {
  basics: Partial<
    Record<'name' | 'email' | 'phone' | 'city' | 'jobTitle', SourceSpan>
  >
  entries: {
    section: EntrySection
    start: number
    end: number
    fields: Partial<
      Record<
        'title' | 'subtitle' | 'degree' | 'startDate' | 'endDate',
        SourceSpan
      >
    >
  }[]
  sections: { section: TextSection; start: number; end: number }[]
}
```

行范围 `start/end` 为零基闭区间，字符范围 `start/end` 为 JavaScript UTF-16 切片的左闭右开区间。经历和文本模块行范围不重叠，basic 字段可引用这些行。服务端将模型抄出的字符串在限定范围内匹配成 SourceSpan，匹配不到不采用；浏览器再次校验。服务器错误返回 `{ error: 'unauthorized'|'too_large'|'rate_limited'|'processing'|'unavailable'|'invalid_request' }`，不含上游密钥、原文或任意服务端异常。

## 状态与验证

验收覆盖 A→B→A 账户切换、不同账户相同文字、并发相同请求、处理实例失联后的租约恢复，以及全角字形、空行、缩进和 AI 漏掉已被本地识别的经历。

保留账户隔离、原文、草稿恢复、精确模板选择及创建幂等身份。取消、换文件、关窗、切换账户或内容改变后，旧读取/AI 返回不得覆盖当前草稿；取消不破坏之前输入。已提交创建不能重新解析。AI 整理不属于润色，不把原样搬运冒充 AI 生成经历。

沿用已有 Dialog、Button、Tabs、Collapsible、Textarea、motion 预设与减少动效。验证真实桌面/手机流程、两轮弹窗开关及快速反向、焦点、错误与未归类内容、原文不丢、成功文件无需先编辑文字或逐模块勾选。临时验证放 tests/，交付后删除。涉及服务端变更须完成隔离验证、当前链接云端部署、迁移与函数版本/线上 smoke，用户实际 AI 额度在导入前后不变。

实施状态：实现完成；已执行验证通过（范围如下）；用户审查待进行。当前分支保留改动，未提交或推送。

## 验证与部署记录（2026-10-25）

- 浏览器实际模块回归 32 项通过：中文分栏/公司简称、空内容、原文规范化、非法/重叠映射、局部岗位和重复日期、年份格式、Java/JavaScript、未映射内容保留、游客与取消、真实 PDF/DOCX 提取、线上模型返回结果在前端合并。
- 后端 12 项契约/handler 测试通过；真实 Postgres 8 项测试通过，包括同 hash 20 并发只预留一次、跨 hash 账户限额、跨账户全局限额、缓存隔离与不重复计费、租约恢复与旧 writer 拒绝、两次失败上限、过期清理、service-only 权限/RLS。
- 桌面实际走通粘贴→自动填充→预览→选择精确模板→创建本地简历→编辑器，正文与联系方式保留，无需逐模块确认。390×844 iframe 视口验证预览、按需编辑、固定页脚与滚动；完成两轮弹窗开关及关闭后立即重开，焦点恢复到入口；控制台未见 warning/error。
- 系统文件选择器未完成原生点击验收：Chrome 扩展缺少文件 URL 权限，系统操作时设备处于锁定状态。未修改浏览器权限；PDF/DOCX 文件提取已通过真实 File 对象回读验证。切换账户的前端 A→B→A 时序采用代码审查，跨账户服务端缓存采用事务测试，未冒充实际账号切换 UI 验收。
- 目标项目 resume / bitxrpdtlohlnywgusfw。迁移 20261025093029_resume_import_cache_and_limits 已应用并核对账本；resume-import v2 为 ACTIVE。平台 JWT 开关关闭，但函数内执行签名/iss/aud/role/session/sub/exp 与当前确认用户校验。
- 真实云端 smoke 使用合成内容和临时确认账户：未登录401、额外model字段400、超长413；同内容并发返回200/409，上游尝试为1；第二次200且cached=true。真实映射包含工作与教育；user_quotas、ai_credit_requests、ai_quota_daily_usage 前后完全相同。耗时约7.2秒（含并发、缓存与验证，不是单独模型耗时）；临时账户已删除。
- 首次线上检查发现既有 llm-proxy 使用 OPENAI_API_KEY 配置 DeepSeek，已兼容 DEEPSEEK_API_KEY 优先、OPENAI_API_KEY 回退并重新部署验证。
- 改动范围 Prettier / ESLint layout、TypeScript、Deno check、生产构建、git diff --check 通过。构建保留既有循环 chunk/大 chunk 提示。云端安全检查未对本次新增表/函数报告告警；其他既有告警不在本期变更范围。
- 临时脚本/样例/测试容器按仓库要求清理；开发服务与用户原有简历保持独立。

## 用户复测：识别质量问题（2026-10-25，尚未修复）

用户反馈识别结果不理想。现有功能性测试不能等同真实简历准确率验收；本节记录新复现，不将上一轮流程通过视为质量问题已解决。本轮尚未取得用户具体失败文件，不能认定以下就是该文件的全部原因。

通过实际 parseResumeText / needsImportHelp / createPdfTextAssembler 模块隔离复现（不调用模型、不发送简历）：

1. 标准“示例公司 | 前端工程师 | 2022.01—至今”正确；交换为“前端工程师 | 示例公司 | 2022.01—至今”后公司和岗位反转，needsImportHelp 仍为 false。根因是按列位置猜字段，且非空被当作可靠。
2. 将“技能”标题换成“技术能力”后，技能被并入前一工作经历正文，技能模块为空、未归类也为空，needsImportHelp 仍为 false。根因是固定标题词典和仅依据未归类/空字段触发 AI。
3. 构造按横向交错存储的双栏 PDF 文本项，输出姓名→工作标题→邮箱→公司→技能标题→日期，证明当前流式拼接没有恢复分栏阅读顺序；这是可复现的输入处理限制，尚非对用户具体 PDF 的结论。

代码审查另确认：AI 合并优先保留本地非空字段，不能充分纠正规则已填错的结果；一个字段不满足来源契约会导致整次映射被丢弃。扫描件当前无 OCR 支持。

建议下一步以用户失败样本验证：先恢复版面阅读顺序，再由一次结构识别完成语义分组；规则用于验证、补漏与失败回退，覆盖冲突须有来源证据并保留原文。扫描件/复杂版式可按需启用页面视觉识别，需明确告知发送页面图片，继续由平台承担受控成本。模型选型以同一批样本的字段准确率、经历分组与正文漏失率比较，不能仅以调用成功或字段非空验收。

截至 2026-10-25，[DeepSeek 官方视觉文档](https://api-docs.deepseek.com/guides/vision/)说明现用 Flash 支持图片输入；当前产品仅发送文本，没有启用该能力。这提供后续验证方向，不代表视觉识别已实现或保证准确。
