import type { Issue } from './types'

export const MOCK_ISSUES: Issue[] = [
  {
    id: '1',
    severity: 'critical',
    category: 'Contact Info',
    title: '联系方式缺少可识别的邮箱格式',
    description: '简历中未检测到有效的电子邮件地址。',
    impact: 'ATS 无法解析您的联系方式，招聘人员将无法联系您。',
  },
  {
    id: '2',
    severity: 'warning',
    category: 'Experience',
    title: '项目经历缺乏量化指标',
    description: '项目描述主要由定性陈述组成，缺少具体的数字或结果。',
    impact: 'ATS 算法倾向于通过数字（如 %、增长额）来评估候选人的影响力。',
  },
  {
    id: '3',
    severity: 'warning',
    category: 'Formatting',
    title: '检测到不一致的项目符号格式',
    description: '使用了多种不同的项目符号样式。',
    impact: '可能导致解析混乱，降低可读性分数。',
  },
  {
    id: '4',
    severity: 'info',
    category: 'Keywords',
    title: '关键词密度低于建议阈值',
    description: '针对目标职位的关键词覆盖率仅为 45%。',
    impact: '可能会降低在特定职位搜索中的排名。',
  },
  {
    id: '5',
    severity: 'critical',
    category: 'Structure',
    title: '过度使用表格',
    description: '检测到复杂的嵌套表格布局。',
    impact: '许多旧版 ATS 无法读取表格内的内容，导致信息丢失。',
  },
]

export const SCORE_LABELS = {
  job_match: '职位匹配度',
  ats_parsing: 'ATS 解析度',
  format_readability: '格式可读性',
  content_completeness: '内容完整度',
  impact_quantification: '影响力量化',
}
