import type { Resume, ResumeStats } from '../../type'
import { BarChart3 } from 'lucide-react'
import { useMemo } from 'react'
import { Label, Pie, PieChart } from 'recharts'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { TYPE_LABELS, typeChartConfig } from '../../const'
import EmptyChart from './empty-chart'

interface ResumeTypeProps {
  stats: ResumeStats
  resumes: Resume[]
}

function ResumeType({ stats, resumes }: ResumeTypeProps) {
  const typeDistribution = useMemo(() => {
    const typeCount: Record<string, number> = {}

    resumes.forEach((r) => {
      const type = r.type || 'default'
      typeCount[type] = (typeCount[type] || 0) + 1
    })

    return Object.entries(typeCount).map(([type, count]) => ({
      type,
      name: TYPE_LABELS[type] || type,
      value: count,
      fill: `var(--color-${type})`,
    }))
  }, [resumes])

  return (
    <Card className="flex flex-col transition-all duration-200 hover:shadow-md">
      <CardHeader className="items-center pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="size-4 text-primary" />
          简历类型分布
        </CardTitle>
        <CardDescription className="text-xs">按模板类型统计</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {typeDistribution.length > 0
          ? (
              <ChartContainer
                config={typeChartConfig}
                className="mx-auto aspect-square max-h-[220px]"
              >
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Pie
                    data={typeDistribution}
                    dataKey="value"
                    nameKey="type"
                    innerRadius={50}
                    strokeWidth={4}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={viewBox.cy}
                                className="fill-foreground text-2xl font-semibold"
                              >
                                {stats.total.toLocaleString()}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 20}
                                className="fill-muted-foreground text-xs"
                              >
                                总数
                              </tspan>
                            </text>
                          )
                        }
                      }}
                    />
                  </Pie>
                  <ChartLegend
                    content={<ChartLegendContent nameKey="type" />}
                    className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center text-xs"
                  />
                </PieChart>
              </ChartContainer>
            )
          : (
              <EmptyChart message="暂无简历数据" />
            )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {stats.recentCount > 0
            ? (
                <>
                  最近 7 天新增
                  <span className="font-medium text-foreground">{stats.recentCount}</span>
                  份
                </>
              )
            : (
                '最近7天无新增简历'
              )}
        </div>
      </CardFooter>
    </Card>
  )
}

export default ResumeType
