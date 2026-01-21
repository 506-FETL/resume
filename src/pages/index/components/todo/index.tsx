import { Card, CardContent } from '@/components/ui/card'
import { CompletenessModule } from './content-complete'
import { ExportModule } from './export-module'
import { FollowUpModule } from './follow-up'
import { TodoHeader } from './todo-header'

export function TodoCard() {
  const completeness = {
    score: 85,
    missingCount: 2,
    missingItems: ['量化信息', '项目亮点'],
  }

  const exportInfo = {
    lastExportDays: 5,
  }

  const followUp = {
    pendingCount: 3,
    days: 7,
  }

  return (
    <Card className="overflow-hidden">
      <TodoHeader />

      <CardContent className="pt-0">
        <div className="flex -mx-6 px-6 overflow-x-auto gap-3 pb-2 snap-x snap-mandatory md:grid lg:grid-cols-3 md:grid-cols-2 md:gap-4 md:pb-0 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden scroll-smooth">
          <div className="min-w-[80%] snap-center md:min-w-0">
            <CompletenessModule
              missingCount={completeness.missingCount}
              missingItems={completeness.missingItems}
            />
          </div>
          <div className="min-w-[80%] snap-center md:min-w-0">
            <ExportModule lastExportDays={exportInfo.lastExportDays} />
          </div>
          <div className="min-w-[80%] snap-center md:min-w-0">
            <FollowUpModule
              pendingCount={followUp.pendingCount}
              days={followUp.days}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
