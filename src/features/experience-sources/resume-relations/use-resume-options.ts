import { useEffect, useRef, useState } from 'react'
import { subscribeResumeReadChanges } from '@/lib/resume-read-events'
import supabase from '@/lib/supabase/client'
import { RESUME_LIBRARY_PAGE_SIZE } from '@/lib/supabase/resume/library'

type ResumeOption = { resume_id: string; display_name: string | null }

export function useResumeOptions(open: boolean, ownerId: string | null) {
  const [request, setRequest] = useState({ offset: 0 })
  const loadedRequestRef = useRef<typeof request | null>(null)
  const [options, setOptions] = useState<ResumeOption[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeResumeReadChanges(() => {
        setRequest({ offset: 0 })
      }),
    [],
  )

  useEffect(() => {
    if (!open || !ownerId || loadedRequestRef.current === request) return

    const controller = new AbortController()
    const { offset } = request

    setError(null)

    supabase
      .from('resume_config')
      .select('resume_id,display_name', { count: 'exact' })
      .eq('user_id', ownerId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('resume_id', { ascending: false })
      .range(offset, offset + RESUME_LIBRARY_PAGE_SIZE - 1)
      .abortSignal(controller.signal)
      .retry(false)
      .then(({ data, count, error: cause }) => {
        if (controller.signal.aborted) return
        if (offset > 0 && cause?.code === 'PGRST103') {
          setRequest({ offset: 0 })

          return
        }
        if (cause || count === null) {
          setError('简历列表读取失败。')

          return
        }

        loadedRequestRef.current = request
        setOptions((previous) => (offset ? previous.concat(data) : data))
        setHasMore(offset + data.length < count)
      })

    return () => controller.abort()
  }, [open, ownerId, request])

  return {
    options,
    hasMore,
    error,
    loading: open && loadedRequestRef.current !== request && !error,
    loadMore: () => setRequest({ offset: options.length }),
    retry: () => setRequest({ ...request }),
  }
}
