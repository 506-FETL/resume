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
    <div className="grid gap-4 md:grid-cols-4">
      <MetricCard
        title="评分"
        value={`${summary?.overall_score}/100`}
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
      <Card className="h-full group relative">
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
          <CheckCircle2 className="w-20 h-20 text-blue-800 dark:text-blue-100" />
        </div>
        <CardContent className="p-4 md:p-5 flex flex-col justify-between h-full relative">
          <div className="flex items-start justify-between w-full mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/20 text-blue-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">优化完成度</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between">
              {Number.isFinite(progress) && (
                <span className="text-3xl md:text-4xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                  {progress}
                  <span className="text-lg md:text-xl ml-0.5 text-blue-600/60">%</span>
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <Progress value={progress} className="h-2 bg-blue-100 dark:bg-blue-950" />
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                {progress === 100
                  ? '太棒了！您已完成所有建议的优化项。'
                  : '继续加油，完成剩余优化项可显著提升简历评分。'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
