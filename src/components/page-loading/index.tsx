import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface PageLoadingProps {
  className?: string
}

export function PageLoading({ className }: PageLoadingProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-48 w-full items-center justify-center text-foreground',
        className,
      )}
    >
      <Spinner className='size-8' />
    </div>
  )
}
