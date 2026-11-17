# 职业档案原件保存与文字复制实现计划

> 使用 subagent-driven-development 处理后端独立任务并审查。按用户要求在当前分支工作，不执行 TDD，不 commit 或 push；已有 package.json、锁文件及其他任务文档保持原样。

**目标：** 上传文件只校验大小并保存原件，文字档案可复制完整原文。

**架构：** 沿用 experience-sources 私有文件、版本和操作事务，新增 `file` 类型承载不提取文字的原件。文字复制使用当前版本全文专用读取，沿用账户/目标失效和原有 UI 组件。

**技术栈：** React、Zustand、shadcn/Radix、Supabase Edge/PostgreSQL、既有原件 viewer。

**状态：** 实施完成，产品验证通过，后端已部署，用户审查待进行。全仓格式检查受其他任务文件的一处排版错误阻塞，本期改动单独检查通过；具体结果见[验收记录](../specs/2026-11-17-career-archive-originals-acceptance.md)。

## 任务 1：后端原件协议和全文读取

- [x] 修改 `supabase/functions/shared/experience-source-contract.ts`：`ExperienceSourceKind` 增加 `'file'`，新类型只保存原件，兼容历史类型。
- [x] 修改 `supabase/functions/experience-sources/input.ts`、`files.ts`：新文件允许空 text/blocks，实际文件仅校验最大 10 MB 和必要协议对应关系，不检测扩展名、魔数、页数或正文；保留粘贴和历史协议的数据一致性。
- [x] 通过 `pnpm exec supabase migration new career_archive_original_files` 创建迁移，增加 `file` 枚举约束、该类型空正文与原件约束、文件大小 0–10485760；存储桶保持私有、10 MB、不限制 MIME，旧数据不改写。
- [x] 增加 `text` 读取动作，在 `read.ts`/`operations.ts`/`input.ts` 读取明确版本 `extracted_text`，仅用于无原件的文字资料；复用 owner/version/status 权限检查，不增加列表载荷，handler 沿用原实现。
- [x] 在隔离 PostgreSQL 和 Deno 上验证真实约束/输入/权限。部署由主代理在全部集成验证通过后串行完成。

## 任务 2：上传界面与原件语义

- [x] `src/lib/experience-sources/extract.ts` 删除文件解析，在 `file.ts` 提供仅检查大小和构建 `kind:'file', text:'', blocks:[]` 的文件准备逻辑；粘贴提取仍独立使用。`upload.ts` 选择对应入口，现有 operationId、signal、账户订阅保留。
- [x] `upload-dialog/index.tsx` 和助手文件 input 移除 accept，提示只保留“单份文件不超过 10 MB”；背景、经历、项目说明同步调整。
- [x] 新类型补齐 `utils.ts`、页面 `const.ts` 标签，原件 fallback、列表、SourceReader 和 AI 来源工具使用文件说明；不向 AI 承诺识别原件。
- [x] 保留已有 preview 按文件名解析与按需加载，不影响简历导入模块。原件保存不调用预览/提取库。

## 任务 3：文字复制

- [x] `src/lib/experience-sources/api.ts` 增加明确版本的全文读取函数；复制组件位于 `src/pages/experience/components/source-detail/copy-source-button/index.tsx`。
- [x] 顶部文字动作增加“复制全文”按钮，采用浏览器剪贴板 API，异步读取完整原文，优先使用支持 Promise Blob 的 ClipboardItem 保留用户手势；兼容 writeText。使用 Spinner 和 toast 提供实际状态。
- [x] 内容可在组件生命周期内复用，key 包含账户代次/资料/版本；请求和复制完成前核对账户、目标和存续状态，失败可重试，不按段落分页拼凑原文。

## 任务 4：集成和交付

- [x] 在 `tests/career-archive-originals/` 创建临时真实文件、浏览器和 API 验证；覆盖规格所有样例，重点核对无提取调用、下载字节和完整复制。
- [x] 对本期文件运行 `pnpm exec prettier <files> --write` 与 `pnpm exec eslint <files> --fix --fix-type layout`，执行 `pnpm exec tsc -b --pretty false`、`pnpm build`、`pnpm format:check` 和 `git diff --check`。
- [x] 独立审查并修复具体问题；部署迁移和 `experience-sources`，核对远端迁移账本、函数版本、真实线上保存/读取/下载/越权和清理。
- [x] 更新防回归清单和验收记录，清理本期测试/账户/服务，记录实施、验证完成及用户审查待进行，不发布前端或推送远端。
