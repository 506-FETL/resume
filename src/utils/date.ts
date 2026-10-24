import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

// 加载插件和语言包
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/**
 * 格式化相对时间
 * @param dateString - 日期字符串或Date对象
 * @param includeTime - 是否在超过7天时包含时分信息，默认 false
 * @returns 格式化后的相对时间字符串 (如: "刚刚", "5分钟前", "3小时前", "2天前", "2023年1月1日")
 */
export function formatRelativeTime(
  dateString: string | Date | number | null | undefined,
  includeTime = false,
): string {
  if (!dateString) return '未知'

  const date = dayjs(dateString)
  const now = dayjs()

  if (!date.isValid()) return '无效日期'

  const diffInMinutes = now.diff(date, 'minute')
  const diffInHours = now.diff(date, 'hour')
  const diffInDays = now.diff(date, 'day')

  if (diffInMinutes < 1) {
    return '刚刚'
  }

  if (diffInMinutes < 60) {
    return `${diffInMinutes} 分钟前`
  }

  if (diffInHours < 24) {
    return `${diffInHours} 小时前`
  }

  if (diffInDays < 7) {
    return `${diffInDays} 天前`
  }

  if (!includeTime) {
    if (diffInDays < 30) {
      return `${Math.floor(diffInDays / 7)} 周前`
    }
    return date.format('YYYY年M月D日')
  }

  return date.format('YYYY年M月D日 HH:mm')
}

/**
 * 格式化日期
 * @param dateString - 日期字符串或Date对象
 * @param template - 格式化模板，默认为 'YYYY年M月D日'
 * @returns 格式化后的日期字符串
 */
export function formatDate(
  dateString: string | Date | number | null | undefined,
  template: string = 'YYYY年M月D日',
): string {
  if (!dateString) return '未知'
  const date = dayjs(dateString)
  return date.isValid() ? date.format(template) : '无效日期'
}

/**
 * 格式化时间 (包含时分)
 * @param dateString - 日期字符串或Date对象
 * @returns 格式化后的时间字符串 (如: "2023年1月1日 12:30")
 */
export function formatDateTime(dateString: string | Date | number): string {
  if (!dateString) return '未知'
  const date = dayjs(dateString)
  return date.isValid() ? date.format('YYYY年M月D日 HH:mm') : '无效日期'
}

/**
 * 格式化时间 (仅时分秒)
 * @param dateString - 日期字符串或Date对象
 * @returns 格式化后的时间字符串 (如: "12:30:45")
 */
export function formatTime(
  dateString: string | Date | number | null | undefined,
): string {
  if (!dateString) return '未知'
  const date = dayjs(dateString)
  return date.isValid() ? date.format('HH:mm:ss') : '无效日期'
}

/**
 * 计算年龄
 * @param birthDateString - 出生日期字符串
 * @returns 年龄数字，如果无效则返回空字符串
 */
export function getAge(
  birthDateString: string | Date | number | null | undefined,
): number | string {
  if (!birthDateString) return ''

  const birthDate = dayjs(birthDateString)
  if (!birthDate.isValid()) return ''

  return dayjs().diff(birthDate, 'year')
}

/**
 * 比较两个日期的时间戳差值 (dateA - dateB)
 * @param dateA
 * @param dateB
 * @returns 毫秒差值
 */
export function diffDates(
  dateA: string | Date | number,
  dateB: string | Date | number,
): number {
  return dayjs(dateA).diff(dayjs(dateB))
}

/**
 * 获取当前时间戳
 */
export function getTimestamp(): number {
  return dayjs().valueOf()
}
