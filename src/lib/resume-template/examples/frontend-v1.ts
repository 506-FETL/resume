import type { ResumeExample } from '../source/types'
import { DEFAULT_BASICS, DEFAULT_ORDER, DEFAULT_VISIBILITY, normalizeResumeFormData } from '@/lib/schema'

export const frontendExampleV1: ResumeExample = {
  exampleId: 'frontend',
  version: 1,
  name: '前端工程师社招',
  projectionReferenceDate: '2026-10-21',
  content: {
    ...normalizeResumeFormData({
      basics: { ...DEFAULT_BASICS, name: '林知夏', phone: '13800000000', email: 'frontend@example.com', nativePlace: '上海', workYears: '3-5年' },
      job_intent: { jobIntent: '前端开发工程师', intentionalCity: '上海 / 杭州', expectedSalary: 25, dateEntry: '1个月内' },
      edu_background: { items: [{ entryId: 'frontend-education-1', schoolName: '明川大学（示例）', professional: '软件工程', degree: '本科', duration: ['2017-09', '2021-06'], eduInfo: '<p>主修软件工程、数据结构、计算机网络和数据库，毕业设计为团队任务管理系统。</p>' }] },
      work_experience: { items: [
        { entryId: 'frontend-work-1', companyName: '青禾信息科技（示例）', position: '前端开发工程师', workDuration: ['2023-03', '至今'], workInfo: '<ul><li>负责企业协同产品的前端开发，使用 React、TypeScript 与组件库交付核心业务页面。</li><li>梳理复杂表单的状态边界，统一请求与错误处理，降低重复实现和维护成本。</li><li>优化首屏资源加载与长列表渲染，通过性能指标和实际回访验证改进效果。</li><li>参与需求评审、代码审查及发布验收，维护开发文档并支持新成员入职。</li></ul>' },
        { entryId: 'frontend-work-2', companyName: '映山数字科技（示例）', position: '前端开发工程师', workDuration: ['2021-07', '2023-02'], workInfo: '<ul><li>开发运营管理后台与移动端活动页面，完成权限展示、数据报表和表单流程。</li><li>抽取通用列表、筛选器与弹窗组件，与设计团队保持视觉和交互一致。</li><li>维护项目构建配置，参与线上问题排查与回归验证。</li></ul>' },
      ] },
      project_experience: { items: [{ entryId: 'frontend-project-1', projectName: '团队协作管理平台', participantRole: '前端核心开发', projectDuration: ['2024-02', '2024-10'], projectInfo: '<ul><li>实现任务列表、详情编辑与成员协作，建立页面状态和服务端数据的清晰边界。</li><li>针对重复提交、请求乱序和网络失败设计恢复机制，保持编辑内容稳定。</li><li>沉淀可复用组件与排查文档，为迭代和跨团队接入提供支持。</li></ul>' }] },
      skill_specialty: { description: '<p>熟悉现代前端工程体系，关注可访问性、性能及复杂状态管理。能够独立推进需求拆解、开发联调和上线验收。</p>', skills: [{ entryId: 'frontend-skill-1', label: 'React / TypeScript', proficiencyLevel: '精通', displayType: 'text' }, { entryId: 'frontend-skill-2', label: '浏览器性能优化', proficiencyLevel: '熟练', displayType: 'text' }, { entryId: 'frontend-skill-3', label: '工程化与组件设计', proficiencyLevel: '熟练', displayType: 'text' }] },
      honors_certificates: { description: '', certificates: [{ entryId: 'frontend-honor-1', name: '大学英语六级' }] },
      self_evaluation: { content: '<p>注重业务理解与技术方案的可维护性，善于通过清晰的沟通和小步验证推进复杂需求。对问题保持追踪，重视协作与稳定交付。</p>' },
      hobbies: { description: '', hobbies: [{ entryId: 'frontend-hobby-1', name: '摄影' }] },
    }),
    order: [...DEFAULT_ORDER],
    visibility: { ...DEFAULT_VISIBILITY, application_info: true, internship_experience: true, campus_experience: true, hobbies: true },
  },
}
