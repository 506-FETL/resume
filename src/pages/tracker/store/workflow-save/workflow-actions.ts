import type { PersistenceRuntime } from './runtime'
import type { WorkflowDrafts } from './workflow-drafts'
import type { FieldWrites } from './field-writes'
import type { JobFieldsPatch, JobPatchFactory } from './types'
import type {
  ApplicationStatus,
  InterviewSubStage,
  StageDetail,
} from '../../types'
import { appendStatusChangeActivity } from '../../utils'
import {
  normalizeInterviewSubStages,
  normalizeJobWorkflow,
  transitionJobWorkflow,
} from '../../workflow'

export function createWorkflowActions(
  core: PersistenceRuntime,
  drafts: WorkflowDrafts,
  writes: FieldWrites,
) {
  const { find, runtimeFor, runtimes, isLive, merge, enqueue, requestFlush } =
    core

  const { persistDirty, editWorkflow, flushWorkflow } = drafts
  const { writePatch } = writes

  return {
    saveJobFields: (id: string, patch: JobFieldsPatch | JobPatchFactory) =>
      enqueue(id, (runtime) => {
        const changes = typeof patch === 'function' ? patch(find(id)!) : patch

        if (
          'status' in changes ||
          'stage_details' in changes ||
          'interview_sub_stages' in changes
        )
          throw new Error('流程状态和内容必须使用流程保存动作')

        return writePatch(id, runtime, changes)
      }),
    flushWorkflow,
    retryWorkflow: flushWorkflow,
    hasPendingWorkflow: () =>
      [...runtimes].some(
        ([id, runtime]) =>
          isLive(id, runtime) &&
          !runtime.deleting &&
          (runtime.dirty.size > 0 ||
            runtime.inFlight.has('stage_details') ||
            runtime.inFlight.has('interview_sub_stages')),
      ),
    flushPendingWorkflows: () =>
      Promise.allSettled([...runtimes.keys()].map(flushWorkflow)),
    changeJobStatus: (
      id: string,
      target: ApplicationStatus,
      fields: JobFieldsPatch = {},
    ) =>
      enqueue(id, async (runtime) => {
        if (
          'status' in fields ||
          'stage_details' in fields ||
          'interview_sub_stages' in fields ||
          'activities' in fields
        )
          throw new Error('附加字段不能覆盖流程状态、内容或活动')

        // 在同一串行任务内刷新，不能 enqueue 后再 await 自己后面的队列。
        requestFlush(runtime)
        await persistDirty(id, runtime)
        runtime.flushVersions = {}

        if (!isLive(id, runtime)) throw new Error('该职位已删除或不可用')

        const job = find(id)!

        if (job.status === target) {
          if (Object.keys(fields).length) await writePatch(id, runtime, fields)

          return
        }

        const transitioned = transitionJobWorkflow(job, target)

        await writePatch(id, runtime, {
          ...fields,
          status: transitioned.status,
          stage_details: transitioned.stage_details,
          interview_sub_stages: transitioned.interview_sub_stages,
          activities: appendStatusChangeActivity(job, target),
        })

        // 请求期间可能继续编辑内容；以成功状态规范化最新草稿。
        if (isLive(id, runtime)) {
          const latest = normalizeJobWorkflow(find(id)!)

          merge(id, {
            stage_details: latest.stage_details,
            interview_sub_stages: latest.interview_sub_stages,
          })

          await persistDirty(id, runtime)
        }
      }),
    editStageContent: (
      id: string,
      stage: ApplicationStatus,
      patch: Partial<Pick<StageDetail, 'start_date' | 'notes'>>,
      immediate = false,
    ) => {
      const job = find(id)

      if (!job) return

      const details = normalizeJobWorkflow(job).stage_details
      // 展开保存整个条目，保留终态 source_stage 的 undefined / null 语义。
      const content: Partial<Pick<StageDetail, 'start_date' | 'notes'>> = {}

      if ('notes' in patch) content.notes = patch.notes
      if ('start_date' in patch) content.start_date = patch.start_date
      if (!Object.keys(content).length) return

      const updated = details.some((detail) => detail.stage === stage)
        ? details.map((detail) =>
            detail.stage === stage ? { ...detail, ...content } : detail,
          )
        : [
            ...details,
            {
              stage,
              status: '待处理' as const,
              start_date: null,
              notes: '',
              ...content,
            },
          ]

      // 内容编辑可补建旧记录缺失的条目，不创建来源、推进活动或历史状态。
      const next = normalizeJobWorkflow({
        ...job,
        stage_details: updated,
      }).stage_details

      editWorkflow(
        id,
        'stage_details',
        next,
        immediate || 'start_date' in patch,
      )
    },
    editInterviewRound: (
      id: string,
      roundId: string,
      patch: Partial<Pick<InterviewSubStage, 'label' | 'start_date' | 'notes'>>,
      immediate = false,
    ) => {
      const job = find(id)

      if (
        !job ||
        !job.interview_sub_stages.some((round) => round.id === roundId)
      )
        return

      const content: Partial<
        Pick<InterviewSubStage, 'label' | 'start_date' | 'notes'>
      > = {}

      if ('label' in patch) content.label = patch.label
      if ('notes' in patch) content.notes = patch.notes
      if ('start_date' in patch) content.start_date = patch.start_date
      if (!Object.keys(content).length) return

      const next = job.interview_sub_stages.map((round) =>
        round.id === roundId ? { ...round, ...content } : round,
      )

      editWorkflow(
        id,
        'interview_sub_stages',
        normalizeInterviewSubStages(job.status, next),
        immediate || 'start_date' in patch,
      )
    },
    addInterviewRound: (id: string): string | null => {
      const job = find(id)

      if (!job || job.status !== 'interview' || runtimeFor(id).deleting)
        return null

      const roundId = crypto.randomUUID()

      const order =
        Math.max(-1, ...job.interview_sub_stages.map((round) => round.order)) +
        1

      const next = [
        ...job.interview_sub_stages,
        {
          id: roundId,
          label: `第 ${job.interview_sub_stages.length + 1} 轮面试`,
          status: '进行中' as const,
          start_date: null,
          notes: '',
          order,
        },
      ]

      editWorkflow(
        id,
        'interview_sub_stages',
        normalizeInterviewSubStages(job.status, next),
        true,
      )

      return roundId
    },
    removeInterviewRound: (id: string, roundId: string) => {
      const job = find(id)

      if (!job) return

      const next = job.interview_sub_stages.filter(
        (round) => round.id !== roundId,
      )

      editWorkflow(
        id,
        'interview_sub_stages',
        normalizeInterviewSubStages(job.status, next),
        true,
      )
    },
  }
}
