import type { JobFieldsPatch } from '@/pages/tracker/store/workflow-save'
import type { ApplicationStatus } from '@/pages/tracker/types'
import { createCompany, getCompanies } from '@/lib/supabase/resume'
import { APPLICATION_STATUS_CONFIG } from '@/pages/tracker/const'
import { assertTrackerAccountScope, createTrackerAccountGuard, getTrackerAccountScope } from '@/pages/tracker/lib/account-scope'
import useTrackerStore from '@/pages/tracker/store'
import { requestConfirm } from '../agent/confirm-bridge'
import { registerTool } from '../agent/tool-registry'

registerTool({
  name: 'list_jobs',
  description: '列出当前用户求职看板里的所有职位（公司、岗位、状态、城市等）。当用户问投了哪些公司、看板情况、求职进度时使用。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => {
    const scope = getTrackerAccountScope()
    try {
      const jobs = await getCompanies(createTrackerAccountGuard(scope))
      assertTrackerAccountScope(scope)
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
    const scope = getTrackerAccountScope()
    try {
      const jobs = await getCompanies(createTrackerAccountGuard(scope))
      assertTrackerAccountScope(scope)
      const job = jobs.find(j => j.id === String(args.jobId))
      return job ?? { error: '未找到该职位' }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取职位失败' }
    }
  },
})

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(APPLICATION_STATUS_CONFIG).map(([status, config]) => [status, config.label]),
)

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
  description: '修改某个看板职位的字段（如 status 状态、next_action 下一步、notes 备注、location、salary 等）。status 可选：saved/applied/assessment/screen/written/interview/offer/rejected。此操作需用户确认。',
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
  execute: async (args, context) => {
    const scope = getTrackerAccountScope()
    const jobId = String(args.jobId)
    const patch = (args.patch ?? {}) as Record<string, unknown>
    const jobs = await getCompanies(createTrackerAccountGuard(scope)).catch(() => [])
    assertTrackerAccountScope(scope)
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
        assertTrackerAccountScope(scope)
        const { status, ...fields } = patch
        if ('stage_details' in fields || 'interview_sub_stages' in fields)
          throw new Error('阶段内容和面试轮次请通过求职跟进页面编辑，不能手动改流程状态')
        if (status !== undefined && (typeof status !== 'string' || !Object.hasOwn(APPLICATION_STATUS_CONFIG, status)))
          throw new Error('无效的职位状态')
        if (!useTrackerStore.getState().jobs.some(item => item.id === jobId))
          await useTrackerStore.getState().reloadJobs()
        assertTrackerAccountScope(scope)
        if (status !== undefined)
          await useTrackerStore.getState().changeJobStatus(jobId, status as ApplicationStatus, fields as JobFieldsPatch)
        else if (Object.keys(fields).length)
          await useTrackerStore.getState().saveJobFields(jobId, fields as JobFieldsPatch)
        // 生成统一的红绿 diff：逐字段对比旧值 → 新值
        const keys = Object.keys(patch)
        const before = keys.map(k => jobFieldLine(k, (job as unknown as Record<string, unknown>)[k])).join('\n')
        const after = keys.map(k => jobFieldLine(k, patch[k])).join('\n')
        return { ok: true, jobId, before, after }
      },
    }, context?.signal)
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
  execute: async (args, context) => {
    const scope = getTrackerAccountScope()
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
        assertTrackerAccountScope(scope)
        const status = data.status ?? 'saved'
        if (typeof status !== 'string' || !Object.hasOwn(APPLICATION_STATUS_CONFIG, status))
          throw new Error('无效的职位状态')
        if ('stage_details' in data || 'interview_sub_stages' in data)
          throw new Error('新增职位时不能手动指定阶段和轮次状态')
        const created = await createCompany({
          ...data,
          status,
          stage_details: [{ stage: status, status: '待处理', start_date: null, notes: '', ...((status === 'offer' || status === 'rejected') ? { source_stage: null } : {}) }],
          interview_sub_stages: [],
        } as never, createTrackerAccountGuard(scope))
        useTrackerStore.getState().prependJob(created, scope)
        // 新增：before 为空，after 为新职位内容，统一走红绿 diff（整体新增为绿色）
        const after = Object.keys(data)
          .filter(k => k in JOB_FIELD_LABELS && formatJobField(k, data[k]))
          .map(k => jobFieldLine(k, data[k]))
          .join('\n')
        return { ok: true, id: created.id, before: '', after }
      },
    }, context?.signal)
  },
})
