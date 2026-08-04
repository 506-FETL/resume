import type { ReactNode } from 'react'
import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { Sparkles } from 'lucide-react'
import { MessageActions } from './message-actions'
import { ReasoningPart } from './reasoning-part'
import { TextPart } from './text-part'
import { ToolCallPartGroup } from './tool-call-part'

interface MessageBubbleProps {
  message: AiMessage
  onEdit?: (message: AiMessage) => void
  onRetry?: () => void
}

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

// 助手 parts 分组分派：连续的 tool-call 合并成一个 ToolCallsSection；reasoning/text 各自渲染
function renderAssistantParts(parts: AiMessagePart[]) {
  const nodes: ReactNode[] = []
  let buffer: ToolCallPart[] = []
  const flush = (key: string) => {
    if (buffer.length) {
      nodes.push(<ToolCallPartGroup key={key} calls={buffer} />)
      buffer = []
    }
  }
  parts.forEach((p, i) => {
    if (p.type === 'tool-call') {
      buffer.push(p)
      return
    }
    flush(`tc-${i}`)
    if (p.type === 'reasoning')
      nodes.push(<ReasoningPart key={i} text={p.text} />)
    else if (p.type === 'text')
      nodes.push(<TextPart key={i} text={p.text} />)
  })
  flush('tc-end')
  return nodes
}

export function MessageBubble({ message, onEdit, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  // 本地临时行 / 进行中行不显示操作栏
  const hideActions = message.id.startsWith('local-') || message.id === 'streaming'

  if (isUser) {
    return (
      <div className="group flex flex-col items-end gap-1">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground whitespace-pre-wrap break-words">
          {message.parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join('\n')}
        </div>
        {!hideActions && <MessageActions message={message} onEdit={onEdit} />}
      </div>
    )
  }

  return (
    <div className="group flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="pt-0.5 text-sm leading-relaxed text-foreground">
          {renderAssistantParts(message.parts)}
        </div>
        {!hideActions && <MessageActions message={message} onRetry={onRetry} />}
      </div>
    </div>
  )
}
