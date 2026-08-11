import { Plus, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ShareHeaderProps {
  total: number
  active: number
  canCreate: boolean
  onCreate: () => void
}

export default function ShareHeader({ total, active, canCreate, onCreate }: ShareHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <Share2 className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">分享管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total}
            {' '}
            个链接 ·
            {' '}
            {active}
            {' '}
            个有效
          </p>
        </div>
      </div>
      <Button
        onClick={onCreate}
        disabled={!canCreate}
        title={canCreate ? undefined : '请先创建或同步一份云端简历'}
      >
        <Plus data-icon="inline-start" />
        <span className="hidden sm:inline">新建分享</span>
        <span className="sm:hidden">新建</span>
      </Button>
    </div>
  )
}
