import { BarChart3, CheckCircle2, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import useAtsStore from '../../store'
import MetricCard from './metric-card'
import ScoresRadarChart from './scores-radar-chart'
import { calculateRating, calculateReadabilityRating } from './utils'

export function OptimizeDashboard() {
  const { currentAtsConfig, loading } = useAtsStore()
  const { fixChecklist, summary, readabilityIndex, scores } = currentAtsConfig || {}

  const totalTasks = fixChecklist?.length || 0
  const completedTasks = fixChecklist?.filter(item => item.isDone).length || 0
  const progress = Math.round((completedTasks / totalTasks) * 100)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="评分"
        value={summary?.overall_score}
        subtext={summary?.grade}
        icon={BarChart3}
        colorClass={calculateRating(summary?.overall_score || 0)}
        loading={loading}
      />
      <MetricCard
        title="可读性指数"
        value={readabilityIndex?.score || ''}
        subtext={readabilityIndex?.summary}
        icon={FileText}
        colorClass={calculateReadabilityRating(readabilityIndex?.score || 0)}
        loading={loading}
      />
      <ScoresRadarChart scores={scores} loading={loading} />
      <Card className="h-full group relative overflow-hidden border-primary/20 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300 transform">
          <CheckCircle2 className="w-32 h-32 text-primary" />
        </div>
        <CardContent className="p-5 flex flex-col justify-between h-full relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">优化完成度</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-baseline">
              {Number.isFinite(progress) && (
                <span className="text-4xl font-bold tracking-tight text-foreground">
                  {progress}
                  <span className="text-xl ml-1 text-muted-foreground font-medium">%</span>
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Progress value={progress} className="h-2.5 bg-muted" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {progress === 100
                  ? '完美！您已完成所有优化项。'
                  : '继续完成剩余优化项以提升评分。'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
