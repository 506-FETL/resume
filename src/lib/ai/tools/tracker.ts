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
  saved: '已保存',
  applied: '已投递',
  screen: '筛选中',
  interview: '面试中',
  offer: '已录用',
  rejected: '已终止',
}

// 看板职位字段 → 中文标签（用于变更记录里生成统一的红绿 diff）
const JOB_FIELD_LABELS: Record<string, string> = {
  company: '公司',
  position: '岗位',
  status: '状态',
  next_action: '下一步',
  notes: '备注',
  location: '城市',
  salary: '薪资',
}

function formatJobField(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '')
    return ''
  if (key === 'status')
    return STATUS_LABELS[String(value)] ?? String(value)
  return String(value)
}

function jobFieldLine(key: string, value: unknown): string {
  return `${JOB_FIELD_LABELS[key] ?? key}：${formatJobField(key, value)}`
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
        // 生成统一的红绿 diff：逐字段对比旧值 → 新值
        const keys = Object.keys(patch)
        const before = keys.map(k => jobFieldLine(k, (job as unknown as Record<string, unknown>)[k])).join('\n')
        const after = keys.map(k => jobFieldLine(k, patch[k])).join('\n')
        return { ok: true, jobId, before, after }
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
        // 新增：before 为空，after 为新职位内容，统一走红绿 diff（整体新增为绿色）
        const after = Object.keys(data)
          .filter(k => k in JOB_FIELD_LABELS && formatJobField(k, data[k]))
          .map(k => jobFieldLine(k, data[k]))
          .join('\n')
        return { ok: true, id: created.id, before: '', after }
      },
    })
  },
})
