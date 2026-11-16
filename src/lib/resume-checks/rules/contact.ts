import { resumeHtmlToText } from '@/lib/resume-import/text'
import type { CheckSnapshot, CheckTarget } from '../types'
import type { NewIssue } from './issue-types'

/** 国际号码只检查通用结构与长度，不套用中国大陆手机前缀。 */
export function plausiblePhone(raw: string): boolean {
  const value = raw.trim()
  const main = value.replace(/(?:\s*(?:转|分机|ext\.?|x|#)\s*\d{1,6})$/i, '')

  if (!/^(?:\+|00)?[\d\s().-]+$/.test(main)) return false
  if ((main.match(/\(/g)?.length ?? 0) !== (main.match(/\)/g)?.length ?? 0))
    return false

  const digits = main.replace(/\D/g, '').replace(/^00/, '')

  return digits.length >= 7 && digits.length <= 15 && !/^0+$/.test(digits)
}

export function basicTarget(
  snapshot: CheckSnapshot,
  path: string,
): CheckTarget {
  return {
    section: 'basics',
    path: `/${path}`,
    quote: resumeHtmlToText(
      String(snapshot.basics[path as keyof typeof snapshot.basics] ?? ''),
    ).trim(),
  }
}

export function checkContactFields(
  snapshot: CheckSnapshot,
  add: (issue: NewIssue) => void,
) {
  if (!snapshot.basics.name.trim()) {
    add({
      id: 'missing:name',
      section: 'basics',
      kind: 'missing',
      severity: 'error',
      title: '还没有填写姓名',
      detail: '填写用于求职的姓名。',
      targets: [basicTarget(snapshot, 'name')],
    })
  }

  if (!snapshot.basics.phone.trim() && !snapshot.basics.email.trim()) {
    add({
      id: 'missing:contact',
      section: 'basics',
      kind: 'missing',
      severity: 'error',
      title: '还没有填写联系方式',
      detail: '电话和邮箱至少填写一项。',
      targets: [basicTarget(snapshot, 'phone'), basicTarget(snapshot, 'email')],
    })
  }

  const email = snapshot.basics.email.trim()

  if (
    email &&
    (!/^[^\s@<>.]+(?:\.[^\s@<>.]+)*@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(email) ||
      /(^|\.)-|-(@|\.|$)/.test(email.slice(email.lastIndexOf('@') + 1)))
  ) {
    add({
      id: 'contact:email',
      section: 'basics',
      kind: 'contact',
      severity: 'error',
      title: '邮箱格式不完整',
      detail: '检查邮箱中的 @、域名和空格。',
      targets: [basicTarget(snapshot, 'email')],
    })
  }

  if (snapshot.basics.phone.trim() && !plausiblePhone(snapshot.basics.phone)) {
    add({
      id: 'contact:phone',
      section: 'basics',
      kind: 'contact',
      severity: 'warning',
      title: '请核对电话号码',
      detail: '号码的字符或长度不常见，请确认招聘方能够拨通。',
      targets: [basicTarget(snapshot, 'phone')],
    })
  }
}
