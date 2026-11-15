import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'

export default function HistoryLoadError({
  error,
  retry,
  loading = false,
}: {
  error: string | null
  retry: () => void
  loading?: boolean
}) {
  return (
    <AnimatedContent animationKey={error ? 'error' : 'ready'}>
      {error && (
        <div
          role='alert'
          className='flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground'
        >
          <p className='min-w-0 break-words'>{error}</p>
          <Button
            variant='outline'
            size='sm'
            disabled={loading}
            onClick={retry}
          >
            重试
          </Button>
        </div>
      )}
    </AnimatedContent>
  )
}
