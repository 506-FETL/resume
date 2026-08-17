export interface LegacyResumeEntryIdInput {
  sectionKey: string
  collectionKey: string
  index: number
  value: unknown
}

function normalizeStableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => normalizeStableValue(item))
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .filter(key => record[key] !== undefined)
        .sort()
        .map(key => [key, normalizeStableValue(record[key])]),
    )
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null
  }

  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeStableValue(value))
}

function fnv1a32(value: string, seed: number): number {
  let hash = seed >>> 0

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return hash
}

function toHex32(value: number): string {
  return value.toString(16).padStart(8, '0')
}

export function createLegacyResumeEntryId({
  sectionKey,
  collectionKey,
  index,
  value,
}: LegacyResumeEntryIdInput): string {
  const payload = stableStringify({
    collectionKey,
    index,
    sectionKey,
    value,
  })
  const first = fnv1a32(payload, 0x811C9DC5)
  const second = fnv1a32(payload, 0x9E3779B9)

  return `legacy_${toHex32(first)}${toHex32(second)}`
}

export interface CommentAnchorDocumentBlock {
  ordinal: number
  startGraphemeOffset: number
  endGraphemeOffset: number
}

export interface CommentAnchorDocumentNode {
  nodeKey: string
  sectionKey: string
  entryId: string
  fieldKey: string
  text: string
  blocks: CommentAnchorDocumentBlock[]
  nodeTextHash: string
}

export interface CommentAnchorDocument {
  version: 1
  projectionReferenceDate: string
  nodes: CommentAnchorDocumentNode[]
}

export interface CommentAnchorDocumentResult {
  document: CommentAnchorDocument
  documentHash: string
}

export interface ResumeCommentAnchor {
  nodeKey: string
  startGraphemeOffset: number
  endGraphemeOffset: number
  blockOrdinal: number
  exactQuote: string
  prefix: string
  suffix: string
  nodeTextHash: string
  createdAtContentHash: string
}

export type ResumeCommentRelocationResult
  = | {
    status: 'anchored'
    anchor: ResumeCommentAnchor
    moved: boolean
    contextChanged: boolean
  }
  | { status: 'detached', reason: 'node_missing' | 'quote_missing' | 'ambiguous' }

export interface CommentProjectedBlock {
  text: string
}

interface ProjectedNodeInput {
  sectionKey: string
  entryId: string
  fieldKey: string
  blocks: CommentProjectedBlock[]
}

const COMMENT_SECTION_ORDER = [
  'basics',
  'job_intent',
  'application_info',
  'edu_background',
  'work_experience',
  'internship_experience',
  'campus_experience',
  'project_experience',
  'skill_specialty',
  'honors_certificates',
  'self_evaluation',
  'hobbies',
] as const

const HTML_BLOCK_TAGS = new Set([
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
])

const SHA256_CONSTANTS = [
  0x428A2F98,
  0x71374491,
  0xB5C0FBCF,
  0xE9B5DBA5,
  0x3956C25B,
  0x59F111F1,
  0x923F82A4,
  0xAB1C5ED5,
  0xD807AA98,
  0x12835B01,
  0x243185BE,
  0x550C7DC3,
  0x72BE5D74,
  0x80DEB1FE,
  0x9BDC06A7,
  0xC19BF174,
  0xE49B69C1,
  0xEFBE4786,
  0x0FC19DC6,
  0x240CA1CC,
  0x2DE92C6F,
  0x4A7484AA,
  0x5CB0A9DC,
  0x76F988DA,
  0x983E5152,
  0xA831C66D,
  0xB00327C8,
  0xBF597FC7,
  0xC6E00BF3,
  0xD5A79147,
  0x06CA6351,
  0x14292967,
  0x27B70A85,
  0x2E1B2138,
  0x4D2C6DFC,
  0x53380D13,
  0x650A7354,
  0x766A0ABB,
  0x81C2C92E,
  0x92722C85,
  0xA2BFE8A1,
  0xA81A664B,
  0xC24B8B70,
  0xC76C51A3,
  0xD192E819,
  0xD6990624,
  0xF40E3585,
  0x106AA070,
  0x19A4C116,
  0x1E376C08,
  0x2748774C,
  0x34B0BCB5,
  0x391C0CB3,
  0x4ED8AA4A,
  0x5B9CCA4F,
  0x682E6FF3,
  0x748F82EE,
  0x78A5636F,
  0x84C87814,
  0x8CC70208,
  0x90BEFFFA,
  0xA4506CEB,
  0xBEF9A3F7,
  0xC67178F2,
]

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? value : {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function normalizeCommentText(value: string): string {
  return value.normalize('NFC')
}

export function splitCommentGraphemes(value: string): string[] {
  const normalized = normalizeCommentText(value)
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(normalized),
    segment => segment.segment,
  )
}

export function countCommentGraphemes(value: string): number {
  return splitCommentGraphemes(value).length
}

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count))
}

export function sha256Hex(value: string): string {
  const input = new TextEncoder().encode(value)
  const bitLength = input.length * 8
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64
  const bytes = new Uint8Array(paddedLength)
  bytes.set(input)
  bytes[input.length] = 0x80
  const view = new DataView(bytes.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  const hash = new Uint32Array([
    0x6A09E667,
    0xBB67AE85,
    0x3C6EF372,
    0xA54FF53A,
    0x510E527F,
    0x9B05688C,
    0x1F83D9AB,
    0x5BE0CD19,
  ])
  const words = new Uint32Array(64)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false)
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15]
      const previous2 = words[index - 2]
      const sigma0 = rotateRight(previous15, 7)
        ^ rotateRight(previous15, 18)
        ^ (previous15 >>> 3)
      const sigma1 = rotateRight(previous2, 17)
        ^ rotateRight(previous2, 19)
        ^ (previous2 >>> 10)
      words[index] = (
        words[index - 16]
        + sigma0
        + words[index - 7]
        + sigma1
      ) >>> 0
    }

    let a = hash[0]
    let b = hash[1]
    let c = hash[2]
    let d = hash[3]
    let e = hash[4]
    let f = hash[5]
    let g = hash[6]
    let h = hash[7]

    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temp1 = (h + sigma1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (sigma0 + majority) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }

  return Array.from(hash, toHex32).join('')
}

function decodeHtmlEntity(entity: string): string {
  const normalized = entity.toLowerCase()
  const named: Record<string, string> = {
    '&amp;': '&',
    '&apos;': '\'',
    '&gt;': '>',
    '&lt;': '<',
    '&nbsp;': ' ',
    '&quot;': '"',
  }
  if (named[normalized] !== undefined) {
    return named[normalized]
  }

  const decimal = /^&#(\d+);$/.exec(normalized)
  const hexadecimal = /^&#x([0-9a-f]+);$/.exec(normalized)
  const codePoint = decimal
    ? Number.parseInt(decimal[1], 10)
    : hexadecimal
      ? Number.parseInt(hexadecimal[1], 16)
      : Number.NaN
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) {
    return entity
  }
  return String.fromCodePoint(codePoint)
}

function decodeHtmlText(value: string): string {
  return value.replace(/&(?:amp|apos|gt|lt|nbsp|quot|#\d+|#x[0-9a-f]+);/giu, decodeHtmlEntity)
}

export function normalizeCommentRichTextBlock(value: string): string {
  return normalizeCommentText(value)
    .replace(/[\t\f\v ]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .trim()
}

export function projectCommentRichTextBlocks(html: string): CommentProjectedBlock[] {
  const source = readString(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '')
  const tokens = source.match(/<[^>]*>|[^<]+/gu) ?? []
  const blocks: CommentProjectedBlock[] = []
  let activeBlockTag: string | null = null
  let buffer = ''

  const flush = () => {
    const text = normalizeCommentRichTextBlock(buffer)
    if (text) {
      blocks.push({ text })
    }
    buffer = ''
  }

  for (const token of tokens) {
    if (!token.startsWith('<')) {
      buffer += decodeHtmlText(token)
      continue
    }

    const match = /^<\s*(?:(\/)\s*)?([a-z0-9]+)/iu.exec(token)
    if (!match) {
      continue
    }
    const closing = Boolean(match[1])
    const tag = match[2].toLowerCase()

    if (tag === 'br' && !closing) {
      buffer += '\n'
      continue
    }
    if (!HTML_BLOCK_TAGS.has(tag)) {
      continue
    }
    if (closing) {
      if (activeBlockTag === tag) {
        flush()
        activeBlockTag = null
      }
      continue
    }

    if (buffer) {
      flush()
    }
    activeBlockTag = tag
  }

  flush()
  return blocks
}

function normalizeProjectionReferenceDate(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError('Invalid projection reference date')
    }
    return value.toISOString().slice(0, 10)
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) {
    throw new Error('Invalid projection reference date')
  }
  const normalized = `${match[1]}-${match[2]}-${match[3]}`
  const date = new Date(`${normalized}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error('Invalid projection reference date')
  }
  return normalized
}

function calculateAge(birthValue: unknown, referenceDate: string): string {
  const birth = readString(birthValue).trim()
  const match = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(birth)
  if (!match) {
    return ''
  }

  const [referenceYear, referenceMonth, referenceDay] = referenceDate.split('-').map(Number)
  const birthYear = Number(match[1])
  const birthMonth = Number(match[2])
  const birthDay = Number(match[3] ?? 1)
  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
    return ''
  }
  let age = referenceYear - birthYear
  if (referenceMonth < birthMonth || (referenceMonth === birthMonth && referenceDay < birthDay)) {
    age -= 1
  }
  return age >= 0 && age <= 150 ? `${age}岁` : ''
}

function formatCommentDuration(value: unknown): string {
  const range = readArray(value)
  const startValue = readString(range[0]).trim()
  if (!startValue) {
    return ''
  }
  const normalizeYearMonth = (item: string) => {
    const match = /^(\d{4})[-/](\d{1,2})[-/]\d{1,2}$/.exec(item.trim())
    return match ? `${match[1]}-${match[2].padStart(2, '0')}` : item
  }
  const endValue = readString(range[1]).trim()
  return `${normalizeYearMonth(startValue)} - ${endValue ? normalizeYearMonth(endValue) : '至今'}`
}

function buildEntryId(
  sectionKey: string,
  collectionKey: string,
  index: number,
  value: unknown,
  usedIds: Set<string>,
): string {
  const record = readRecord(value)
  const entryId = readString(record.entryId).trim()
  if (entryId && entryId.length <= 128 && !usedIds.has(entryId)) {
    usedIds.add(entryId)
    return entryId
  }
  const { entryId: _entryId, ...valueWithoutEntryId } = record
  const base = createLegacyResumeEntryId({
    sectionKey,
    collectionKey,
    index,
    value: valueWithoutEntryId,
  })
  let candidate = base
  let suffix = 1
  while (usedIds.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }
  usedIds.add(candidate)
  return candidate
}

function pushTextNode(
  target: ProjectedNodeInput[],
  sectionKey: string,
  entryId: string,
  fieldKey: string,
  value: unknown,
  fallback = '',
) {
  const text = normalizeCommentText(readString(value).trim() || fallback)
  if (text) {
    target.push({ sectionKey, entryId, fieldKey, blocks: [{ text }] })
  }
}

function pushRichTextNode(
  target: ProjectedNodeInput[],
  sectionKey: string,
  entryId: string,
  fieldKey: string,
  value: unknown,
) {
  const blocks = projectCommentRichTextBlocks(readString(value))
  if (blocks.length > 0) {
    target.push({ sectionKey, entryId, fieldKey, blocks })
  }
}

function projectSingletonSections(
  resume: Record<string, unknown>,
  referenceDate: string,
): Record<string, ProjectedNodeInput[]> {
  const sections = Object.fromEntries(
    COMMENT_SECTION_ORDER.map(sectionKey => [sectionKey, [] as ProjectedNodeInput[]]),
  ) as Record<string, ProjectedNodeInput[]>
  const basics = readRecord(resume.basics)
  pushTextNode(sections.basics, 'basics', 'singleton', 'name', basics.name, '姓名')
  pushTextNode(sections.basics, 'basics', 'singleton', 'phone', basics.phone)
  pushTextNode(sections.basics, 'basics', 'singleton', 'email', basics.email)
  pushTextNode(sections.basics, 'basics', 'singleton', 'age', calculateAge(basics.birthMonth, referenceDate))
  pushTextNode(sections.basics, 'basics', 'singleton', 'gender', basics.gender === '不填' ? '' : basics.gender)
  pushTextNode(sections.basics, 'basics', 'singleton', 'workYears', basics.workYears === '不填' ? '' : basics.workYears)
  pushTextNode(sections.basics, 'basics', 'singleton', 'nation', basics.nation)
  pushTextNode(sections.basics, 'basics', 'singleton', 'height', readNumber(basics.heightCm) > 0 ? `${readNumber(basics.heightCm)}cm` : '')
  pushTextNode(sections.basics, 'basics', 'singleton', 'weight', readNumber(basics.weightKg) > 0 ? `${readNumber(basics.weightKg)}kg` : '')
  pushTextNode(sections.basics, 'basics', 'singleton', 'nativePlace', basics.nativePlace)

  const jobIntent = readRecord(resume.job_intent)
  pushTextNode(sections.job_intent, 'job_intent', 'singleton', 'jobIntent', jobIntent.jobIntent)
  pushTextNode(sections.job_intent, 'job_intent', 'singleton', 'intentionalCity', jobIntent.intentionalCity)
  pushTextNode(sections.job_intent, 'job_intent', 'singleton', 'expectedSalary', readNumber(jobIntent.expectedSalary) > 0 ? `${readNumber(jobIntent.expectedSalary)}K` : '')
  pushTextNode(sections.job_intent, 'job_intent', 'singleton', 'dateEntry', jobIntent.dateEntry === '不填' ? '' : jobIntent.dateEntry)

  const applicationInfo = readRecord(resume.application_info)
  pushTextNode(sections.application_info, 'application_info', 'singleton', 'applicationSchool', applicationInfo.applicationSchool ? `申请院校：${readString(applicationInfo.applicationSchool)}` : '')
  pushTextNode(sections.application_info, 'application_info', 'singleton', 'applicationMajor', applicationInfo.applicationMajor ? `申请专业：${readString(applicationInfo.applicationMajor)}` : '')

  const selfEvaluation = readRecord(resume.self_evaluation)
  pushRichTextNode(sections.self_evaluation, 'self_evaluation', 'singleton', 'content', selfEvaluation.content)
  return sections
}

function projectExperienceCollection(
  target: ProjectedNodeInput[],
  sectionKey: string,
  collectionKey: string,
  entries: unknown,
  fields: {
    title: string
    titleFallback: string
    subtitle?: string
    subtitleProject?: (entry: Record<string, unknown>) => string
    duration: string
    content: string
    visibilityFields?: string[]
  },
) {
  const usedIds = new Set<string>()
  readArray(entries).forEach((value, index) => {
    const entry = readRecord(value)
    if (entry.hidden === true) {
      return
    }
    const entryId = buildEntryId(sectionKey, collectionKey, index, entry, usedIds)
    const subtitle = fields.subtitleProject
      ? fields.subtitleProject(entry)
      : fields.subtitle
        ? readString(entry[fields.subtitle])
        : ''
    const duration = formatCommentDuration(entry[fields.duration])
    const visibilityFields = fields.visibilityFields ?? [
      fields.title,
      ...(fields.subtitle ? [fields.subtitle] : []),
      fields.content,
    ]
    if (!visibilityFields.some(field => Boolean(readString(entry[field]))) && !duration) {
      return
    }

    pushTextNode(target, sectionKey, entryId, fields.title, entry[fields.title], fields.titleFallback)
    pushTextNode(target, sectionKey, entryId, fields.subtitle ?? 'subtitle', subtitle)
    pushTextNode(target, sectionKey, entryId, 'duration', duration)
    pushRichTextNode(target, sectionKey, entryId, 'content', entry[fields.content])
  })
}

function projectCollectionSections(
  resume: Record<string, unknown>,
  sections: Record<string, ProjectedNodeInput[]>,
) {
  projectExperienceCollection(
    sections.edu_background,
    'edu_background',
    'items',
    readRecord(resume.edu_background).items,
    {
      title: 'schoolName',
      titleFallback: '学校',
      subtitle: 'professionalDegree',
      subtitleProject: entry => [
        readString(entry.professional),
        entry.degree !== '不填' ? readString(entry.degree) : '',
      ].filter(Boolean).join(' / '),
      duration: 'duration',
      content: 'eduInfo',
      visibilityFields: ['schoolName', 'professional', 'eduInfo'],
    },
  )
  projectExperienceCollection(
    sections.work_experience,
    'work_experience',
    'items',
    readRecord(resume.work_experience).items,
    {
      title: 'companyName',
      titleFallback: '公司',
      subtitle: 'position',
      duration: 'workDuration',
      content: 'workInfo',
    },
  )
  projectExperienceCollection(
    sections.internship_experience,
    'internship_experience',
    'items',
    readRecord(resume.internship_experience).items,
    {
      title: 'companyName',
      titleFallback: '公司',
      subtitle: 'position',
      duration: 'internshipDuration',
      content: 'internshipInfo',
    },
  )
  projectExperienceCollection(
    sections.campus_experience,
    'campus_experience',
    'items',
    readRecord(resume.campus_experience).items,
    {
      title: 'experienceName',
      titleFallback: '校园经历',
      subtitle: 'role',
      duration: 'duration',
      content: 'campusInfo',
    },
  )
  projectExperienceCollection(
    sections.project_experience,
    'project_experience',
    'items',
    readRecord(resume.project_experience).items,
    {
      title: 'projectName',
      titleFallback: '项目',
      subtitle: 'participantRole',
      duration: 'projectDuration',
      content: 'projectInfo',
    },
  )

  const skillSection = readRecord(resume.skill_specialty)
  pushRichTextNode(sections.skill_specialty, 'skill_specialty', 'singleton', 'description', skillSection.description)
  const usedSkillIds = new Set<string>()
  readArray(skillSection.skills).forEach((value, index) => {
    const entry = readRecord(value)
    const entryId = buildEntryId('skill_specialty', 'skills', index, entry, usedSkillIds)
    const label = readString(entry.label).trim()
    const proficiency = readString(entry.proficiencyLevel).trim()
    pushTextNode(
      sections.skill_specialty,
      'skill_specialty',
      entryId,
      'skill',
      `${label} · ${proficiency}`.trim(),
    )
  })

  const certificateSection = readRecord(resume.honors_certificates)
  pushRichTextNode(sections.honors_certificates, 'honors_certificates', 'singleton', 'description', certificateSection.description)
  const usedCertificateIds = new Set<string>()
  readArray(certificateSection.certificates).forEach((value, index) => {
    const entry = readRecord(value)
    pushTextNode(
      sections.honors_certificates,
      'honors_certificates',
      buildEntryId('honors_certificates', 'certificates', index, entry, usedCertificateIds),
      'name',
      entry.name,
    )
  })

  const hobbySection = readRecord(resume.hobbies)
  pushRichTextNode(sections.hobbies, 'hobbies', 'singleton', 'description', hobbySection.description)
  const usedHobbyIds = new Set<string>()
  readArray(hobbySection.hobbies).forEach((value, index) => {
    const entry = readRecord(value)
    pushTextNode(
      sections.hobbies,
      'hobbies',
      buildEntryId('hobbies', 'hobbies', index, entry, usedHobbyIds),
      'name',
      entry.name,
    )
  })
}

function toAnchorDocumentNode(input: ProjectedNodeInput): CommentAnchorDocumentNode {
  const normalizedBlocks = input.blocks
    .map(block => normalizeCommentText(block.text))
    .filter(Boolean)
  const text = normalizedBlocks.join('\n')
  let cursor = 0
  const blocks = normalizedBlocks.map((blockText, ordinal) => {
    const startGraphemeOffset = cursor
    cursor += countCommentGraphemes(blockText)
    const block = {
      ordinal,
      startGraphemeOffset,
      endGraphemeOffset: cursor,
    }
    cursor += 1
    return block
  })
  return {
    nodeKey: `${input.sectionKey}/${input.entryId}/${input.fieldKey}`,
    sectionKey: input.sectionKey,
    entryId: input.entryId,
    fieldKey: input.fieldKey,
    text,
    blocks,
    nodeTextHash: sha256Hex(text),
  }
}

export function buildCommentAnchorDocument(
  resumeValue: unknown,
  projectionReferenceDateValue: string | Date,
): CommentAnchorDocumentResult {
  const resume = readRecord(resumeValue)
  const projectionReferenceDate = normalizeProjectionReferenceDate(projectionReferenceDateValue)
  const sections = projectSingletonSections(resume, projectionReferenceDate)
  projectCollectionSections(resume, sections)
  const visibility = readRecord(resume.visibility)
  const requestedOrder = readArray(resume.order).map(readString)
  const orderedSections = [
    ...requestedOrder.filter(key => COMMENT_SECTION_ORDER.includes(key as typeof COMMENT_SECTION_ORDER[number])),
    ...COMMENT_SECTION_ORDER.filter(key => !requestedOrder.includes(key)),
  ].filter((key, index, all) => all.indexOf(key) === index)

  const nodes = orderedSections.flatMap((sectionKey) => {
    if (sectionKey !== 'basics' && visibility[sectionKey] === true) {
      return []
    }
    return sections[sectionKey].map(toAnchorDocumentNode)
  })
  const document: CommentAnchorDocument = {
    version: 1,
    projectionReferenceDate,
    nodes,
  }
  return {
    document,
    documentHash: sha256Hex(stableStringify(document)),
  }
}

function commentGraphemeSlice(value: string, start: number, end?: number): string {
  return splitCommentGraphemes(value).slice(start, end).join('')
}

function findCommentQuoteOffsets(text: string, quote: string): number[] {
  const haystack = splitCommentGraphemes(text)
  const needle = splitCommentGraphemes(quote)
  if (needle.length === 0 || needle.length > haystack.length) {
    return []
  }
  const matches: number[] = []
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((grapheme, index) => haystack[start + index] === grapheme)) {
      matches.push(start)
    }
  }
  return matches
}

function readCommentAnchorContext(text: string, start: number, end: number) {
  return {
    prefix: commentGraphemeSlice(text, Math.max(0, start - 32), start),
    suffix: commentGraphemeSlice(text, end, end + 32),
  }
}

function commentAnchorContextMatches(
  anchor: ResumeCommentAnchor,
  text: string,
  start: number,
  end: number,
): boolean {
  const context = readCommentAnchorContext(text, start, end)
  return context.prefix.endsWith(anchor.prefix) && context.suffix.startsWith(anchor.suffix)
}

function moveResumeCommentAnchor(
  anchor: ResumeCommentAnchor,
  node: CommentAnchorDocumentNode,
  start: number,
  nextDocumentHash?: string,
): ResumeCommentAnchor | null {
  const end = start + countCommentGraphemes(anchor.exactQuote)
  const startBlock = node.blocks.find(item => (
    start >= item.startGraphemeOffset
    && start <= item.endGraphemeOffset
  ))
  const endBlock = node.blocks.find(item => (
    end >= item.startGraphemeOffset
    && end <= item.endGraphemeOffset
  ))
  if (!startBlock || !endBlock) {
    return null
  }
  const context = readCommentAnchorContext(node.text, start, end)
  return {
    ...anchor,
    startGraphemeOffset: start,
    endGraphemeOffset: end,
    blockOrdinal: startBlock.ordinal,
    prefix: context.prefix,
    suffix: context.suffix,
    nodeTextHash: node.nodeTextHash,
    createdAtContentHash: nextDocumentHash ?? anchor.createdAtContentHash,
  }
}

export function relocateResumeCommentAnchor(
  anchor: ResumeCommentAnchor,
  nextNode: CommentAnchorDocumentNode | null | undefined,
  nextDocumentHash?: string,
): ResumeCommentRelocationResult {
  if (!nextNode || nextNode.nodeKey !== anchor.nodeKey) {
    return { status: 'detached', reason: 'node_missing' }
  }
  const originalQuote = commentGraphemeSlice(
    nextNode.text,
    anchor.startGraphemeOffset,
    anchor.endGraphemeOffset,
  )
  if (originalQuote === anchor.exactQuote) {
    const nextAnchor = moveResumeCommentAnchor(
      anchor,
      nextNode,
      anchor.startGraphemeOffset,
      nextDocumentHash,
    )
    if (!nextAnchor) {
      return { status: 'detached', reason: 'quote_missing' }
    }
    return {
      status: 'anchored',
      anchor: nextAnchor,
      moved: false,
      contextChanged: !commentAnchorContextMatches(
        anchor,
        nextNode.text,
        anchor.startGraphemeOffset,
        anchor.endGraphemeOffset,
      ),
    }
  }

  const offsets = findCommentQuoteOffsets(nextNode.text, anchor.exactQuote)
  if (offsets.length === 0) {
    return { status: 'detached', reason: 'quote_missing' }
  }
  const quoteLength = countCommentGraphemes(anchor.exactQuote)
  const matchingOffsets = offsets.filter(start => commentAnchorContextMatches(
    anchor,
    nextNode.text,
    start,
    start + quoteLength,
  ))
  const selectedOffset = matchingOffsets.length === 1
    ? matchingOffsets[0]
    : offsets.length === 1
      ? offsets[0]
      : null
  if (selectedOffset === null) {
    return { status: 'detached', reason: 'ambiguous' }
  }
  const nextAnchor = moveResumeCommentAnchor(
    anchor,
    nextNode,
    selectedOffset,
    nextDocumentHash,
  )
  if (!nextAnchor) {
    return { status: 'detached', reason: 'quote_missing' }
  }
  return {
    status: 'anchored',
    anchor: nextAnchor,
    moved: true,
    contextChanged: matchingOffsets.length !== 1,
  }
}
