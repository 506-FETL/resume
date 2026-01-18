import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResumeManager } from './resume-manager'

function Header() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">ATS 优化助手</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
          智能分析并优化您的简历
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ResumeManager />
        <Button variant="outline" size="sm" className="h-8">
          <History className="w-3.5 h-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline text-xs">历史版本</span>
        </Button>
      </div>
    </div>
  )
}

export default Header
