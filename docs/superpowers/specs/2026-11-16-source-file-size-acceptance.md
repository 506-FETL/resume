# 全源码拆分与文件预览验收

日期：2026-11-16。基线 `0ae0920f`，在当前分支工作，未提交或推送。

## 交付范围

初扫 98 个超限代码文件，补查发现 11 个邮件 HTML 和 1 份编辑器示例 JSON。合计 110 个，按用户确认保留 11 个已执行的历史迁移，其余 **99 个超限维护源码全部拆分**。组件、hooks、store slices、协议与操作分别组织，通过 index 保留公开入口。邮件源码按语义模块生成完整邮件，不压行、不改文案/样式/认证变量，生成产物位于被忽略的 `supabase/templates/dist/`；13 份输出均与原模板逐字节相等。

### 关键结果

- 77 个前端 TS/TSX 原入口的公开导出完全相同；1589 个前端模块的静态运行时依赖图中，涉及改动文件的循环为 0。
- 路由候选仍为原来的 19 个，没有将组件/helper 识别为新页面。
- 两份首页 CSS 展开后、编辑器按钮 SCSS 编译后的内容与基线等价，层叠顺序不变。
- 78 个迁移文件的 SHA-256 均与基线一致，部署前后云端 78 条账本相同。
- ESLint 已检查物理行数（含空行/注释）：JS/TS/MJS、CSS/SCSS、SQL/SQL include、前端 JSON 和邮件 HTML。401 行的五类样本及一个新迁移路径都被拒绝；已执行迁移只有精确路径例外。`.sql.inc` 不交给 Prettier 的 HTML parser，仍受行数检查和真实 PostgreSQL 验证。

## 文件原件加载修复

详情读取、原件下载、viewer 与 PDF 引擎加载原先连续等待；每次重开还会创建 worker、重新解析绘制。已知当前文件版本时并行发起必要读取，并提前准备对应 viewer；已预载组件直接渲染，避免首次 lazy Promise 的额外等待。历史版本按自身文件名选择类型，防止把当前 PDF 的引擎误加载到历史 TXT。

PDF 仅保留最近一次首屏成品，用弱引用 Blob 身份、实际容器宽度和像素比例匹配；账户或版本更新沿原件缓存链路失效。复开首屏不创建 worker，翻页按需解析，退出销毁 worker；不同组件取得画布副本，避免互相搬走 DOM。

### 同机受控对照

本机开发模式、相同两页合成 PDF，详情读取固定 500ms、原件传输固定 400ms，实际执行 viewer 加载、PDF.js、worker 和绘制。三轮旧/新配对：

| 指标                |    旧版范围 |  新版范围 |
| ------------------- | ----------: | --------: |
| 点击至真实首屏      | 1852–1869ms | 857–865ms |
| 同版本再次打开      |   193–196ms |   16–19ms |
| 两次打开累计 worker |           2 |         1 |

这是受控实验，不是用户原文件的公网速度承诺。另在线上合成 PDF smoke 中读取约 533ms、下载约 643ms，均实际运行于 us-east-1；样本不用于推断固定网络收益。

Chromium、WebKit 实际验证首屏、逐像素相同的缓存重开、1→2→1→2 翻页、不同 Blob 隔离、390px 调整、损坏 PDF 重试、下载失败重试。当前 PDF/历史 TXT 不加载 PDF 引擎，当前粘贴文字/历史 PDF 正确打开。独立审查发现重命名保存中关闭弹窗后错误丢失，已恢复 SourceActions 共享操作状态，并以旧新延迟失败场景复验；worker 创建/销毁最终 3/3。

## 行为与导出验证

- 基础库、评论与页面数据：78 项浏览器旧新差分，覆盖解析、ATS、评论 pending/失败/realtime 先到/HTTP 确认、协作批次顺序、真实 IndexedDB 的 23 条 10/10/3 分页、账户 A→B→A、历史/分享缓存去重、过期响应和失败重试。
- 跟进、助手及编辑器：287 条纯模块对照、27 条保存队列断言、11 条加载门禁；实际 useChatStream 队列停止/未知结果恢复一致。桌面和窄屏两轮弹窗、退出中反向切换、焦点、联系人/跟进保存、间距确认/放弃通过。
- 共享 UI：桌面 1100px 与移动 390px，上传接受/拒绝/删除/清空/重选、键盘/鼠标/触屏拖拽、Escape/失焦取消、预览和 body 样式清理、SideTabs 焦点/默认值、数字动画回调；旧新事件相同，无 pageerror。
- 后端：129 个既有顶层函数体未变；真实旧新 handler、Supabase SDK、ES256/JWKS，仅在 HTTP 边界提供合成数据，39 个协议场景逐响应/请求顺序相等。覆盖归属复查、原件字节、评论增量、分享设置持久化/旧密码协议、模型账本/流式/空流/429。
- PostgreSQL：隔离 PG17 应用全部历史迁移，原 005 维护验证拆分后仍为 Files=1、Tests=32、PASS；SQL include 未被递归重复执行。
- PDF 导出：真实 CanonicalPagedDocument + useResumePrint 入口，通过字体/图片、打印副本重新测量和签名校验后接管系统 print，使用该副本生成最终 PDF。默认短 2 段/1 页、临界 48 段/1 页（余 8.44px，49 段即第二页）、长 120 段/3 页，另有彩色 ribbon；旧新 × 背景开关共 16 份 PDF、24 个栅格页，文本顺序与像素哈希相等。default@3、asu@1、classic-ribbon@3 的 DOM/分页签名相同，跨区域预算和主投影拒绝仍生效。
- 邮件：13 份生成 HTML 与基线逐字节相等，重复生成哈希相同；示例 JSON 的 15 个内容块组合后与原对象深等，未接入真实编辑器。

测试使用官方模板示例和合成资料，没有操作用户简历。没有进行真实模型计费调用或双端真人协作；系统“另存为 PDF”对话被测试接管，不能描述为手动系统打印验收。

## 检查与部署

TypeScript、ESLint、Prettier、生产构建、Deno 2.5.6 check、git diff 检查通过。临时文件清理后，全项目 `pnpm format:check`、`pnpm exec tsc --noEmit`、`pnpm build` 与 `git diff --check` 再次通过；最终构建耗时 18.23s。ESLint 保留既有 64 条 warning、0 error，构建保留既有大 chunk 提示，没有提高阈值或压制规则。

| Edge Function      | 部署前 | 部署后 |
| ------------------ | -----: | -----: |
| llm-proxy          |     50 |     51 |
| resume-share       |     48 |     49 |
| resume-comments    |     46 |     47 |
| job-submissions    |      4 |      5 |
| experience-sources |      4 |      5 |

链接项目为 `bitxrpdtlohlnywgusfw`。18 项线上 smoke 通过：5 个 OPTIONS 与 x-region CORS、未登录拒绝、空资料列表、合成 PDF 保存/读取/字节下载、跨账户下载拒绝、改名/删除、未知评论/分享/投递目标、模型未登录/无效输入拒绝。响应地区均 us-east-1。两名临时账户删除后 SQL 复查剩余 0，测试资料经正式删除入口清理。迁移 CLI 直连首次失败，没有记作通过；使用 Supabase 连接工具只读核对全部账本，与本地一致。

前端未发布；邮件生成产物未发布，认证配置未改，也未发送邮件。临时服务、数据库卷、测试脚本/数据与 PDF 已全部清理，仅保留本文非敏感证据。

## 原超限入口映射

| 原文件                                                                                         | 原行数 | 当前入口                                                                                       |
| ---------------------------------------------------------------------------------------------- | -----: | ---------------------------------------------------------------------------------------------- |
| `src/components/animate-ui/primitives/texts/sliding-number.tsx`                                |    461 | `src/components/animate-ui/primitives/texts/sliding-number/index.tsx`                          |
| `src/components/jd-variant/components/generator-dialog.tsx`                                    |    433 | `src/components/jd-variant/components/generator-dialog/index.tsx`                              |
| `src/components/jd-variant/components/tasks-dialog.tsx`                                        |    458 | `src/components/jd-variant/components/tasks-dialog/index.tsx`                                  |
| `src/components/resume/pagination/utils.ts`                                                    |    576 | `src/components/resume/pagination/utils/index.ts`                                              |
| `src/components/resume/runtime/declarative-renderer.tsx`                                       |    638 | `src/components/resume/runtime/declarative-renderer/index.tsx`                                 |
| `src/components/tiptap-ui-primitive/button/button-colors.scss`                                 |    429 | `src/components/tiptap-ui-primitive/button/button-colors.scss`                                 |
| `src/components/ui/cross-list-drag.tsx`                                                        |   1262 | `src/components/ui/cross-list-drag/index.tsx`                                                  |
| `src/components/ui/file-upload.tsx`                                                            |   1483 | `src/components/ui/file-upload/index.tsx`                                                      |
| `src/components/ui/responsive-dialog.tsx`                                                      |    435 | `src/components/ui/responsive-dialog/index.tsx`                                                |
| `src/components/ui/side-tabs/side-tabs-provider.tsx`                                           |    424 | `src/components/ui/side-tabs/side-tabs-provider/index.tsx`                                     |
| `src/features/experience-sources/upload-dialog/index.tsx`                                      |    437 | `src/features/experience-sources/upload-dialog/index.tsx`                                      |
| `src/features/resume-comments/api/cache.ts`                                                    |    583 | `src/features/resume-comments/api/cache.ts`                                                    |
| `src/features/resume-comments/api/client.ts`                                                   |   1091 | `src/features/resume-comments/api/client.ts`                                                   |
| `src/features/resume-comments/api/performance.ts`                                              |    413 | `src/features/resume-comments/api/performance.ts`                                              |
| `src/features/resume-comments/components/comment-tree.tsx`                                     |    472 | `src/features/resume-comments/components/comment-tree.tsx`                                     |
| `src/features/resume-comments/hooks/use-comment-actions.ts`                                    |    724 | `src/features/resume-comments/hooks/use-comment-actions.ts`                                    |
| `src/features/resume-comments/hooks/use-comment-realtime.ts`                                   |    618 | `src/features/resume-comments/hooks/use-comment-realtime.ts`                                   |
| `src/features/resume-comments/store/create-store.ts`                                           |    690 | `src/features/resume-comments/store/create-store.ts`                                           |
| `src/lib/ai/agent/agent-loop.ts`                                                               |    424 | `src/lib/ai/agent/agent-loop/index.ts`                                                         |
| `src/lib/ai/tools/crud.ts`                                                                     |    634 | `src/lib/ai/tools/crud/index.ts`                                                               |
| `src/lib/ats/assessment-input.ts`                                                              |    489 | `src/lib/ats/assessment-input.ts`                                                              |
| `src/lib/ats/result.ts`                                                                        |   1011 | `src/lib/ats/result.ts`                                                                        |
| `src/lib/automerge/collaboration/supabase-network-adapter.ts`                                  |    517 | `src/lib/automerge/collaboration/supabase-network-adapter/index.ts`                            |
| `src/lib/collaboration/session/store.ts`                                                       |   1135 | `src/lib/collaboration/session/store/index.ts`                                                 |
| `src/lib/offline-resume-manager.ts`                                                            |   1013 | `src/lib/offline-resume-manager/index.ts`                                                      |
| `src/lib/resume-checks/proofread.ts`                                                           |    572 | `src/lib/resume-checks/proofread/index.ts`                                                     |
| `src/lib/resume-checks/rules.ts`                                                               |    468 | `src/lib/resume-checks/rules/index.ts`                                                         |
| `src/lib/resume-import/extract.ts`                                                             |    507 | `src/lib/resume-import/extract/index.ts`                                                       |
| `src/lib/resume-import/mapping.ts`                                                             |    469 | `src/lib/resume-import/mapping/index.ts`                                                       |
| `src/lib/resume-import/parse.ts`                                                               |    515 | `src/lib/resume-import/parse/index.ts`                                                         |
| `src/lib/resume-template/declarative/schema.ts`                                                |    491 | `src/lib/resume-template/declarative/schema.ts`                                                |
| `src/lib/supabase/resume/company.ts`                                                           |    442 | `src/lib/supabase/resume/company/index.ts`                                                     |
| `src/lib/supabase/resume/history/queries.ts`                                                   |    463 | `src/lib/supabase/resume/history/queries/index.ts`                                             |
| `src/lib/supabase/resume/share.ts`                                                             |    695 | `src/lib/supabase/resume/share/index.ts`                                                       |
| `src/lib/supabase/resume/variant.ts`                                                           |    404 | `src/lib/supabase/resume/variant/index.ts`                                                     |
| `src/lib/tiptap-utils.ts`                                                                      |    565 | `src/lib/tiptap-utils/index.ts`                                                                |
| `src/pages/assistant/components/assistant-canvas/change-log/index.tsx`                         |    745 | `src/pages/assistant/components/assistant-canvas/change-log/index.tsx`                         |
| `src/pages/assistant/components/assistant-canvas/resume-preview/annotation-controls/index.tsx` |    681 | `src/pages/assistant/components/assistant-canvas/resume-preview/annotation-controls/index.tsx` |
| `src/pages/assistant/components/composer/index.tsx`                                            |    613 | `src/pages/assistant/components/composer/index.tsx`                                            |
| `src/pages/assistant/components/message-list/index.tsx`                                        |    439 | `src/pages/assistant/components/message-list/index.tsx`                                        |
| `src/pages/assistant/hooks/use-chat-stream.ts`                                                 |   1644 | `src/pages/assistant/hooks/use-chat-stream/index.ts`                                           |
| `src/pages/assistant/utils.ts`                                                                 |    431 | `src/pages/assistant/utils/index.ts`                                                           |
| `src/pages/experience/components/source-detail/index.tsx`                                      |    587 | `src/pages/experience/components/source-detail/index.tsx`                                      |
| `src/pages/history/store/history-data.ts`                                                      |    517 | `src/pages/history/store/history-data/index.ts`                                                |
| `src/pages/history/utils.ts`                                                                   |    418 | `src/pages/history/utils/index.ts`                                                             |
| `src/pages/index/components/insight-cards/index.tsx`                                           |    562 | `src/pages/index/components/insight-cards/index.tsx`                                           |
| `src/pages/index/insights.ts`                                                                  |    659 | `src/pages/index/insights.ts`                                                                  |
| `src/pages/optimize/utils.ts`                                                                  |    422 | `src/pages/optimize/utils/index.ts`                                                            |
| `src/pages/resume/components/create-resume-card/components/review/index.tsx`                   |    466 | `src/pages/resume/components/create-resume-card/components/review/index.tsx`                   |
| `src/pages/resume/components/create-resume-card/components/template-picker/index.tsx`          |    575 | `src/pages/resume/components/create-resume-card/components/template-picker/index.tsx`          |
| `src/pages/resume/components/create-resume-card/hooks/use-creation-flow.ts`                    |    409 | `src/pages/resume/components/create-resume-card/hooks/use-creation-flow/index.ts`              |
| `src/pages/resume/components/create-resume-card/index.tsx`                                     |    716 | `src/pages/resume/components/create-resume-card/index.tsx`                                     |
| `src/pages/resume/editor/components/check-panel/index.tsx`                                     |    467 | `src/pages/resume/editor/components/check-panel/index.tsx`                                     |
| `src/pages/resume/editor/components/editor-workspace/index.tsx`                                |    746 | `src/pages/resume/editor/components/editor-workspace/index.tsx`                                |
| `src/pages/resume/editor/components/forms/skill-specialty/index.tsx`                           |    447 | `src/pages/resume/editor/components/forms/skill-specialty/index.tsx`                           |
| `src/pages/resume/editor/components/toolbar/spacing-settings.tsx`                              |    510 | `src/pages/resume/editor/components/toolbar/spacing-settings/index.tsx`                        |
| `src/pages/resume/editor/hooks/use-comment-review-mode.ts`                                     |    464 | `src/pages/resume/editor/hooks/use-comment-review-mode/index.ts`                               |
| `src/pages/resume/editor/hooks/use-resume-loader.ts`                                           |    574 | `src/pages/resume/editor/hooks/use-resume-loader/index.ts`                                     |
| `src/pages/resume/index.tsx`                                                                   |    665 | `src/pages/resume/index.tsx`                                                                   |
| `src/pages/resume/store/library.ts`                                                            |    645 | `src/pages/resume/store/library/index.ts`                                                      |
| `src/pages/share/store/data.ts`                                                                |    492 | `src/pages/share/store/data/index.ts`                                                          |
| `src/pages/tracker/components/board/index.tsx`                                                 |    587 | `src/pages/tracker/components/board/index.tsx`                                                 |
| `src/pages/tracker/components/drawer/activity-timeline/index.tsx`                              |    622 | `src/pages/tracker/components/drawer/activity-timeline/index.tsx`                              |
| `src/pages/tracker/components/drawer/add-job/index.tsx`                                        |    522 | `src/pages/tracker/components/drawer/add-job/index.tsx`                                        |
| `src/pages/tracker/components/drawer/contacts/index.tsx`                                       |    403 | `src/pages/tracker/components/drawer/contacts/index.tsx`                                       |
| `src/pages/tracker/components/drawer/index.tsx`                                                |    806 | `src/pages/tracker/components/drawer/index.tsx`                                                |
| `src/pages/tracker/components/drawer/interview-sub-stages/index.tsx`                           |    534 | `src/pages/tracker/components/drawer/interview-sub-stages/index.tsx`                           |
| `src/pages/tracker/components/drawer/submission-dialog/index.tsx`                              |    562 | `src/pages/tracker/components/drawer/submission-dialog/index.tsx`                              |
| `src/pages/tracker/components/drawer/submission-list/index.tsx`                                |    501 | `src/pages/tracker/components/drawer/submission-list/index.tsx`                                |
| `src/pages/tracker/components/list/job-table.tsx`                                              |    731 | `src/pages/tracker/components/list/job-table/index.tsx`                                        |
| `src/pages/tracker/store.ts`                                                                   |    472 | `src/pages/tracker/store/index.ts`                                                             |
| `src/pages/tracker/store/workflow-save.ts`                                                     |   1062 | `src/pages/tracker/store/workflow-save/index.ts`                                               |
| `src/pages/tracker/utils.ts`                                                                   |    630 | `src/pages/tracker/utils/index.ts`                                                             |
| `src/public-homepage/components/feature-guide/story-art.tsx`                                   |    552 | `src/public-homepage/components/feature-guide/story-art/index.tsx`                             |
| `src/public-homepage/components/feature-guide/style.css`                                       |    610 | `src/public-homepage/components/feature-guide/style.css`                                       |
| `src/public-homepage/components/feature-guide/use-story-scroll.ts`                             |    435 | `src/public-homepage/components/feature-guide/use-story-scroll/index.ts`                       |
| `src/public-homepage/homepage.css`                                                             |    567 | `src/public-homepage/homepage.css`                                                             |
| `src/store/experience-sources/index.ts`                                                        |    480 | `src/store/experience-sources/index.ts`                                                        |
| `src/store/jd-variant/generate.ts`                                                             |    470 | `src/store/jd-variant/generate/index.ts`                                                       |
| `src/store/resume/slices/document.ts`                                                          |    487 | `src/store/resume/slices/document/index.ts`                                                    |
| `supabase/functions/experience-sources/index.ts`                                               |    793 | `supabase/functions/experience-sources/index.ts`                                               |
| `supabase/functions/job-submissions/index.ts`                                                  |    465 | `supabase/functions/job-submissions/index.ts`                                                  |
| `supabase/functions/llm-proxy/index.ts`                                                        |    943 | `supabase/functions/llm-proxy/index.ts`                                                        |
| `supabase/functions/resume-comments/index.ts`                                                  |   3713 | `supabase/functions/resume-comments/index.ts`                                                  |
| `supabase/functions/resume-share/index.ts`                                                     |   1047 | `supabase/functions/resume-share/index.ts`                                                     |
| `supabase/functions/shared/resume-comment-core.ts`                                             |   1256 | `supabase/functions/shared/resume-comment-core.ts`                                             |
| `supabase/tests/database/005_backend_maintenance.sql`                                          |    828 | `supabase/tests/database/005_backend_maintenance.sql`                                          |
| `supabase/templates/confirmation.html`                                                         |    500 | `supabase/templates/confirmation/index.mjs`                                                    |
| `supabase/templates/email-change.html`                                                         |    405 | `supabase/templates/email-change/index.mjs`                                                    |
| `supabase/templates/email-changed.html`                                                        |    455 | `supabase/templates/email-changed/index.mjs`                                                   |
| `supabase/templates/identity-linked.html`                                                      |    430 | `supabase/templates/identity-linked/index.mjs`                                                 |
| `supabase/templates/identity-unlinked.html`                                                    |    431 | `supabase/templates/identity-unlinked/index.mjs`                                               |
| `supabase/templates/invite.html`                                                               |    457 | `supabase/templates/invite/index.mjs`                                                          |
| `supabase/templates/magic-link.html`                                                           |    446 | `supabase/templates/magic-link/index.mjs`                                                      |
| `supabase/templates/mfa-factor-enrolled.html`                                                  |    430 | `supabase/templates/mfa-factor-enrolled/index.mjs`                                             |
| `supabase/templates/mfa-factor-unenrolled.html`                                                |    430 | `supabase/templates/mfa-factor-unenrolled/index.mjs`                                           |
| `supabase/templates/password-changed.html`                                                     |    431 | `supabase/templates/password-changed/index.mjs`                                                |
| `supabase/templates/phone-changed.html`                                                        |    455 | `supabase/templates/phone-changed/index.mjs`                                                   |
| `src/components/tiptap-templates/simple/data/content.json`                                     |    477 | `src/components/tiptap-templates/simple/data/content/index.ts`                                 |

清理后维护源码扫描：1826 个文件，最大 400 行，超限 0。生成 dist、依赖、历史迁移和文档不计入维护源码；历史迁移豁免已精确记录于 ESLint。

实施完成：是。验证通过：是，清理后的最终检查已通过。用户审查通过：待用户审查。
