import type { TemplateResumeDataInput } from '@/components/resume/runtime/context/resume-data-context'
import {
  DEFAULT_APPLICATION_INFO,
  DEFAULT_CAMPUS_EXPERIENCE,
  DEFAULT_EDU_BACKGROUND,
  DEFAULT_HOBBIES,
  DEFAULT_HONORS_CERTIFICATES,
  DEFAULT_INTERNSHIP_EXPERIENCE,
  DEFAULT_JOB_INTENT,
  DEFAULT_ORDER,
  DEFAULT_PROJECT_EXPERIENCE,
  DEFAULT_SELF_EVALUATION,
  DEFAULT_SKILL_SPECIALTY,
  DEFAULT_VISIBILITY,
  DEFAULT_WORK_EXPERIENCE,
} from '@/lib/schema'

export const demoResumeData: TemplateResumeDataInput = {
  basics: {
    name: '林知夏',
    gender: '不填',
    birthMonth: '',
    phone: '13800000000',
    email: 'linzhixia@example.com',
    workYears: '3-5年',
    maritalStatus: '不填',
    heightCm: 0,
    weightKg: 0,
    nation: '',
    nativePlace: '上海',
    politicalStatus: '群众',
    customFields: [
      {
        label: '求职方向',
        value: '产品设计 / 体验设计',
      },
    ],
  },
  job_intent: {
    ...DEFAULT_JOB_INTENT,
    jobIntent: '高级产品设计师',
    intentionalCity: '上海 / 杭州',
    expectedSalary: 35,
    dateEntry: '1个月内',
  },
  application_info: {
    ...DEFAULT_APPLICATION_INFO,
    applicationSchool: '同济大学',
    applicationMajor: '交互设计',
  },
  edu_background: {
    ...DEFAULT_EDU_BACKGROUND,
    items: [
      {
        entryId: 'demo_edu_background_1',
        schoolName: '华东理工大学',
        professional: '数字媒体设计',
        degree: '本科',
        duration: ['2016-09', '2020-06'],
        eduInfo: '主修交互设计、视觉传达与信息架构，连续两年获学院奖学金。',
      },
    ],
  },
  work_experience: {
    ...DEFAULT_WORK_EXPERIENCE,
    items: [
      {
        entryId: 'demo_work_experience_1',
        companyName: '半径科技',
        position: '产品设计师',
        workDuration: ['2022-03', '至今'],
        workInfo: '<ul><li>负责招聘与人才协同产品的体验设计，主导信息架构重构和关键流程优化。</li><li>牵头搭建模板系统与流程看板的视觉规范，推动核心转化率提升。</li><li>与前端和后端协作推进复杂配置型界面落地，沉淀可复用组件资产。</li></ul>',
      },
      {
        entryId: 'demo_work_experience_2',
        companyName: '光栅互动',
        position: '高级 UI 设计师',
        workDuration: ['2020-07', '2022-02'],
        workInfo: '<ul><li>负责 B 端管理系统和营销活动页面设计，建立跨端组件库。</li><li>优化表单、列表和配置流程，降低新用户上手成本并提升交付效率。</li></ul>',
      },
    ],
  },
  internship_experience: {
    ...DEFAULT_INTERNSHIP_EXPERIENCE,
    items: [
      {
        entryId: 'demo_internship_experience_1',
        companyName: '像素工场',
        position: '体验设计实习生',
        internshipDuration: ['2021-07', '2021-12'],
        internshipInfo: '<ul><li>参与校园招聘官网与职位投递流程优化，完成高保真设计与设计走查。</li><li>配合研究同学梳理候选人投递旅程，输出体验改进建议。</li></ul>',
      },
    ],
  },
  campus_experience: {
    ...DEFAULT_CAMPUS_EXPERIENCE,
    items: [
      {
        entryId: 'demo_campus_experience_1',
        experienceName: '设计学院学生会',
        role: '视觉负责人',
        duration: ['2018-09', '2020-06'],
        campusInfo: '<ul><li>负责活动主视觉与信息设计，组织跨团队协作并维护宣传物料规范。</li><li>统筹招新活动、作品展和校内宣发，管理多渠道物料输出。</li></ul>',
      },
    ],
  },
  project_experience: {
    ...DEFAULT_PROJECT_EXPERIENCE,
    items: [
      {
        entryId: 'demo_project_experience_1',
        projectName: '求职看板与简历工作台',
        participantRole: '产品设计 / 前端协作',
        projectDuration: ['2024-05', '2024-11'],
        projectInfo: '<ul><li>负责模板系统、求职流程看板与 AI 辅助优化模块的交互方案设计。</li><li>设计模板 manifest、运行时渲染链路和可视化编辑器结构。</li></ul>',
      },
      {
        entryId: 'demo_project_experience_2',
        projectName: '企业招聘官网改版',
        participantRole: '体验设计负责人',
        projectDuration: ['2023-02', '2023-08'],
        projectInfo: '<ul><li>重构职位搜索、企业展示和投递流程，提高岗位浏览与投递完成率。</li><li>建立响应式设计规范并输出设计交付模板。</li></ul>',
      },
    ],
  },
  skill_specialty: {
    ...DEFAULT_SKILL_SPECIALTY,
    description: '熟悉复杂信息界面设计与组件化协作。',
    skills: [
      { entryId: 'demo_skill_1', label: 'Figma', proficiencyLevel: '精通', displayType: 'percentage' },
      { entryId: 'demo_skill_2', label: '设计系统', proficiencyLevel: '擅长', displayType: 'percentage' },
      { entryId: 'demo_skill_3', label: '前端协作', proficiencyLevel: '熟练', displayType: 'percentage' },
    ],
  },
  honors_certificates: {
    ...DEFAULT_HONORS_CERTIFICATES,
    description: '连续两年获得学院奖学金，并持有常用职业技能证书。',
    certificates: [
      { entryId: 'demo_certificate_1', name: '英语六级' },
      { entryId: 'demo_certificate_2', name: '计算机二级' },
      { entryId: 'demo_certificate_3', name: '学院一等奖学金' },
    ],
  },
  self_evaluation: {
    ...DEFAULT_SELF_EVALUATION,
    content: '擅长在复杂业务中抽象信息结构、建立视觉规则，并推动设计方案稳定落地。对模板系统、表单配置和信息密度较高的后台界面有持续实践。',
  },
  hobbies: {
    ...DEFAULT_HOBBIES,
    description: '关注展览与城市观察，习惯通过摄影和写作积累设计灵感。',
    hobbies: [
      { entryId: 'demo_hobby_1', name: '摄影' },
      { entryId: 'demo_hobby_2', name: '旅行' },
      { entryId: 'demo_hobby_3', name: '跑步' },
    ],
  },
  order: DEFAULT_ORDER,
  type: 'default',
  visibility: {
    ...DEFAULT_VISIBILITY,
    application_info: false,
  },
}
