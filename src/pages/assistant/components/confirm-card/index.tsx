import { Check, MessageSquarePlus, ShieldQuestion, X } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import AnimatedContent from '@/components/motion/animated-content'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { useChatStream } from '../../hooks/use-chat-stream'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { DURATION, EASE } from '@/lib/motion'
import useAssistantStore from '../../store'
import { JobChangeSummary } from './job-change-summary'
import { ResumeFieldDiff } from './resume-field-diff'

type PendingConfirm = NonNullable<
  ReturnType<typeof useAssistantStore.getState>['pendingConfirm']
>

function Confirmation({ pending }: { pending: PendingConfirm }) {
  const reduceMotion = useReducedMotion()
  const isPresent = useIsPresent()
  const resolvedRef = useRef(false)
  const { preview, resolve, status } = pending
  const awaiting = status === 'pending'

  const errorMessage =
    pending.result &&
    typeof pending.result === 'object' &&
    'error' in pending.result
      ? String(pending.result.error)
      : '应用修改失败，请查看工具结果后重试。'

  const feedback = useAssistantStore((state) => state.confirmationFeedback)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const feedbackRef = useRef<HTMLTextAreaElement>(null)
  const { reviseConfirmation } = useChatStream()

  const respond = (accepted: boolean, button: HTMLButtonElement) => {
    if (!isPresent || resolvedRef.current || !awaiting) return

    resolvedRef.current = true

    button
      .closest<HTMLElement>('[data-slot=message-scroller-viewport]')
      ?.focus({ preventScroll: true })

    resolve({ kind: accepted ? 'accept' : 'reject' })
  }

  return (
    <motion.div
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
      initial={
        reduceMotion ? false : { opacity: 0, transform: 'translateY(8px)' }
      }
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{
        opacity: 0,
        transition: {
          duration: reduceMotion ? 0 : DURATION.fast,
          ease: EASE.in,
        },
      }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
      className='min-w-0'
    >
      <Item variant='outline' size='sm' className='items-start'>
        <ItemMedia variant='icon'>
          <ShieldQuestion />
        </ItemMedia>
        <ItemContent className='min-w-0'>
          <ItemTitle className='line-clamp-none'>
            <AnimatedContent as='span' animationKey={status}>
              {status === 'pending'
                ? '等待确认：'
                : status === 'applying'
                  ? '正在应用：'
                  : status === 'result'
                    ? '已应用：'
                    : '未能应用：'}
              {preview.title}
            </AnimatedContent>
          </ItemTitle>
          <ItemDescription role={status === 'error' ? 'alert' : 'status'}>
            {status === 'pending'
              ? '确认后将应用以下修改。'
              : status === 'applying'
                ? '正在保存修改，请等待实际结果。'
                : status === 'result'
                  ? '修改已完成。'
                  : errorMessage}
          </ItemDescription>
          <div className='mt-2'>
            {preview.kind === 'resume-field' ? (
              <ResumeFieldDiff
                sectionKey={preview.sectionKey ?? ''}
                before={preview.before}
                after={preview.after}
              />
            ) : (
              <JobChangeSummary summary={preview.summary ?? ''} />
            )}
          </div>
        </ItemContent>
        <AnimatePresence initial={false}>
          {(awaiting || status === 'applying') && (
            <motion.div
              className='basis-full'
              initial={
                reduceMotion
                  ? false
                  : { opacity: 0, transform: 'translateY(8px)' }
              }
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.fast,
                ease: EASE.out,
              }}
            >
              <ItemActions className='justify-end'>
                <Button
                  variant='ghost'
                  size='sm'
                  disabled={!awaiting}
                  onClick={(event) => respond(false, event.currentTarget)}
                >
                  <X className='size-3.5' />
                  拒绝
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={!awaiting}
                  onClick={() => {
                    setFeedbackOpen(true)
                    requestAnimationFrame(() => feedbackRef.current?.focus())
                  }}
                >
                  <MessageSquarePlus className='size-3.5' />
                  继续修改
                </Button>
                <Button
                  size='sm'
                  disabled={!awaiting}
                  onClick={(event) => respond(true, event.currentTarget)}
                >
                  {status === 'applying' ? (
                    <Spinner aria-hidden='true' className='size-3.5' />
                  ) : (
                    <Check className='size-3.5' />
                  )}
                  {status === 'applying' ? '正在应用' : '确认应用'}
                </Button>
              </ItemActions>
            </motion.div>
          )}
        </AnimatePresence>
        <Collapsible open={feedbackOpen && awaiting} className='w-full'>
          <CollapsibleContent>
            <div className='space-y-2 pt-2'>
              <Textarea
                ref={feedbackRef}
                value={feedback}
                onChange={(event) =>
                  useAssistantStore
                    .getState()
                    .setConfirmationFeedback(event.target.value)
                }
                placeholder='例如：保留技术细节，弱化团队成果，突出我负责的部分…'
                aria-label='对这次修改的补充要求'
                onKeyDown={(event) => {
                  if (
                    !event.nativeEvent.isComposing &&
                    event.key === 'Enter' &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault()
                    reviseConfirmation()
                  }
                }}
              />
              <div className='flex justify-end'>
                <Button
                  size='sm'
                  disabled={!feedback.trim() || !isPresent || !awaiting}
                  onClick={() => reviseConfirmation()}
                >
                  按要求重新修改
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Item>
    </motion.div>
  )
}

export default function ConfirmCard() {
  const pending = useAssistantStore((state) => state.pendingConfirm)

  // 外层消息行负责退出，避免空的 propagate 列表阻塞父级卸载。
  return (
    <AnimatePresence initial={false} mode='wait'>
      {pending && <Confirmation key={pending.id} pending={pending} />}
    </AnimatePresence>
  )
}
