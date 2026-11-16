import type { RefObject } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { useShallow } from 'zustand/react/shallow'
import { ChevronDown, Sparkles, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import useUserStore from '@/store/user'
import { useResumeReviewStore } from '../../../review-store'
import { useResumeCheckStore } from '../../../store/checks'
import {
  cancelProofreading,
  runProofreading,
  undoCheckSuggestion,
} from '../../../utils/check-actions'

export function CheckPanelFooter({
  filterAllRef,
}: {
  filterAllRef: RefObject<HTMLButtonElement | null>
}) {
  const state = useResumeCheckStore(
    useShallow((state) => ({
      proofreadStatus: state.proofreadStatus,
      proofreadError: state.proofreadError,
      ruleStatus: state.ruleStatus,
      aiCount: state.aiCount,
      canUndo: state.canUndo,
    })),
  )

  const review = useResumeReviewStore((value) => value.active)
  const loggedIn = useUserStore((value) => !!value.currentUser)

  return (
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
        <Spinner className='size-3.5 text-muted-foreground' aria-hidden />
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
        <Button
          size='xs'
          variant='ghost'
          onClick={() => {
            filterAllRef.current?.focus({ preventScroll: true })
            undoCheckSuggestion()
          }}
        >
          <Undo2 />
          撤销上次修改
        </Button>
      )}
    </footer>
  )
}
