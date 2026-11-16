import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import useResumeListStore from '@/pages/resume/store'
import useUserStore from '@/store/user'
import { FileText, Plus } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import type { MouseEvent } from 'react'
import ResumeCard from '../../components/resume-card'
import type { ResumeItem } from '../../types'

import type { RefObject } from 'react'
import type { useJobPreparation } from '../../hooks/use-job-preparation'

export function LibraryResults({
  resumes,
  loading,
  loadError,
  resumeListRef,
  pageStatusRef,
  allFilterTriggerRef,
  openCreate,
  jobPreparation,
}: {
  resumes: ResumeItem[]
  loading: boolean
  loadError: string | null
  resumeListRef: RefObject<HTMLDivElement | null>
  pageStatusRef: RefObject<HTMLSpanElement | null>
  allFilterTriggerRef: RefObject<HTMLButtonElement | null>
  openCreate: (event: MouseEvent<HTMLButtonElement>) => void
  jobPreparation: ReturnType<typeof useJobPreparation>
}) {
  const {
    syncingIds,
    libraryQuery,
    libraryCounts,
    filterMode,
    setLibrarySearchInput,
    setLibraryQuery,
    setLibraryFilter,
  } = useResumeListStore()

  const shouldReduceMotion = useReducedMotion()
  const user = useUserStore((state) => state.currentUser)

  const { jobContext, routeJobId, preparingResume, prepareForJob } =
    jobPreparation

  const visibleItems = resumes

  return (
    <div
      ref={resumeListRef}
      role='region'
      aria-label='简历列表'
      tabIndex={-1}
      className='min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain outline-none [scrollbar-gutter:stable]'
      aria-busy={loading}
      inert={loading || undefined}
    >
      <AnimatePresence mode='popLayout' initial={false}>
        {visibleItems.map((resume, index) => {
          const isSyncingThis = syncingIds.has(resume.resume_id)

          return (
            <PresenceDiv
              key={resume.resume_id}
              className='min-w-0 border-b border-border/60 last:border-b-0'
              layout={shouldReduceMotion ? false : 'position'}
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
              animate={{
                opacity: isSyncingThis ? 0.55 : 1,
                y: 0,
                transition: {
                  duration: shouldReduceMotion ? 0 : DURATION.base,
                  ease: EASE.out,
                  delay: shouldReduceMotion
                    ? 0
                    : staggerDelay(Math.min(index, 8)),
                },
              }}
              exit={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : -4,
                transition: {
                  duration: shouldReduceMotion ? 0 : DURATION.fast,
                  ease: EASE.in,
                },
              }}
              transition={{
                duration: shouldReduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
                layout: shouldReduceMotion ? { duration: 0 } : SPRING.layout,
              }}
            >
              <ResumeCard
                resume={resume}
                onDeletedClose={() =>
                  pageStatusRef.current?.focus({ preventScroll: true })
                }
                preparedForJob={jobContext?.resumeId === resume.resume_id}
                preparingForJob={
                  preparingResume?.jobId === routeJobId &&
                  preparingResume?.userId === user?.id &&
                  preparingResume?.resumeId === resume.resume_id
                }
                prepareDisabled={
                  preparingResume?.jobId === routeJobId &&
                  preparingResume?.userId === user?.id
                }
                onPrepareForJob={
                  jobContext?.id === routeJobId && !resume.isOffline
                    ? () => prepareForJob(resume.resume_id)
                    : undefined
                }
              />
            </PresenceDiv>
          )
        })}

        {visibleItems.length === 0 && !loadError && !loading && (
          <PresenceDiv
            key='create-empty'
            layout={shouldReduceMotion ? false : 'position'}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : -4,
              transition: {
                duration: shouldReduceMotion ? 0 : DURATION.fast,
                ease: EASE.in,
              },
            }}
            transition={{
              duration: shouldReduceMotion ? 0 : DURATION.base,
              ease: EASE.out,
              layout: shouldReduceMotion ? { duration: 0 } : SPRING.layout,
            }}
          >
            <Empty className='min-h-64 px-4 py-10'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <FileText aria-hidden />
                </EmptyMedia>
                <EmptyTitle>
                  {libraryQuery
                    ? '未找到匹配的简历'
                    : libraryCounts?.all === 0
                      ? '还没有简历'
                      : filterMode === 'variants'
                        ? '还没有可用的岗位版本'
                        : '没有原始简历'}
                </EmptyTitle>
                <EmptyDescription>
                  {libraryQuery
                    ? '试试其他名称或描述，或清空搜索。'
                    : libraryCounts?.all === 0
                      ? '创建一份简历，整理经历并选择适合的模板。'
                      : filterMode === 'variants'
                        ? '从原始简历创建岗位版本，生成完成后会显示在这里。'
                        : '创建一份新的原始简历，已有岗位版本可在「全部」中查看。'}
                </EmptyDescription>
              </EmptyHeader>
              <div className='flex flex-wrap justify-center gap-2'>
                {libraryQuery ? (
                  <Button
                    variant='outline'
                    onClick={() => {
                      document
                        .getElementById('resume-library-search')
                        ?.focus({ preventScroll: true })

                      setLibrarySearchInput('')
                      setLibraryQuery('')
                    }}
                  >
                    清空搜索
                  </Button>
                ) : (
                  (libraryCounts?.all ?? 0) > 0 && (
                    <Button
                      variant='outline'
                      onClick={() => {
                        allFilterTriggerRef.current?.focus({
                          preventScroll: true,
                        })

                        setLibraryFilter('all')
                      }}
                    >
                      查看全部简历
                    </Button>
                  )
                )}
                <Button aria-label='打开创建简历表单' onClick={openCreate}>
                  <Plus aria-hidden />
                  创建新简历
                </Button>
              </div>
            </Empty>
          </PresenceDiv>
        )}
      </AnimatePresence>
    </div>
  )
}
