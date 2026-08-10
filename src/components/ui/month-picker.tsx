import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

// 年份面板一页展示的年数（3 列 × 4 行）
const YEARS_PER_PAGE = 12

/** 将年份对齐到 12 年为一块的起始年，例如 2024 → 2016（块 2016–2027）。 */
function yearBlockStartFor(year: number): number {
  return year - (((year % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE)
}

export interface MonthPickerProps {
  /** 当前值，格式 YYYY-MM（兼容历史的 YYYY-MM-DD，会自动解析到对应年月） */
  value?: string
  /** 选择后回调，输出统一为 YYYY-MM */
  onChange: (value: string) => void
  /** 禁止选择未来月份（含当前月之后） */
  disableFuture?: boolean
  /** 可选择的最大年份（默认当前年 + 10） */
  maxYear?: number
  /** 可选择的最小年份（默认 1970） */
  minYear?: number
  className?: string
}

/**
 * 月份选择器：年份切换 + 12 个月宫格，仅精确到「年月」。
 * 点击标题的年份可切换到「年份面板」快速跳选年份（按 12 年一页翻页），无需逐年点击。
 * 用于简历各经历时间段与出生年月，替代原先精确到「日」的 Calendar，避免用户选了日却被静默丢弃。
 */
export function MonthPicker({
  value,
  onChange,
  disableFuture = false,
  maxYear,
  minYear = 1970,
  className,
}: MonthPickerProps) {
  const now = dayjs()
  const parsed = value && dayjs(value).isValid() ? dayjs(value) : null

  // 视图年份：优先跟随已选值，否则回落到当前年
  const [viewYear, setViewYear] = React.useState(() => parsed?.year() ?? now.year())
  // 面板视图：month=月份宫格，year=年份快速选择
  const [view, setView] = React.useState<'month' | 'year'>('month')
  // 年份面板当前页的起始年
  const [yearBlockStart, setYearBlockStart] = React.useState(() => yearBlockStartFor(viewYear))

  // 已选值变化时（如外部重置），同步视图年份
  React.useEffect(() => {
    if (parsed)
      setViewYear(parsed.year())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const resolvedMaxYear = maxYear ?? now.year() + 10
  const selectedYear = parsed?.year() ?? null
  const selectedMonth = parsed?.month() ?? null // 0-11

  const isMonthDisabled = (monthIndex: number) => {
    if (!disableFuture)
      return false
    // 禁止晚于当前月的年月
    return dayjs(new Date(viewYear, monthIndex, 1)).isAfter(now, 'month')
  }

  const isYearDisabled = (year: number) => {
    if (year < minYear || year > resolvedMaxYear)
      return true
    // 未来年份整年不可选（当前年仍可选，其月份由 isMonthDisabled 控制）
    return disableFuture && year > now.year()
  }

  const handleSelectMonth = (monthIndex: number) => {
    if (isMonthDisabled(monthIndex))
      return
    onChange(dayjs(new Date(viewYear, monthIndex, 1)).format('YYYY-MM'))
  }

  const openYearPanel = () => {
    setYearBlockStart(yearBlockStartFor(viewYear))
    setView('year')
  }

  const handleSelectYear = (year: number) => {
    if (isYearDisabled(year))
      return
    setViewYear(year)
    setView('month')
  }

  // 月份视图翻年 / 年份视图翻页 的可用性
  const canStepPrev = view === 'month'
    ? viewYear > minYear
    : yearBlockStart > minYear
  const canStepNext = view === 'month'
    ? viewYear < resolvedMaxYear
    : yearBlockStart + YEARS_PER_PAGE <= resolvedMaxYear

  const handlePrev = () => {
    if (view === 'month')
      setViewYear(y => Math.max(minYear, y - 1))
    else
      setYearBlockStart(s => s - YEARS_PER_PAGE)
  }

  const handleNext = () => {
    if (view === 'month')
      setViewYear(y => Math.min(resolvedMaxYear, y + 1))
    else
      setYearBlockStart(s => s + YEARS_PER_PAGE)
  }

  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearBlockStart + i)

  return (
    <div className={cn('w-64 p-3', className)} data-slot="month-picker">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={view === 'month' ? '上一年' : '上一页'}
          disabled={!canStepPrev}
          onClick={handlePrev}
        >
          <ChevronLeft className="size-4" />
        </Button>

        {view === 'month'
          ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-sm font-medium tabular-nums"
                aria-label="选择年份"
                onClick={openYearPanel}
              >
                {viewYear}
                年
              </Button>
            )
          : (
              <span className="text-sm font-medium tabular-nums">
                {`${yearBlockStart} - ${yearBlockStart + YEARS_PER_PAGE - 1}`}
              </span>
            )}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={view === 'month' ? '下一年' : '下一页'}
          disabled={!canStepNext}
          onClick={handleNext}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {view === 'month'
        ? (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_LABELS.map((label, index) => {
                const isSelected = selectedYear === viewYear && selectedMonth === index
                const disabled = isMonthDisabled(index)
                return (
                  <Button
                    key={label}
                    type="button"
                    variant={isSelected ? 'default' : 'ghost'}
                    size="sm"
                    aria-label={`${viewYear}年${label}`}
                    aria-pressed={isSelected}
                    disabled={disabled}
                    onClick={() => handleSelectMonth(index)}
                    className="h-9"
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          )
        : (
            <div className="grid grid-cols-3 gap-1.5">
              {years.map((year) => {
                const isSelected = selectedYear === year
                const isCurrent = year === viewYear
                const disabled = isYearDisabled(year)
                return (
                  <Button
                    key={year}
                    type="button"
                    variant={isSelected ? 'default' : isCurrent ? 'secondary' : 'ghost'}
                    size="sm"
                    aria-label={`${year}年`}
                    aria-pressed={isSelected}
                    disabled={disabled}
                    onClick={() => handleSelectYear(year)}
                    className="h-9 tabular-nums"
                  >
                    {year}
                  </Button>
                )
              })}
            </div>
          )}
    </div>
  )
}
