import type { CommentNodes, ProfileContent } from './types'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { contentField } from './types'

export function adaptProfile(data: TemplateResumeData, nodes: CommentNodes): ProfileContent | null {
  if (!data.order.includes('basics'))
    return null
  const fields = (section: 'basics' | 'job_intent', entries: Array<[string, string]>) => entries
    .map(([key, label]) => contentField(nodes, section, 'singleton', key, label))
    .filter(field => nodes.has(field.nodeKey))
  return {
    name: contentField(nodes, 'basics', 'singleton', 'name', '姓名'),
    workYears: fields('basics', [['workYears', '工作年限']])[0],
    jobIntent: data.getVisibility('job_intent')
      ? fields('job_intent', [['jobIntent', '求职意向'], ['intentionalCity', '意向城市'], ['expectedSalary', '期望薪资'], ['dateEntry', '到岗时间']])
      : [],
    meta: fields('basics', [['age', '年龄'], ['gender', '性别'], ['nation', '民族'], ['height', '身高'], ['weight', '体重'], ['nativePlace', '籍贯']]),
    contact: fields('basics', [['phone', '手机号'], ['email', '邮箱']]),
  }
}
