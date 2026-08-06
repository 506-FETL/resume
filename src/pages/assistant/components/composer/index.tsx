import type { ComposerContextOption, Tool } from '@/components/ui/composer'
import { Brain, Briefcase, FileText, Square } from 'lucide-react'
import { useMemo } from 'react'
import { Composer as GaiaComposer } from '@/components/ui/composer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ASSISTANT_TOOLS, TEMPLATE_PROMPTS } from '../../composer-tools'
import { COMPOSER_PLACEHOLDER } from '../../const'
import { useChatStream } from '../../hooks/use-chat-stream'
import { useComposerContext } from '../../hooks/use-composer-context'
import useAssistantStore from '../../store'

export default function Composer() {
  const { streaming, composerDraft: draft, initializing, loadingMessages, deepThinking, setDeepThinking } = useAssistantStore()
  const { sendMessage, stopStreaming } = useChatStream()
  const { resumes, jobs } = useComposerContext()
  const disabled = streaming || initializing || loadingMessages

  // @ 引用：把简历/职位信息拼接进输入框，作为本轮上下文提示
  const appendDraft = (text: string) => {
    const cur = useAssistantStore.getState().composerDraft
    const next = cur ? `${cur.replace(/\s*$/, '')} ${text} ` : `${text} `
    useAssistantStore.getState().setComposerDraft(next)
  }

  const contextOptions = useMemo<ComposerContextOption[]>(() => {
    const opts: ComposerContextOption[] = []
    resumes.forEach(r => opts.push({
      id: `resume-${r.resumeId}`,
      label: `简历：${r.name}`,
      icon: <FileText className="size-4" />,
      onClick: () => appendDraft(`【参考简历：${r.name}(resumeId=${r.resumeId})】`),
    }))
    jobs.forEach(j => opts.push({
      id: `job-${j.id}`,
      label: `职位：${j.company} · ${j.position}`,
      icon: <Briefcase className="size-4" />,
      onClick: () => appendDraft(`【参考职位：${j.company}·${j.position}】`),
    }))
    return opts
  }, [resumes, jobs])

  const handleToolSelect = (tool: Tool) => {
    const template = TEMPLATE_PROMPTS[tool.name] ?? ''
    if (!template)
      return
    const cur = useAssistantStore.getState().composerDraft
    // 通过 "/" 触发时替换掉查询串；否则追加到已有内容
    const merged = cur.startsWith('/') ? template : (cur ? `${cur}\n${template}` : template)
    // 去掉模板末尾多余的换行，避免插入后留下一个空行（光标随后聚焦到末尾）
    const next = merged.replace(/\n+$/, '')
    useAssistantStore.getState().setComposerDraft(next)
  }

  const submit = (message: string) => {
    const text = message.trim()
    if (!text || disabled)
      return
    useAssistantStore.getState().setComposerDraft('')
    sendMessage(text)
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-6 lg:px-8">
      <GaiaComposer
        value={draft}
        placeholder={COMPOSER_PLACEHOLDER}
        disabled={disabled}
        showToolsButton
        tools={ASSISTANT_TOOLS}
        onToolSelect={handleToolSelect}
        contextOptions={contextOptions}
        trailingActions={(
          <>
            {streaming && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="停止生成"
                    onClick={stopStreaming}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-rose-100 px-3 text-sm text-rose-600 transition-colors hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-300"
                  >
                    <Square className="size-3.5 fill-current" />
                    停止
                  </button>
                </TooltipTrigger>
                <TooltipContent>停止本轮生成</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="深度思考"
                  aria-pressed={deepThinking}
                  onClick={() => setDeepThinking(!deepThinking)}
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors',
                    deepThinking
                      ? 'bg-primary/15 text-primary'
                      : 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400',
                  )}
                >
                  <Brain className="size-4" />
                  深度思考
                </button>
              </TooltipTrigger>
              <TooltipContent>{deepThinking ? '已开启深度思考' : '开启深度思考（更慢更细）'}</TooltipContent>
            </Tooltip>
          </>
        )}
        onChange={value => useAssistantStore.getState().setComposerDraft(value)}
        onSubmit={submit}
      />
    </div>
  )
}
