import type { DateRange } from 'react-day-picker'
import type { Resume } from '../../type'
import dayjs from 'dayjs'
import { AreaChart as AreaChartIcon, BarChart3, Calendar as CalendarIcon, LineChart as LineChartIcon, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { trendChartConfig } from '../../const'
import { GRANULARITY_CONFIG } from './const'
import { getGranularity } from './utils'

interface MonthlyTrend {
  resumes: Resume[]
}

function CreateTrend({ resumes }: MonthlyTrend) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: dayjs().subtract(5, 'month').toDate(),
    to: new Date(),
  }))

  const trendData = useMemo(() => {
    if (!dateRange?.from)
      return []

    const start = dayjs(dateRange.from).startOf('day')
    const end = dayjs(dateRange.to || dateRange.from).endOf('day')
    const granularity = getGranularity(start, end)
    const { unit, format: dateFormat, displayFormat } = GRANULARITY_CONFIG[granularity]

    // 生成时间区间
    const data: Record<string, number> = {}
    let current = start.startOf(unit)
    const endTime = end.endOf(unit)

    while (current.isBefore(endTime) || current.isSame(endTime)) {
      data[current.format(dateFormat)] = 0
      current = current.add(1, unit)
    }

    // 统计数据
    resumes.forEach((r) => {
      const date = dayjs(r.created_at)
      if (date.isAfter(start) && date.isBefore(end)) {
        const key = date.format(dateFormat)
        if (key in data) {
          data[key]++
        }
      }
    })

    return Object.entries(data).map(([date, count]) => ({
      date: dayjs(date).format(displayFormat),
      fullDate: date,
      count,
    }))
  }, [resumes, dateRange])

  return (
    <Card className="flex flex-col transition-all duration-200 hover:shadow-md">
      <CardHeader className="items-center pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="size-4 text-primary" />
          创建趋势
        </CardTitle>
        <CardDescription className="flex flex-col items-center gap-2.5 pt-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
              >
                <CalendarIcon className="size-3.5 mr-1.5 opacity-50" />
                {dateRange?.from
                  ? (
                      dateRange.to
                        ? (
                            <>
                              {dayjs(dateRange.from).format('YYYY/MM/DD')}
                              {' - '}
                              {dayjs(dateRange.to).format('YYYY/MM/DD')}
                            </>
                          )
                        : (
                            dayjs(dateRange.from).format('YYYY/MM/DD')
                          )
                    )
                  : (
                      <span>选择日期范围</span>
                    )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                captionLayout="dropdown"
              />
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-0.5 bg-muted/50 p-0.5 rounded-md">
            <Button
              variant={chartType === 'bar' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-6 rounded transition-colors"
              onClick={() => setChartType('bar')}
              title="柱状图"
            >
              <BarChart3 className="size-3.5" />
            </Button>
            <Button
              variant={chartType === 'line' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-6 rounded transition-colors"
              onClick={() => setChartType('line')}
              title="折线图"
            >
              <LineChartIcon className="size-3.5" />
            </Button>
            <Button
              variant={chartType === 'area' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-6 rounded transition-colors"
              onClick={() => setChartType('area')}
              title="面积图"
            >
              <AreaChartIcon className="size-3.5" />
            </Button>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={trendChartConfig} className="h-52 w-full">
          {chartType === 'bar'
            ? (
                <BarChart accessibilityLayer data={trendData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )
            : chartType === 'line'
              ? (
                  <LineChart accessibilityLayer data={trendData}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-count)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: 'var(--color-count)' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                )
              : (
                  <AreaChart accessibilityLayer data={trendData}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-count)"
                      fill="var(--color-count)"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                )}
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          共创建
          <span className="font-medium text-foreground">
            {trendData.reduce((acc, curr) => acc + curr.count, 0)}
          </span>
          份简历
        </div>
      </CardFooter>
    </Card>
  )
}

export default CreateTrend
