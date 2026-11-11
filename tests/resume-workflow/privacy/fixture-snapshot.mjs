export const originalPhone = '13800138000'

export const originalEmail = 'synthetic-contact@example.com'

export function fixtureSnapshot(binding) {
  return {
    type: 'default',
    templateBinding: binding,
    basics: {
      name: '合成分享姓名',
      photo: null,
      gender: '不填',
      birthMonth: '',
      phone: originalPhone,
      email: originalEmail,
      workYears: '3-5年',
      maritalStatus: '不填',
      heightCm: 0,
      weightKg: 0,
      nation: '',
      nativePlace: '',
      politicalStatus: '不填',
      customFields: [],
    },
    job_intent: {
      jobIntent: '前端工程师',
      intentionalCity: '上海',
      expectedSalary: 0,
      dateEntry: '不填',
    },
    application_info: { applicationSchool: '', applicationMajor: '' },
    edu_background: { items: [] },
    work_experience: {
      items: [
        {
          entryId: 'synthetic-work',
          hidden: false,
          companyName: '合成示例公司',
          position: '前端工程师',
          workDuration: ['2024-01', '2026-01'],
          workInfo: '<p>维护业务页面与组件，支持日常需求交付。</p>',
        },
      ],
    },
    internship_experience: { items: [] },
    campus_experience: { items: [] },
    project_experience: { items: [] },
    skill_specialty: { description: '', skills: [] },
    honors_certificates: { description: '', certificates: [] },
    self_evaluation: {
      content: `<p>合成联系方式重复检查：${originalPhone} / ${originalEmail}</p><p><a href="mailto:${originalEmail}">联系邮箱</a> / <a href="tel:${originalPhone}">联系电话</a></p>`,
    },
    hobbies: { description: '', hobbies: [] },
    order: ['basics', 'job_intent', 'work_experience', 'self_evaluation'],
    visibility: {
      job_intent: false,
      application_info: true,
      edu_background: true,
      work_experience: false,
      internship_experience: true,
      campus_experience: true,
      project_experience: true,
      skill_specialty: true,
      honors_certificates: true,
      self_evaluation: false,
      hobbies: true,
    },
    spacing: { lineHeight: 1.6, pageMargin: 16, sectionSpacing: 20 },
    font: { fontSize: 14, fontFamily: 'system' },
    theme: { theme: 'default' },
  }
}
