import {
  jobContextUrl,
  readJobContextDescription,
  useJobContextStore,
} from '@/lib/job-context'
import type { ResumeToolContext } from '../shared/types'
import type { ComponentProps } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'
import { GitBranch, Search, Target } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { deferDialog } from '@/components/deferred-dialog'
import type { JdVariantDialogProps } from '@/components/jd-variant/components/generator-dialog'
import { MIN_JD_CHARS } from '@/components/jd-variant/const'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import useUserStore from '@/store/user'
import useAtsStore from '@/pages/optimize/store'
import useCurrentResumeStore from '@/store/resume/current'
import {
  ToolEmptyState,
  ToolMetaBadge,
  ToolPanelBody,
  ToolPanelCard,
  ToolPanelHeader,
} from '../shared/primitives'
import { getJobDescriptionSessionKey } from './const'
import useJobDescriptionToolStore, {
  initialSession,
  flushJobDescriptionSessions,
} from './store'
import { hasJobDescriptionAnalysisFlow } from './utils'

const AnalysisTrace = createDeferredComponent<
  ComponentProps<typeof import('./analysis-trace').default>
>(() => import('./analysis-trace'), '比对过程')

const ComparisonResultView = createDeferredComponent<
  ComponentProps<typeof import('./comparison-result').default>
>(() => import('./comparison-result'), '比对结果')

const VariantDialog = deferDialog<JdVariantDialogProps>(
  () => import('./variant-dialog'),
  '派生针对性简历',
)

interface JobDescriptionToolProps {
  resumeId: string
  resumeType: ResumeToolContext['resumeType']
  resume: ResumeToolContext['resume'] | undefined
  initialJobDescription?: Promise<string>
}

function JobDescriptionTool({
  resumeId,
  resumeType,
  resume,
  initialJobDescription,
}: JobDescriptionToolProps) {
  const owner = useUserStore((state) => state.currentUser?.id ?? 'guest')

  const jobContext = useJobContextStore((state) =>
    state.context?.userId === owner ? state.context : null,
  )

  const target = getJobDescriptionSessionKey(resumeId, resumeType)
  const sessionKey = `${owner}:${jobContext ? `${jobContext.id}:` : ''}${target}`

  const legacyKey = jobContext
    ? `${jobContext.userId}:${jobContext.id}:${target}`
    : resumeType === 'online' && resume
      ? target
      : undefined

  const session =
    useJobDescriptionToolStore((state) => state.sessions[sessionKey]) ??
    initialSession

  const { update, load } = useJobDescriptionToolStore.getState()

  const {
    analysisError,
    analysisOpen,
    analysisState,
    analyzing,
    jobDescription,
    result,
  } = session

  const [jdRetry, setJdRetry] = useState(0)

  const [jdStatus, setJdStatus] = useState<'loading' | 'ready' | 'error'>(
    'ready',
  )

  const editedRef = useRef(false)

  useEffect(() => {
    load(sessionKey, legacyKey)
  }, [load, sessionKey, legacyKey])

  useEffect(() => {
    editedRef.current = false

    setJdStatus('ready')

    return flushJobDescriptionSessions
  }, [sessionKey])

  useEffect(() => {
    if (!jobContext || jobContext.resumeId !== resumeId) return

    let current = true
    const existing = useJobDescriptionToolStore.getState().sessions[sessionKey]

    const keepDraft =
      existing?.jobDescriptionEdited ?? Boolean(existing?.jobDescription)

    setJdStatus('loading')

    const source =
      jdRetry === 0 && initialJobDescription
        ? initialJobDescription
        : Promise.resolve().then(() => readJobContextDescription(jobContext))

    source.then(
      (description) => {
        if (!current) return

        if (
          !editedRef.current &&
          !keepDraft &&
          existing?.jobDescription !== description
        )
          update(sessionKey, {
            jobDescription: description,
            jobDescriptionEdited: false,
          })

        setJdStatus('ready')
      },
      () => {
        if (current) setJdStatus('error')
      },
    )

    return () => {
      current = false
    }
  }, [jobContext, resumeId, sessionKey, initialJobDescription, update, jdRetry])

  const jobDescriptionLength = jobDescription.trim().length

  const hasAnalysisFlow = useMemo(
    () => hasJobDescriptionAnalysisFlow(analysisState, analysisError),
    [analysisError, analysisState],
  )

  const analysisDone = analysisState.status === 'complete' && Boolean(result)
  const canDerive = analysisDone && jobDescription.trim().length >= MIN_JD_CHARS
  const [deriveOpen, setDeriveOpen] = useState(false)
  const navigate = useNavigate()

  const setCurrentResume = useCurrentResumeStore(
    (state) => state.setCurrentResume,
  )

  const jobDescriptionId = useId()

  const setAnalysisOpen = useCallback(
    (open: boolean) => update(sessionKey, { analysisOpen: open }),
    [sessionKey, update],
  )

  const handleCompare = async () => {
    const normalizedJobDescription = jobDescription.trim()

    if (!normalizedJobDescription || !resume) {
      return
    }

    const isCurrent = useAtsStore.getState().isReportAccountCurrent()

    const initial = {
      ...initialSession.analysisState,
      status: 'sending' as const,
      logs: { send: '正在提交简历和岗位描述…' },
    }

    update(sessionKey, {
      analyzing: true,
      result: null,
      analysisError: null,
      analysisOpen: true,
      analysisState: initial,
    })

    try {
      const { compareJobDescription } = await import('./compare')

      if (!isCurrent()) return

      const completed = await compareJobDescription(
        sessionKey,
        resume,
        normalizedJobDescription,
        isCurrent,
      )

      if (!completed || !isCurrent()) return

      const { comparison, content, reasoning } = completed

      update(sessionKey, {
        analyzing: false,
        result: comparison,
        analysisState: {
          status: 'complete',
          content,
          reasoning,
          logs: {
            send: '已提交',
            result: '已收到比对结果',
            display: '已展示结果',
          },
        },
      })
    } catch (error) {
      if (!isCurrent()) return

      const message =
        error instanceof Error ? error.message : '职位描述分析失败，请稍后重试'

      update(sessionKey, { analyzing: false, analysisError: message })
      toast.error(message)
    }
  }

  return (
    <div className='flex flex-col gap-8'>
      <ToolPanelCard>
        <ToolPanelHeader
          title='岗位描述输入'
          icon={Search}
          badge={
            jobDescriptionLength > 0 ? (
              <ToolMetaBadge tone='info'>{`已输入 ${jobDescriptionLength} 字`}</ToolMetaBadge>
            ) : null
          }
        />
        <ToolPanelBody className='space-y-4'>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={jobDescriptionId}>职位描述</FieldLabel>
              <Textarea
                id={jobDescriptionId}
                value={jobDescription}
                onChange={(event) => {
                  editedRef.current = true

                  update(
                    sessionKey,
                    {
                      jobDescription: event.target.value,
                      jobDescriptionEdited: true,
                    },
                    'draft',
                  )
                }}
                className='min-h-40 resize-y border-border/60 bg-background sm:max-h-60 lg:max-h-80 xl:max-h-100'
                placeholder='粘贴职位描述、岗位职责、任职要求或加分项。'
              />
              {jdStatus === 'loading' && (
                <p role='status' className='text-sm text-muted-foreground'>
                  正在读取岗位描述…
                </p>
              )}
              {jdStatus === 'error' && (
                <div role='alert' className='flex items-center gap-2 text-sm'>
                  <span>岗位描述读取失败，可以手动填写。</span>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setJdRetry((count) => count + 1)}
                  >
                    重试
                  </Button>
                </div>
              )}
              <FieldDescription>
                派生针对性简历至少需要 {MIN_JD_CHARS} 字。
              </FieldDescription>
            </Field>
          </FieldGroup>
          <div className='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3'>
            <Button
              className='w-full sm:w-auto'
              onClick={handleCompare}
              disabled={analyzing || !resume || !jobDescription.trim()}
            >
              {analyzing ? (
                <Spinner data-icon='inline-start' />
              ) : (
                <Target data-icon='inline-start' />
              )}
              {analyzing ? '分析中...' : '开始比对'}
            </Button>
            <Button
              type='button'
              variant='outline'
              className='w-full sm:w-auto'
              disabled={!canDerive}
              onClick={() => {
                setDeriveOpen(true)
              }}
            >
              <GitBranch data-icon='inline-start' />
              派生针对性简历
            </Button>
          </div>
        </ToolPanelBody>
      </ToolPanelCard>

      <AnimatedContent
        animationKey={hasAnalysisFlow ? 'analysis' : 'idle'}
        className='empty:hidden'
      >
        {hasAnalysisFlow && (
          <AnalysisTrace
            analysisError={analysisError}
            analysisOpen={analysisOpen}
            analysisState={analysisState}
            onAnalysisOpenChange={setAnalysisOpen}
          />
        )}
      </AnimatedContent>

      <AnimatedContent
        animationKey={
          result ? 'result' : !hasAnalysisFlow ? 'empty' : 'pending'
        }
        className='empty:hidden'
      >
        {result ? (
          <ComparisonResultView result={result} />
        ) : !hasAnalysisFlow ? (
          <ToolEmptyState title='还没有生成比对结果' />
        ) : null}
      </AnimatedContent>

      <VariantDialog open={deriveOpen} onClose={() => setDeriveOpen(false)}>
        {(DialogContent, opener) => (
          <DialogContent
            open={deriveOpen}
            returnFocusTo={opener}
            onOpenChange={setDeriveOpen}
            parentResumeId={resumeId}
            jobId={jobContext?.id}
            initialJd={jobDescription.trim()}
            skipInputStep
            recentJds={[]}
            onOpenResume={(draftId) => {
              setCurrentResume(draftId, 'default')

              navigate(
                jobContext
                  ? jobContextUrl('/resume/editor', jobContext.id)
                  : '/resume/editor',
              )
            }}
          />
        )}
      </VariantDialog>
    </div>
  )
}

export default JobDescriptionTool
