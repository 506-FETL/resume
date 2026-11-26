import { useState } from 'react'
import type { ApplicationStatus } from '../../types'
import useTrackerStore from '../../store'
import {
  assertTrackerAccountScope,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
  isTrackerAccountScopeError,
} from '../../lib/account-scope'
import { getTrackerErrorMessage } from '../../utils/errors'
import { toast } from 'sonner'

type Operation = ApplicationStatus | 'archive' | 'delete'

export function useBatchWrites(exit: () => void) {
  const [busy, setBusy] = useState(false)

  async function apply(operation: Operation) {
    const scope = getTrackerAccountScope()
    const state = useTrackerStore.getState()

    const targets = state.jobs.filter(
      (job) =>
        state.selectedIds.has(job.id) &&
        (operation === 'archive' ? !job.archived : operation !== job.status),
    )

    if (busy || !targets.length) return

    const guided = targets.filter(
      (job) =>
        (operation === 'applied' && !job.has_submission) ||
        (job.status === 'rejected' &&
          ['applied', 'assessment', 'screen', 'written', 'interview'].includes(
            operation,
          )),
    )

    const waiting = new Set(guided)
    const queue = targets.filter((job) => !waiting.has(job)).values()
    const failures = new Map<string, unknown>()

    const write = async (id: string) => {
      assertTrackerAccountScope(scope)

      try {
        if (operation === 'delete') await state.deleteJob(id)
        else if (operation === 'archive')
          await state.saveJobFields(id, { archived: true })
        else await state.changeJobStatus(id, operation)
      } catch (error) {
        if (isTrackerAccountScopeError(error)) throw error

        failures.set(id, error)
      }
    }

    const worker = async () => {
      for (const job of queue) await write(job.id)
    }

    setBusy(true)

    try {
      await state.runJobBatch(async () => {
        await Promise.all(
          Array.from(
            { length: Math.min(4, targets.length - guided.length) },
            worker,
          ),
        )

        for (const job of guided) await write(job.id)
      })

      assertTrackerAccountScope(scope)

      const latest = useTrackerStore.getState()

      const remaining = new Set(
        latest.jobs
          .filter(
            (row) =>
              state.selectedIds.has(row.id) &&
              (operation === 'delete'
                ? true
                : operation === 'archive'
                  ? !row.archived
                  : row.status !== operation),
          )
          .map((row) => row.id),
      )

      if (remaining.size)
        useTrackerStore.setState({ isSelectMode: true, selectedIds: remaining })
      else exit()

      if (failures.size)
        toast.error(`${failures.size} 个职位操作失败`, {
          description: getTrackerErrorMessage(failures.values().next().value),
        })
      else if (operation === 'delete')
        toast.success(`已删除 ${targets.length} 个职位`)
    } catch (error) {
      if (isTrackerAccountScopeCurrent(scope))
        toast.error('批量操作失败', {
          description: getTrackerErrorMessage(error),
        })
    } finally {
      if (isTrackerAccountScopeCurrent(scope)) setBusy(false)
    }
  }

  return { apply, busy }
}
