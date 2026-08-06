import type { ReactNode } from 'react'
import type { TokenUsage } from '../../store'
import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageActions } from './message-actions'
import { ReasoningPart } from './reasoning-part'
import { TextPart } from './text-part'
import { ToolCallPartGroup } from './tool-call-part'

interface MessageBubbleProps {
  message: AiMessage
  onEditSave?: (messageId: string, newText: string) => void
  onRegenerate?: (messageId: string) => void
  usage?: TokenUsage | null
}

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

function plainText(message: AiMessage): string {
  return message.parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join('\n')
}

// 助手 parts 分组分派：连续的 tool-call 合并成一个 ToolCallsSection；reasoning/text 各自渲染
function renderAssistantParts(parts: AiMessagePart[], isStreamingMessage: boolean) {
  const nodes: ReactNode[] = []
  let buffer: ToolCallPart[] = []
  const keyOccurrences = new Map<string, number>()
  const createPartKey = (prefix: string, content: string) => {
    const baseKey = `${prefix}-${content}`
    const occurrence = keyOccurrences.get(baseKey) ?? 0
    keyOccurrences.set(baseKey, occurrence + 1)
    return `${baseKey}-${occurrence}`
  }
  const flush = (key: string) => {
    if (buffer.length) {
      nodes.push(<ToolCallPartGroup key={key} calls={buffer} />)
      buffer = []
    }
  }
  const lastIndex = parts.length - 1
  parts.forEach((p, index) => {
    if (p.type === 'tool-call') {
      buffer.push(p)
      return
    }
    flush(createPartKey('tool-group', buffer.map(call => call.toolCallId).join('-')))
    if (p.type === 'reasoning') {
      const streaming = isStreamingMessage && index === lastIndex
      nodes.push(<ReasoningPart key={createPartKey('reasoning', p.text)} text={p.text} streaming={streaming} />)
    }
    else if (p.type === 'text') {
      nodes.push(<TextPart key={createPartKey('text', p.text)} text={p.text} />)
    }
  })
  flush('tc-end')
  return nodes
}

// 用户消息内联编辑器
function UserMessageEditor({ initial, onSave, onCancel }: { initial: string, onSave: (text: string) => void, onCancel: () => void }) {
  const [value, setValue] = useState(initial)
  return (
    <div className="flex w-full max-w-[80%] flex-col gap-2">
      <textarea
        value={value}
        autoFocus
        onChange={e => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            onSave(value)
          }
          if (e.key === 'Escape')
            onCancel()
        }}
        className="min-h-20 w-full resize-y rounded-2xl border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" disabled={!value.trim()} onClick={() => onSave(value)}>保存并重新生成</Button>
      </div>
    </div>
  )
}

export function MessageBubble({ message, onEditSave, onRegenerate, usage }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [editing, setEditing] = useState(false)
  // 本地临时行 / 进行中行不显示操作栏
  const hideActions = message.id.startsWith('local-') || message.id === 'streaming'

  if (isUser) {
    if (editing) {
      return (
        <div className="flex flex-col items-end gap-1">
          <UserMessageEditor
            initial={plainText(message)}
            onCancel={() => setEditing(false)}
            onSave={(text) => {
              setEditing(false)
              onEditSave?.(message.id, text)
            }}
          />
        </div>
      )
    }
    return (
      <div className="group flex flex-col items-end gap-1">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground whitespace-pre-wrap break-words">
          {plainText(message)}
        </div>
        {!hideActions && (
          <MessageActions
            message={message}
            onEdit={onEditSave ? () => setEditing(true) : undefined}
          />
        )}
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
          {renderAssistantParts(message.parts, message.id === 'streaming')}
        </div>
        {usage && (usage.total > 0) && (
          <p className="text-[11px] tabular-nums text-muted-foreground/80">
            本轮 tokens：输入
            {' '}
            {usage.input}
            {' '}
            / 输出
            {' '}
            {usage.output}
            {' '}
            / 合计
            {' '}
            {usage.total}
          </p>
        )}
        {!hideActions && (
          <MessageActions
            message={message}
            onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
          />
        )}
      </div>
    </div>
  )
}
