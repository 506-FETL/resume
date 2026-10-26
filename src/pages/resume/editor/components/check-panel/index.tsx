import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { CheckSeverity } from '@/lib/resume-checks/types'
import {
  Check,
  ChevronDown,
  LoaderCircle,
  RotateCw,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DURATION } from '@/lib/motion'
import { SECTION_LABELS } from '@/lib/resume-preparation/const'
import { cn } from '@/lib/utils'
import useUserStore from '@/store/user'
import { useResumeReviewStore } from '../../review-store'
import { useResumeCheckStore } from '../../store/checks'
import {
  applyCheckSuggestion,
  cancelProofreading,
  editCheckIssue,
  keepCheckIssue,
  runProofreading,
  undoCheckSuggestion,
} from '../../utils/check-actions'
import { CHECK_LEVELS } from '../../utils/check-presentation'

function CheckPanel() {
  const state = useResumeCheckStore(
    useShallow((state) => ({
      aiCount: state.aiCount,
      busy: state.busy,
      canUndo: state.canUndo,
      filter: state.filter,
      issues: state.issues,
      locate: state.locate,
      locationMessage: state.locationMessage,
      proofreadError: state.proofreadError,
      proofreadStatus: state.proofreadStatus,
      ruleError: state.ruleError,
      ruleStatus: state.ruleStatus,
      selectedIssueId: state.selectedIssueId,
      selectedTargetIndex: state.selectedTargetIndex,
      setFilter: state.setFilter,
      sourceError: state.sourceError,
    })),
  )

  const review = useResumeReviewStore((value) => value.active)
  const loggedIn = useUserStore((value) => !!value.currentUser)
  const reduced = useReducedMotion()
  const active = state.issues.filter((issue) => !issue.resolved)
  const resolved = state.issues.filter((issue) => issue.resolved)
  const counts = { error: 0, warning: 0, suggestion: 0 }

  active.forEach((issue) => {
    counts[issue.severity] += 1
  })

  const visible =
    state.filter === 'resolved'
      ? resolved
      : active.filter(
          (issue) => state.filter === 'all' || issue.severity === state.filter,
        )

  const disabled = review || state.busy || state.ruleStatus !== 'ready'

  return (
    <div className='flex h-full min-h-0 flex-col' data-resume-check-panel>
      <div className='shrink-0 space-y-3 px-4 py-3'>
        <div className='flex items-center justify-between gap-2'>
          <p className='text-xs text-muted-foreground' role='status'>
            {state.ruleStatus === 'ready'
              ? '本地检查已完成'
              : state.ruleStatus === 'error'
                ? '检查未完成'
                : '正在检查…'}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size='icon-xs'
                variant='ghost'
                aria-label='重新检查'
                disabled={state.busy}
                onClick={() =>
                  useResumeCheckStore.setState((value) => ({
                    revision: value.revision + 1,
                  }))
                }
              >
                <RotateCw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重新检查</TooltipContent>
          </Tooltip>
        </div>
        <div className='flex flex-wrap gap-1.5' aria-label='按严重程度筛选'>
          <Button
            variant='ghost'
            size='xs'
            aria-pressed={state.filter === 'all'}
            className={cn(
              'border border-transparent',
              state.filter === 'all' && 'border-border bg-muted',
            )}
            onClick={() => state.setFilter('all')}
          >
            全部 {active.length}
          </Button>
          {(Object.keys(CHECK_LEVELS) as CheckSeverity[]).map((level) => (
            <Button
              key={level}
              variant='ghost'
              size='xs'
              aria-pressed={state.filter === level}
              className={cn(
                'border border-transparent',
                CHECK_LEVELS[level].badge,
                state.filter === level && 'border-current',
              )}
              onClick={() => state.setFilter(level)}
            >
              {CHECK_LEVELS[level].label} {counts[level]}
            </Button>
          ))}
          {resolved.length > 0 && (
            <Button
              size='xs'
              variant='ghost'
              aria-pressed={state.filter === 'resolved'}
              onClick={() => state.setFilter('resolved')}
            >
              已处理 {resolved.length}
            </Button>
          )}
        </div>
        {state.ruleError && (
          <p className='text-xs text-destructive' role='alert'>
            {state.ruleError}
          </p>
        )}
        {state.sourceError && (
          <p
            className='text-xs text-amber-700 dark:text-amber-300'
            role='alert'
          >
            来源记录未能读取，可重新检查。正文检查与导出仍可使用。
          </p>
        )}
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 [scrollbar-gutter:stable]'>
        {visible.length === 0 ? (
          <div className='flex items-start gap-2 py-8 text-sm text-muted-foreground'>
            <Check className='mt-0.5 size-4 shrink-0' />
            <div>
              {state.ruleStatus === 'ready'
                ? state.filter === 'all'
                  ? '本地规则未发现待处理问题'
                  : '这一类没有待处理的问题'
                : state.ruleStatus === 'error'
                  ? '暂时无法完成本地检查，请重试'
                  : '正在准备检查结果…'}
              {state.filter === 'all' && state.proofreadStatus !== 'ready' && (
                <p className='mt-1 text-xs'>
                  文字校对尚未完成，可在下方继续检查。
                </p>
              )}
            </div>
          </div>
        ) : (
          <Accordion
            type='single'
            collapsible
            value={state.selectedIssueId ?? ''}
            onValueChange={(value) =>
              value
                ? state.locate(value)
                : useResumeCheckStore.setState({ selectedIssueId: null })
            }
          >
            {visible.map((issue) => {
              const level = CHECK_LEVELS[issue.severity]
              const Icon = level.icon

              // 其余字段只用于确认签名，不是额外缺失的标题。
              const targetCount = issue.id.startsWith('missing:title:')
                ? 1
                : issue.targets.length

              const targetIndex =
                issue.id === state.selectedIssueId
                  ? Math.min(
                      state.selectedTargetIndex,
                      Math.max(0, targetCount - 1),
                    )
                  : 0

              const target = issue.targets[targetIndex]

              return (
                <AccordionItem key={issue.id} value={issue.id}>
                  <AccordionTrigger className='items-start gap-2 py-3.5 text-left hover:no-underline'>
                    <Icon
                      className={cn('mt-0.5 size-4 shrink-0', level.color)}
                      aria-label={level.label}
                    />
                    <span className='min-w-0 flex-1'>
                      <span className='block text-sm font-medium'>
                        {issue.title}
                      </span>
                      <span className='mt-1 block text-xs font-normal text-muted-foreground'>
                        {SECTION_LABELS[issue.section]}
                        {targetCount > 1 ? ` · ${targetCount} 处` : ''}
                        {issue.source === 'ai' ? ' · AI 待核对' : ''}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent
                    className='space-y-3 pl-6'
                    style={{
                      animationDuration: `${reduced ? 0 : DURATION.base}s`,
                    }}
                  >
                    <p className='text-xs leading-5 text-muted-foreground'>
                      {issue.detail}
                    </p>
                    {issue.id === state.selectedIssueId &&
                      state.locationMessage && (
                        <p
                          className='text-xs text-muted-foreground'
                          role='status'
                        >
                          {state.locationMessage}
                        </p>
                      )}
                    {!!target?.quote && (
                      <div className='max-h-36 overflow-auto break-words rounded-md bg-muted p-2.5 text-xs leading-5'>
                        <span
                          className={
                            issue.replacement
                              ? 'text-muted-foreground line-through'
                              : ''
                          }
                        >
                          {target.quote}
                        </span>
                        {issue.replacement && (
                          <span className='ml-2 font-medium'>
                            {issue.replacement}
                          </span>
                        )}
                      </div>
                    )}
                    {targetCount > 1 && (
                      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <span>
                          第 {targetIndex + 1} / {targetCount} 处
                        </span>
                        <Button
                          size='xs'
                          variant='ghost'
                          onClick={() =>
                            state.locate(
                              issue.id,
                              (targetIndex + 1) % targetCount,
                            )
                          }
                        >
                          下一处
                        </Button>
                      </div>
                    )}
                    <div className='flex flex-wrap gap-1.5'>
                      {issue.resolved ? (
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={disabled}
                          onClick={() => keepCheckIssue(issue, false)}
                        >
                          恢复提醒
                        </Button>
                      ) : (
                        <>
                          {issue.replacement && (
                            <Button
                              size='sm'
                              variant='outline'
                              disabled={disabled}
                              onClick={() => applyCheckSuggestion(issue)}
                            >
                              采用建议
                            </Button>
                          )}
                          {issue.source !== 'layout' && (
                            <Button
                              size='sm'
                              variant={issue.replacement ? 'ghost' : 'outline'}
                              disabled={disabled}
                              onClick={() => editCheckIssue(issue, targetIndex)}
                            >
                              前往修改
                            </Button>
                          )}
                          <Button
                            size='sm'
                            variant='ghost'
                            disabled={disabled}
                            onClick={() => keepCheckIssue(issue, true)}
                          >
                            {issue.source === 'layout'
                              ? '暂不调整'
                              : issue.severity === 'warning'
                                ? '确认无误'
                                : '保留原文'}
                          </Button>
                        </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </div>

      <footer className='shrink-0 space-y-2.5 border-t px-4 py-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <span className='text-xs text-muted-foreground'>
            {state.proofreadStatus === 'running'
              ? '正在校对文字…'
              : state.proofreadStatus === 'ready'
                ? '文字校对已完成'
                : state.proofreadStatus === 'stale'
                  ? '内容已变化，需重新校对'
                  : state.proofreadStatus === 'error'
                    ? '文字校对未完成'
                    : '文字校对未运行'}
          </span>
          {state.proofreadStatus === 'running' ? (
            <Button
              size='xs'
              variant='ghost'
              onClick={() => cancelProofreading()}
            >
              取消
            </Button>
          ) : (
            <Button
              size='xs'
              variant='outline'
              disabled={review || state.ruleStatus !== 'ready'}
              onClick={() => runProofreading()}
            >
              <Sparkles />
              AI 文字校对
            </Button>
          )}
        </div>
        <p className='text-xs text-muted-foreground'>
          {loggedIn
            ? '文字发送给 AI 校对，使用现有 AI 额度。'
            : '登录后可校对错别字和专业名词。'}
        </p>
        {state.proofreadStatus === 'running' && (
          <LoaderCircle
            className={cn(
              'size-3.5 text-muted-foreground',
              !reduced && 'animate-spin',
            )}
            aria-hidden
          />
        )}
        {state.proofreadError && (
          <p role='alert' className='text-xs text-destructive'>
            {state.proofreadError}
          </p>
        )}
        {state.aiCount > 0 && (
          <Collapsible>
            <CollapsibleTrigger className='flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300'>
              <ChevronDown className='size-3.5' />
              {state.aiCount} 处内容使用过 AI 修改
            </CollapsibleTrigger>
            <CollapsibleContent className='pt-2 text-xs leading-5 text-muted-foreground'>
              核对公司、日期和成果是否准确。这项提醒不影响导出。
            </CollapsibleContent>
          </Collapsible>
        )}
        {state.canUndo && (
          <Button size='xs' variant='ghost' onClick={undoCheckSuggestion}>
            <Undo2 />
            撤销上次修改
          </Button>
        )}
      </footer>
    </div>
  )
}

export default memo(CheckPanel)
