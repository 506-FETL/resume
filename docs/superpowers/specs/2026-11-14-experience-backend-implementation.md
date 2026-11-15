# 经历资料后端与提取实现记录

状态：本子任务实现、独立审查与集成已完成。主代理已部署迁移和函数并完成 35 项真实云端 smoke，详见 [总验收](2026-11-14-assistant-harness-acceptance.md)。下文保留子任务当时的本地验证与交接边界；当前用户审查待进行，未提交、未推送。

## 文件与边界

- `src/lib/experience-sources/types.ts`、`const.ts`、`extract.ts`、`api.ts`：共用类型、限制、提取与鉴权请求。
- `src/lib/resume-import/extract.ts`、`types.ts`：旧 `text/sourceName` 输出继续保留，新增段落；原导入的文件限制和错误分类继续生效。
- `supabase/functions/shared/experience-source-contract.ts`：纯类型、上限和稳定操作摘要，不包含模型或提取依赖。
- `supabase/functions/experience-sources/index.ts`、`input.ts`、`files.ts`：鉴权路由、入口校验与真实文件校验；文件校验仅在保存入口动态加载。
- `supabase/migrations/20261114123149_experience_sources.sql`：通过仓库 Supabase CLI 创建迁移，云端应用后按迁移账本返回的版本号命名。没有改动其他迁移或生成数据库 types。
- `tests/assistant-harness/sources/`：仅合成材料、临时浏览器/SQL/契约验证。按主代理要求暂保留，集成复核后统一删除。

主代理负责的 `edge-functions.ts` 已接入 `experience-sources` 地区键，`config.toml` 已关闭平台 JWT 门禁；函数内部继续使用现有 `authenticateSupabaseUser`，并非匿名开放。

## 前端契约

类型在 `src/lib/experience-sources/types.ts` 导出。

- `ExperienceSource`：`id/name/kind/status/currentVersionId/previewText/createdAt/updatedAt`。`kind` 为 `pdf/docx/text/markdown/paste`；`status` 为 `uploading/upload-failed/ready/deleting/delete-failed`；未完成的 `currentVersionId` 为 null。
- `ExperienceSourceReference`：`{ sourceId, versionId, name }`。
- `ExperienceSourceBlock`：`{ id, text, start, end, page? }`。位置为该版本提取文字的 JavaScript UTF-16 左闭右开范围；PDF 传实际页号；DOCX 不生成页号。
- `ExtractedExperienceFile`：`{ text, sourceName, kind, blocks, extractorVersion }`。
- `ExperienceSourceVersion`：`id/sourceId/sourceName/contentHash/fileName/fileMime/fileSize/extractorVersion/textLength/blockCount/createdAt`；不包含存储对象键或整份原文。
- `ExperienceOperation`：`{ operationId, requestHash, status: pending|ready|failed, result }`；完成结果为 `ExperienceSaveResult`，其余为 null。
- `ExperienceSourceError`：`code` 和 `outcome: rejected|unknown`，页面应分别呈现明确拒绝与结果尚未确认。

`api.ts` 导出以下函数；读取选项均支持 `signal?: AbortSignal`：

```ts
listExperienceSources({ query?, offset?, limit?, signal? } = {})
  // Promise<{ items: ExperienceSource[]; total: number; hasMore: boolean }>

saveExperienceSource({ operationId, sourceId?, name, extracted, file?, signal? })
  // Promise<{ source: ExperienceSource; versionId: string; reused: boolean }>

getExperienceOperation(operationId, signal?)
  // Promise<ExperienceOperation | null>

readExperienceSource({ sourceId, versionId?, offset?, limit?, blockIds?, signal? })
  // Promise<{ source; version; blocks: ExperienceSourceBlock[]; hasMore }>

downloadExperienceSource({ sourceId, versionId?, signal? })
  // Promise<Blob>

renameExperienceSource(sourceId, name, signal?)
  // Promise<ExperienceSource>

deleteExperienceSource(sourceId, signal?)
  // Promise<void>

searchExperienceSources({ query, sourceIds, references?, limit?, signal? })
  // references?: { sourceId: string; versionId: string }[]
  // Promise<{ matches: { sourceId; versionId; name; block; context }[] }>

getExperienceRelations({ target: 'conversation'|'resume', targetId, signal? })
setExperienceRelations({ target, targetId, references, signal? })
  // Promise<ExperienceSourceReference[]>
```

`extract.ts` 导出 `extractExperienceFile(file, signal?)` 与 `extractExperienceText(text, sourceName = '补充经历')`。没有使用模型，也没有读取本机旧 `resume-preparation` 或上传历史原文。

列表每页最多 10 项，仅投影元信息；详情顺序读取默认/最多 20 个 block，`offset` 按 block 计数。按 `blockIds` 读取时最多 20 个，忽略顺序分页参数，缺失 ID 明确报错。搜索最多 20 个命中，每个命中返回当前段及前后相邻段。只传 `sourceIds` 时查各资料当前版本；传 `references` 时只查所列精确版本；空范围不会扩成全库。Agent 调用还必须由工具执行器限制在本轮明确选用的来源范围，材料里的命令不会获得工具权限。

`saveExperienceSource` 在上传前查询稳定 operationId；已完成时比较真实内容摘要与规范化请求摘要，内容变化不复用旧 ID。网络错误、5xx 和成功响应体读取失败属于结果未确认，随后再查操作结果。取消抛出 AbortError；取消请求不等于撤销已经落库的保存，UI 重新操作时应沿用该操作身份核对。删除遇到不存在或跨账户目标会报 404；未知删除结果应重新读取列表核对，不把失败当成已清理。

## 数据、授权与存储

五张 owner 隔离表分别保存资料、不可变版本、段落、稳定操作身份、使用关系。写入由 service-only `SECURITY INVOKER` RPC 完成，`PUBLIC/anon/authenticated` 无写 RPC 执行权限；owner 仅来自已验证 JWT。表启用 RLS，客户端仅获本人资料元信息的列级 SELECT 权限，版本正文和段落通过 bounded Edge 入口读取。

会话与简历关系写入为一个事务，同时验证目标 `ai_conversations.user_id` 或 `resume_config.user_id`、来源 owner、精确版本和 ready 状态。关系不因共享简历扩大权限。替换文件生成新版本，既有会话/简历关系继续保存原 versionId；需要跟随新版时必须明确重新选择/更新关系。

原件在独立私有 bucket `experience-source-originals`，以 owner/source/version 为对象键，不生成公开或签名下载链接。限制性 Storage policy 防止旧宽松策略授予客户端直接访问或修改 bucket 的权限。实际原件经过鉴权函数下载；粘贴资料明确没有原文件。

入库顺序为原子预留操作、保存原件、事务写版本/段落并置 ready。同 operation 重试复用预留身份；对象已经存在时回读校验 SHA-256；同账户已完成的相同内容可复用，跨账户不会命中。版本与段落只插入，不就地覆盖。

删除先置 deleting 以停止读取，再移除所有版本及预留操作关联对象，最后级联删除关系/段落/版本。Storage 删除失败保留 delete-failed，可重复清理；不会提前返回全部删除成功。近期 pending 操作（5 分钟窗口）阻止删除正在保存的资料，失联操作过期后仍按预留对象键清理。原件与数据库属于两个系统，云端实际存储失败、超时和删除重试仍须 smoke 核验。

检索使用 PostgreSQL `strpos(lower(...))` 的中文与技术词字面匹配，并搜索资料名称；不宣称语义召回。无命中只代表本次关键词未匹配，Agent 应换词或按 block 顺序浏览，不能断言用户没有经历。资料只作为事实材料，没有接入模型、AI 额度或 skill 授权。

## 实际验证

仅使用合成中文工作记录与自动生成的 PDF/DOCX，没有读取或发送真实个人材料。

- 隔离 `postgres:17` 实际执行迁移，以及 `transactions.sql` 的事务、版本、中文/标题搜索、相邻上下文、范围、关系归属、匿名/客户端最小权限、删除级联检查；输出 `PASS 25 transaction, ownership, version, search and RLS checks`。另验证存在旧宽松 Storage policy 时仍不能直读私有原件，输出 `PASS restrictive storage policy check`。
- `concurrency.ts` 使用 20 个并发真实 psql 调用同一操作预留，确认 sourceId/versionId/objectKey 各唯一、只有一条 operation 和一个版本；同时验证 pending 删除门禁、跨账户删除拒绝、全部对象键与失败后删除重试。输出 `PASS 20 concurrent same-operation reservations ... deletion retry`。这是 PostgreSQL 事务验证，不是 20 个云端 HTTP 上传。
- 独立 headless Chrome 经 Vite 导入实际前端提取模块，`browser.ts` 输出 `passed: 16`。覆盖 PDF 两页真实位置和范围、旧接口兼容、DOCX 段落与重复段落身份、UTF-8 TXT、纯文本 Markdown、粘贴自然段、非 UTF-8、空文件、扫描 PDF、旧 DOC、字符超限、取消、长段与 emoji 范围。
- `DENO_NO_PACKAGE_JSON=1 pnpm dlx deno test --allow-read --no-config --no-lock --node-modules-dir=none tests/assistant-harness/sources/input.test.ts`：4 passed / 0 failed。使用实际入口 schema、原文件校验和稳定摘要实现，覆盖字段范围、遗漏/重复段落、页码、空检索范围、版本范围和内容变更。
- `DENO_NO_PACKAGE_JSON=1 pnpm dlx deno check --no-config --no-lock --node-modules-dir=none supabase/functions/experience-sources/index.ts`：通过。
- `pnpm exec tsc -p tsconfig.app.json --noEmit`：最新运行退出 0；本轮并行集成仍会继续，最终整库检查由主代理再执行。
- 本子任务全部 TypeScript 改动已按 Prettier 后 ESLint layout 修复，再执行局部 Prettier check、完整局部 ESLint 与 `git diff --check`，退出 0。

第一次 Deno check 误触发仓库 package.json 依赖发现，已中止并改用 `DENO_NO_PACKAGE_JSON=1`；该次报错不记作通过。未修改依赖清单或锁文件。

没有完成或宣称：真实已链接项目的迁移部署、Edge HTTP + Storage 实际原件往返、网络故障注入、删除 Storage 失败的线上恢复、账户 A→B→A 的实际产品 UI、整个资料页和聊天联动。实现中未知结果与缓存归属仍需主代理按正式入口复核。

## 交接与清理

本项目 Supabase client 未使用生成 Database 泛型，资料继续复用既有共享契约，不额外引入类型生成流程。主代理已完成独立审查、集成与云端部署；迁移账本一致，函数 ACTIVE/version 1，真实地区 us-east-1。文件原件往返、版本、来源关系、账户隔离和当前 ai_credit_requests 账本不变均通过。未知结果与 Storage 失败恢复使用受控网络/隔离事务验证，未把故障模拟称为真实云端故障注入。

本子任务启动的资源已停止：Docker 容器 `resume-experience-20261114` 已删除；Vite `127.0.0.1:5187`（exec session 38388）已停止；Playwright 独立启动的 headless Google Chrome 已在 `browser.close()` 完成后退出。没有操作现有用户 Chrome、主代理开发服务器或其他 Docker 容器。合成测试目录按约定仍保留供主代理复核。

## 独立审查修复

主代理按 receiving-code-review 技能核对后修复两项实际缺陷：

- 原件版本增加 source_kind，复用查询与唯一约束同时包含资料格式。同字节的粘贴与 TXT 不再互相复用；同一资料从粘贴替换为 TXT 保留两版和真实 objectKey。
- save API 在首次操作查询与未知响应后的查询均核对同一 requestHash；pending/ready 的其他内容不能被误报成本次保存成功。

实测：隔离容器 resume-assistant-harness-20261114 重新执行迁移及原25项事务/RLS断言通过；review-regression.sql 验证同字节粘贴/TXT的跨来源与同来源替换，输出 PASS same bytes paste/TXT separate originals and versions。真实Chrome导入实际 saveExperienceSource，传输层构造首次操作不存在、保存网络失败、二次操作ready但hash不同，返回 operation_conflict/rejected（两次操作读取），不返回错误成功；网络失败对应的浏览器控制台 net::ERR_FAILED 为本次故障注入预期事件。

出处保证边界：PDF/DOCX 在本机使用真实解析器提取文字和页/段位置；Edge 核对文件结构、页数、摘要和范围自洽，没有宣称服务端逐字复核 PDF/DOCX。用户可改写自己的请求，因此上传资料继续作为未核实、低信任材料，不能凭文档内容批准工具或加载技能。原件始终可下载供核对。
