import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  getOfflineResumeSummariesByIds,
  isOfflineResumeId,
} from '@/lib/offline-resume-manager'
import { getResumeById } from '@/lib/supabase/resume/form'
import {
  getTrackerAccountScope,
  subscribeTrackerAccountScope,
} from '@/pages/tracker/lib/account-scope'

type JdState = {
  key: string
  text: string
  loading: boolean
  error: string | null
}

export function useDeriveJd(resumeId: string | null) {
  const scope = useSyncExternalStore(
    subscribeTrackerAccountScope,
    getTrackerAccountScope,
    getTrackerAccountScope,
  )

  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([scope.generation, resumeId, attempt])
  const [state, setState] = useState<JdState | null>(null)

  useEffect(() => {
    if (!resumeId) {
      setState(null)

      return
    }

    let active = true

    setState({ key, text: '', loading: true, error: null })

    const request = isOfflineResumeId(resumeId)
      ? getOfflineResumeSummariesByIds([resumeId]).then(([record]) => record)
      : getResumeById<{ linked_jd_text: string | null }>(
          resumeId,
          'linked_jd_text',
        )

    request
      .then((record) => {
        if (!active || scope !== getTrackerAccountScope()) return

        if (!record) throw new Error('未找到这份简历，请刷新后重试')

        setState({
          key,
          text: record.linked_jd_text ?? '',
          loading: false,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (!active || scope !== getTrackerAccountScope()) return

        setState({
          key,
          text: '',
          loading: false,
          error:
            error instanceof Error ? error.message : '职位描述加载失败，请重试',
        })
      })

    return () => {
      active = false
    }
  }, [resumeId, scope, key])

  const current = resumeId && state?.key === key ? state : null

  return {
    text: current?.text ?? '',
    loading: Boolean(resumeId) && (current?.loading ?? true),
    error: current?.error ?? null,
    retry: () => setAttempt((value) => value + 1),
  }
}
