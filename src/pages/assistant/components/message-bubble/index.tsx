import type { ReactNode } from 'react'
import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { BookOpen, Brain, Sparkles } from 'lucide-react'
import { memo, useRef, useState } from 'react'
import {
  Attachment,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from '@/components/ui/message'
import { Trace, TraceIcon, TraceLine, TraceTitle } from '@/components/ui/trace'
import AnimatedContent from '@/components/motion/animated-content'
import { Textarea } from '@/components/ui/textarea'
import {
  composeDraft,
  parseComposerDraft,
  readableMessageText,
} from '../../composer-references'
import { Button } from '@/components/ui/button'
import {
  getEditableMessageText,
  getSkillReferences,
} from '@/lib/ai/skills/references'
import SkillActivity from '../skill-activity'
import { MessageActions } from './message-actions'
import { ReasoningPart } from './reasoning-part'
import { TextPart } from './text-part'
import { ToolCallPartGroup } from './tool-call-part'

interface MessageBubbleProps {
  message: AiMessage
  onEditSave?: (messageId: string, newText: string) => void
  onRegenerate?: (messageId: string) => void
}

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

function plainText(message: AiMessage): string {
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { text: string }).text)
    .join('\n')
}

function editableText(message: AiMessage): string {
  const { text, references } = parseComposerDraft(plainText(message))

  const parts: AiMessagePart[] = [
    ...message.parts.filter((part) => part.type !== 'text'),
    { type: 'text', text },
  ]

  return composeDraft(getEditableMessageText(parts), references)
}

// 保持流式部件的 key 稳定，展开状态不会随 token 更新重置。
function renderAssistantParts(
  parts: AiMessagePart[],
  isStreamingMessage: boolean,
) {
  const nodes: ReactNode[] = []
  let buffer: ToolCallPart[] = []

  const flush = () => {
    if (buffer.length) {
      // 工具组从流式尾部变为中间部件时仍复用同一节点，避免状态与动效重播。
      nodes.push(
        <ToolCallPartGroup
          key={`tools-${buffer[0].toolCallId}`}
          calls={buffer}
          streaming={isStreamingMessage}
        />,
      )

      buffer = []
    }
  }

  const lastIndex = parts.length - 1

  parts.forEach((p, index) => {
    if (p.type === 'tool-call') {
      buffer.push(p)

      return
    }

    // 用「部件在数组中的位置」作为稳定 key，避免内容增量导致整块卸载重挂、重解析 markdown（长文本卡顿主因）
    flush()

    const streaming = isStreamingMessage && index === lastIndex

    if (p.type === 'reasoning') {
      nodes.push(
        <ReasoningPart
          // eslint-disable-next-line @eslint-react/no-array-index-key -- 流式部件位置稳定，避免正文增量触发重挂载
          key={`reasoning-${index}`}
          text={p.text}
          streaming={streaming}
        />,
      )
    } else if (p.type === 'text') {
      nodes.push(
        <TextPart
          // eslint-disable-next-line @eslint-react/no-array-index-key -- 流式部件位置稳定，避免正文增量触发重挂载
          key={`text-${index}`}
          text={p.text}
          animate={streaming}
        />,
      )
    } else if (p.type === 'skill-activity') {
      nodes.push(
        <SkillActivity
          key={p.id}
          activity={p}
          streaming={isStreamingMessage}
        />,
      )
    }
  })

  flush()

  return nodes
}

// 用户消息内联编辑器
function UserMessageEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const { text, references } = parseComposerDraft(initial)
  const [value, setValue] = useState(text)

  return (
    <div className='flex w-full flex-col gap-2'>
      {references.length > 0 && (
        <p className='text-xs text-muted-foreground'>
          {references.map((reference) => reference.label).join(' · ')}
        </p>
      )}
      <Textarea
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return

          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && value.trim()) {
            e.preventDefault()
            onSave(composeDraft(value, references))
          }
          if (e.key === 'Escape') onCancel()
        }}
        aria-label='编辑消息内容'
        className='min-h-24 resize-y rounded-2xl bg-background px-3 py-2 text-base leading-relaxed sm:text-sm'
      />
      <div className='flex items-center justify-end gap-2'>
        <Button variant='ghost' size='sm' onClick={onCancel}>
          取消
        </Button>
        <Button
          size='sm'
          disabled={!value.trim()}
          onClick={() => onSave(composeDraft(value, references))}
        >
          保存并重新生成
        </Button>
      </div>
    </div>
  )
}

export const MessageBubble = memo(function MessageBubble({
  message,
  onEditSave,
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [editing, setEditing] = useState(false)
  const userMessageRef = useRef<HTMLDivElement>(null)

  const finishEditing = () => {
    userMessageRef.current?.focus({ preventScroll: true })
    setEditing(false)
  }

  // 本地临时行 / 进行中行不显示操作栏
  const hideActions =
    message.id.startsWith('local-') || message.id === 'streaming'

  if (isUser) {
    const text = readableMessageText(plainText(message))

    return (
      <Message
        align='end'
        ref={userMessageRef}
        tabIndex={-1}
        role='group'
        aria-label='你的消息'
        className='group outline-none'
      >
        <MessageContent>
          <AnimatedContent
            animationKey={editing ? 'editing' : 'message'}
            className='w-full min-w-0'
          >
            {editing ? (
              <div className='ml-auto w-full sm:max-w-[85%]'>
                <UserMessageEditor
                  initial={editableText(message)}
                  onCancel={finishEditing}
                  onSave={(value) => {
                    finishEditing()
                    onEditSave?.(message.id, value)
                  }}
                />
              </div>
            ) : (
              <div className='flex min-w-0 flex-col items-end gap-1.5'>
                {getSkillReferences(message.parts).map((reference) => (
                  <Attachment
                    size='xs'
                    key={reference.skillId}
                    className='min-w-0'
                  >
                    <AttachmentMedia>
                      <BookOpen />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>{reference.displayName}</AttachmentTitle>
                    </AttachmentContent>
                  </Attachment>
                ))}
                {text.trim() && (
                  <Bubble
                    align='end'
                    variant='muted'
                    className='max-w-[92%] sm:max-w-[85%]'
                  >
                    <BubbleContent className='whitespace-pre-wrap'>
                      {text}
                    </BubbleContent>
                  </Bubble>
                )}
                {!hideActions && (
                  <MessageActions
                    message={message}
                    onEdit={
                      onEditSave
                        ? () => {
                            userMessageRef.current?.focus({
                              preventScroll: true,
                            })

                            setEditing(true)
                          }
                        : undefined
                    }
                  />
                )}
              </div>
            )}
          </AnimatedContent>
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message className='group' role='group' aria-label='AI 助手的回复'>
      <MessageContent>
        <MessageHeader className='gap-1.5 px-0'>
          <Sparkles className='size-3.5' aria-hidden='true' />
          AI 助手
        </MessageHeader>
        <AnimatedContent
          animationKey={
            message.id === 'streaming' && message.parts.length === 0
              ? 'thinking'
              : 'content'
          }
          className='min-w-0 text-sm leading-relaxed break-words text-foreground'
        >
          {message.parts.length === 0 && message.id === 'streaming' ? (
            <Trace>
              <TraceLine status='running'>
                <TraceIcon>
                  <Brain />
                </TraceIcon>
                <TraceTitle>正在思考</TraceTitle>
              </TraceLine>
            </Trace>
          ) : (
            <Bubble variant='ghost' className='w-full'>
              <BubbleContent className='flex w-full flex-col gap-3 overflow-visible'>
                {renderAssistantParts(
                  message.parts,
                  message.id === 'streaming',
                )}
              </BubbleContent>
            </Bubble>
          )}
        </AnimatedContent>
        {hideActions ? (
          // 预留操作行，完成后显示按钮时正文保持原位。
          <MessageFooter aria-hidden='true' className='h-6' />
        ) : (
          <MessageActions
            message={message}
            onRegenerate={
              onRegenerate ? () => onRegenerate(message.id) : undefined
            }
          />
        )}
      </MessageContent>
    </Message>
  )
})
