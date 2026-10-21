import type { CommentNodes, ContentBlock, ContentSection, ExperienceContent } from './types'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { ResumeSchema } from '@/lib/schema'
import { contentField } from './types'

interface ExperienceInput {
  entryId: string
  hidden?: boolean
  title: string
  subtitle: string
  range?: readonly (string | null | undefined)[] | null
  html: string
}

function experienceBlock(nodes: CommentNodes, section: keyof ResumeSchema, entries: ExperienceInput[], titleKey: string, titleLabel: string, subtitleKey: string, subtitleLabel: string, descriptionLabel: string): ContentBlock {
  const items: ExperienceContent[] = entries
    .filter(item => !item.hidden && (item.title || item.subtitle || item.html || item.range?.some(Boolean)))
    .map((item) => {
      const read = (key: string, label: string) => {
        const field = contentField(nodes, section, item.entryId, key, label)
        return nodes.has(field.nodeKey) ? field : undefined
      }
      const description = read('content', descriptionLabel)
      return {
        entryId: item.entryId,
        title: read(titleKey, titleLabel),
        subtitle: read(subtitleKey, subtitleLabel),
        duration: read('duration', '时间'),
        description: description && item.html ? { field: description, html: item.html } : undefined,
      }
    })
  return { kind: 'experience', items }
}

export function adaptSections(data: TemplateResumeData, nodes: CommentNodes): ContentSection[] {
  const richText = (section: keyof ResumeSchema, key: string, label: string, html: string): ContentBlock[] => html
    ? [{ kind: 'richText', field: contentField(nodes, section, 'singleton', key, label), html }]
    : []
  const sections: ContentSection[] = [
    {
      key: 'application_info',
      title: '申请信息',
      blocks: [{ kind: 'fieldList', items: [
        ...(data.application_info.applicationSchool ? [contentField(nodes, 'application_info', 'singleton', 'applicationSchool', '申请院校')] : []),
        ...(data.application_info.applicationMajor ? [contentField(nodes, 'application_info', 'singleton', 'applicationMajor', '申请专业')] : []),
      ] }],
    },
    {
      key: 'edu_background',
      title: '教育经历',
      blocks: [experienceBlock(nodes, 'edu_background', data.edu_background.items.map(i => ({ ...i, title: i.schoolName, subtitle: i.professional, range: i.duration, html: i.eduInfo })), 'schoolName', '学校名称', 'professionalDegree', '专业与学历', '教育经历描述')],
    },
    {
      key: 'work_experience',
      title: '工作经历',
      blocks: [experienceBlock(nodes, 'work_experience', data.work_experience.items.map(i => ({ ...i, title: i.companyName, subtitle: i.position, range: i.workDuration, html: i.workInfo })), 'companyName', '公司名称', 'position', '职位', '工作经历描述')],
    },
    {
      key: 'internship_experience',
      title: '实习经历',
      blocks: [experienceBlock(nodes, 'internship_experience', data.internship_experience.items.map(i => ({ ...i, title: i.companyName, subtitle: i.position, range: i.internshipDuration, html: i.internshipInfo })), 'companyName', '公司名称', 'position', '实习职位', '实习经历描述')],
    },
    {
      key: 'campus_experience',
      title: '校园经历',
      blocks: [experienceBlock(nodes, 'campus_experience', data.campus_experience.items.map(i => ({ ...i, title: i.experienceName, subtitle: i.role, range: i.duration, html: i.campusInfo })), 'experienceName', '经历名称', 'role', '担任角色', '校园经历描述')],
    },
    {
      key: 'project_experience',
      title: '项目经历',
      blocks: [experienceBlock(nodes, 'project_experience', data.project_experience.items.map(i => ({ ...i, title: i.projectName, subtitle: i.participantRole, range: i.projectDuration, html: i.projectInfo })), 'projectName', '项目名称', 'participantRole', '项目角色', '项目经历描述')],
    },
    {
      key: 'skill_specialty',
      title: '技能特长',
      blocks: [
        ...richText('skill_specialty', 'description', '技能描述', data.skill_specialty.description),
        { kind: 'skills', items: data.skill_specialty.skills.filter(i => !i.hidden).map(i => ({ field: contentField(nodes, 'skill_specialty', i.entryId, 'skill', '技能'), proficiencyLevel: i.proficiencyLevel, displayType: i.displayType })) },
      ],
    },
    {
      key: 'honors_certificates',
      title: '荣誉证书',
      blocks: [
        ...richText('honors_certificates', 'description', '荣誉证书描述', data.honors_certificates.description),
        { kind: 'tagList', items: data.honors_certificates.certificates.filter(i => !i.hidden).map(i => contentField(nodes, 'honors_certificates', i.entryId, 'name', '荣誉证书')) },
      ],
    },
    { key: 'self_evaluation', title: '自我评价', blocks: richText('self_evaluation', 'content', '自我评价', data.self_evaluation.content) },
    {
      key: 'hobbies',
      title: '兴趣爱好',
      blocks: [
        ...richText('hobbies', 'description', '兴趣爱好描述', data.hobbies.description),
        { kind: 'tagList', items: data.hobbies.hobbies.filter(i => !i.hidden).map(i => contentField(nodes, 'hobbies', i.entryId, 'name', '兴趣爱好')) },
      ],
    },
  ]
  const byKey = new Map(sections.map(section => [section.key, section]))
  return data.order.flatMap((key) => {
    const section = byKey.get(key)
    return section && key !== 'basics' && data.getVisibility(key) ? [section] : []
  })
}
