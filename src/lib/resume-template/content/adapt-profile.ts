import type { CommentNodes, ProfileContent } from './types'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { resumePhotoSchema } from '@/lib/schema/resume/form/photo'
import { contentField } from './types'

export function adaptProfile(data: TemplateResumeData, nodes: CommentNodes): ProfileContent | null {
  if (!data.order.includes('basics'))
    return null

  const fields = (section: 'basics' | 'job_intent', entries: Array<[string, string]>) => entries
    .map(([key, label]) => contentField(nodes, section, 'singleton', key, label))
    .filter(field => nodes.has(field.nodeKey) && field.text.trim())

  // 远端快照与直接预览也经过同一格式检查，不能以任意 URL 冒充照片。
  const photo = data.basics.photo ? resumePhotoSchema.parse(data.basics.photo) : null
  const customFields = fields('basics', data.basics.customFields.map((field, index) => [`customFields.${index}`, field?.label.trim() ?? '']))
    .map(field => ({ ...field, labelRequired: true }))
  const profile = {
    photo,
    name: fields('basics', [['name', '姓名']])[0],
    workYears: fields('basics', [['workYears', '工作年限']])[0],
    jobIntent: data.getVisibility('job_intent')
      ? fields('job_intent', [['jobIntent', '求职意向'], ['intentionalCity', '意向城市'], ['expectedSalary', '期望薪资'], ['dateEntry', '到岗时间']])
      : [],
    meta: [...fields('basics', [
      ['age', '年龄'],
      ['gender', '性别'],
      ['nation', '民族'],
      ['height', '身高'],
      ['weight', '体重'],
      ['nativePlace', '籍贯'],
      ['maritalStatus', '婚姻状况'],
      ['politicalStatus', '政治面貌'],
    ]), ...customFields],
    contact: fields('basics', [['phone', '手机号'], ['email', '邮箱']]),
  }
  const allFields = [profile.name, profile.workYears, ...profile.jobIntent, ...profile.meta, ...profile.contact].filter((field): field is NonNullable<typeof field> => Boolean(field?.text.trim()))
  return allFields.length || photo ? { ...profile, fields: [...new Map(allFields.map(field => [field.nodeKey, field])).values()] } : null
}
