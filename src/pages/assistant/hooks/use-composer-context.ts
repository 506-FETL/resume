import { useEffect, useRef, useState } from 'react'
import supabase from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/user'
import { getOfflineResumeSummaries } from '@/lib/offline-resume-manager/queries'
import { listAssistantJobOverviews } from '@/lib/supabase/resume/company/queries'
import useUserStore from '@/store/user'
import type { ComposerContextResult, ComposerReferenceState } from '../types'
import { useCanvasResources } from './canvas-resources'

async function loadResumes() {
  const owner = await getCurrentUser()
  const limit = 20

  const { data: cloud, error } = owner
    ? await supabase
        .from('resume_config')
        .select('resume_id,display_name')
        .eq('user_id', owner.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit)
    : { data: [], error: null }

  if (error) throw error

  const local =
    cloud.length < limit
      ? await getOfflineResumeSummaries(limit - cloud.length)
      : []

  return [...cloud, ...local].map((resume) => ({
    resumeId: resume.resume_id,
    name: resume.display_name ?? '未命名简历',
  }))
}

async function loadJobs() {
  const rows = await listAssistantJobOverviews(20)

  return rows.map(({ id, company, position }) => ({ id, company, position }))
}

function useReferenceOptions<T>(
  open: boolean,
  generation: number,
  revision: number,
  load: () => Promise<T[]>,
) {
  const [attempt, setAttempt] = useState(0)

  const [state, setState] = useState<ComposerReferenceState<T>>({
    generation: -1,
    items: [],
    status: 'idle',
  })

  const requestedRef = useRef('')
  const key = `${generation}:${revision}:${attempt}`

  useEffect(() => {
    if (!open || requestedRef.current === key) return

    requestedRef.current = key

    setState((previous) => ({
      generation,
      items: previous.generation === generation ? previous.items : [],
      status: 'loading',
    }))

    load().then(
      (items) => {
        if (
          requestedRef.current === key &&
          useCanvasResources.getState().generation === generation
        )
          setState({ generation, items, status: 'ready' })
      },
      () => {
        if (
          requestedRef.current === key &&
          useCanvasResources.getState().generation === generation
        )
          setState((previous) => ({ ...previous, status: 'error' }))
      },
    )
  }, [open, key, generation, load])

  const view: ComposerReferenceState<T> =
    state.generation === generation
      ? state
      : { generation, items: [], status: open ? 'loading' : 'idle' }

  return { view, retry: () => setAttempt((value) => value + 1) }
}

export function useComposerContext(open: boolean): ComposerContextResult {
  const authStatus = useUserStore((state) => state.authStatus)
  const generation = useCanvasResources((state) => state.generation)
  const resumeRevision = useCanvasResources((state) => state.resumeRevision)
  const boardRevision = useCanvasResources((state) => state.boardRevision)
  const active = open && authStatus !== 'unknown'

  const resumes = useReferenceOptions(
    active,
    generation,
    resumeRevision,
    loadResumes,
  )

  const jobs = useReferenceOptions(active, generation, boardRevision, loadJobs)

  return {
    resumes: resumes.view,
    jobs: jobs.view,
    retryResumes: resumes.retry,
    retryJobs: jobs.retry,
  }
}
