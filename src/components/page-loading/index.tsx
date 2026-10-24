import { WanderingEyes } from '@/components/wandering-eyes'
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
      <WanderingEyes className='w-24 sm:w-28 [--duration:3s]' />
    </div>
  )
}
