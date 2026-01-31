import { Brain, CloudUpload, Database, FileText, Loader2, RefreshCcw, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtStep } from '@/components/ai/chain-of-thought'
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai/code-block'
import { AutoScrollContainer } from '@/components/ui/auto-scroll-container'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { runAtsStructured } from '@/lib/llm'
import { getOfflineResumeById } from '@/lib/offline-resume-manager'
import { createAtsConfig, updateAtsConfig } from '@/lib/supabase/resume'
import { uploadOfflineResumeToCloud } from '@/lib/supabase/resume/form'
import useAtsStore from '../../store'
import { fetchResumeDataForAnalysis } from '../../utils'
import { ResumeManager } from './resume-manager'

type AnalysisStatus = 'idle' | 'uploading' | 'fetching' | 'sending' | 'thinking' | 'generating' | 'received' | 'saving' | 'complete'

function Header() {
  const { selectedResumeId, selectedResumeType, atsConfigs, init, setSelectedResume } = useAtsStore()
  const [reasoning, setReasoning] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [isOpen, setIsOpen] = useState(false)
  const [uploadLog, setUploadLog] = useState<string>('')
  const [fetchLog, setFetchLog] = useState<string>('')
  const [sendLog, setSendLog] = useState<string>('')
  const [resultLog, setResultLog] = useState<string>('')
  const [saveLog, setSaveLog] = useState<string>('')
  const [displayLog, setDisplayLog] = useState<string>('')

  const handleStartAnalysis = async () => {
    if (!selectedResumeId) {
      toast.error('请先选择一份简历')
      return
    }

    setIsOpen(true)
    setReasoning('')
    setContent('')
    setUploadLog('')
    setFetchLog('')
    setSendLog('')
    setResultLog('')
    setSaveLog('')
    setDisplayLog('')

    try {
      let currentResumeId = selectedResumeId
      const currentResumeType = selectedResumeType

      if (currentResumeType === 'offline') {
        setStatus('uploading')
        setUploadLog('检测到本地简历，正在上传至云端...')

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

        setUploadLog(prev => `${prev}\n✅ 上传成功，已转换为在线简历`)

        currentResumeId = onlineResume.resume_id
        setSelectedResume(currentResumeId, 'online')
      }

      setStatus('fetching')
      setFetchLog('正在获取简历字段...')
      const resumeData = await fetchResumeDataForAnalysis(currentResumeId, false)
      setFetchLog(prev => `${prev}\n✅ 获取成功，准备上传给 LLM`)

      setStatus('sending')
      setSendLog('正在上传给 LLM...')

      let finalContent = ''

      await runAtsStructured(resumeData, ({ content, reasoning }) => {
        if (reasoning) {
          setStatus('thinking')
          setSendLog('✅ 已上传给 LLM，开始思考')
          setReasoning(reasoning)
        }
        if (content) {
          setStatus('generating')
          setContent(content)
          setSendLog(prev => (prev.includes('✅') ? prev : '✅ 已上传给 LLM'))
          finalContent = content
        }
      })

      if (!finalContent) {
        throw new Error('未生成有效内容')
      }

      setStatus('received')
      setResultLog('✅ 已收到结果')

      const result = JSON.parse(finalContent)

      setStatus('saving')
      setSaveLog('正在保存分析报告...')

      const { id, user_id, created_at, resume_id: _resumeId, ...restResult } = result

      const payload = {
        ...restResult,
        resume_id: currentResumeId,
      }

      const existingAts = atsConfigs?.find(a => a.resume_id === currentResumeId)

      if (existingAts) {
        await updateAtsConfig(existingAts.id, payload)
        setSaveLog(prev => `${prev}\n✅ 报告已更新`)
        toast.success('ATS 分析报告已更新')
      }
      else {
        await createAtsConfig(payload)
        setSaveLog(prev => `${prev}\n✅ 报告已生成`)
        toast.success('ATS 分析报告已生成')
      }

      await init()

      setStatus('complete')
      setDisplayLog('✅ 已展示分析结果')
    }
    catch (error: any) {
      console.error(error)
      toast.error(error.message || '分析过程中发生错误')
      setStatus('idle')
    }
  }

  const handleViewAnalysis = () => {
    setIsOpen(true)
  }

  const hasAnalysis = status !== 'idle' && (reasoning || content || uploadLog || fetchLog || sendLog || resultLog || saveLog || displayLog)
  const isProcessing = status !== 'idle' && status !== 'complete'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
        <div className="flex items-center gap-3 shrink-0 pl-11 sm:pl-0">
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
            className="h-9 px-4"
            onClick={handleStartAnalysis}
            disabled={isProcessing || !selectedResumeId}
          >
            {isProcessing
              ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )
              : (
                  <RefreshCcw className="mr-2 h-4 w-4" />
                )}
            {hasAnalysis ? '重新检测' : '开始检测'}
          </Button>
        </div>
      </div>

      <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveDialogContent className="max-w-2xl h-[85vh] max-h-[85vh] flex flex-col p-0">
          <ResponsiveDialogHeader className="px-6 pt-6 pb-2">
            <ResponsiveDialogTitle>ATS 分析过程</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <ChainOfThought open className="w-full">
              <ChainOfThoughtContent>
                {selectedResumeType === 'offline' && (
                  <ChainOfThoughtStep
                    icon={CloudUpload}
                    label="同步简历"
                    status={status === 'uploading' ? 'active' : uploadLog ? 'complete' : 'pending'}
                    description={(
                      <AutoScrollContainer
                        className="max-h-[100px] bg-muted p-3 rounded-md mt-2"
                        dependency={uploadLog}
                        enabled={status === 'uploading'}
                      >
                        <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                          {uploadLog || '等待上传...'}
                        </div>
                      </AutoScrollContainer>
                    )}
                  />
                )}

                <ChainOfThoughtStep
                  icon={Database}
                  label="获取简历字段"
                  status={status === 'fetching' ? 'active' : fetchLog ? 'complete' : 'pending'}
                  description={(
                    <AutoScrollContainer
                      className="max-h-[100px] bg-muted p-3 rounded-md mt-2"
                      dependency={fetchLog}
                      enabled={status === 'fetching'}
                    >
                      <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                        {fetchLog || '等待获取简历字段...'}
                      </div>
                    </AutoScrollContainer>
                  )}
                />

                <ChainOfThoughtStep
                  icon={CloudUpload}
                  label="上传给 LLM"
                  status={status === 'sending' ? 'active' : sendLog ? 'complete' : 'pending'}
                  description={(
                    <AutoScrollContainer
                      className="max-h-[100px] bg-muted p-3 rounded-md mt-2"
                      dependency={sendLog}
                      enabled={status === 'sending'}
                    >
                      <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                        {sendLog || '等待上传给 LLM...'}
                      </div>
                    </AutoScrollContainer>
                  )}
                />

                <ChainOfThoughtStep
                  icon={Brain}
                  label="LLM 开始思考"
                  status={status === 'thinking' ? 'active' : reasoning ? 'complete' : 'pending'}
                  description={(
                    <AutoScrollContainer
                      className="max-h-[300px] bg-muted p-3 rounded-md mt-2"
                      dependency={reasoning}
                      enabled={status === 'thinking'}
                    >
                      <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                        {reasoning || '等待 LLM 思考输出...'}
                      </div>
                    </AutoScrollContainer>
                  )}
                />

                <ChainOfThoughtStep
                  icon={FileText}
                  label="返回结果"
                  status={status === 'generating' ? 'active' : resultLog || content ? 'complete' : 'pending'}
                  description={(
                    <AutoScrollContainer
                      className="max-h-[220px] bg-muted p-3 rounded-md mt-2"
                      dependency={content || resultLog}
                      enabled={status === 'generating'}
                    >
                      {content
                        ? (
                            <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                              {content}
                            </div>
                          )
                        : (
                            <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                              {resultLog || '等待返回结果...'}
                            </div>
                          )}
                    </AutoScrollContainer>
                  )}
                />

                <ChainOfThoughtStep
                  icon={Database}
                  label="更新到 ATS 并获取字段"
                  status={status === 'saving' ? 'active' : saveLog ? 'complete' : 'pending'}
                  description={(
                    <AutoScrollContainer
                      className="max-h-[100px] bg-muted p-3 rounded-md mt-2"
                      dependency={saveLog}
                      enabled={status === 'saving'}
                    >
                      <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                        {saveLog || '等待更新到 ATS...'}
                      </div>
                    </AutoScrollContainer>
                  )}
                />

                <ChainOfThoughtStep
                  icon={Sparkles}
                  label="展示"
                  status={status === 'complete' ? 'complete' : 'pending'}
                  description={(
                    <AutoScrollContainer
                      className="max-h-20 bg-muted p-3 rounded-md mt-2"
                      dependency={displayLog}
                      enabled={status === 'complete'}
                    >
                      <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                        {displayLog || '等待展示...'}
                      </div>
                    </AutoScrollContainer>
                  )}
                />
              </ChainOfThoughtContent>
            </ChainOfThought>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}

export default Header
