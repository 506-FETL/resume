import { Button } from '@/components/ui/button'

export function PreviewError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className='flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center'>
      <p role='alert' className='text-sm text-muted-foreground'>
        {message}
      </p>
      <Button variant='outline' size='sm' onClick={onRetry}>
        重新预览
      </Button>
    </div>
  )
}
