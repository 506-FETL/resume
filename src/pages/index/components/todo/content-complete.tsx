import { ArrowRight, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface CompletenessModuleProps {
  missingCount: number
  missingItems: string[]
}

export function CompletenessModule({ missingCount, missingItems }: CompletenessModuleProps) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2.5">
        <FileText className="size-3.5 text-amber-500" />
        <h4 className="font-medium text-xs">内容完善</h4>
      </div>
      <div className="bg-amber-50/80 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-100/80 dark:border-amber-900/20 flex-1 flex flex-col">
        <div className="flex-1">
          <p className="text-xs text-amber-700/90 dark:text-amber-400/90 mb-2">
            还差 <span className="font-semibold">{missingCount}</span> 项优化
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missingItems.map(item => (
              <span
                key={item}
                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100/60 dark:bg-amber-900/30 text-amber-700/80 dark:text-amber-400/80"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 mt-2.5 p-0 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-transparent justify-start"
          onClick={() => navigate('/optimize')}
        >
          去完善
          <ArrowRight className="size-3 ml-1" />
        </Button>
      </div>
    </div>
  )
}
