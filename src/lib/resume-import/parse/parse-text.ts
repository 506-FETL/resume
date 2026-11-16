import type { ResumeSchema } from '../../schema/resume'
import { DEFAULT_BASICS, DEFAULT_JOB_INTENT } from '../../schema/resume/form'
import { MAX_RESUME_TEXT_LENGTH } from '../const'
import { readSectionHeading, type Section } from '../sections'
import { textToResumeHtml } from '../text'
import type { ResumeParseResult } from '../types'
import { ResumeImportError } from '../types'
import { dateRange, parseExperience } from './experience'

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

  const sourceEntries: NonNullable<ResumeParseResult['sources']>['entries'] = {}
  const continuationLines: number[] = []
  let lineNumber = -1

  const sections: {
    key: Section | null
    lines: string[]
    lineNumbers: number[]
  }[] = [{ key: null, lines: [], lineNumbers: [] }]

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()

    if (!line) continue

    lineNumber++

    const heading = readSectionHeading(line)

    if (heading?.continuation && sections.at(-1)?.key === heading.section) {
      continuationLines.push(lineNumber)

      if (heading.inlineText) {
        sections.at(-1)!.lines.push(heading.inlineText)
        sections.at(-1)!.lineNumbers.push(lineNumber)
      }

      continue
    }
    if (heading)
      sections.push({
        key: heading.section,
        lines: heading.inlineText
          ? [heading.section === 'job_intent' ? line : heading.inlineText]
          : [],
        lineNumbers: heading.inlineText ? [lineNumber] : [],
      })
    else {
      sections.at(-1)!.lines.push(line)
      sections.at(-1)!.lineNumbers.push(lineNumber)
    }
  }

  for (const { key, lines, lineNumbers } of sections) {
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
      parseExperience(
        content,
        key,
        lines,
        unassigned,
        lineNumbers,
        sourceEntries,
        continuationLines,
      )

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
      if (
        (!key || key === 'basics') &&
        line === lines[1] &&
        content.basics.name &&
        line.length <= 120 &&
        /前端|后端|全栈|研发|工程师|设计师|产品经理|运营|developer|engineer|designer/i.test(
          line,
        ) &&
        !email &&
        !phone &&
        !dateRange.test(line)
      ) {
        content.job_intent.jobIntent = line
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

      if (!key || key === 'basics') {
        const addField = (label: string, value: string) => {
          if (
            !content.basics.customFields.some(
              (field) => field?.label === label && field.value === value,
            )
          )
            content.basics.customFields.push({ label, value })
        }

        const age = remainder.match(/(?<!\d)(?:[1-9]\d?|100)\s*岁(?!\d)/)?.[0]

        const gender = remainder.match(
          /(?:^|[\s|｜·])([男女])(?=$|[\s|｜·])/,
        )?.[1]

        const enrollment = remainder.match(/(?:本科|硕士|博士|研究生)在读/)?.[0]
        const url = remainder.match(/https?:\/\/[^\s|｜]+/i)?.[0]

        if (age) {
          addField('年龄', age)
          remainder = remainder.replace(age, '')
        }
        if (gender) {
          content.basics.gender = gender as '男' | '女'
          remainder = remainder.replace(
            /(^|[\s|｜·])([男女])(?=$|[\s|｜·])/,
            '$1',
          )
        }
        if (enrollment) {
          addField('在读情况', enrollment)
          remainder = remainder.replace(enrollment, '')
        }
        if (url) {
          addField('个人主页', url)
          remainder = remainder.replace(url, '')
        }
      }

      remainder = remainder.replace(/^[\s|｜·,，;；]+|[\s|｜·,，;；]+$/g, '')

      if (remainder) unassigned.push(remainder)
    }
  }

  return {
    content,
    unassignedText: unassigned.join('\n'),
    warnings: unassigned.length ? ['部分内容尚未归类，请对照原文补充。'] : [],
    sources: { entries: sourceEntries },
  }
}
