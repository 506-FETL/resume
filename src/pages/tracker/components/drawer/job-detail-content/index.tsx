import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ContentSkeleton } from '@/components/loading-skeleton'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import type { JobDetailField } from '@/lib/supabase/resume/company/queries'
import useTrackerStore from '../../../store'
import type { JobApplication } from '../../../types'
import { getTrackerErrorMessage } from '../../../utils'

export default function JobDetailContent<K extends JobDetailField>({
  field,
  children,
}: {
  field: K
  children: (value: Exclude<JobApplication[K], undefined>) => ReactNode
}) {
  const id = useTrackerStore((state) => state.selectedJob?.id)
  const revision = useTrackerStore((state) => state.selectedJob?.updated_at)
  const value = useTrackerStore((state) => state.selectedJob?.[field])
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const previousRef = useRef<{
    id: string
    value: Exclude<JobApplication[K], undefined>
  } | null>(null)

  const loaded = value !== undefined

  if (id && loaded)
    previousRef.current = {
      id,
      value: value as Exclude<JobApplication[K], undefined>,
    }

  const visible = previousRef.current?.id === id ? previousRef.current : null
  const label = field === 'contacts' ? '联系人' : '岗位 JD'

  useEffect(() => {
    if (!id || loaded) return

    let current = true

    setError(null)

    useTrackerStore
      .getState()
      .loadJobDetail(id, field)
      .catch((cause) => {
        if (current) setError(getTrackerErrorMessage(cause))
      })

    return () => {
      current = false
    }
  }, [id, field, revision, loaded, attempt])

  const retry = error && (
    <div role='alert' className='space-y-2 text-sm'>
      <p>
        {label}加载失败：{error}
      </p>
      <Button
        variant='outline'
        size='sm'
        onClick={() => setAttempt((count) => count + 1)}
      >
        重试
      </Button>
    </div>
  )

  return (
    <AnimatedContent
      animationKey={visible ? 'ready' : error ? 'error' : 'loading'}
    >
      {visible ? (
        <>
          <fieldset className='min-w-0' disabled={!loaded} aria-busy={!loaded}>
            {children(visible.value)}
          </fieldset>
          {!loaded && retry}
        </>
      ) : (
        retry || (
          <ContentSkeleton
            label={`正在加载${label}`}
            rows={2}
            className='p-0'
          />
        )
      )}
    </AnimatedContent>
  )
}
