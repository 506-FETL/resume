# AI 简历工具本地/云端边界修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [x]`）语法来跟踪进度。

**目标：** 让 AI 助手和画布正确读写本地/云端简历，并消除本地 ID 的 Supabase 400 与已删除云端 ID 的 406。

**架构：** 在 IndexedDB 与 Supabase 之上增加统一的可访问简历数据边界，通用 CRUD 按 ID 路由，云端专属功能显式拒绝本地目标。Supabase 单行读取增加 UUID 前置校验并改为零行安全的 `maybeSingle`，画布在列表解析后再读取目标并清理失效选择。

**技术栈：** React 19、TypeScript、Zustand、IndexedDB/idb、Supabase JS/PostgREST、Node 专项验证脚本、ESLint、Vite。

---

## 文件结构

- 创建 `src/lib/resume-id.ts`：云端 UUID 判定和统一的简历不存在错误。
- 创建 `src/lib/resume-access.ts`：本地/云端简历列表、读取、元信息更新和删除路由。
- 修改 `src/lib/supabase/resume/form.ts`：UUID 请求门禁、`maybeSingle` 和零行错误语义。
- 修改 `src/lib/supabase/resume/config.ts`：云端更新入口的 UUID 防御门禁。
- 修改 `src/lib/ai/tools/resume.ts`：通用 AI 读取与正文修改改用统一数据源。
- 修改 `src/lib/ai/tools/crud.ts`：打开、元信息、删除和当前历史工具的数据源路由/能力门禁。
- 修改 `src/lib/ai/tools/misc.ts`：本地简历的 ATS、血缘和版本能力门禁。
- 修改 `src/lib/ai/agent/build-context.ts`：上下文同时感知本地和云端简历，忽略失效 current ID。
- 修改 `src/pages/assistant/hooks/use-canvas-preview.ts`：列表就绪后解析目标、本地预览、失效选择自愈。
- 修改 `src/pages/assistant/hooks/use-composer-context.ts`：`@` 简历引用同时包含本地和云端简历。
- 修改 `src/pages/assistant/components/assistant-canvas/version-timeline/index.tsx`：本地预览禁用云端历史入口。
- 修改 `src/pages/resume/store/resume-list.ts`：成功删除当前简历后清理持久化选择。
- 修改 `src/store/resume/helpers/sync-service.ts`：区分外观缺失、目标不存在和临时查询失败。
- 修改 `src/store/resume/slices/document.ts`：自有云端简历在 Automerge 初始化前执行存在性门禁。
- 修改 `src/pages/resume/editor/hooks/use-resume-loader.ts`：目标不存在时清理 current ID 并返回列表。
- 创建 `scripts/verify-ai-resume-tools.ts`：纯函数与关键调用边界专项验证。
- 修改 `package.json`：注册 `verify:ai-resume-tools`。

### 任务 1：建立 ID 与统一数据访问边界

**文件：**
- 创建：`src/lib/resume-id.ts`
- 创建：`src/lib/resume-access.ts`
- 修改：`src/lib/supabase/resume/form.ts:55-73`
- 修改：`src/lib/supabase/resume/config.ts:5-19`

- [x] **步骤 1：实现纯 ID 判定和可识别错误**

```ts
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu

export function isCloudResumeId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export class ResumeNotFoundError extends Error {
  constructor() {
    super('简历不存在、已删除或无权访问')
    this.name = 'ResumeNotFoundError'
  }
}
```

- [x] **步骤 2：让云端单行读取在请求前拒绝非 UUID，并安全处理零行**

```ts
if (!isCloudResumeId(id))
  throw new ResumeNotFoundError()

const { data, error } = await query.maybeSingle()
if (error)
  throw error
if (!data)
  throw new ResumeNotFoundError()
return data as T
```

云端更新和按 `resume_id` 删除入口使用相同 UUID 门禁，防止未来调用点再次把本地 ID 送入 PostgREST。

- [x] **步骤 3：实现统一简历列表与读取**

```ts
export async function getAccessibleResumeById(resumeId: string) {
  if (isOfflineResumeId(resumeId)) {
    const local = await getOfflineResumeById(resumeId)
    if (!local)
      throw new ResumeNotFoundError()
    const { data, ...meta } = local
    return { ...data, ...meta, isOffline: true, storage: 'local' as const }
  }
  const cloud = await getResumeById(resumeId)
  return { ...cloud, isOffline: false, storage: 'cloud' as const }
}
```

- [x] **步骤 4：实现统一元信息更新和删除路由**

```ts
export async function updateAccessibleResumeMeta(resumeId: string, patch: ResumeMetaPatch) {
  return isOfflineResumeId(resumeId)
    ? updateOfflineResumeMeta(resumeId, patch)
    : updateResumeConfig(resumeId, patch)
}
```

### 任务 2：修复 AI 简历读写工具

**文件：**
- 修改：`src/lib/ai/tools/resume.ts`
- 修改：`src/lib/ai/tools/crud.ts`
- 修改：`src/lib/ai/tools/misc.ts`

- [x] **步骤 1：列表和详情工具改用统一数据源**

`list_resumes` 输出 `storage: 'local' | 'cloud'`，`get_resume_detail` 调用 `getAccessibleResumeById`；错误继续归一为工具 `{ error }` 结果。

- [x] **步骤 2：正文修改使用持久化真实基线**

```ts
const current = await getAccessibleResumeById(currentId)
const before = current[sectionKey]
```

保留现有对象合并、`normalizeResumeSection`、Zod 校验、确认卡和 `applyResumeFieldToDocument`。

- [x] **步骤 3：元信息、删除和打开工具按数据源路由**

打开前读取目标确认存在并采用记录中的真实 `type`；删除确认前读取名称，确认后调用统一删除并清理当前选择。

- [x] **步骤 4：为云端专属工具增加本地门禁**

```ts
if (isOfflineResumeId(resumeId))
  return { error: '本地简历暂不支持历史版本，请先同步到云端。' }
```

覆盖保存历史、恢复历史、ATS、派生血缘和历史版本列表；门禁必须位于 Supabase 调用之前。

### 任务 3：修复助手上下文与画布

**文件：**
- 修改：`src/lib/ai/agent/build-context.ts`
- 修改：`src/pages/assistant/hooks/use-canvas-preview.ts`
- 修改：`src/pages/assistant/hooks/use-composer-context.ts`

- [x] **步骤 1：上下文列出两种数据源**

系统上下文和 Composer 的 `@` 简历引用都调用 `listAccessibleResumes`；系统摘要标注“本地/云端”，且只有 current ID 出现在已加载列表中时才注入“当前正在编辑”。

- [x] **步骤 2：画布增加列表加载状态并延后目标读取**

```ts
const [optionsStatus, setOptionsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
if (optionsStatus !== 'ready')
  return
```

列表未成功前不得把 current/preview ID 发给任何详情读取函数。

- [x] **步骤 3：解析有效目标并清理失效选择**

优先保留仍存在的 `previewResumeId`，其次选择仍存在的 `currentResumeId`，最后回退到第一份可访问简历；current ID 已不存在时调用 `clearCurrentResume()`。

- [x] **步骤 4：画布详情读取改用统一数据源**

本地记录展平后直接交给 `buildResumeSnapshot`；读取期间目标切换仍用 effect cleanup 阻止旧请求覆盖。

### 任务 4：修复删除和编辑器打开路径的当前选择

**文件：**
- 修改：`src/pages/resume/store/resume-list.ts:69-107`
- 修改：`src/store/resume/helpers/sync-service.ts`
- 修改：`src/store/resume/slices/document.ts`
- 修改：`src/pages/resume/editor/hooks/use-resume-loader.ts`

- [x] **步骤 1：仅在删除成功后清理 current ID**

```ts
function clearDeletedCurrentResume(id: string) {
  const current = useCurrentResumeStore.getState()
  if (current.resumeId === id)
    current.clearCurrentResume()
}
```

本地和云端删除成功分支都调用该函数；失败分支保留原选择。

- [x] **步骤 2：在自有云端文档初始化前验证目标存在**

外观读取结果同时返回 `resumeExists: true | false | null`；`false` 只表示可识别的 `ResumeNotFoundError`，`null` 表示临时查询失败。非共享路径在 `DocumentManager.initialize()` 前遇到 `false` 时终止加载，共享 `documentUrl` 跳过该门禁。

- [x] **步骤 3：编辑器对不存在目标执行自愈**

`useResumeLoader` 捕获 `ResumeNotFoundError` 后，仅当失败 ID 仍是 current ID 时调用 `clearCurrentResume()`，随后保留现有错误提示和返回简历列表行为。

### 任务 5：添加专项验证

**文件：**
- 创建：`scripts/verify-ai-resume-tools.ts`
- 修改：`package.json`

- [x] **步骤 1：验证 ID 纯函数**

```ts
assert.equal(isCloudResumeId('12fbe260-06b1-4072-89ee-ce90a9f06a0d'), true)
assert.equal(isCloudResumeId('local-0991d248-0e55-4d2a-9bb5-8b25d6f6d003'), false)
assert.equal(isCloudResumeId('not-a-resume'), false)
```

- [x] **步骤 2：静态断言关键调用边界**

读取目标源码并断言：`getResumeById` 使用 `.maybeSingle()` 和 `isCloudResumeId`；AI/画布使用统一访问层；本地历史/血缘门禁存在；画布不再直接调用 `getResumeById`；删除路径清理 current。

- [x] **步骤 3：运行专项验证**

运行：`pnpm verify:ai-resume-tools`

预期：输出 `AI resume tool boundary verification passed.`，退出码 0。

### 任务 6：完成质量与在线只读验证

**文件：**
- 检查本计划列出的全部修改文件。

- [x] **步骤 1：运行目标文件 ESLint**

运行：

```bash
pnpm exec eslint src/lib/resume-id.ts src/lib/resume-access.ts src/lib/supabase/resume/form.ts src/lib/ai/tools/resume.ts src/lib/ai/tools/crud.ts src/lib/ai/tools/misc.ts src/lib/ai/agent/build-context.ts src/pages/assistant/hooks/use-canvas-preview.ts src/pages/resume/store/resume-list.ts scripts/verify-ai-resume-tools.ts
```

预期：退出码 0。

- [x] **步骤 2：运行 TypeScript 与生产构建**

运行：`pnpm exec tsc --noEmit --pretty false` 和 `pnpm build`。

预期：本次文件无新增类型错误，生产构建退出码 0；若全量 TypeScript 仍被既有错误阻塞，单独记录基线。

- [x] **步骤 3：运行差异卫生和调用点复扫**

运行：

```bash
git diff --check
rg -n "getResumeById|resume_config|isOfflineResumeId" src/lib/ai src/pages/assistant
```

预期：无空白错误；AI 通用简历工具和画布不存在绕过统一边界的详情查询。

- [x] **步骤 4：执行 Supabase 只读 smoke**

使用当前已链接项目和现有非敏感客户端配置，比较合法存在/不存在 UUID 的 REST 行为；记录 HTTP/JSON 证据，不修改 schema、RLS 或函数。

- [x] **步骤 5：复查最终差异**

确认只包含本任务代码、规格和计划；不推送远端。当前执行不自动创建 Git 提交，除非用户另行要求。

## 实际验证记录

- `pnpm verify:ai-resume-tools`、`pnpm verify:mobile-stability`、`pnpm verify:llm-proxy`：通过。
- 目标文件 ESLint、`git diff --check`、`pnpm build`：通过；构建保留既有循环 chunk/大 chunk 警告。
- `pnpm exec tsc --noEmit --pretty false`：仍仅命中既有的 tracker 表单未使用 `Sparkles` 导入，本次文件无新增类型错误。
- Supabase 线上只读 SQL：确认 `resume_config.resume_id` 为 `uuid`，随机合法 UUID 匹配 0 行。
- Chrome 登录态只读验收：刷新助手页后本地「测试」简历画布正常渲染，Composer 上下文可见该本地简历，控制台无错误；未重放会把简历正文发送给模型的 AI 消息。
