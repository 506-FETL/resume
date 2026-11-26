import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ContentSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils/errors'

export default function WorkflowContent({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: ReactNode
}) {
  const loaded = useTrackerStore(
    (state) =>
      state.selectedJob?.id === id &&
      state.selectedJob.workflowLoaded !== false,
  )

  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (loaded) return

    let active = true

    setError('')

    const state = useTrackerStore.getState()

    const opening =
      state.selectedJob?.id === id && !attempt ? state.drawerWorkflowRead : null

    const pending = opening
      ? opening.then(() => {
          const selected = useTrackerStore.getState().selectedJob

          if (
            active &&
            selected?.id === id &&
            selected.workflowLoaded === false
          )
            return state.ensureJobLoaded(id)
        })
      : state.ensureJobLoaded(id)

    pending.catch((cause) => {
      if (active) setError(getTrackerErrorMessage(cause))
    })

    return () => {
      active = false
    }
  }, [id, loaded, attempt])

  if (loaded) return children
  if (error)
    return (
      <div className='flex items-center gap-2' role='alert'>
        <span className='text-sm'>{error}</span>
        <Button
          size='sm'
          variant='outline'
          onClick={() => setAttempt((n) => n + 1)}
        >
          重试
        </Button>
      </div>
    )

  return <ContentSkeleton label={`正在读取${label}`} rows={2} />
}
