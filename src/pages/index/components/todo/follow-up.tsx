import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface FollowUpModuleProps {
  pendingCount: number
  days: number
}

export function FollowUpModule({ pendingCount, days }: FollowUpModuleProps) {
  return (
    <div className="flex flex-col h-full relative">
      <div className="hidden md:block absolute -left-2 top-1 bottom-0 w-px bg-border/50" />
      <div className="flex items-center gap-2 mb-2.5">
        <Send className="size-3.5 text-emerald-500" />
        <h4 className="font-medium text-xs">投递跟进</h4>
      </div>
      <div className="bg-emerald-50/80 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100/80 dark:border-emerald-900/20 flex-1 flex flex-col">
        <div className="flex-1">
          <div className="flex items-start gap-2">
            <span className="relative flex h-1.5 w-1.5 mt-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <p className="text-xs text-emerald-700/90 dark:text-emerald-400/90 leading-relaxed">
              有 <span className="font-semibold text-sm">{pendingCount}</span> 个岗位超过
              <span className="font-semibold"> {days}</span> 天没跟进
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full mt-2.5 text-xs border-emerald-200/80 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
          onClick={() => toast.info('看板功能开发中...')}
        >
          投递看板
        </Button>
      </div>
    </div>
  )
}
