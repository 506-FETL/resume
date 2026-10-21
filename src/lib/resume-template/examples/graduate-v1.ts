import type { ResumeExample } from '../source/types'
import { DEFAULT_BASICS, DEFAULT_ORDER, DEFAULT_VISIBILITY, normalizeResumeFormData } from '@/lib/schema'

export const graduateExampleV1: ResumeExample = {
  exampleId: 'graduate',
  version: 1,
  name: '应届求职',
  projectionReferenceDate: '2026-10-21',
  content: {
    ...normalizeResumeFormData({
      basics: { ...DEFAULT_BASICS, name: '陈知远', phone: '13800000000', email: 'graduate@example.com', nativePlace: '杭州', workYears: '应届' },
      job_intent: { jobIntent: '前端开发工程师', intentionalCity: '杭州 / 上海', expectedSalary: 12, dateEntry: '随时到岗' },
      edu_background: { items: [{ entryId: 'graduate-education-1', schoolName: '明川大学（示例）', professional: '计算机科学与技术', degree: '本科', duration: ['2022-09', '2026-06'], eduInfo: '<p>GPA 3.7/4.0，专业排名前 10%。主修数据结构、计算机网络、软件工程与数据库。</p><p>获得校级奖学金，参与校园信息系统的设计与开发。</p>' }] },
      internship_experience: { items: [{ entryId: 'graduate-internship-1', companyName: '青禾信息科技（示例）', position: '前端开发实习生', internshipDuration: ['2025-07', '2025-12'], internshipInfo: '<ul><li>参与内部管理系统开发，使用 React 和 TypeScript 完成列表筛选、表单校验与详情页面。</li><li>与设计和后端同学对齐接口及交互，修复移动端布局问题，整理通用表单组件。</li><li>为核心操作补充错误提示和加载反馈，协助完成上线前的功能验收。</li></ul>' }] },
      project_experience: { items: [{ entryId: 'graduate-project-1', projectName: '校园活动报名平台', participantRole: '前端负责人', projectDuration: ['2025-03', '2025-06'], projectInfo: '<ul><li>完成活动列表、报名表单和个人报名记录，设计页面路由与状态管理。</li><li>通过请求缓存和分页加载减少重复请求，优化弱网情况下的使用体验。</li><li>与两名同学协作完成接口联调、测试和项目文档，形成可复用的开发约定。</li></ul>' }] },
      campus_experience: { items: [{ entryId: 'graduate-campus-1', experienceName: '计算机协会', role: '技术组成员', duration: ['2023-09', '2025-06'], campusInfo: '<ul><li>组织前端学习交流与代码分享，协助新成员完成入门项目。</li><li>参与维护社团网站，负责活动信息发布与页面适配。</li></ul>' }] },
      skill_specialty: { description: '<p>掌握 HTML、CSS、JavaScript 基础，熟悉组件开发、接口联调与 Git 协作。</p>', skills: [{ entryId: 'graduate-skill-1', label: 'React / TypeScript', proficiencyLevel: '熟练', displayType: 'text' }, { entryId: 'graduate-skill-2', label: 'Git', proficiencyLevel: '良好', displayType: 'text' }] },
      honors_certificates: { description: '', certificates: [{ entryId: 'graduate-honor-1', name: '大学英语六级' }, { entryId: 'graduate-honor-2', name: '校级奖学金' }] },
      self_evaluation: { content: '<p>重视代码可读性与用户体验，能够主动拆解问题、沟通进度并持续迭代。希望在实际产品中积累工程经验，与团队共同完成可靠的交付。</p>' },
      hobbies: { description: '', hobbies: [{ entryId: 'graduate-hobby-1', name: '阅读' }, { entryId: 'graduate-hobby-2', name: '跑步' }] },
    }),
    order: [...DEFAULT_ORDER],
    visibility: { ...DEFAULT_VISIBILITY, application_info: true, work_experience: true, hobbies: true },
  },
}
