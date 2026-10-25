import type { ReactNode } from 'react'
import type { PreparationIssue } from '@/lib/resume-preparation/checks'
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DURATION, EASE, staggerDelay } from '@/lib/motion'
import { SECTION_LABELS } from '@/lib/resume-preparation/const'

interface CheckListProps {
  issues: PreparationIssue[]
  busy: boolean
  onResolve: (issue: PreparationIssue, reason: string | null) => Promise<void>
  onLocate: (issue: PreparationIssue) => void
}

function CheckBody({ children }: { children: ReactNode }) {
  const present = useIsPresent()
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      inert={!present}
      className='space-y-3'
      initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: reducedMotion ? 0 : 4,
        transition: {
          duration: reducedMotion ? 0 : DURATION.fast,
          ease: EASE.in,
        },
      }}
      transition={{
        duration: reducedMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
    >
      {children}
    </motion.div>
  )
}

function CheckItem({
  issue,
  busy,
  onResolve,
  onLocate,
  index,
}: Omit<CheckListProps, 'issues'> & {
  issue: PreparationIssue
  index: number
}) {
  const [reason, setReason] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const reducedMotion = useReducedMotion()
  const present = useIsPresent()

  const resolve = (value: string | null) => {
    // 先把焦点交给稳定标题，再让原操作表单退出并变为 inert。
    headingRef.current?.focus({ preventScroll: true })

    return onResolve(issue, value)
  }

  return (
    <motion.li
      inert={!present}
      className='space-y-3 rounded-lg border p-3'
      layout={reducedMotion ? false : 'position'}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: reducedMotion ? 0 : 4,
        transition: {
          duration: reducedMotion ? 0 : DURATION.fast,
          ease: EASE.in,
        },
      }}
      transition={{
        duration: reducedMotion ? 0 : DURATION.base,
        ease: EASE.out,
        delay: reducedMotion ? 0 : staggerDelay(index),
      }}
    >
      <div className='flex items-start justify-between gap-3'>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className='font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring'
        >
          {issue.title}
        </h3>
        <span className='shrink-0 text-xs text-muted-foreground'>
          {issue.resolved ? '已处理' : SECTION_LABELS[issue.section]}
        </span>
      </div>
      <p className='max-h-32 overflow-auto whitespace-pre-wrap break-words text-sm text-muted-foreground'>
        {issue.detail}
      </p>
      <AnimatePresence mode='wait' initial={false}>
        {issue.resolved ? (
          <CheckBody key='resolved'>
            <p className='break-words text-xs text-muted-foreground'>
              处理说明：{issue.reason}
            </p>
            <Button
              variant='outline'
              size='sm'
              disabled={busy}
              onClick={() => resolve(null)}
            >
              撤销处理
            </Button>
          </CheckBody>
        ) : (
          <CheckBody key='unresolved'>
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={busy}
                onClick={() => onLocate(issue)}
              >
                前往修改
              </Button>
              {issue.kind === 'ai' && (
                <Button
                  variant='outline'
                  size='sm'
                  disabled={busy}
                  onClick={() => resolve('我已逐项核实这段文字与实际经历一致')}
                >
                  我已核实这段内容
                </Button>
              )}
            </div>
            <label className='block space-y-2 text-xs text-muted-foreground'>
              <span>如果无需修改，请填写原因</span>
              <Textarea
                aria-label={`忽略原因：${issue.title}`}
                placeholder='例如：联系方式通过投递平台提供'
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                className='min-h-16'
              />
            </label>
            <Button
              variant='ghost'
              size='sm'
              disabled={busy || !reason.trim()}
              onClick={() => resolve(reason.trim())}
            >
              记录原因并忽略
            </Button>
          </CheckBody>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

export default function CheckList(props: CheckListProps) {
  const reducedMotion = useReducedMotion()

  return (
    <AnimatePresence mode='wait' initial={false}>
      {!props.issues.length ? (
        <motion.p
          key='empty'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reducedMotion ? 0 : DURATION.base,
            ease: EASE.out,
          }}
          className='rounded-lg bg-muted p-3 text-sm'
        >
          没有发现上述待处理项。请再检查一遍经历、时间和联系方式。
        </motion.p>
      ) : (
        <motion.ul
          key='issues'
          className='space-y-3'
          exit={{ opacity: 0 }}
          transition={{
            duration: reducedMotion ? 0 : DURATION.fast,
            ease: EASE.in,
          }}
        >
          <AnimatePresence initial={false}>
            {props.issues.map((issue, index) => (
              <CheckItem
                key={`${issue.id}:${issue.signature}`}
                issue={issue}
                index={index}
                busy={props.busy}
                onResolve={props.onResolve}
                onLocate={props.onLocate}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </AnimatePresence>
  )
}
