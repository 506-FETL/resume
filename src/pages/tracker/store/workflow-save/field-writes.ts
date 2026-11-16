import type { PersistenceRuntime } from './runtime'
import type { WorkflowDrafts } from './workflow-drafts'
import type { Runtime, JobFieldsPatch, WorkflowField } from './types'
import { sameValue } from './values'
import type { JobApplication } from '../../types'
import { updateCompany } from '@/lib/supabase/resume'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
} from '../../lib/account-scope'
import { normalizeJobWorkflow } from '../../workflow'

export function createFieldWrites(
  core: PersistenceRuntime,
  drafts: WorkflowDrafts,
) {
  const { find, isLive, merge, bump, requestFlush, enqueue } = core
  const { persistDirty } = drafts

  const writePatch = async (
    id: string,
    runtime: Runtime,
    patch: JobFieldsPatch,
  ) => {
    if ('id' in patch || 'created_at' in patch || 'user_id' in patch)
      throw new Error('不能修改职位标识或归属信息')

    const current = find(id)!
    const changesStatus = 'status' in patch

    patch = Object.fromEntries(
      Object.entries(patch).filter(
        ([field, value]) =>
          // 流程 RPC 需要完整的阶段、轮次与活动快照，即使某个数组未变化。
          (changesStatus &&
            [
              'status',
              'stage_details',
              'interview_sub_stages',
              'activities',
            ].includes(field)) ||
          !sameValue(current[field as keyof JobApplication], value) ||
          (runtime.dirty.has(field as WorkflowField) &&
            !sameValue(runtime.baseline[field as keyof JobApplication], value)),
      ),
    )

    const fields = Object.keys(patch) as (keyof JobFieldsPatch)[]

    if (!fields.length) return current

    const versions = fields.map((field) => bump(runtime, field))

    merge(id, patch)
    fields.forEach((field) => runtime.inFlight.add(field))

    try {
      const saved = await updateCompany(
        id,
        patch,
        createTrackerAccountGuard(getTrackerAccountScope()),
      )

      if (!isLive(id, runtime)) throw new Error('该职位已删除或不可用')

      const accepted: JobFieldsPatch = { updated_at: saved.updated_at }

      fields.forEach((field, index) => {
        runtime.baseline = { ...runtime.baseline, [field]: saved[field] }

        if (runtime.versions[field] === versions[index])
          Object.assign(accepted, { [field]: saved[field] })
      })

      bump(runtime, 'updated_at')
      merge(id, accepted)

      return find(id)!
    } catch (error) {
      if (isLive(id, runtime)) {
        const rollback: JobFieldsPatch = {}

        fields.forEach((field, index) => {
          if (runtime.versions[field] === versions[index])
            Object.assign(rollback, { [field]: runtime.baseline[field] })
        })

        // 状态请求中的新输入仍保留，但状态恢复后要重新计算轮次状态。
        const current = find(id)!

        if ('status' in patch) {
          if (
            runtime.versions.stage_details !==
            versions[fields.indexOf('stage_details')]
          ) {
            // 首次进入已结束时条目可能只存在于乐观请求中；保留随后输入的内容，
            // 以弱态空条目作为回滚基线，移除失败转换创造的来源和历史标记。
            const newContentStages = current.stage_details
              .filter((detail) => {
                if (
                  runtime.baseline.stage_details.some(
                    (base) => base.stage === detail.stage,
                  )
                )
                  return false

                const submitted = patch.stage_details?.find(
                  (item) => item.stage === detail.stage,
                )

                return (
                  detail.notes !== (submitted?.notes ?? '') ||
                  detail.start_date !== (submitted?.start_date ?? null)
                )
              })
              .map((detail) => ({
                stage: detail.stage,
                status: '待处理' as const,
                start_date: null,
                notes: '',
              }))

            rollback.stage_details = [
              ...runtime.baseline.stage_details,
              ...newContentStages,
            ].map((detail) => {
              const draft = current.stage_details.find(
                (item) => item.stage === detail.stage,
              )

              const submitted = patch.stage_details?.find(
                (item) => item.stage === detail.stage,
              )

              return {
                ...detail,
                ...(draft && draft.notes !== submitted?.notes
                  ? { notes: draft.notes }
                  : {}),
                ...(draft && draft.start_date !== submitted?.start_date
                  ? { start_date: draft.start_date }
                  : {}),
              }
            })
          }
          if (
            runtime.versions.interview_sub_stages !==
            versions[fields.indexOf('interview_sub_stages')]
          ) {
            rollback.interview_sub_stages = current.interview_sub_stages.map(
              (round) => {
                const base = runtime.baseline.interview_sub_stages.find(
                  (item) => item.id === round.id,
                )

                const submitted = patch.interview_sub_stages?.find(
                  (item) => item.id === round.id,
                )

                if (!base) return round

                return {
                  ...base,
                  ...(round.label !== submitted?.label
                    ? { label: round.label }
                    : {}),
                  ...(round.notes !== submitted?.notes
                    ? { notes: round.notes }
                    : {}),
                  ...(round.start_date !== submitted?.start_date
                    ? { start_date: round.start_date }
                    : {}),
                }
              },
            )
          }
        }

        const normalized = normalizeJobWorkflow({ ...current, ...rollback })

        merge(id, {
          ...rollback,
          stage_details: normalized.stage_details,
          interview_sub_stages: normalized.interview_sub_stages,
        })
      }

      throw error
    } finally {
      fields.forEach((field) => runtime.inFlight.delete(field))
    }
  }

  const applyTransaction = (
    id: string,
    fields: (keyof JobFieldsPatch)[],
    save: () => Promise<JobApplication>,
  ) =>
    enqueue(id, async (runtime) => {
      requestFlush(runtime)
      await persistDirty(id, runtime)

      const versions = { ...runtime.versions }
      const saved = await save()
      const accepted: JobFieldsPatch = {}

      if (!isLive(id, runtime)) throw new Error('该职位已删除或不可用')

      for (const field of fields) {
        runtime.baseline = { ...runtime.baseline, [field]: saved[field] }

        if (runtime.versions[field] === versions[field])
          Object.assign(accepted, { [field]: saved[field] })
      }

      merge(id, accepted)

      return find(id)!
    })

  return { writePatch, applyTransaction }
}

export type FieldWrites = ReturnType<typeof createFieldWrites>
