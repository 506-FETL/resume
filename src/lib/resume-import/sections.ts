import type { ResumeSchema } from '../schema/resume'

export type Section = Exclude<keyof ResumeSchema, 'application_info'>

const headings: [Section, RegExp][] = [
  [
    'basics',
    /^(基本信息|个人信息|联系方式|基本资料|个人资料|contact|personal information)$/i,
  ],
  [
    'job_intent',
    /^(求职意向|求职目标|意向岗位|职业目标|job objective|objective)$/i,
  ],
  ['edu_background', /^(教育背景|教育经历|学习经历|education)$/i],
  [
    'work_experience',
    /^(工作经历|工作经验|职业经历|工作履历|职业履历|work experience|professional experience|employment|experience)$/i,
  ],
  ['internship_experience', /^(实习经历|实习经验|internships?)$/i],
  ['project_experience', /^(项目经历|项目经验|项目实践|projects?)$/i],
  ['campus_experience', /^(校园经历|校园实践|在校经历|社团经历|学生工作)$/],
  [
    'skill_specialty',
    /^(技能特长|专业技能|个人技能|技术技能|技能清单|技能与工程实践|技术能力|核心技能|技能|skills|technical skills)$/i,
  ],
  [
    'honors_certificates',
    /^(荣誉证书|荣誉奖励|获奖经历|荣誉|证书|certificates|awards)$/i,
  ],
  [
    'self_evaluation',
    /^(自我评价|个人总结|个人优势|自我介绍|summary|profile)$/i,
  ],
  ['hobbies', /^(兴趣爱好|爱好|hobbies|interests)$/i],
]

export function readSectionHeading(line: string) {
  const separator = line.search(/[:：]/)
  const label = separator >= 0 ? line.slice(0, separator) : line

  const title = label
    .normalize('NFKC')
    .replace(/^[#【[\s]+|[】\]:：\s]+$/g, '')
    .replace(/(?<=[\u3400-\u9fff]) (?=[\u3400-\u9fff])/g, '')
    .trim()

  const continuation = /\s*\((?:续|续页|continued)\)$/i.test(title)
  const bareTitle = title.replace(/\s*\((?:续|续页|continued)\)$/i, '')
  const heading = headings.find(([, pattern]) => pattern.test(bareTitle))

  return heading
    ? {
        section: heading[0],
        continuation,
        inlineText: separator >= 0 ? line.slice(separator + 1).trim() : '',
      }
    : null
}
