import type { ResumeStats } from '../../type'
import { Cloud, CloudOff } from 'lucide-react'
import { useMemo } from 'react'
import { Label, Pie, PieChart } from 'recharts'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { storageChartConfig } from '../../const'
import EmptyChart from './empty-chart'

interface ResumeStorageProps {
  stats: ResumeStats
}

function ResumeStorage({ stats }: ResumeStorageProps) {
  const storageDistribution = useMemo(() => {
    return [
      { type: 'cloud', name: '云端', value: stats.online, fill: 'var(--color-cloud)' },
      { type: 'local', name: '本地', value: stats.offline, fill: 'var(--color-local)' },
    ].filter(item => item.value > 0)
  }, [stats])

  return (
    <Card className="flex flex-col transition-all duration-200 hover:shadow-md">
      <CardHeader className="items-center pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Cloud className="size-4 text-primary" />
          存储分布
        </CardTitle>
        <CardDescription className="text-xs">云端与本地存储占比</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {storageDistribution.length > 0
          ? (
              <ChartContainer
                config={storageChartConfig}
                className="mx-auto aspect-square max-h-[180px]"
              >
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Pie
                    data={storageDistribution}
                    dataKey="value"
                    nameKey="type"
                    innerRadius={45}
                    outerRadius={65}
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
                                y={(viewBox.cy || 0) + 18}
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
              <EmptyChart message="暂无存储数据" />
            )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {stats.offline > 0
            ? (
                <>
                  <span className="font-medium text-foreground">{stats.offline}</span>
                  份简历仅存储在本地
                  <CloudOff className="size-3.5 text-amber-500" />
                </>
              )
            : (
                <>
                  所有简历已同步至云端
                  <Cloud className="size-3.5 text-blue-500" />
                </>
              )}
        </div>
      </CardFooter>
    </Card>
  )
}

export default ResumeStorage
