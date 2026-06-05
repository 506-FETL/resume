import type { ResumeToolContext } from '../shared/types'
import type { JobDescriptionComparisonResult } from './types'
import { GitBranch, Search, Target } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { JdVariantDialog } from '@/components/jd-variant/components/generator-dialog'
import { MIN_JD_CHARS } from '@/components/jd-variant/const'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { parseLlmJsonObject, runJobDescriptionStructured } from '@/lib/llm'
import useJdVariantStore from '@/store/jd-variant'
import useCurrentResumeStore from '@/store/resume/current'
import { ToolEmptyState, ToolMetaBadge, ToolPanelBody, ToolPanelCard, ToolPanelHeader } from '../shared/primitives'
import AnalysisTrace from './analysis-trace'
import ComparisonResultView from './comparison-result'
import { createInitialJobDescriptionToolSession, getJobDescriptionSessionKey } from './const'
import useJobDescriptionToolStore from './store'
import { hasJobDescriptionAnalysisFlow, normalizeJobDescriptionComparisonResult } from './utils'

interface JobDescriptionToolProps {
  resumeContext: ResumeToolContext
}

function JobDescriptionTool({ resumeContext }: JobDescriptionToolProps) {
  const sessionKey = useMemo(() => getJobDescriptionSessionKey(resumeContext), [resumeContext])
  const session = useJobDescriptionToolStore(state => state.sessions[sessionKey]) ?? createInitialJobDescriptionToolSession()
  const {
    setAnalysisError,
    setAnalysisOpen,
    setAnalysisState,
    setAnalyzing,
    setJobDescription,
    setResult,
    updateAnalysisLog,
    updateAnalysisState,
  } = useJobDescriptionToolStore()

  const { analysisError, analysisOpen, analysisState, analyzing, jobDescription, result } = session
  const jobDescriptionLength = jobDescription.trim().length
  const hasAnalysisFlow = useMemo(
    () => hasJobDescriptionAnalysisFlow(analysisState, analysisError),
    [analysisError, analysisState],
  )
  const analysisDone = analysisState.status === 'complete' && Boolean(result)
  const canDerive = analysisDone && jobDescription.trim().length >= MIN_JD_CHARS
  const [deriveOpen, setDeriveOpen] = useState(false)
  const navigate = useNavigate()
  const { setCurrentResume } = useCurrentResumeStore()
  const jobDescriptionId = useId()

  const handleCompare = async () => {
    const normalizedJobDescription = jobDescription.trim()
    if (!normalizedJobDescription) {
      return
    }

    setAnalyzing(sessionKey, true)
    setResult(sessionKey, null)
    setAnalysisError(sessionKey, null)
    setAnalysisOpen(sessionKey, true)
    setAnalysisState(sessionKey, {
      ...createInitialJobDescriptionToolSession().analysisState,
      status: 'sending',
      logs: {
        send: '正在上传当前简历和岗位描述...',
      },
    })

    try {
      let finalContent = ''

      await runJobDescriptionStructured(
        resumeContext.resume,
        normalizedJobDescription,
        ({ content: streamContent, reasoning: streamReasoning }) => {
          if (streamReasoning) {
            updateAnalysisState(sessionKey, {
              status: 'thinking',
              reasoning: streamReasoning,
            })
            updateAnalysisLog(sessionKey, 'send', '已上传，开始推导岗位匹配关系...')
          }

          if (streamContent) {
            finalContent = streamContent
            updateAnalysisState(sessionKey, {
              status: 'generating',
              content: streamContent,
            })
            updateAnalysisLog(sessionKey, 'result', '正在生成结构化分析结果...')
          }
        },
      )

      if (!finalContent.trim()) {
        throw new Error('大模型没有返回有效结果')
      }

      updateAnalysisState(sessionKey, { status: 'received' })
      updateAnalysisLog(sessionKey, 'result', '已收到结构化结果')

      const parsed = parseLlmJsonObject<Partial<JobDescriptionComparisonResult>>(finalContent)
      setResult(sessionKey, normalizeJobDescriptionComparisonResult(parsed, resumeContext.resume))

      updateAnalysisState(sessionKey, { status: 'complete' })
      updateAnalysisLog(sessionKey, 'display', '已展示职位描述比对结果')
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '职位描述分析失败，请稍后重试'
      setAnalysisError(sessionKey, message)
      toast.error(message)
    }
    finally {
      setAnalyzing(sessionKey, false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ToolPanelCard>
        <ToolPanelHeader
          title="岗位描述输入"
          description="粘贴职位描述、职责和任职要求，系统会把当前简历和 JD 一起发给大模型做结构化分析。"
          icon={Search}
          badge={jobDescriptionLength > 0 ? <ToolMetaBadge tone="info">{`已输入 ${jobDescriptionLength} 字`}</ToolMetaBadge> : null}
        />
        <ToolPanelBody className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={jobDescriptionId}>职位描述</FieldLabel>
              <Textarea
                id={jobDescriptionId}
                value={jobDescription}
                onChange={event => setJobDescription(sessionKey, event.target.value)}
                className="max-h-50 resize-y border-border/60 bg-background md:max-h-60 lg:max-h-80 xl:max-h-100"
                placeholder="粘贴职位描述、岗位职责、任职要求或加分项。"
              />
              <FieldDescription>
                已输入
                {' '}
                {jobDescriptionLength}
                {' '}
                字；派生针对性简历至少需要
                {' '}
                {MIN_JD_CHARS}
                {' '}
                字。
              </FieldDescription>
            </Field>
          </FieldGroup>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleCompare} disabled={analyzing || !jobDescription.trim()}>
              {analyzing
                ? <Spinner data-icon="inline-start" />
                : <Target data-icon="inline-start" />}
              {analyzing ? '分析中...' : '开始比对'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canDerive}
              onClick={() => {
                const task = useJdVariantStore.getState().tasks[resumeContext.resumeId]
                if (task && (task.phase === 'success' || task.phase === 'error' || task.phase === 'aborted'))
                  useJdVariantStore.getState().clearTask(resumeContext.resumeId)
                setDeriveOpen(true)
              }}
            >
              <GitBranch data-icon="inline-start" />
              派生针对性简历
            </Button>
            {jobDescriptionLength > 0 && (
              <ToolMetaBadge tone="info">建议包含职责、要求、加分项三部分</ToolMetaBadge>
            )}
          </div>
        </ToolPanelBody>
      </ToolPanelCard>

      {hasAnalysisFlow && (
        <AnalysisTrace
          analysisError={analysisError}
          analysisOpen={analysisOpen}
          analysisState={analysisState}
          onAnalysisOpenChange={open => setAnalysisOpen(sessionKey, open)}
        />
      )}

      {result
        ? (
            <ComparisonResultView result={result} />
          )
        : !hasAnalysisFlow
            ? (
                <ToolEmptyState
                  title="还没有生成比对结果"
                  description="把岗位描述贴进上面的输入框，然后点击“开始比对”。系统会把当前简历和 JD 一起交给大模型分析。"
                />
              )
            : null}

      {deriveOpen && (
        <JdVariantDialog
          open
          onOpenChange={setDeriveOpen}
          parentResumeId={resumeContext.resumeId}
          initialJd={jobDescription.trim()}
          skipInputStep
          recentJds={[]}
          onOpenResume={(draftId) => {
            setCurrentResume(draftId, resumeContext.resumeType === 'offline' ? 'default' : 'default')
            navigate('/resume/editor')
          }}
        />
      )}
    </div>
  )
}

export default JobDescriptionTool
