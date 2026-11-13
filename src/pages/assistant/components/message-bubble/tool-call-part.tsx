import type { AiMessagePart } from '@/lib/ai/types'
import {
  CircleAlert,
  CircleMinus,
  PanelRight,
  RotateCw,
  ShieldQuestion,
} from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Button } from '@/components/ui/button'
import AnimatedContent from '@/components/motion/animated-content'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace'
import { getSkillToolLabel } from '@/lib/ai/skills/presentation'
import { isSkillTool } from '@/lib/ai/skills/runtime'
import { DURATION, EASE } from '@/lib/motion'
import { getToolCategoryIcon } from '@/lib/utils/tool-icons'
import useAssistantStore from '../../store'
import { retryToolCall } from '../../tool-retry'
import { TOOL_CANVAS_META } from '../../utils'
import { fieldDiffStat } from '../diff/compute-field-diff'
import { DiffStat } from '../diff/diff-view'

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

interface ToolCallPartProps {
  calls: ToolCallPart[]
  streaming?: boolean
}

export const ToolCallPartGroup = memo(function ToolCallPartGroup({
  calls,
  streaming = false,
}: ToolCallPartProps) {
  return (
    <Trace>
      {calls.map((call) => (
        <ToolCallRow key={call.toolCallId} call={call} streaming={streaming} />
      ))}
    </Trace>
  )
})

const ToolCallRow = memo(function ToolCallRow({
  call,
  streaming,
}: {
  call: ToolCallPart
  streaming: boolean
}) {
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const meta = TOOL_CANVAS_META[call.toolName]

  const label =
    getSkillToolLabel(call.toolName, call.args) ?? meta?.label ?? call.toolName

  const stat = statOf(call)
  const targetTab = meta?.targetTab
  const canRetry = call.state === 'error' && !isSkillTool(call.toolName)

  const status =
    call.state === 'call'
      ? 'running'
      : call.state === 'awaiting-confirm'
        ? 'pending'
        : call.state === 'error'
          ? 'error'
          : undefined

  const title = {
    call: `正在${label}`,
    'awaiting-confirm': `${label}，等待确认`,
    result: `已${label}`,
    error: `${label}失败`,
    cancelled: `已取消${label}`,
  }[call.state]

  return (
    <motion.div
      initial={
        reducedMotion || !streaming
          ? false
          : { opacity: 0, transform: 'translateY(8px)' }
      }
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{
        duration: reducedMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
      tabIndex={-1}
      data-assistant-tool-row
      className='min-w-0 outline-none'
    >
      <TraceCollapsible open={open} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger className='max-w-full py-1'>
          <AnimatedContent
            as='span'
            className='min-w-0'
            animationKey={call.state}
          >
            <TraceLine status={status}>
              <TraceIcon>
                {call.state === 'error' ? (
                  <CircleAlert />
                ) : call.state === 'cancelled' ? (
                  <CircleMinus />
                ) : call.state === 'awaiting-confirm' ? (
                  <ShieldQuestion />
                ) : (
                  getToolCategoryIcon(meta?.iconCategory ?? 'general', {
                    showBackground: false,
                    size: 16,
                  })
                )}
              </TraceIcon>
              <TraceTitle title={title}>{title}</TraceTitle>
              {stat && (
                <TraceDescription className='text-xs'>
                  <DiffStat
                    additions={stat.additions}
                    deletions={stat.deletions}
                  />
                </TraceDescription>
              )}
            </TraceLine>
          </AnimatedContent>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <ToolCallDetails call={call} />
        </TraceCollapsibleContent>
      </TraceCollapsible>
      <div className='flex flex-wrap items-center gap-1 pl-6'>
        <AnimatedContent animationKey={canRetry ? 'retry' : 'none'}>
          {canRetry && (
            <Button
              variant='ghost'
              size='sm'
              className='h-7 gap-1 px-2 text-xs text-destructive'
              onClick={(event) => {
                event.currentTarget
                  .closest<HTMLElement>('[data-assistant-tool-row]')
                  ?.focus({ preventScroll: true })

                retryToolCall(call.toolCallId)
              }}
            >
              <RotateCw className='size-3.5' />
              重试
            </Button>
          )}
        </AnimatedContent>
        {targetTab && (
          <Button
            variant='ghost'
            size='sm'
            className='h-7 gap-1 px-2 text-xs text-muted-foreground'
            onClick={() => {
              useAssistantStore.setState({
                canvasOpen: true,
                canvasMobileOpen: true,
              })

              useAssistantStore.getState().requestCanvasTab(targetTab)
            }}
          >
            <PanelRight className='size-3.5' />
            在画布中查看
          </Button>
        )}
      </div>
    </motion.div>
  )
})

function ToolCallDetails({ call }: { call: ToolCallPart }) {
  return (
    <div className='space-y-3 text-xs'>
      <div>
        <p className='mb-1 font-medium text-foreground'>请求内容</p>
        <pre className='max-h-56 overflow-auto rounded-md bg-muted p-3 text-foreground whitespace-pre-wrap break-all'>
          {JSON.stringify(call.args, null, 2)}
        </pre>
      </div>
      {call.result !== undefined && (
        <div>
          <p className='mb-1 font-medium text-foreground'>
            {call.state === 'error' ? '失败原因' : '返回结果'}
          </p>
          <pre className='max-h-72 overflow-auto rounded-md bg-muted p-3 text-foreground whitespace-pre-wrap break-all'>
            {JSON.stringify(call.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function statOf(
  part: ToolCallPart,
): { additions: number; deletions: number } | null {
  const result = part.result

  const sectionKey = (part.args as { sectionKey?: string } | undefined)
    ?.sectionKey

  if (
    !sectionKey ||
    !result ||
    typeof result !== 'object' ||
    !('before' in result) ||
    !('after' in result)
  )
    return null

  return fieldDiffStat(sectionKey, result.before, result.after)
}
