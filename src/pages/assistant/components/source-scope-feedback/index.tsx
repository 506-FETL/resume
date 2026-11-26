import { InputGroupButton } from '@/components/ui/input-group'
import type { useSourceScope } from '../../hooks/use-source-scope'

export function SourceScopeFeedback({
  scope,
}: {
  scope: Pick<ReturnType<typeof useSourceScope>, 'error' | 'loading' | 'retry'>
}) {
  if (scope.error)
    return (
      <div
        className='flex items-center gap-1 text-xs text-destructive'
        role='alert'
      >
        参考资料读取失败
        <InputGroupButton type='button' size='xs' onClick={scope.retry}>
          重试
        </InputGroupButton>
      </div>
    )

  if (scope.loading)
    return (
      <p className='text-xs text-muted-foreground' role='status'>
        正在读取参考资料目录
      </p>
    )

  return null
}
