import type { AssistantSubmission } from '../../store/composer-slice'
import { ChevronDown, Pencil, Play, Send, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { useChatStream } from '../../hooks/use-chat-stream'
import useAssistantStore from '../../store'
import ReferenceTags from '../reference-tags'
import { SourceScopeSummary } from '../conversation-sources/source-scope-summary'

function QueueItem({ item }: { item: AssistantSubmission }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.text)
  const { sendQueuedNow } = useChatStream()
  const editRef = useRef<HTMLButtonElement>(null)
  const reduced = useReducedMotion()

  const closeEditor = () => {
    setEditing(false)
    requestAnimationFrame(() => editRef.current?.focus({ preventScroll: true }))
  }

  const focusComposer = () =>
    document
      .querySelector<HTMLTextAreaElement>('[data-composer] textarea')
      ?.focus({ preventScroll: true })

  return (
    <motion.div
      data-queue-item={item.id}
      layout={reduced ? false : 'position'}
      initial={reduced ? false : { opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{
        opacity: 0,
        transition: { duration: reduced ? 0 : DURATION.fast },
      }}
      transition={{ duration: reduced ? 0 : DURATION.base, ease: EASE.out }}
      className='space-y-1.5 py-1.5'
    >
      {item.status === 'unknown' && (
        <p className='text-xs text-muted-foreground'>
          发送结果待核对，继续时会先检查这条消息
        </p>
      )}
      {item.references.length > 0 && (
        <ReferenceTags references={item.references} />
      )}
      <SourceScopeSummary sources={item.sources ?? []} />
      {editing ? (
        <>
          <Textarea
            aria-label='编辑排队消息'
            value={text}
            onChange={(event) => setText(event.target.value)}
            className='min-h-16'
            autoFocus
          />
          <div className='flex justify-end gap-1'>
            <Button size='sm' variant='ghost' onClick={closeEditor}>
              取消
            </Button>
            <Button
              size='sm'
              disabled={!text.trim() && !item.references.length}
              onClick={() => {
                useAssistantStore.setState((state) => ({
                  queuedMessages: state.queuedMessages.map((message) =>
                    message.id === item.id
                      ? { ...message, text: text.trim() }
                      : message,
                  ),
                }))

                closeEditor()
              }}
            >
              保存
            </Button>
          </div>
        </>
      ) : (
        <div className='flex min-h-6 items-center gap-1'>
          <p className='line-clamp-2 min-w-0 flex-1 whitespace-pre-wrap break-words pr-2 text-sm leading-5'>
            {item.text || '使用所选引用'}
          </p>
          <Button
            ref={editRef}
            size='icon-xs'
            variant='ghost'
            aria-label='编辑排队消息'
            disabled={item.status === 'unknown'}
            onClick={() => {
              setText(item.text)
              setEditing(true)
            }}
          >
            <Pencil />
          </Button>
          <Button
            size='icon-xs'
            variant='ghost'
            aria-label='立即发送这条消息'
            onClick={() => {
              focusComposer()
              sendQueuedNow(item.id)
            }}
          >
            <Send />
          </Button>
          <Button
            size='icon-xs'
            variant='ghost'
            aria-label='移除排队消息'
            onClick={() => {
              focusComposer()

              useAssistantStore.setState((state) => ({
                queuedMessages: state.queuedMessages.filter(
                  (message) => message.id !== item.id,
                ),
              }))
            }}
          >
            <X />
          </Button>
        </div>
      )}
    </motion.div>
  )
}

export default function QueuedMessages() {
  const items = useAssistantStore((state) => state.queuedMessages)
  const paused = useAssistantStore((state) => state.queuePaused)
  const pendingWrite = useAssistantStore((state) => state.pendingAssistantWrite)

  const pendingUpdates = useAssistantStore(
    (state) => state.pendingMessageUpdates.length > 0,
  )

  const reduced = useReducedMotion()
  const { resumeQueue } = useChatStream()
  const listRef = useRef<HTMLDivElement>(null)
  const [visibleHeight, setVisibleHeight] = useState(144)
  const [open, setOpen] = useState(true)

  useLayoutEffect(() => {
    const list = listRef.current

    if (!list || !open) return

    const rows = Array.from(list.children)
      .filter((element) =>
        items.some(
          (item) => item.id === (element as HTMLElement).dataset.queueItem,
        ),
      )
      .slice(0, 3) as HTMLElement[]

    const measure = () => {
      const last = rows.at(-1)

      setVisibleHeight(last ? last.offsetTop + last.offsetHeight : 0)
    }

    const observer = new ResizeObserver(measure)

    for (const row of rows) observer.observe(row)

    measure()

    return () => observer.disconnect()
  }, [items, open])

  return (
    <AnimatePresence initial={false}>
      {(items.length > 0 || pendingWrite || pendingUpdates) && (
        <motion.div
          data-composer-queue
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : DURATION.base, ease: EASE.out }}
          className='mb-2 min-w-0 rounded-xl border bg-muted/20 px-3 py-1'
        >
          <Collapsible open={open} onOpenChange={setOpen}>
            <div className='flex items-center justify-between gap-2 pb-1'>
              <CollapsibleTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='group h-7 min-w-0 justify-start gap-1.5 px-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground'
                >
                  {pendingWrite || pendingUpdates
                    ? '回复待保存'
                    : paused
                      ? '队列已暂停'
                      : '等待发送'}
                  {items.length > 0 && ` · ${items.length}`}
                  <ChevronDown
                    className='size-3.5 transition-transform duration-(--ui-motion-fast) group-data-[state=closed]:-rotate-90'
                    style={reduced ? { transitionDuration: '0s' } : undefined}
                  />
                </Button>
              </CollapsibleTrigger>
              {paused && (
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-7 px-2 text-xs'
                  onClick={resumeQueue}
                >
                  <Play className='size-3.5' />
                  继续
                </Button>
              )}
            </div>
            <CollapsibleContent className='overflow-hidden'>
              {(pendingWrite || pendingUpdates) && (
                <p role='status' className='pb-2 text-xs text-muted-foreground'>
                  继续时会先核对并保存已有进展，不会重新执行修改。
                </p>
              )}
              <div
                data-queue-scroll
                className='overflow-y-auto overscroll-contain'
                style={{ maxHeight: `min(${visibleHeight}px, 30dvh)` }}
              >
                <div ref={listRef} className='relative'>
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <QueueItem key={item.id} item={item} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
