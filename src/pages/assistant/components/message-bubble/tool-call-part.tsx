import type { AiMessagePart } from '@/lib/ai/types'
import { CircleAlert, CircleMinus, PanelRight, RotateCw } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import AnimatedContent from '@/components/motion/animated-content'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
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

  const r = result as { before: unknown; after: unknown }

  return fieldDiffStat(sectionKey, r.before, r.after)
}

export function ToolCallPartGroup({
  calls,
  streaming = false,
}: ToolCallPartProps) {
  const reduced = useReducedMotion()

  const targetTab = calls
    .map((c) => TOOL_CANVAS_META[c.toolName]?.targetTab)
    .find(Boolean)

  return (
    <div className='flex flex-col gap-1'>
      {/* ChatGPT/Codex 式工具活动轨迹：左侧引导线 + 逐行「图标 + 动作 + 增删统计」 */}
      <div className='flex flex-col gap-0.5 border-l-2 border-border/70 pl-3'>
        {calls.map((c) => {
          const meta = TOOL_CANVAS_META[c.toolName]

          const label =
            getSkillToolLabel(c.toolName, c.args) ?? meta?.label ?? c.toolName

          const skillError =
            isSkillTool(c.toolName) &&
            c.state === 'error' &&
            c.result &&
            typeof c.result === 'object' &&
            'error' in c.result
              ? String(c.result.error)
              : null

          const pending = c.state === 'call' || c.state === 'awaiting-confirm'
          const stat = statOf(c)

          return (
            <motion.div
              key={c.toolCallId}
              initial={
                reduced || !streaming
                  ? false
                  : { opacity: 0, transform: 'translateY(8px)' }
              }
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{
                duration: reduced ? 0 : DURATION.base,
                ease: EASE.out,
              }}
              tabIndex={-1}
              data-assistant-tool-row
              className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-0.5 text-sm outline-none'
            >
              <AnimatedContent
                animationKey={c.state}
                as='span'
                className='flex size-4 shrink-0 items-center justify-center text-muted-foreground'
              >
                {pending ? (
                  <Spinner className='size-3.5' />
                ) : c.state === 'error' ? (
                  <CircleAlert className='size-4 text-destructive' />
                ) : c.state === 'cancelled' ? (
                  <CircleMinus className='size-4' />
                ) : (
                  getToolCategoryIcon(meta?.iconCategory ?? 'general', {
                    showBackground: false,
                    size: 16,
                  })
                )}
              </AnimatedContent>
              <span
                title={label}
                className='min-w-0 flex-1 truncate text-foreground/80'
              >
                {label}
              </span>
              <AnimatedContent
                animationKey={c.state}
                as='span'
                className='flex max-w-full flex-wrap items-center gap-1.5'
              >
                {stat && (
                  <DiffStat
                    additions={stat.additions}
                    deletions={stat.deletions}
                  />
                )}
                {c.state === 'cancelled' && (
                  <span className='text-xs text-muted-foreground'>已取消</span>
                )}
                {c.state === 'error' && (
                  <>
                    <span
                      className='text-xs text-rose-500'
                      title={skillError ?? undefined}
                    >
                      失败
                    </span>
                    {!isSkillTool(c.toolName) && (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 gap-1 px-1.5 text-xs text-rose-500 hover:text-rose-600'
                        onClick={(event) => {
                          event.currentTarget
                            .closest<HTMLElement>('[data-assistant-tool-row]')
                            ?.focus({ preventScroll: true })

                          retryToolCall(c.toolCallId)
                        }}
                      >
                        <RotateCw className='size-3.5' />
                        重试
                      </Button>
                    )}
                  </>
                )}
                {skillError && (
                  <span className='min-w-0 text-xs break-words text-destructive'>
                    {skillError}
                  </span>
                )}
              </AnimatedContent>
            </motion.div>
          )
        })}
      </div>
      {targetTab && (
        <Button
          variant='ghost'
          size='sm'
          className='h-7 w-fit gap-1 px-2 text-xs text-muted-foreground'
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
  )
}
