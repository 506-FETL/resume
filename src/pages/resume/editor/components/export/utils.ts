import type { ResumeCheckIssue } from '@/lib/resume-checks/types'

export const CHECK_KIND_LABELS: Record<ResumeCheckIssue['kind'], string> = {
  missing: '信息缺失',
  contact: '联系方式',
  date: '日期',
  term: '技术名称',
  spelling: '文字',
  example: '示例残留',
  layout: '排版',
}

export function getCheckCategories(issues: ResumeCheckIssue[]) {
  return [
    ...new Set(issues.map((issue) => CHECK_KIND_LABELS[issue.kind])),
  ].join('、')
}
