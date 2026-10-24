const SECTION_DEFAULTS = {
  job_intent: {
    jobIntent: '',
    intentionalCity: '',
    expectedSalary: 0,
    dateEntry: '不填',
  },
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
} as const

const SECTION_COLLECTIONS = {
  edu_background: 'items',
  work_experience: 'items',
  internship_experience: 'items',
  campus_experience: 'items',
  project_experience: 'items',
  skill_specialty: 'skills',
  honors_certificates: 'certificates',
  hobbies: 'hobbies',
} as const

// 与表单 LEGACY_KEY_MAP 保持一致；历史 release 可能保存未归一化的旧键。
const LEGACY_SECTION_KEYS = {
  jobIntent: 'job_intent',
  applicationInfo: 'application_info',
  eduBackground: 'edu_background',
  workExperience: 'work_experience',
  internshipExperience: 'internship_experience',
  campusExperience: 'campus_experience',
  projectExperience: 'project_experience',
  skillSpecialty: 'skill_specialty',
  honorsCertificates: 'honors_certificates',
  selfEvaluation: 'self_evaluation',
} as const

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** 与渲染器一致：整节 true 隐藏，条目 hidden true 隐藏；不修改编辑快照。 */
export function redactHiddenResumeSections<T>(snapshot: T): T {
  const publicSnapshot = structuredClone(snapshot)
  const record = readRecord(publicSnapshot)
  const visibility: Record<string, boolean> = Object.fromEntries(
    Object.keys(SECTION_DEFAULTS).map((key) => [
      key,
      key === 'application_info',
    ]),
  )
  // 与 migrateVisibility 相同：有效新旧键按原始遍历顺序覆盖默认值。
  for (const [key, value] of Object.entries(readRecord(record.visibility))) {
    const normalizedKey =
      LEGACY_SECTION_KEYS[key as keyof typeof LEGACY_SECTION_KEYS] ?? key
    if (
      Object.hasOwn(SECTION_DEFAULTS, normalizedKey) &&
      typeof value === 'boolean'
    )
      visibility[normalizedKey] = value
  }
  record.visibility = visibility

  for (const [legacyKey, key] of Object.entries(LEGACY_SECTION_KEYS)) {
    // 与 mapSourceToPersistedSnapshot 相同：新键非空时优先，否则回退旧键。
    if (record[key] == null && record[legacyKey] != null)
      record[key] = record[legacyKey]
    // 即便新键存在，也必须删掉可能包含隐藏内容的旧键副本。
    delete record[legacyKey]
  }

  for (const key of Object.keys(
    SECTION_DEFAULTS,
  ) as (keyof typeof SECTION_DEFAULTS)[]) {
    if (visibility[key]) {
      // 空集合是合法 schema，避免在公开快照中生成表单用的占位经历。
      record[key] = structuredClone(SECTION_DEFAULTS[key])
      continue
    }

    if (!(key in SECTION_COLLECTIONS)) continue
    const collectionKey =
      SECTION_COLLECTIONS[key as keyof typeof SECTION_COLLECTIONS]
    const section = readRecord(record[key])
    const entries = section[collectionKey]
    if (Array.isArray(entries)) {
      section[collectionKey] = entries.filter(
        (entry) => !readRecord(entry).hidden,
      )
    }
  }

  return publicSnapshot
}
