import type { Scores } from '../../types'
import type { ChartConfig } from '@/components/ui/chart'
import { Activity } from 'lucide-react'
import { useMemo } from 'react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Spinner } from '@/components/ui/spinner'
import { SCORE_LABELS } from '../../const'

interface ScoresRadarChartProps {
  scores: Scores | undefined
  loading?: boolean
}

const chartConfig = {
  score: {
    label: '得分',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export default function ScoresRadarChart({ scores, loading = false }: ScoresRadarChartProps) {
  const chartData = useMemo(() => {
    if (!scores)
      return []

    return Object.entries(scores).map(([key, value]) => ({
      category: SCORE_LABELS[key as keyof typeof SCORE_LABELS] || key,
      score: Math.round((value.score / value.max) * 100),
      raw: value.score,
      max: value.max,
    }))
  }, [scores])

  return (
    <Card className="h-full group relative overflow-hidden shadow-sm border-primary/20 hover:shadow-md transition-all duration-300">
      <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300 transform">
        <Activity className="w-32 h-32 text-primary" />
      </div>
      <CardContent className="p-5 flex flex-col justify-between h-full relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <Activity className="w-4 h-4" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">能力雷达图</p>
        </div>

        {loading
          ? (
              <div className="flex-1 flex items-center justify-center min-h-[180px]">
                <Spinner className="w-6 h-6" />
              </div>
            )
          : chartData.length > 0
            ? (
                <ChartContainer
                  config={chartConfig}
                  className="mx-auto w-full flex-1 max-h-[200px]"
                >
                  <RadarChart
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                  >
                    <ChartTooltip
                      cursor={false}
                      content={(
                        <ChartTooltipContent
                          labelFormatter={value => SCORE_LABELS[value as keyof typeof SCORE_LABELS] || value}
                          formatter={(value, _, item) => (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{item.payload.raw}</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-muted-foreground">{item.payload.max}</span>
                              <span className="text-muted-foreground text-xs ml-1">
                                (
                                {value}
                                %)
                              </span>
                            </div>
                          )}
                        />
                      )}
                    />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                    />
                    <PolarGrid gridType="polygon" stroke="var(--border)" />
                    <Radar
                      dataKey="score"
                      fill="var(--chart-1)"
                      fillOpacity={0.4}
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ChartContainer>
              )
            : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground min-h-[180px]">
                  暂无评分数据
                </div>
              )}
      </CardContent>
    </Card>
  )
}
