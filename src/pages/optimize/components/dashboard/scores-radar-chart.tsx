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
      rationale: value.rationale,
    }))
  }, [scores])

  return (
    <Card className="min-w-0 border-primary/15 shadow-sm">
      <CardContent className="flex min-h-0 flex-col p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Activity className="size-4" />
            </div>
            <p className="text-sm font-medium">能力雷达图</p>
          </div>
          <span className="text-xs text-muted-foreground">五维评分</span>
        </div>

        {loading
          ? (
              <div className="flex min-h-60 flex-1 items-center justify-center">
                <Spinner className="size-6" />
              </div>
            )
          : chartData.length > 0
            ? (
                <>
                  <ChartContainer
                    aria-label="ATS 五维评分雷达图"
                    config={chartConfig}
                    className="mx-auto aspect-square w-full max-w-[18rem] flex-1"
                  >
                    <RadarChart
                      accessibilityLayer
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      outerRadius="68%"
                    >
                      <ChartTooltip
                        cursor={false}
                        content={(
                          <ChartTooltipContent
                            labelFormatter={value => SCORE_LABELS[value as keyof typeof SCORE_LABELS] || value}
                            formatter={(value, _, item) => (
                              <div className="max-w-64 space-y-1.5">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">{item.payload.raw}</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className="text-muted-foreground">{item.payload.max}</span>
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    (
                                    {value}
                                    %)
                                  </span>
                                </div>
                                {item.payload.rationale && (
                                  <p className="whitespace-normal text-xs leading-5 text-muted-foreground">
                                    {item.payload.rationale}
                                  </p>
                                )}
                              </div>
                            )}
                          />
                        )}
                      />
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        tickLine={false}
                      />
                      <PolarGrid gridType="polygon" stroke="var(--border)" />
                      <Radar
                        dataKey="score"
                        fill="var(--chart-1)"
                        fillOpacity={0.28}
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ChartContainer>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/60 pt-3 text-xs sm:grid-cols-3 xl:grid-cols-2">
                    {chartData.map(item => (
                      <div key={item.category} className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-muted-foreground" title={item.category}>{item.category}</span>
                        <span className="shrink-0 font-medium">
                          {item.raw}
                          /
                          {item.max}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )
            : (
                <div className="flex min-h-60 flex-1 items-center justify-center text-sm text-muted-foreground">
                  暂无评分数据
                </div>
              )}
      </CardContent>
    </Card>
  )
}
