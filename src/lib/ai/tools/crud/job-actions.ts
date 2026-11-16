import { getCompanySummaryById } from '@/lib/supabase/resume'
import {
  assertTrackerAccountScope,
  createTrackerAccountGuard,
  getTrackerAccountScope,
} from '@/pages/tracker/lib/account-scope'
import useTrackerStore from '@/pages/tracker/store'
import { requestConfirm } from '../../agent/confirm-bridge'
import { registerTool } from '../../agent/tool-registry'

registerTool({
  name: 'delete_job',
  description:
    '删除求职看板中的某个职位。jobId 从 list_jobs 获得。不可恢复，此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: { jobId: { type: 'string', description: '职位 id' } },
    required: ['jobId'],
    additionalProperties: false,
  },
  mode: 'write',
  policy: { scope: 'account', confirmation: 'required' },
  execute: async (args, context) => {
    const jobId = String(args.jobId ?? '')
    const scope = getTrackerAccountScope()

    if (!jobId) return { error: '缺少 jobId' }

    const job = await getCompanySummaryById(
      jobId,
      createTrackerAccountGuard(scope),
    )

    assertTrackerAccountScope(scope)

    if (!job) return { error: '未找到该职位' }

    return requestConfirm(
      {
        id: crypto.randomUUID(),
        toolName: 'delete_job',
        preview: {
          kind: 'job-delete',
          title: '删除职位',
          summary: `将永久删除职位「${job.company} · ${job.position}」，无法恢复。`,
        },
        apply: async () => {
          assertTrackerAccountScope(scope)

          if (
            !useTrackerStore.getState().jobs.some((item) => item.id === jobId)
          )
            await useTrackerStore.getState().reloadJobs()

          assertTrackerAccountScope(scope)
          await useTrackerStore.getState().deleteJob(jobId)

          // 统一红绿 diff：删除 → before 为职位信息，after 为空（整体删除为红色）
          const beforeLines = [`公司：${job.company}`, `岗位：${job.position}`]

          if (job.location) beforeLines.push(`城市：${job.location}`)

          return { ok: true, jobId, before: beforeLines.join('\n'), after: '' }
        },
      },
      context?.signal,
    )
  },
})
