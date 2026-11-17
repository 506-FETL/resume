import type { ReactNode } from 'react'
import type { AiMessage, AiMessagePart, AiUserReference } from '@/lib/ai/types'
import { Brain, Sparkles } from 'lucide-react'
import { memo, useRef, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { getUserReferences, referenceKey } from '@/lib/ai/references'
import ReferenceTags from '../reference-tags'
import SkillActivity from '../skill-activity'
import { MessageActions } from './message-actions'
import { ReasoningPart } from './reasoning-part'
import type { CitationEvidence } from '@/lib/ai/agent/citation-evidence'
import { useCitationEvidence } from './use-citation-evidence'
import { TextPart } from './text-part'
import { ToolCallPartGroup } from './tool-call-part'
import useAssistantStore from '../../store'

interface MessageBubbleProps {
  message: AiMessage
  onEditSave?: (
    messageId: string,
    newText: string,
    references: AiUserReference[],
  ) => void
  onRegenerate?: (messageId: string) => void
}

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

// 保持流式部件的 key 稳定，展开状态不会随 token 更新重置。
function renderAssistantParts(
  parts: AiMessagePart[],
  isStreamingMessage: boolean,
  evidence: CitationEvidence[],
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

  const lastIndex = parts.reduce(
    (last, part, index) => (isVisibleAssistantPart(part) ? index : last),
    -1,
  )

  parts.forEach((p, index) => {
    if (!isVisibleAssistantPart(p)) return

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
          evidence={evidence}
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

function isVisibleAssistantPart(part: AiMessagePart) {
  if (part.type === 'text' || part.type === 'reasoning')
    return Boolean(part.text.trim())

  return part.type === 'tool-call' || part.type === 'skill-activity'
}

// 用户消息内联编辑器
function UserMessageEditor({
  initial,
  initialReferences,
  onSave,
  onCancel,
}: {
  initial: string
  initialReferences: AiUserReference[]
  onSave: (text: string, references: AiUserReference[]) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const [references, setReferences] = useState(initialReferences)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canSave = Boolean(value.trim() || references.length)

  return (
    <div className='flex w-full flex-col gap-2'>
      {references.length > 0 && (
        <ReferenceTags
          references={references}
          onRemove={(key) => {
            setReferences((current) =>
              current.filter((reference) => referenceKey(reference) !== key),
            )

            textareaRef.current?.focus({ preventScroll: true })
          }}
        />
      )}
      <Textarea
        ref={textareaRef}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return

          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSave) {
            e.preventDefault()
            onSave(value, references)
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
          disabled={!canSave}
          onClick={() => onSave(value, references)}
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
  const evidence = useCitationEvidence(message)

  const pendingWriteId = useAssistantStore(
    (state) => state.pendingAssistantWrite?.id,
  )

  const persistencePending = useAssistantStore((state) =>
    Boolean(state.pendingAssistantWrite || state.pendingMessageUpdates.length),
  )

  const finishEditing = () => {
    userMessageRef.current?.focus({ preventScroll: true })
    setEditing(false)
  }

  // 本地临时行 / 进行中行不显示操作栏
  const hideActions =
    message.id.startsWith('local-') ||
    message.id === 'streaming' ||
    message.id === pendingWriteId

  if (isUser) {
    const parts = message.parts

    const text = parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')

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
                  initial={text}
                  initialReferences={getUserReferences(parts)}
                  onCancel={finishEditing}
                  onSave={(value, references) => {
                    finishEditing()
                    onEditSave?.(message.id, value, references)
                  }}
                />
              </div>
            ) : (
              <div className='flex min-w-0 flex-col items-end gap-1.5'>
                <ReferenceTags
                  references={getUserReferences(parts)}
                  align='end'
                />
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
                    disabled={persistencePending}
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

  const waitingForContent =
    message.id === 'streaming' && !message.parts.some(isVisibleAssistantPart)

  return (
    <Message className='group' role='group' aria-label='AI 助手的回复'>
      <MessageContent>
        <MessageHeader className='gap-1.5 px-0'>
          <Sparkles className='size-3.5' aria-hidden='true' />
          AI 助手
        </MessageHeader>
        <AnimatedContent
          animationKey={waitingForContent ? 'thinking' : 'content'}
          className='min-w-0 text-sm leading-relaxed break-words text-foreground'
        >
          {waitingForContent ? (
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
                  evidence,
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
            disabled={persistencePending}
            onRegenerate={
              onRegenerate ? () => onRegenerate(message.id) : undefined
            }
          />
        )}
      </MessageContent>
    </Message>
  )
})
