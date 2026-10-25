import type { ResumeSchema } from '../schema/resume'
import type { ResumeParseResult } from './types'
import { DEFAULT_BASICS, DEFAULT_JOB_INTENT } from '../schema/resume/form'
import { MAX_RESUME_TEXT_LENGTH } from './const'
import { textToResumeHtml } from './text'
import { ResumeImportError } from './types'

export function createBlankResume(): ResumeSchema {
  return {
    basics: { ...DEFAULT_BASICS, name: '', customFields: [] },
    job_intent: { ...DEFAULT_JOB_INTENT },
    application_info: { applicationSchool: '', applicationMajor: '' },
    edu_background: { items: [] },
    work_experience: { items: [] },
    internship_experience: { items: [] },
    campus_experience: { items: [] },
    project_experience: { items: [] },
    skill_specialty: { description: '', skills: [] },
    honors_certificates: { description: '', certificates: [] },
    self_evaluation: { content: '' },
    hobbies: { description: '', hobbies: [] },
  }
}

type Section = Exclude<keyof ResumeSchema, 'application_info'>

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
    /^(工作经历|工作经验|职业经历|work experience|employment)$/i,
  ],
  ['internship_experience', /^(实习经历|实习经验|internships?)$/i],
  ['project_experience', /^(项目经历|项目经验|项目实践|projects?)$/i],
  ['campus_experience', /^(校园经历|校园实践|在校经历|社团经历|学生工作)$/],
  ['skill_specialty', /^(技能特长|专业技能|个人技能|技能|skills)$/i],
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

const dateToken =
  '(?:19|20)\\d{2}(?:(?:[年./-])(?:1[0-2]|0?[1-9])(?!\\d)月?|年)?(?![\\d./])'

const presentToken = '(?:至今|现在|present\\b|current\\b)'

const dateRange = new RegExp(
  `(${dateToken})\\s*(?:(?:至|到|[-—–~～])\\s*|(?=${presentToken}))(${dateToken}|${presentToken})`,
  'i',
)

function experienceTitle(line: string): string {
  return line.replace(dateRange, '').replace(/^[\s|｜·,，]+|[\s|｜·,，]+$/g, '')
}

function isExperienceHeader(
  lines: string[],
  index: number,
  section: Section,
): boolean {
  const line = lines[index]
  const title = experienceTitle(line)

  if (
    !title ||
    title.length > 160 ||
    /(?:19|20)\d{2}[年./-]/.test(title) ||
    /^(?:[•●*]|负责|参与|完成|协助|推动|开发|维护|管理|主导|通过|实现|技术栈|项目职责|工作职责|职责|成果说明|工作成果|项目成果|项目描述|工作内容|项目内容|主要成果|主要工作)/.test(
      title,
    )
  )
    return false

  if (section === 'edu_background') return /(?:大学|学院|学校|中学)/.test(title)
  if (section === 'work_experience' || section === 'internship_experience') {
    if (
      /[:：]/.test(title) &&
      !/^(?:公司名称|公司|单位名称|单位|company)[:：]/i.test(title)
    )
      return false

    return (
      /^(?:公司(?:名称)?[:：]\s*)?[^|｜\t]+?(?:公司|研究院|事务所|集团|银行|医院)(?=$|[\s|｜\t])/.test(
        title,
      ) || /^(?:公司名称|公司|单位名称|单位|company)[:：]\s*\S/i.test(title)
    )
  }

  return (
    /^(?:项目名称|项目名|活动名称|社团名称)[:：]/.test(title) ||
    (dateRange.test(line) && title.length <= 60)
  )
}

function normalizeDate(value: string): string {
  if (/^(至今|现在|present|current)$/i.test(value)) return '至今'

  const parts = value.match(/\d+/g) ?? []

  return parts.length > 1 ? `${parts[0]}-${parts[1].padStart(2, '0')}` : value
}

function parseExperience(
  content: ResumeSchema,
  section: Section,
  lines: string[],
  unknown: string[],
) {
  const headerIndexes = Array.from(lines.keys()).filter((index) =>
    isExperienceHeader(lines, index, section),
  )

  if (!headerIndexes.length) {
    unknown.push(...lines)

    return
  }

  const isDateOnly = (index: number) =>
    Boolean(
      lines[index] &&
      dateRange.test(lines[index]) &&
      !experienceTitle(lines[index]),
    )

  const datesLead = isDateOnly(headerIndexes[0] - 1)
  const claimedDates = new Set<number>()

  // 标题只识别一次；独立日期只归属一个标题，切片后不再重新猜标题。
  const anchors = headerIndexes.map((headerIndex) => {
    const inlineRange = lines[headerIndex].match(dateRange)

    const candidates = datesLead
      ? [headerIndex - 1, headerIndex + 1]
      : [headerIndex + 1, headerIndex - 1]

    const dateIndex = inlineRange
      ? undefined
      : candidates.find(
          (index) => isDateOnly(index) && !claimedDates.has(index),
        )

    if (dateIndex !== undefined) claimedDates.add(dateIndex)

    return {
      headerIndex,
      start:
        dateIndex !== undefined && dateIndex < headerIndex
          ? dateIndex
          : headerIndex,
      range:
        inlineRange ??
        (dateIndex !== undefined ? lines[dateIndex].match(dateRange) : null),
    }
  })

  unknown.push(...lines.slice(0, anchors[0].start))

  for (const [index, anchor] of anchors.entries()) {
    const group = lines.slice(anchor.start, anchors[index + 1]?.start)
    const headerIndex = anchor.headerIndex - anchor.start
    const header = group[headerIndex]
    const range = anchor.range

    if (
      headerIndex < 0 ||
      !header ||
      !isExperienceHeader([header], 0, section)
    ) {
      unknown.push(...group)

      continue
    }

    const duration = range
      ? [normalizeDate(range[1]), normalizeDate(range[2])]
      : ['', '']

    const title = header
      .replace(dateRange, '')
      .replace(/^[\s|｜·,，]+|[\s|｜·,，]+$/g, '')

    const parts = title
      .replace(
        /^(?:公司名称|公司|单位名称|单位|company|项目名称|项目名|活动名称|社团名称)[:：]\s*/i,
        '',
      )
      .split(/\s*[|｜\t]\s*|\s{2,}/)
      .filter(Boolean)

    if (
      parts.length === 1 &&
      (section === 'work_experience' || section === 'internship_experience')
    ) {
      const company = title.match(/^(.+?(?:公司|研究院|事务所))\s+(.+)$/)

      if (company) parts.splice(0, 1, company[1], company[2])
    }

    const entryId = `import_${section}_${index}_${content[section as 'work_experience'].items.length}`

    const details = textToResumeHtml(
      group
        .filter((_, lineIndex) => lineIndex !== headerIndex)
        .filter(Boolean)
        .join('\n'),
    )

    if (!title || (!range && parts.length < 2)) {
      unknown.push(...group)
      continue
    }

    if (section === 'edu_background') {
      const degree = title.match(
        /(?:^|\s|[|｜])(初中|高中|中专|大专|本科|学士|硕士|博士|EMBA|MBA)(?=$|\s|[|｜])/i,
      )?.[1]

      const school = parts[0].match(/[^\s|｜]*?(?:大学|学院|学校|中学)/)?.[0]

      if (!school) {
        unknown.push(...group)
        continue
      }

      const remainder = title
        .replace(school, '')
        .replace(degree ?? /$^/, '')
        .replace(/^[\s|｜]+|[\s|｜]+$/g, '')

      content.edu_background.items.push({
        entryId,
        schoolName: school,
        professional: remainder,
        degree: ((degree && /^(mba|emba)$/i.test(degree)
          ? degree.toUpperCase()
          : degree) ??
          '不填') as ResumeSchema['edu_background']['items'][number]['degree'],
        duration,
        eduInfo: details,
      })
    } else if (
      section === 'work_experience' ||
      section === 'internship_experience'
    ) {
      const base = {
        entryId,
        companyName: parts[0],
        position: parts.slice(1).join(' | '),
      }

      if (section === 'work_experience')
        content.work_experience.items.push({
          ...base,
          workDuration: duration,
          workInfo: details,
        })
      else
        content.internship_experience.items.push({
          ...base,
          internshipDuration: duration,
          internshipInfo: details,
        })
    } else if (section === 'project_experience') {
      content.project_experience.items.push({
        entryId,
        projectName: parts[0],
        participantRole: parts.slice(1).join(' | '),
        projectDuration: duration,
        projectInfo: details,
      })
    } else if (section === 'campus_experience') {
      content.campus_experience.items.push({
        entryId,
        experienceName: parts[0],
        role: parts.slice(1).join(' | '),
        duration,
        campusInfo: details,
      })
    }
  }
}

export function parseResumeText(text: string): ResumeParseResult {
  if (text.length > MAX_RESUME_TEXT_LENGTH)
    throw new ResumeImportError(
      'too-much-text',
      '文字超过 60000 字符，请分段整理后再导入。',
    )

  const content = createBlankResume()
  const unassigned: string[] = []

  const firstLine = text.trim().split(/\r?\n/)[0]?.trim()
  const hasContact = /@|1[3-9]\d{9}/.test(text)

  const sections: { key: Section | null; lines: string[] }[] = [
    { key: null, lines: [] },
  ]

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()

    if (!line) continue

    const title = line
      .replace(/^[#【[\s]+|[】\]:：\s]+$/g, '')
      .normalize('NFKC')
      .replace(/(?<=[\u3400-\u9fff]) (?=[\u3400-\u9fff])/g, '')
      .trim()

    const separator = line.search(/[:：]/)
    const inlineTitle = separator >= 0 ? line.slice(0, separator).trim() : ''

    const heading = headings.find(
      ([, pattern]) =>
        pattern.test(title) || (inlineTitle && pattern.test(inlineTitle)),
    )

    const inlineText = separator >= 0 ? line.slice(separator + 1).trim() : ''

    if (heading)
      sections.push({
        key: heading[0],
        lines: inlineText
          ? [heading[0] === 'job_intent' ? line : inlineText]
          : [],
      })
    else sections.at(-1)!.lines.push(line)
  }

  for (const { key, lines } of sections) {
    if (
      key &&
      [
        'edu_background',
        'work_experience',
        'internship_experience',
        'project_experience',
        'campus_experience',
      ].includes(key)
    ) {
      parseExperience(content, key, lines, unassigned)
      continue
    }

    if (
      key === 'skill_specialty' ||
      key === 'honors_certificates' ||
      key === 'hobbies'
    ) {
      const previous = content[key].description

      content[key].description = previous + textToResumeHtml(lines.join('\n'))
      continue
    }

    if (key === 'self_evaluation') {
      content.self_evaluation.content += textToResumeHtml(lines.join('\n'))
      continue
    }

    for (const line of lines) {
      let remainder = line

      const email = line.match(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
      )?.[0]

      const phone = line.match(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/)?.[0]

      const name =
        line.match(
          /^(?:姓名|name)\s*[:：]\s*([\u4e00-\u9fff·]{2,12}|[a-z][a-z .'-]{1,39})$/i,
        )?.[1] ??
        ((!key || key === 'basics') &&
        line === firstLine &&
        !/简历|联系|电话|邮箱|信息|资料/.test(line) &&
        hasContact &&
        /^[\u4e00-\u9fff]{2,4}$/.test(line)
          ? line
          : undefined)

      const intent = line.match(
        /^(?:求职意向|意向岗位|求职岗位|目标岗位)\s*[:：]\s*(.+)$/,
      )?.[1]

      const city = line.match(
        /^(?:意向城市|期望城市|工作城市)\s*[:：]\s*(.+)$/,
      )?.[1]

      if (name && !content.basics.name) {
        content.basics.name = name
        continue
      }
      if (intent && !content.job_intent.jobIntent) {
        content.job_intent.jobIntent = intent
        continue
      }
      if (city && !content.job_intent.intentionalCity) {
        content.job_intent.intentionalCity = city
        continue
      }
      if (
        key === 'job_intent' &&
        lines.length === 1 &&
        !content.job_intent.jobIntent
      ) {
        content.job_intent.jobIntent = line
        continue
      }
      if (email && !content.basics.email) {
        content.basics.email = email
        remainder = remainder
          .replace(email, '')
          .replace(/(?:电子)?邮箱\s*[:：]?|e-?mail\s*[:：]?/gi, '')
      }
      if (phone && !content.basics.phone) {
        content.basics.phone = phone
        remainder = remainder
          .replace(phone, '')
          .replace(/(?:联系)?(?:电话|手机)\s*[:：]?|phone\s*[:：]?/gi, '')
      }

      remainder = remainder.replace(/^[\s|｜·,，;；]+|[\s|｜·,，;；]+$/g, '')

      if (remainder) unassigned.push(remainder)
    }
  }

  return {
    content,
    unassignedText: unassigned.join('\n'),
    warnings: unassigned.length ? ['部分内容尚未归类，请对照原文补充。'] : [],
  }
}
