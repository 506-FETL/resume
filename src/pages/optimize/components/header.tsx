import { History, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResumeManager } from './resume-manager'

function Header() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">ATS 优化助手</h1>
        </div>
        <p className="text-sm text-muted-foreground pl-11 max-w-lg">
          基于 AI 深度分析，为您提供专业的简历优化建议，提升通过 ATS 筛选的概率。
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 pl-11 sm:pl-0">
        <ResumeManager />
        <Button variant="outline" size="sm" className="h-9 px-4">
          <History className="w-4 h-4 mr-2 text-muted-foreground" />
          历史版本
        </Button>
      </div>
    </div>
  )
}

export default Header
