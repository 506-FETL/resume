# AI 助手 · S4 工具集 + 混合确认 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把内部全域用户数据打通进 agent——10 个只读工具（简历完整内容/看板/模板/历史/ATS/派生/用户/时间）+ 3 个写工具（当前简历字段/看板增改，走内联确认卡）+ 轻量概况注入 system。治好"只能看到简历名称类型、无法对比内容"。

**架构：** `AgentTool` 加 `mode:'read'|'write'`；新增 `src/lib/ai/tools/`（按域拆分注册业务工具，替换 S3 占位工具）；`build-context` 拉轻量概况注入 `to-api-messages` 动态 system；写工具 `execute` 返回**挂起 Promise**（store `pendingConfirm` 存 resolve 句柄），对话流内渲染确认卡，确认才真正落库——`agent-loop` 的 `await execute` 天然暂停/恢复，循环结构不变。

**技术栈：** React 19 · TS · Zustand · DeepSeek FC · GAIA（Tool Calls Section 已用；确认卡 shadcn 手搭）· 复用 `src/lib/supabase/**` 全域入口 + `useResumeStore`/`useCurrentResumeStore`/`useTrackerStore`

**验证约定：** 不写测试。门槛 = `pnpm lint` + `pnpm build` + `tsc --noEmit` + 手动清单。GAIA 优先、禁 props 下钻、组件超阈值拆分为硬约束。实现期间**不 commit**。规格：`docs/superpowers/specs/2026-08-04-ai-assistant-s4-tools-confirm-design.md`。

---

## 已查证的接口事实（落地依据）

- **只读入口**（`@/lib/supabase/resume` barrel + `@/lib/supabase/user` + `@/lib/supabase/template`）：`getAllResumesFromUser()`、`getResumeById(id,'*')`、`getCompanies()`、`getAtsFromUserId()`、`fetchVariantTree(id)`、`listUserTemplates()`、`listResumeHistoryVersionSummaries()`、`getUserProfile()`、`getCurrentUser()`。
- **写入口**：`updateCompany(id,patch)` / `createCompany(data)`（`@/lib/supabase/resume`，无 CRDT 问题）；简历正文经 `useResumeStore.getState().updateForm(sectionKey, data)`（CRDT 安全）。
- **当前简历**：`useCurrentResumeStore.getState().resumeId`（`src/store/resume/current.ts`）；当前简历内容 `useResumeStore.getState().getResumeFormData()`；简历模块键 `FORM_DATA_KEYS`（`@/store/resume`）。
- **S3 现状**：`AgentTool { name, description, parameters, execute }`（`tool-registry.ts`）；`agent-loop.ts` 对每个 tool `await getTool(name).execute(args)`；内置工具在 `builtin-tools.ts`（S4 替换为 `src/lib/ai/tools/`）；`AiMessagePart` tool-call `state: 'call'|'result'|'error'`（S1 `types.ts`，S4 扩展）。

---

## 文件结构

**修改：**
- `src/lib/ai/types.ts` — `AiToolCallState` 加 `'awaiting-confirm' | 'cancelled'`
- `src/lib/ai/agent/tool-registry.ts` — `AgentTool` 加 `mode`；`toApiToolDefs` 不变（mode 不发给模型）
- `src/lib/ai/agent/agent-loop.ts` — tool 执行按 `mode` 分流（write 走确认挂起）；tool-call part 记录 state
- `src/lib/ai/agent/to-api-messages.ts` — system 头接受 `context` 动态拼接
- `src/lib/ai/agent/index.ts` — 导入 `../tools` 替代 `builtin-tools`
- `src/pages/assistant/store.ts` — 加 `pendingConfirm` 态
- `src/pages/assistant/hooks/use-chat-stream.ts` — 起 loop 前 `buildUserContext()` 传入；abort 时清 pendingConfirm
- `src/pages/assistant/components/message-list/index.tsx` — 渲染确认卡

**新增：**
- `src/lib/ai/agent/build-context.ts` — `buildUserContext()` 轻量概况
- `src/lib/ai/agent/confirm-bridge.ts` — 写工具挂起/确认桥（连接 tool execute 与 store）
- `src/lib/ai/tools/resume.ts` — 简历只读 + 写工具
- `src/lib/ai/tools/tracker.ts` — 看板只读 + 写工具
- `src/lib/ai/tools/misc.ts` — time/profile/template/history/ats 只读
- `src/lib/ai/tools/index.ts` — 副作用导入全部
- `src/pages/assistant/components/confirm-card/index.tsx` — 确认卡壳
- `src/pages/assistant/components/confirm-card/resume-field-diff.tsx` — 简历字段 diff
- `src/pages/assistant/components/confirm-card/job-change-summary.tsx` — 看板改动摘要

**删除：** `src/lib/ai/agent/builtin-tools.ts`（被 tools/ 取代）

---

## 任务 1：扩展类型与 AgentTool.mode

**文件：**
- 修改：`src/lib/ai/types.ts`、`src/lib/ai/agent/tool-registry.ts`

- [ ] **步骤 1：AiToolCallState 扩展**

`src/lib/ai/types.ts` 将：
```ts
export type AiToolCallState = 'call' | 'result' | 'error'
```
改为：
```ts
export type AiToolCallState = 'call' | 'awaiting-confirm' | 'result' | 'error' | 'cancelled'
```

- [ ] **步骤 2：AgentTool 加 mode**

`tool-registry.ts` 的 `AgentTool` 接口加字段：
```ts
export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  mode: 'read' | 'write'
  execute: (args: Record<string, unknown>) => Promise<unknown>
}
```
（`toApiToolDefs` 不变——`mode` 不发给模型。）

- [ ] **步骤 3：验证**

运行：`pnpm exec tsc --noEmit 2>&1 | grep -E "ai/types|tool-registry"`
预期：无 error（S3 的 builtin-tools 会因缺 mode 报错，下一任务替换它，暂忽略）。

---

## 任务 2：写工具确认桥

**文件：**
- 创建：`src/lib/ai/agent/confirm-bridge.ts`

- [ ] **步骤 1：写确认桥**（连接 tool execute 与 store 的 pendingConfirm；store 在任务 6 定义，这里只定义桥的契约与全局挂载点）

```ts
// 写工具确认桥：写工具调用 requestConfirm 挂起，UI 层通过 store 的 pendingConfirm 处理，
// 用户确认/取消后 resolve。store 层在初始化时注入 handler，解耦 lib 与 React。

export interface ConfirmPreview {
  kind: 'resume-field' | 'job-update' | 'job-create'
  title: string
  // resume-field
  sectionKey?: string
  before?: unknown
  after?: unknown
  // job
  summary?: string
}

export interface ConfirmRequest {
  id: string
  toolName: string
  preview: ConfirmPreview
  // 确认时真正执行写入；返回结果对象
  apply: () => Promise<unknown>
}

// UI 层（store）注入的处理器：弹卡 → 等用户 → 返回是否确认
type ConfirmHandler = (req: ConfirmRequest) => Promise<{ confirmed: boolean, result?: unknown }>

let handler: ConfirmHandler | null = null

export function setConfirmHandler(h: ConfirmHandler | null): void {
  handler = h
}

// 写工具调用此函数：无 handler（理论不会）则直接执行
export async function requestConfirm(req: ConfirmRequest): Promise<unknown> {
  if (!handler) {
    return req.apply()
  }
  const { confirmed, result } = await handler(req)
  if (!confirmed)
    return { cancelled: true }
  return result
}
```

- [ ] **步骤 2：验证**

运行：`pnpm exec tsc --noEmit 2>&1 | grep confirm-bridge`
预期：无 error。

---

## 任务 3：简历工具（只读 + 写）

**文件：**
- 创建：`src/lib/ai/tools/resume.ts`

- [ ] **步骤 1：写简历工具**

```ts
import { getAllResumesFromUser, getResumeById } from '@/lib/supabase/resume'
import { FORM_DATA_KEYS, useCurrentResumeStore, useResumeStore } from '@/store/resume'
import { registerTool } from '../agent/tool-registry'
import { requestConfirm } from '../agent/confirm-bridge'

registerTool({
  name: 'list_resumes',
  description: '列出当前用户的所有简历（名称、类型、派生状态）。当用户问有哪些简历、想对比/选择简历时使用。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => {
    try {
      const rows = (await getAllResumesFromUser()) as Array<Record<string, unknown>> | null
      if (!rows || rows.length === 0)
        return { count: 0, message: '用户还没有任何简历' }
      return {
        count: rows.length,
        resumes: rows.map(r => ({ resumeId: r.resume_id, name: r.display_name ?? '未命名', type: r.type ?? 'unknown', derivedStatus: r.derived_status ?? null })),
      }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取简历列表失败' }
    }
  },
})

registerTool({
  name: 'get_resume_detail',
  description: '读取指定简历的完整内容（基本信息、工作/项目/实习/校园经历、技能、教育、自我评价等所有模块）。对比简历、评价简历、按简历回答时必须先调用它获取内容。resumeId 从 list_resumes 获得。',
  parameters: {
    type: 'object',
    properties: { resumeId: { type: 'string', description: '简历的 resume_id' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  mode: 'read',
  execute: async (args) => {
    try {
      const data = await getResumeById(String(args.resumeId), '*')
      if (!data)
        return { error: '未找到该简历' }
      return data
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取简历内容失败' }
    }
  },
})

// 简历模块中文名（用于确认卡标题与工具描述）
const SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  job_intent: '求职意向',
  application_info: '应聘信息',
  edu_background: '教育背景',
  work_experience: '工作经历',
  internship_experience: '实习经历',
  campus_experience: '校园经历',
  project_experience: '项目经历',
  skill_specialty: '技能特长',
  honors_certificates: '荣誉证书',
  self_evaluation: '自我评价',
  hobbies: '兴趣爱好',
}

registerTool({
  name: 'update_current_resume_field',
  description: `修改「当前正在编辑」的简历的某个模块内容。仅当用户已在编辑器打开某份简历时可用。sectionKey 可选值：${FORM_DATA_KEYS.join(', ')}。value 为该模块的新内容对象（结构需与该模块一致）。此操作需用户确认。`,
  parameters: {
    type: 'object',
    properties: {
      sectionKey: { type: 'string', enum: [...FORM_DATA_KEYS], description: '要修改的简历模块键' },
      value: { type: 'object', description: '该模块的新内容（对象）' },
    },
    required: ['sectionKey', 'value'],
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const currentId = useCurrentResumeStore.getState().resumeId
    if (!currentId)
      return { error: '当前没有打开任何简历。请先在编辑器打开要修改的简历，再让我修改。' }

    const sectionKey = String(args.sectionKey) as (typeof FORM_DATA_KEYS)[number]
    if (!FORM_DATA_KEYS.includes(sectionKey))
      return { error: `无效的模块键：${sectionKey}` }

    const before = useResumeStore.getState().getResumeFormData()[sectionKey]
    const after = args.value

    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'update_current_resume_field',
      preview: {
        kind: 'resume-field',
        title: `修改【${SECTION_LABELS[sectionKey] ?? sectionKey}】`,
        sectionKey,
        before,
        after,
      },
      apply: async () => {
        useResumeStore.getState().updateForm(sectionKey, after as never)
        return { ok: true, sectionKey }
      },
    })
  },
})
```

- [ ] **步骤 2：验证**

运行：`pnpm exec tsc --noEmit 2>&1 | grep tools/resume`
预期：无 error（`updateForm(..., after as never)` 桥接动态 value 类型）。

---

## 任务 4：看板工具（只读 + 写）

**文件：**
- 创建：`src/lib/ai/tools/tracker.ts`

- [ ] **步骤 1：写看板工具**

```ts
import { createCompany, getCompanies, updateCompany } from '@/lib/supabase/resume'
import useTrackerStore from '@/pages/tracker/store'
import { requestConfirm } from '../agent/confirm-bridge'
import { registerTool } from '../agent/tool-registry'

registerTool({
  name: 'list_jobs',
  description: '列出当前用户求职看板里的所有职位（公司、岗位、状态、城市等）。当用户问投了哪些公司、看板情况、求职进度时使用。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => {
    try {
      const jobs = await getCompanies()
      return {
        count: jobs.length,
        jobs: jobs.map(j => ({ id: j.id, company: j.company, position: j.position, status: j.status, location: j.location, salary: j.salary, nextAction: j.next_action, archived: j.archived })),
      }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取看板失败' }
    }
  },
})

registerTool({
  name: 'get_job',
  description: '读取某个职位的完整详情（阶段、面试轮次、活动记录、联系人等）。jobId 从 list_jobs 获得。',
  parameters: {
    type: 'object',
    properties: { jobId: { type: 'string', description: '职位 id' } },
    required: ['jobId'],
    additionalProperties: false,
  },
  mode: 'read',
  execute: async (args) => {
    try {
      const jobs = await getCompanies()
      const job = jobs.find(j => j.id === String(args.jobId))
      return job ?? { error: '未找到该职位' }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取职位失败' }
    }
  },
})

const STATUS_LABELS: Record<string, string> = {
  saved: '已保存', applied: '已投递', screen: '筛选中', interview: '面试中', offer: '已录用', rejected: '已终止',
}

registerTool({
  name: 'update_job',
  description: '修改某个看板职位的字段（如 status 状态、next_action 下一步、notes 备注、location、salary 等）。status 可选：saved/applied/screen/interview/offer/rejected。此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: {
      jobId: { type: 'string', description: '职位 id' },
      patch: { type: 'object', description: '要更新的字段对象' },
    },
    required: ['jobId', 'patch'],
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const jobId = String(args.jobId)
    const patch = (args.patch ?? {}) as Record<string, unknown>
    const jobs = await getCompanies().catch(() => [])
    const job = jobs.find(j => j.id === jobId)
    if (!job)
      return { error: '未找到该职位' }

    const summaryParts: string[] = []
    if (patch.status)
      summaryParts.push(`状态 → ${STATUS_LABELS[String(patch.status)] ?? patch.status}`)
    if (patch.next_action)
      summaryParts.push(`下一步 → ${patch.next_action}`)
    const otherKeys = Object.keys(patch).filter(k => k !== 'status' && k !== 'next_action')
    if (otherKeys.length)
      summaryParts.push(`更新字段：${otherKeys.join(', ')}`)

    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'update_job',
      preview: {
        kind: 'job-update',
        title: `修改职位【${job.company} · ${job.position}】`,
        summary: summaryParts.join('；') || '更新职位信息',
      },
      apply: async () => {
        const saved = await updateCompany(jobId, patch)
        useTrackerStore.getState().syncJob(saved)
        return { ok: true, jobId }
      },
    })
  },
})

registerTool({
  name: 'create_job',
  description: '在求职看板新增一个职位。data 至少包含 company（公司）、position（岗位）。此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: { data: { type: 'object', description: '职位数据（company/position 必填，可含 location/salary/status 等）' } },
    required: ['data'],
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const data = (args.data ?? {}) as Record<string, unknown>
    if (!data.company || !data.position)
      return { error: '新增职位至少需要 company（公司）和 position（岗位）' }

    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'create_job',
      preview: {
        kind: 'job-create',
        title: '新增职位',
        summary: `${data.company} · ${data.position}`,
      },
      apply: async () => {
        const created = await createCompany(data as never)
        useTrackerStore.getState().prependJob(created)
        return { ok: true, id: created.id }
      },
    })
  },
})
```

- [ ] **步骤 2：验证**

运行：`pnpm exec tsc --noEmit 2>&1 | grep tools/tracker`
预期：无 error（确认 `useTrackerStore` 有 `syncJob`/`prependJob`——S1 记录存在；`createCompany(data as never)` 桥接动态类型）。

---

## 任务 5：其他只读工具 + tools barrel

**文件：**
- 创建：`src/lib/ai/tools/misc.ts`、`src/lib/ai/tools/index.ts`

- [ ] **步骤 1：misc.ts（time/profile/template/history/ats/variant）**

```ts
import { getAtsFromUserId, fetchVariantTree, listResumeHistoryVersionSummaries } from '@/lib/supabase/resume'
import { listUserTemplates } from '@/lib/supabase/template'
import { getUserProfile } from '@/lib/supabase/user'
import { registerTool } from '../agent/tool-registry'

registerTool({
  name: 'get_current_time',
  description: '获取当前日期和时间（用户本地时区）。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => ({ now: new Date().toLocaleString('zh-CN') }),
})

registerTool({
  name: 'get_user_profile',
  description: '获取当前登录用户的资料（昵称、邮箱等）。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => {
    try {
      return (await getUserProfile()) ?? { message: '无用户资料' }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取用户资料失败' }
    }
  },
})

registerTool({
  name: 'get_ats',
  description: '获取指定简历的 ATS 评分与优化建议。resumeId 从 list_resumes 获得；不传则返回全部 ATS 记录。',
  parameters: {
    type: 'object',
    properties: { resumeId: { type: 'string', description: '简历 resume_id（可选）' } },
    additionalProperties: false,
  },
  mode: 'read',
  execute: async (args) => {
    try {
      const all = (await getAtsFromUserId()) as Array<Record<string, unknown>>
      const filtered = args.resumeId ? all.filter(a => a.resume_id === args.resumeId) : all
      if (!filtered || filtered.length === 0)
        return { message: '该简历还没有 ATS 评估记录' }
      return { count: filtered.length, records: filtered }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取 ATS 失败' }
    }
  },
})

registerTool({
  name: 'get_variant_tree',
  description: '获取某份简历的 JD 派生血缘树（原始简历与其针对不同岗位的派生版本）。resumeId 从 list_resumes 获得。',
  parameters: {
    type: 'object',
    properties: { resumeId: { type: 'string', description: '简历 resume_id' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  mode: 'read',
  execute: async (args) => {
    try {
      return await fetchVariantTree(String(args.resumeId))
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取派生血缘失败' }
    }
  },
})

registerTool({
  name: 'list_templates',
  description: '列出当前用户的简历模板。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => {
    try {
      const list = (await listUserTemplates()) as Array<Record<string, unknown>>
      return { count: list.length, templates: list.map(t => ({ id: t.template_id, name: t.name, description: t.description })) }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取模板失败' }
    }
  },
})

registerTool({
  name: 'list_resume_versions',
  description: '列出指定简历的历史版本摘要。resumeId 从 list_resumes 获得；不传返回全部。',
  parameters: {
    type: 'object',
    properties: { resumeId: { type: 'string', description: '简历 resume_id（可选）' } },
    additionalProperties: false,
  },
  mode: 'read',
  execute: async (args) => {
    try {
      const all = (await listResumeHistoryVersionSummaries()) as Array<Record<string, unknown>>
      const filtered = args.resumeId ? all.filter(v => v.resume_id === args.resumeId) : all
      return { count: filtered.length, versions: filtered }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取历史版本失败' }
    }
  },
})
```

> 落地时对齐真实导出名：`getAtsFromUserId`/`fetchVariantTree`/`listResumeHistoryVersionSummaries` 均来自 `@/lib/supabase/resume` barrel；`listUserTemplates` 来自 `@/lib/supabase/template`；`getUserProfile` 来自 `@/lib/supabase/user`。import 排序按 antfu（落地后 `--fix`）。

- [ ] **步骤 2：tools/index.ts barrel（副作用导入）**

```ts
import './misc'
import './resume'
import './tracker'
```

- [ ] **步骤 3：验证**

运行：`pnpm exec tsc --noEmit 2>&1 | grep tools/`
预期：无 error。

---

## 任务 6：agent 接入 tools + build-context + system 动态化

**文件：**
- 修改：`src/lib/ai/agent/index.ts`、`src/lib/ai/agent/to-api-messages.ts`、`src/lib/ai/agent/agent-loop.ts`
- 创建：`src/lib/ai/agent/build-context.ts`
- 删除：`src/lib/ai/agent/builtin-tools.ts`

- [ ] **步骤 1：agent barrel 换成 tools**

`src/lib/ai/agent/index.ts`：
```ts
import '@/lib/ai/tools' // 注册全部业务工具（副作用）

export * from './agent-loop'
export * from './build-context'
export * from './tool-registry'
```
删除 `src/lib/ai/agent/builtin-tools.ts`。

- [ ] **步骤 2：build-context.ts**

```ts
import { getAllResumesFromUser, getCompanies } from '@/lib/supabase/resume'
import { getUserProfile } from '@/lib/supabase/user'
import { useCurrentResumeStore, useResumeStore } from '@/store/resume'

// 轻量用户概况（不含正文，注入 system 头，给 agent 基本盘感知）
export async function buildUserContext(): Promise<string> {
  const lines: string[] = []
  const today = new Date().toLocaleDateString('zh-CN')

  try {
    const profile = (await getUserProfile()) as { full_name?: string } | null
    lines.push(`当前用户：${profile?.full_name ?? '未设置昵称'}；今天：${today}。`)
  }
  catch {
    lines.push(`今天：${today}。`)
  }

  try {
    const resumes = (await getAllResumesFromUser()) as Array<Record<string, unknown>> | null
    if (resumes && resumes.length > 0) {
      const list = resumes.slice(0, 10).map((r, i) => `#${i + 1}「${r.display_name ?? '未命名'}」(${r.type ?? 'unknown'}, resumeId=${r.resume_id})`).join('；')
      lines.push(`简历（共 ${resumes.length} 份）：${list}`)
    }
    else {
      lines.push('简历：用户还没有简历。')
    }
  }
  catch {
    // 忽略
  }

  const currentId = useCurrentResumeStore.getState().resumeId
  if (currentId) {
    const name = useResumeStore.getState().getResumeFormData().basics?.name
    lines.push(`当前正在编辑：resumeId=${currentId}${name ? `（${name}）` : ''}`)
  }
  else {
    lines.push('当前未在编辑器打开任何简历（修改简历字段前需用户先打开）。')
  }

  try {
    const jobs = await getCompanies()
    if (jobs.length > 0) {
      const byStatus = jobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.status] = (acc[j.status] ?? 0) + 1
        return acc
      }, {})
      const dist = Object.entries(byStatus).map(([k, v]) => `${k}:${v}`).join(' / ')
      lines.push(`求职看板：共 ${jobs.length} 个职位（${dist}）`)
    }
    else {
      lines.push('求职看板：暂无职位。')
    }
  }
  catch {
    // 忽略
  }

  lines.push('你可调用工具读取任意简历完整内容、看板、ATS、派生血缘等；可修改当前简历字段与看板职位（这类写操作会先请用户确认）。')
  return lines.join('\n')
}
```

- [ ] **步骤 3：to-api-messages 动态 system**

将 `toApiMessages(messages)` 签名改为 `toApiMessages(messages, context?: string)`，system content 用 `context ? \`${BASE}\n\n${context}\` : BASE`（`BASE` 为原 SYSTEM_PROMPT）。

- [ ] **步骤 4：agent-loop 接受 context + 按 mode 分流**

`AgentRunOptions` 加 `context?: string`；`toApiMessages(history, context)` 传入。工具执行逻辑不变（`await tool.execute(args)`）——因为 write 工具内部已通过 `requestConfirm` 挂起，loop 无需感知 mode。但 tool-call part 的初始 `state`：write 工具置 `'awaiting-confirm'`，read 置 `'call'`；结果回来后按 result/cancelled/error 更新。修改执行段：

```ts
      for (const tc of toolCalls) {
        const tool = getTool(tc.name)
        const isWrite = tool?.mode === 'write'
        callbacks.onToolCallStart?.({ ...tc, awaitingConfirm: isWrite })
        let result: unknown
        let isError = false
        let cancelled = false
        if (!tool) {
          result = { error: `工具不存在: ${tc.name}` }
          isError = true
        }
        else {
          try {
            result = await tool.execute(tc.args)
            if (result && typeof result === 'object') {
              if ('error' in (result as Record<string, unknown>))
                isError = true
              if ('cancelled' in (result as Record<string, unknown>) && (result as Record<string, unknown>).cancelled)
                cancelled = true
            }
          }
          catch (e) {
            result = { error: e instanceof Error ? e.message : '工具执行失败' }
            isError = true
          }
        }
        callbacks.onToolResult?.(tc.id, result, isError, cancelled)
        finalParts.push({
          type: 'tool-call',
          toolCallId: tc.id,
          toolName: tc.name,
          args: tc.args,
          result,
          state: isError ? 'error' : cancelled ? 'cancelled' : 'result',
        })
        apiMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: tc.id } as any)
      }
```

`AgentCallbacks` 更新：`onToolCallStart?: (call: { id, name, args, awaitingConfirm?: boolean }) => void`；`onToolResult?: (id, result, isError, cancelled?) => void`。

- [ ] **步骤 5：验证**

运行：`pnpm exec tsc --noEmit 2>&1 | grep -E "ai/agent"`
预期：无 error。

---

## 任务 7：store 加 pendingConfirm + 注入确认 handler

**文件：**
- 修改：`src/pages/assistant/store.ts`
- 修改：`src/pages/assistant/hooks/use-chat-stream.ts`

- [ ] **步骤 1：store 加 pendingConfirm**

`store.ts` import 补 `ConfirmPreview`：
```ts
import type { ConfirmPreview } from '@/lib/ai/agent/confirm-bridge'
```
接口加：
```ts
  pendingConfirm: { id: string, toolName: string, preview: ConfirmPreview, resolve: (confirmed: boolean) => void } | null
  setPendingConfirm: (p: AssistantStore['pendingConfirm']) => void
```
初始值 `pendingConfirm: null,`；实现 `setPendingConfirm: p => set({ pendingConfirm: p }),`；`reset` 里不清（挂起由 hook 管理）。

- [ ] **步骤 2：hook 注入 confirm handler + context**

`use-chat-stream.ts` import：
```ts
import { buildUserContext, runAgent } from '@/lib/ai/agent'
import { setConfirmHandler } from '@/lib/ai/agent/confirm-bridge'
```

在模块级或 hook 内注册一次 handler（把 lib 的 requestConfirm 桥到 store 弹卡）。在 `useChatStream` 内用 `useEffect` 注册：
```ts
  useEffect(() => {
    setConfirmHandler(req => new Promise((resolve) => {
      useAssistantStore.getState().setPendingConfirm({
        id: req.id,
        toolName: req.toolName,
        preview: req.preview,
        resolve: async (confirmed: boolean) => {
          useAssistantStore.getState().setPendingConfirm(null)
          if (!confirmed) {
            resolve({ confirmed: false })
            return
          }
          try {
            const result = await req.apply()
            resolve({ confirmed: true, result })
          }
          catch (error) {
            resolve({ confirmed: true, result: { error: error instanceof Error ? error.message : '操作失败' } })
          }
        },
      })
    }))
    return () => setConfirmHandler(null)
  }, [])
```
> 注：`useChatStream` 当前无 import useEffect，补上 `import { useCallback, useEffect } from 'react'`。

起 loop 处传 context（在 `runAgent` 调用前）：
```ts
      const context = await buildUserContext().catch(() => undefined)
      const finalParts = await runAgent({
        history: useAssistantStore.getState().messages,
        signal: controller.signal,
        context,
        callbacks: { /* 原有回调，onToolResult 增加 cancelled 参数签名兼容 */ },
      })
```

abort 时（catch/stop）清挂起：`stopStreaming` 内 `useAssistantStore.getState().pendingConfirm?.resolve(false)`（视为取消）+ `setPendingConfirm(null)`。

- [ ] **步骤 3：验证**

运行：`pnpm lint src/pages/assistant/store.ts src/pages/assistant/hooks/use-chat-stream.ts` + `pnpm exec tsc --noEmit 2>&1 | grep -E "assistant/store|use-chat-stream"`
预期：无 error。

---

## 任务 8：内联确认卡组件

**文件：**
- 创建：`src/pages/assistant/components/confirm-card/resume-field-diff.tsx`、`job-change-summary.tsx`、`index.tsx`

- [ ] **步骤 1：resume-field-diff.tsx**

```tsx
interface ResumeFieldDiffProps {
  before: unknown
  after: unknown
}

function toText(v: unknown): string {
  if (v == null)
    return '（空）'
  if (typeof v === 'string')
    return v
  return JSON.stringify(v, null, 2)
}

export function ResumeFieldDiff({ before, after }: ResumeFieldDiffProps) {
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="rounded-md border border-red-200 bg-red-50 p-2">
        <div className="mb-1 font-medium text-red-700">原内容</div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-red-900">{toText(before)}</pre>
      </div>
      <div className="rounded-md border border-green-200 bg-green-50 p-2">
        <div className="mb-1 font-medium text-green-700">新内容</div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-green-900">{toText(after)}</pre>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：job-change-summary.tsx**

```tsx
interface JobChangeSummaryProps {
  summary: string
}

export function JobChangeSummary({ summary }: JobChangeSummaryProps) {
  return <p className="text-sm text-muted-foreground">{summary}</p>
}
```

- [ ] **步骤 3：index.tsx（确认卡壳，读 store pendingConfirm）**

```tsx
import { Check, ShieldQuestion, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useAssistantStore from '../../store'
import { JobChangeSummary } from './job-change-summary'
import { ResumeFieldDiff } from './resume-field-diff'

export default function ConfirmCard() {
  const pending = useAssistantStore(s => s.pendingConfirm)
  if (!pending)
    return null

  const { preview, resolve } = pending

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <ShieldQuestion className="size-4 text-primary" />
        待确认操作
      </div>
      <p className="mb-2 text-sm font-medium">{preview.title}</p>
      {preview.kind === 'resume-field'
        ? <ResumeFieldDiff before={preview.before} after={preview.after} />
        : <JobChangeSummary summary={preview.summary ?? ''} />}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => resolve(false)}>
          <X className="size-3.5" />
          取消
        </Button>
        <Button size="sm" onClick={() => resolve(true)}>
          <Check className="size-3.5" />
          确认应用
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **步骤 4：验证**

运行：`pnpm lint src/pages/assistant/components/confirm-card/*.tsx`
预期：无 error。

---

## 任务 9：消息流渲染确认卡

**文件：**
- 修改：`src/pages/assistant/components/message-list/index.tsx`

- [ ] **步骤 1：在进行中气泡后渲染确认卡**

import `ConfirmCard`，在 `{streaming && (...)}` 块之后、`<div ref={bottomRef} />` 之前插入 `<ConfirmCard />`（它自身在无 pendingConfirm 时返回 null）。滚动依赖数组加 `pendingConfirm`：

```tsx
  const pendingConfirm = useAssistantStore(s => s.pendingConfirm)
  // ...
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingParts, streaming, pendingConfirm])
```
渲染处：
```tsx
      {/* 进行中气泡 ... */}
      <ConfirmCard />
      <div ref={bottomRef} />
```

- [ ] **步骤 2：验证**

运行：`pnpm lint` + `pnpm exec tsc --noEmit 2>&1 | grep message-list`
预期：无 error。

---

## 任务 10：最终验证

- [ ] **步骤 1：全量 lint + tsc + build**

运行：`pnpm lint && pnpm exec tsc --noEmit && pnpm build`
预期：lint 无新增 error；tsc 0；build 成功。

- [ ] **步骤 2：手动清单**（`pnpm dev` → `/assistant`，已登录、S1 迁移已执行）

- [ ] **读全域**：问"对比我两份简历的差异" → 调 `list_resumes` + `get_resume_detail`×2 → 逐项对比（治截图痛点）
- [ ] "我投了哪些公司" → `list_jobs`；"我这份简历 ATS 分数" → `get_ats`
- [ ] **概况感知**：进来直接问"你了解我的情况吗" → 说出简历数量/当前打开哪份/看板概况（不调工具也有基本盘）
- [ ] **写-当前简历**：编辑器打开某简历 → 助手页"把自我评价改得更专业" → 弹确认卡（原/新）→ 确认后编辑器实时更新；取消则不变
- [ ] **写-看板**：让"把美团那个职位状态改成面试中" → 确认卡 → 确认后看板/store 更新
- [ ] **未打开简历写**：不在编辑器时让改简历 → 工具返回"请先打开该简历"，不弹卡
- [ ] 刷新：读/写 tool-call parts（已应用/已取消态）重现
- [ ] 中断：确认卡待确认时点停止 → 挂起清理、不脏写；纯闲聊不触发工具
- [ ] S3 行为不回归（多步工具、单气泡、仅消息区滚）

---

## 自检记录

- **规格覆盖度：** AiToolCallState 扩展(任务1)、AgentTool.mode(任务1)、简历工具(任务3)、看板工具(任务4)、misc 只读(任务5)、build-context 概况(任务6)、to-api-messages 动态 system(任务6)、agent-loop 分流+cancelled(任务6)、store pendingConfirm(任务7)、confirm 桥+handler(任务2/7)、确认卡组件(任务8)、消息流渲染(任务9)、验证(任务10)——规格全部章节均有对应任务。
- **占位符扫描：** 无 TODO/待定；每步含完整代码。
- **类型一致性：** `AgentTool.mode`、`ConfirmPreview`/`ConfirmRequest`/`requestConfirm`/`setConfirmHandler`、store `pendingConfirm`、`AiToolCallState` 扩展全链路一致；工具入口名与探子盘点/barrel 导出一致。
- **CRDT 安全：** 简历写只经 `useResumeStore.updateForm`，且校验 `useCurrentResumeStore.resumeId`；看板走 `updateCompany/createCompany` + tracker store 同步。
- **GAIA 优先：** 工具可视化续用 Tool Calls Section；确认卡 GAIA 无对应件→shadcn 手搭（规格已注明）。
- **边界：** confirm-bridge 解耦 lib 与 React（handler 注入）；tools 按域拆分单一职责；确认卡组件按 kind 拆子件，props 只接自己数据，跨组件走 store。
- **已知落地判断点：** (a) misc 工具的 supabase 导出名以实际 barrel 为准；(b) `updateForm(..., as never)` / `createCompany(data as never)` 桥接动态 args 类型；(c) confirm handler 用 useEffect 注册一次，注意 StrictMode 双挂载用 setConfirmHandler 幂等覆盖，无副作用。
