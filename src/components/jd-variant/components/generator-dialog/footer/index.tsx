import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { GeneratorState } from '../../../types'

export function GeneratorFooter({
  state,
  canStart,
  startGenerate,
  abort,
  handleOpenChange,
  discarding,
  handleDiscardTask,
  opening,
  handleOpenResult,
  jobId,
}: {
  state: Pick<GeneratorState, 'phase' | 'draftResumeId'>
  canStart: boolean
  startGenerate: () => void
  abort: () => void
  handleOpenChange: (open: boolean) => void
  discarding: boolean
  handleDiscardTask: () => void
  opening: boolean
  handleOpenResult: () => void
  jobId?: string
}) {
  if (state.phase === 'idle') {
    return (
      <Button type='button' disabled={!canStart} onClick={startGenerate}>
        生成岗位版本
      </Button>
    )
  }

  if (state.phase === 'parsing' || state.phase === 'rewriting') {
    return (
      <>
        <Button type='button' variant='ghost' onClick={abort}>
          取消生成
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => handleOpenChange(false)}
        >
          后台生成
        </Button>
      </>
    )
  }

  if (state.phase === 'error') {
    return (
      <>
        <Button
          type='button'
          variant='outline'
          disabled={discarding}
          onClick={handleDiscardTask}
        >
          {discarding && <Spinner />}
          {discarding ? '正在丢弃…' : '丢弃草稿'}
        </Button>
        <Button
          type='button'
          disabled={!canStart || discarding}
          onClick={startGenerate}
        >
          重试
        </Button>
      </>
    )
  }

  if (state.phase === 'aborted') {
    return (
      <>
        <Button
          type='button'
          variant='outline'
          disabled={discarding}
          onClick={handleDiscardTask}
        >
          {discarding && <Spinner />}
          {discarding ? '正在丢弃…' : '丢弃草稿'}
        </Button>
        <Button
          type='button'
          disabled={!canStart || discarding}
          onClick={startGenerate}
        >
          重新生成
        </Button>
      </>
    )
  }

  return (
    <>
      <Button
        type='button'
        variant='outline'
        disabled={discarding || opening}
        onClick={handleDiscardTask}
      >
        {discarding && <Spinner />}
        {discarding ? '正在丢弃…' : '丢弃'}
      </Button>
      <Button
        type='button'
        disabled={!state.draftResumeId || opening || discarding}
        onClick={handleOpenResult}
      >
        {opening && <Spinner />}
        {opening
          ? jobId
            ? '正在关联岗位…'
            : '正在打开…'
          : jobId
            ? '用于此岗位并打开'
            : '打开新简历'}
      </Button>
    </>
  )
}
