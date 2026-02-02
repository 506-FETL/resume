import { Loader2, RefreshCcw, Search, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import { toast } from 'sonner'
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtStep } from '@/components/ai/chain-of-thought'
import { AutoScrollContainer } from '@/components/ui/auto-scroll-container'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { runAtsStructured } from '@/lib/llm'
import { getOfflineResumeById } from '@/lib/offline-resume-manager'
import { createAtsConfig, updateAtsConfig } from '@/lib/supabase/resume'
import { uploadOfflineResumeToCloud } from '@/lib/supabase/resume/form'
import { ANALYSIS_STEPS_CONFIG } from '../../const'
import useAtsStore from '../../store'
import { fetchResumeDataForAnalysis, getStepContent, getStepStatus } from '../../utils'
import { ResumeManager } from './resume-manager'

function Header() {
  const { selectedResumeId, selectedResumeType, atsConfigs, init, setSelectedResume, analysisState, setAnalysisState, resetAnalysisState, updateLog } = useAtsStore()

  const [isOpen, setIsOpen] = useState(false)
  const { status, logs, reasoning, content } = analysisState

  const handleStartAnalysis = useCallback(async () => {
    if (!selectedResumeId) {
      toast.error('请先选择一份简历')
      return
    }

    setIsOpen(true)
    resetAnalysisState()

    try {
      let currentResumeId = selectedResumeId
      const currentResumeType = selectedResumeType

      // 上传离线简历
      if (currentResumeType === 'offline') {
        setAnalysisState({ status: 'uploading' })
        updateLog('upload', '检测到本地简历，正在上传至云端...')

        const offlineResume = await getOfflineResumeById(selectedResumeId)
        if (!offlineResume) {
          throw new Error('本地简历不存在')
        }

        const onlineResume = await uploadOfflineResumeToCloud(
          offlineResume.data,
          {
            display_name: offlineResume.display_name,
            description: '从本地上传的简历',
          },
        )

        if (!onlineResume) {
          throw new Error('上传简历失败')
        }

        updateLog('upload', '✅ 上传成功，已转换为在线简历', true)
        currentResumeId = onlineResume.resume_id
        setSelectedResume(currentResumeId, 'online')
      }

      // 获取简历数据
      setAnalysisState({ status: 'fetching' })
      updateLog('fetch', '正在获取简历字段...')
      const resumeData = await fetchResumeDataForAnalysis(currentResumeId, false)
      updateLog('fetch', '✅ 获取成功，准备上传给 LLM', true)

      // 发送给 LLM
      setAnalysisState({ status: 'sending' })
      updateLog('send', '正在上传给 LLM...')

      let finalContent = ''

      await runAtsStructured(resumeData, ({ content: streamContent, reasoning: streamReasoning }) => {
        if (streamReasoning) {
          setAnalysisState({ status: 'thinking', reasoning: streamReasoning })
          updateLog('send', '✅ 已上传给 LLM，开始思考')
        }
        if (streamContent) {
          setAnalysisState({ status: 'generating', content: streamContent })
          finalContent = streamContent
        }
      })

      if (!finalContent) {
        throw new Error('未生成有效内容')
      }

      setAnalysisState({ status: 'received' })
      updateLog('result', '✅ 已收到结果')

      const result = JSON.parse(finalContent)

      // 保存结果
      setAnalysisState({ status: 'saving' })
      updateLog('save', '正在保存分析报告...')

      const { id, user_id, created_at, resume_id: _resumeId, ...restResult } = result
      const payload = { ...restResult, resume_id: currentResumeId }

      const existingAts = atsConfigs?.find(a => a.resume_id === currentResumeId)

      if (existingAts) {
        await updateAtsConfig(existingAts.id, payload)
        updateLog('save', '✅ 报告已更新', true)
        toast.success('ATS 分析报告已更新')
      }
      else {
        await createAtsConfig(payload)
        updateLog('save', '✅ 报告已生成', true)
        toast.success('ATS 分析报告已生成')
      }

      await init()

      setAnalysisState({ status: 'complete' })
      updateLog('display', '✅ 已展示分析结果')
    }
    catch (error: any) {
      console.error(error)
      toast.error(error.message || '分析过程中发生错误')
      setAnalysisState({ status: 'idle' })
    }
  }, [
    selectedResumeId,
    selectedResumeType,
    atsConfigs,
    init,
    setSelectedResume,
    updateLog,
    setAnalysisState,
    resetAnalysisState,
  ])

  const handleViewAnalysis = useCallback(() => {
    setIsOpen(true)
  }, [])

  // 计算派生状态
  const hasAnalysis = useMemo(() => {
    return status !== 'idle' && (
      reasoning
      || content
      || Object.keys(logs).length > 0
    )
  }, [status, reasoning, content, logs])

  const isProcessing = status !== 'idle' && status !== 'complete'

  // 离开页面时提示用户
  useEffect(() => {
    if (!isProcessing)
      return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isProcessing])

  // 过滤并渲染步骤
  const visibleSteps = useMemo(() => {
    return ANALYSIS_STEPS_CONFIG.filter((step) => {
      if (step.showCondition) {
        return step.showCondition(analysisState, selectedResumeType)
      }
      return true
    })
  }, [analysisState, selectedResumeType])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">ATS 优化助手</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-11 max-w-lg">
            基于 AI 深度分析，为您提供专业的简历优化建议，提升通过 ATS 筛选的概率。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pl-11">
          <ResumeManager />

          {hasAnalysis && (
            <Button
              variant="secondary"
              size="sm"
              className="h-9 px-4"
              onClick={handleViewAnalysis}
            >
              <Search className="mr-2 h-4 w-4" />
              查看分析
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleStartAnalysis}
            disabled={isProcessing || !selectedResumeId}
          >
            {isProcessing
              ? (
                  <Loader2 className="animate-spin" />
                )
              : (
                  <RefreshCcw />
                )}
            {hasAnalysis ? '重新检测' : '开始检测'}
          </Button>
        </div>
      </div>

      <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveDialogContent className="max-w-2xl sm:h-[85vh] sm:max-h-[85vh] flex flex-col p-0">
          <ResponsiveDialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <ResponsiveDialogTitle>ATS 分析过程</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pb-safe">
            <ChainOfThought open className="w-full">
              <ChainOfThoughtContent>
                {visibleSteps.map((stepConfig) => {
                  const stepStatus = getStepStatus(stepConfig, status, logs, reasoning, content)

                  if (stepStatus === 'pending') {
                    return null
                  }

                  const stepContent = getStepContent(stepConfig, analysisState)
                  const isActive = stepStatus === 'active'

                  // 根据步骤类型渲染不同的内容
                  const renderStepContent = () => {
                    if (!stepContent)
                      return null

                    // LLM 思考步骤 - 渲染 Markdown
                    if (stepConfig.id === 'thinking') {
                      return (
                        <AutoScrollContainer
                          className="max-h-[300px] bg-muted p-3 rounded-md mt-2 overflow-x-auto"
                          dependency={stepContent}
                          enabled={isActive}
                        >
                          <div className="markdown-content text-xs text-muted-foreground [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-2 [&>li]:mb-1 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-2 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-medium [&>h3]:mb-1 [&>code]:bg-background [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-xs [&>pre]:bg-background [&>pre]:p-2 [&>pre]:rounded [&>pre]:overflow-x-auto [&>pre]:mb-2 [&>blockquote]:border-l-2 [&>blockquote]:border-muted-foreground/30 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:mb-2 [&>strong]:font-semibold [&>em]:italic">
                            <Markdown>{stepContent}</Markdown>
                          </div>
                        </AutoScrollContainer>
                      )
                    }

                    // 返回结果步骤 - JSON 代码块
                    if (stepConfig.id === 'result') {
                      return (
                        <AutoScrollContainer
                          className="max-h-[300px] bg-muted rounded-md mt-2 overflow-x-auto"
                          dependency={stepContent}
                          enabled={isActive}
                        >
                          <pre className="p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                            <code>{stepContent}</code>
                          </pre>
                        </AutoScrollContainer>
                      )
                    }

                    // 默认渲染
                    return (
                      <AutoScrollContainer
                        className="max-h-[300px] bg-muted p-3 rounded-md mt-2"
                        dependency={stepContent}
                        enabled={isActive}
                      >
                        <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                          {stepContent}
                        </div>
                      </AutoScrollContainer>
                    )
                  }

                  return (
                    <ChainOfThoughtStep
                      key={stepConfig.id}
                      icon={stepConfig.icon}
                      label={stepConfig.label}
                      status={stepStatus}
                      description={renderStepContent()}
                    />
                  )
                })}
              </ChainOfThoughtContent>
            </ChainOfThought>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}

export default Header
