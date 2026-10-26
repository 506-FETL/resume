import type { RefObject } from 'react'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { useEffect } from 'react'
import { checkResumeLayout } from '@/lib/resume-checks/layout'
import useResumeStore from '@/store/resume/form'
import { useResumeCheckStore } from '../store/checks'

export function useCheckLayout(
  rootRef: RefObject<HTMLDivElement | null>,
  documentState: ResumeDocumentState,
  review: boolean,
) {
  const signature = useResumeCheckStore((state) => state.snapshotSignature)
  const identity = useResumeCheckStore((state) => state.identity)

  useEffect(() => {
    if (!identity || !signature || review) return

    const frame = requestAnimationFrame(() => {
      const snapshot = useResumeStore.getState().getPersistedSnapshot()

      if (JSON.stringify(snapshot) !== signature) return

      const issues = checkResumeLayout(
        snapshot,
        documentState.status === 'ready' ? rootRef.current : null,
      )

      const previous = useResumeCheckStore.getState()

      const unchanged =
        JSON.stringify(previous.layoutIssues) === JSON.stringify(issues)

      if (unchanged && previous.layoutSnapshotSignature === signature) return

      useResumeCheckStore.setState({
        layoutIssues: unchanged ? previous.layoutIssues : issues,
        layoutSnapshotSignature: signature,
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [identity, signature, documentState, review, rootRef])
}
