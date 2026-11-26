import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { jobContextUrl } from '@/lib/job-context'
import useResumeListStore from '../../store'
import useShareStore from '@/pages/share/store'
import useCurrentResumeStore from '@/store/resume/current'
import { useDeriveJd } from '../../hooks/use-derive-jd'
import type { useJobPreparation } from '../../hooks/use-job-preparation'
import type { ResumeItem } from '../../types'
import {
  LibraryShareDialog,
  LibrarySyncDialog,
  LibraryTasksDialog,
  LibraryVariantDialog,
} from './dialogs'

export function LibraryActions({
  jobPreparation,
  resumes,
}: {
  jobPreparation: ReturnType<typeof useJobPreparation>
  resumes: ResumeItem[]
}) {
  const { jobContext, routeJobId } = jobPreparation

  const {
    showSyncDialog,
    libraryParents,
    derivePendingFor,
    openDeriveFor,
    derivedJobsOpen,
    setDerivedJobsOpen,
  } = useResumeListStore(
    useShallow((s) => ({
      showSyncDialog: s.showSyncDialog,
      libraryParents: s.libraryParents,
      derivePendingFor: s.derivePendingFor,
      openDeriveFor: s.openDeriveFor,
      derivedJobsOpen: s.derivedJobsOpen,
      setDerivedJobsOpen: s.setDerivedJobsOpen,
    })),
  )

  const setCurrentResume = useCurrentResumeStore((s) => s.setCurrentResume)
  const shareOpenForResumeId = useShareStore((s) => s.openForResumeId)
  const navigate = useNavigate()
  const retainedDeriveParentIdRef = useRef<string | null>(derivePendingFor)

  if (derivePendingFor) {
    retainedDeriveParentIdRef.current = derivePendingFor
  }

  const deriveDialogParentId =
    derivePendingFor ?? retainedDeriveParentIdRef.current

  const pendingResume = useMemo(
    () =>
      derivePendingFor
        ? (resumes.find((r) => r.resume_id === derivePendingFor) ??
          libraryParents[derivePendingFor] ??
          null)
        : null,
    [derivePendingFor, resumes, libraryParents],
  )

  const useJobJd = jobContext?.id === routeJobId

  const deriveJd = useDeriveJd(
    !useJobJd &&
      (pendingResume?.linked_jd_excerpt ||
        pendingResume?.linked_jd_text ||
        pendingResume?.derived_status)
      ? derivePendingFor
      : null,
  )

  return (
    <>
      <LibraryShareDialog
        open={Boolean(shareOpenForResumeId)}
        onClose={() => useShareStore.getState().closeDialog()}
      >
        {(QuickDialog, opener) => (
          <QuickDialog
            returnFocusTo={opener}
            getSnapshot={async () => {
              if (!shareOpenForResumeId) throw new Error('未选择简历')

              const { getResumeSnapshotById } =
                await import('@/lib/supabase/resume/share/release-source')

              return getResumeSnapshotById(shareOpenForResumeId)
            }}
          />
        )}
      </LibraryShareDialog>

      {deriveDialogParentId && (
        <LibraryVariantDialog
          key={deriveDialogParentId}
          open={Boolean(derivePendingFor)}
          onClose={() => openDeriveFor(null)}
        >
          {(JdVariantDialog, opener) => (
            <JdVariantDialog
              returnFocusTo={opener}
              open={Boolean(derivePendingFor)}
              onOpenChange={(o) => {
                if (!o) openDeriveFor(null)
              }}
              parentResumeId={deriveDialogParentId}
              recentJds={[]}
              initialJd={
                jobContext?.id === routeJobId
                  ? jobContext.jdText
                  : deriveJd.text
              }
              initialJdLoading={!useJobJd && deriveJd.loading}
              initialJdError={!useJobJd ? deriveJd.error : null}
              onRetryInitialJd={deriveJd.retry}
              jobId={jobContext?.id === routeJobId ? jobContext.id : undefined}
              onOpenResume={(draftId) => {
                const target = resumes.find((r) => r.resume_id === draftId)

                setCurrentResume(draftId, target?.type ?? 'default')

                navigate(
                  jobContext?.id === routeJobId
                    ? jobContextUrl('/resume/editor', jobContext.id)
                    : '/resume/editor',
                )
              }}
            />
          )}
        </LibraryVariantDialog>
      )}
      <LibrarySyncDialog
        open={showSyncDialog}
        onClose={() => useResumeListStore.getState().setShowSyncDialog(false)}
      >
        {(SyncResumesDialog, opener) => (
          <SyncResumesDialog returnFocusTo={opener} />
        )}
      </LibrarySyncDialog>
      <LibraryTasksDialog
        open={derivedJobsOpen}
        onClose={() => setDerivedJobsOpen(false)}
      >
        {(DerivedJobsDialog, opener) => (
          <DerivedJobsDialog
            returnFocusTo={opener}
            open={derivedJobsOpen}
            onOpenChange={setDerivedJobsOpen}
          />
        )}
      </LibraryTasksDialog>
    </>
  )
}
