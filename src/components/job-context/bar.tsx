import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { jobContextUrl } from '@/lib/job-context-url'
import { useJobContextStore } from '@/lib/job-context-store'

export function JobContextBar() {
  const context = useJobContextStore((state) => state.context)
  const [params] = useSearchParams()

  if (!context || context.id !== params.get('jobId')) return null

  return (
    <div className='flex min-w-0 flex-wrap items-center gap-2 text-sm'>
      <Button asChild size='sm' variant='outline'>
        <Link to={jobContextUrl('/tracker', context.id)}>返回岗位</Link>
      </Button>
      <span className='min-w-0 truncate text-muted-foreground'>
        {context.company} · {context.position}
      </span>
    </div>
  )
}
