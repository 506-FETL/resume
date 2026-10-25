# 第二期实现计划

> 面向 AI 代理：使用 subagent-driven-development 分任务实现与审查。用户已授权开发后审查；当前分支工作，不提交、不推送。仓库无需 TDD，临时验证放 tests/，结束删除。

**目标：** 从真实简历导入、逐项核对，到编辑与检查后导出。

**架构：** 客户端解析和核对向导复用模板创建流程，正文持久化保持原有契约。本地准备记录按账户隔离，存放草稿、原文和检查证据，不进入公开快照。

**技术栈：** React、Zustand、IndexedDB、Zod、Motion；PDF.js 与 DOCX 文本解析按需加载。

## 全局约束

- 所有新动效接入 useReducedMotion，沿用 EASE / DURATION。
- 旧文件异步结果不能覆盖新操作，账户切换不能泄漏草稿或打开旧账户结果。
- 原文不静默丢失；确认后创建新简历，不覆盖旧简历。
- 数据用途和保存位置在输入前可见；仅依据可追溯证据检查示例和 AI 表述。
- 保留已通过审查的 tracker 变更；批量操作不动。

## 任务 1：文档提取与确定性整理

创建 `src/lib/resume-import/{types,const,parse,extract,pdf-text,text}.ts`，修改 package.json / pnpm-lock.yaml。独立模块契约：

```ts
type ExtractedResumeText = { text: string; sourceName: string }
type ParsedResumeImport = {
  content: ResumeSchema
  unassignedText: string
  warnings: string[]
}
// parseResumeText(text: string): ParsedResumeImport
// extractResumeFile(file: File, signal?: AbortSignal): Promise<ExtractedResumeText>
// createBlankResume(): ResumeSchema
// textToResumeHtml(text: string): string
// resumeHtmlToText(html: string): string
```

- [x] 阅读现有表单 schema，建立空白内容，不使用默认示例姓名。
- [x] 识别基本信息、教育、工作、实习、项目、校园、技能、荣誉、自评及意向；保持字段真实，未识别文本放 unassignedText，原文由调用方完整保留。
- [x] PDF 使用 worker，DOCX 只提取文本不执行 HTML；10 MB / 30 页 / 60000 字符限制，提供明确错误，支持取消并释放资源。
- [x] 在 tests/ 构建 PDF/DOCX 与解析夹具，验证文本保留、格式错误和取消；报告结果后删除。

## 任务 2：准备记录与创建向导

创建 `src/lib/resume-preparation/`（账户隔离的草稿/证据存取）；创建 `src/pages/resume/components/create-resume-card/{components,hooks,store.ts,types.ts,const.ts,utils.ts}` 内部模块；修改其 index.tsx 与 `src/lib/resume-template/create/{types,prepare}.ts`。

- [x] 扩展创建输入 `content?: ResumeSchema`；传入时只读取模板定义，不读取示例，继续走现有幂等保存流程。
- [x] 三种开始方式；人群示例起点；旧简历粘贴/文件、核对、逐项确认；名称自动生成。
- [x] 原文与模块字段对照，提供未归类处理和原文保留确认。只将核对后的 content 送创建服务。
- [x] 保存草稿，重新打开/刷新恢复；保存失败提示；账户切换清空当前视图并加载相应记录。
- [x] 成功后绑定原文与简历 ID、删除对应草稿、显示真实保存位置；保存结果不确定时沿用同一操作重试，不重复创建。

## 任务 3：填写建议、导出检查与首页

创建 `src/lib/resume-preparation/checks.ts`，`src/pages/resume/editor/components/preparation/`、`components/export/check-list/`。修改 export/index.tsx、editor/index.tsx、home/index.tsx 和 AI 内容应用边界。

- [x] 对应人群建议和明确示例复制记录；导入原文按需查看。
- [x] 姓名、联系方式、有效经历、示例及 AI 证据检查；定位模块、填理由忽略、确认 AI；以内容签名绑定处理结果。
- [x] 首页恢复草稿和进入导出检查；创建成功反馈本地/云端。
- [x] 保持既有导出实现，只在入口加入检查；通过真实入口验证 Word 和 PDF。

## 任务 4：验证与交付记录

- [x] 针对已完成模块做规格/质量审查，修复重要问题。
- [x] 浏览器覆盖桌面/窄屏、键盘、焦点、错误/取消/恢复/减少动效和两轮开关。
- [x] 改动文件运行 Prettier、ESLint layout、ESLint、`pnpm exec tsc --noEmit`、`pnpm build`。
- [x] 准备 `docs/product-phase-two-user-study.md`，列出 5～8 人试用步骤与记录表，真实结果空缺明确标示尚未执行。
- [x] 更新路线图、规格/计划真实验收状态和防回归规则，删除临时 tests/ 文件，交用户审查。

## 实施与验收记录（2026-10-25）

状态：P2-01～P2-06 已实现并完成开发验证，规格与质量复审通过，待用户审查。P2-07 仅准备试用流程，尚未招募或开展真实用户试用。

### 已验证的流程

- 粘贴、文字 PDF、DOCX 读取与字段核对；不确定内容保留，日期覆盖 1～12 月及“至今”。扫描、加密、损坏、超限和不支持文件有明确错误；取消、替换与旧异步结果不覆盖新输入。
- 从首页导入、核对、创建本地简历并打开编辑；人群起点与已有简历的岗位定制入口。刷新恢复草稿、多行输入保留、存储失败提示、账户切换隔离均已检查。
- 创建结果未知后，重建 store 再重试只插入一次，沿用同一 ID；自带正文不读取模板示例。云端失败场景使用隔离的接口模拟，没有改写真实用户云端数据。
- 复制示例、编辑后取消提示、说明忽略原因、撤销处理、跳转编辑、AI 真实应用与来源记录、内容签名失效、隐藏/删除条目及二代派生继承均已覆盖。“不填”和技能展示方式不会当作示例正文，已有内容却缺少经历名称会提示。
- 同步和派生的来源接续进行了 29 条隔离断言；复审补充 19 条断言，覆盖响应丢失后继续编辑、上传期间编辑、云端内容冲突、重置失败、模型关键词变化及稳定 ID 重试。冲突时保留本地，不能凭云端存在就删除本地新内容。
- 检查记录后台刷新保留输入与焦点；导出前等待真实来源加载，读取失败可重试。准备记录只在本浏览器保存，界面不把缺少来源记录称为“事实已验证”。
- 桌面、390 px 和 320 px 窄屏实测；导出弹窗正文滚动，底部按钮保持可见，无页面横向溢出。填写建议和导出弹窗各完成两轮开关及退出中反向打开；减少动效时动画归零。相关路径未出现页面异常或浏览器焦点/aria-hidden warning。

### 实际导出与回读

通过编辑器的实际导出按钮获得 Word 文件，检查其中姓名、联系方式、公司、日期和正文；未宣称完成原生 Microsoft Word 排版验收。保留现有 Word 输出方式，不将它误称为 DOCX。

PDF 通过真实导出入口完成现有布局稳定性检查，再用相同打印 DOM 生成 A4 PDF；背景开、关两份输出均为一页，文本提取和画面检查正确。使用该 PDF 原字节再次走页面文件选择和核对，确认“陈禾”、中文标题、公司与岗位分隔、2022-10～2025-12 都正确，未归类区为空。本次未改打印几何，不将这一页验收扩大称为所有模板和分页回归。

### 交付边界

- 原文、草稿和检查记录按账户保存在本浏览器；同设备同步和岗位定制继承，换设备不自动同步这些附属记录。原文件不上传，原文不进入分享或导出正文。
- 没有数据库迁移或 Edge Functions 变更，无新增后端部署。云端请求失败、账户变化和重试用隔离模拟覆盖；没有借验收写入真实账户。
- 真实用户试用未执行，见 [试用流程与空白记录表](../../product-phase-two-user-study.md)。完成率与耗时暂不填写。
- 既有求职跟进页面和批量操作未改动。未提交、未推送；临时验收脚本、夹具和报告按仓库约定清理，结论保留在本计划。

### 最终工程检查

- 47 个改动文件的 Prettier 检查通过；40 个源码文件已执行 ESLint layout 修复和 lint，无 error。保留两处原有 unused warning：change-log 的 `_undone`、jd-variant 的 `_get`。
- `pnpm exec tsc --noEmit`、`git diff --check` 通过；最后一次 `pnpm build` 成功，用时约 18 秒。
- 构建仍提示 tiptap-editor / radix-ui 循环分块及部分 chunk 超过 500 kB。PDF.js 与 worker 按文件读取动作加载，未改全局分包策略；这些构建提醒没有在本期冒充已解决。
- 最终定向复审确认同步快照冲突、已有派生重置失败和重试身份三项 P2 已关闭，规格与质量结论均为通过。用户审查状态单独保留。

## 用户审查后的调整

2026-10-25：五项反馈已按最新要求修正，详见 [创建流程修正与验收](2026-10-25-creation-review-fixes.md)。从零改为对应人群示例，两条新建路径都要选择模板；每次重新打开回入口，主动继续才能恢复草稿。保留此前导入、来源与账户边界。
