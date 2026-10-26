import type { ContentEvidence } from './types'
import type { ORDERType, ResumeSchema, VariantMetadata } from '@/lib/schema'
import { toast } from 'sonner'
import { getVariantFieldMapping } from '@/lib/schema/resume/variant/fields'
import { resumeHtmlToText } from '@/lib/resume-import/text'
import { updatePreparation } from './storage'

export interface EvidenceField {
  path: string
  text: string
}

export const plainText = (value: string) => resumeHtmlToText(value).trim()

/** 用条目身份而非数组位置定位，重排不能把核实记录套到另一条经历。 */
export function sectionFields(
  value: unknown,
  path = '',
  includeHidden = false,
): EvidenceField[] {
  if (typeof value === 'string') {
    const text = plainText(value)

    // 表单的空值选项不会打印，不能把它当作示例正文或待核实的事实。
    if (
      text === '不填' &&
      /\/(gender|workYears|maritalStatus|politicalStatus|degree|dateEntry)$/.test(
        path,
      )
    )
      return []

    return text ? [{ path, text }] : []
  }
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      if (
        !includeHidden &&
        item &&
        typeof item === 'object' &&
        item.hidden === true
      )
        return []

      const key =
        item && typeof item === 'object' && 'entryId' in item
          ? `@${item.entryId}`
          : String(index)

      return sectionFields(item, `${path}/${key}`, includeHidden)
    })
  }

  return Object.entries(value).flatMap(([key, child]) =>
    ['entryId', 'hidden', 'photo', 'displayType'].includes(key)
      ? []
      : sectionFields(child, `${path}/${key}`, includeHidden),
  )
}

export function collectSectionEvidence(
  section: ORDERType,
  value: unknown,
  kind: ContentEvidence['kind'],
  before?: unknown,
): ContentEvidence[] {
  const previous = new Map(
    sectionFields(before, '', true).map((field) => [field.path, field.text]),
  )

  return sectionFields(value, '', true)
    .filter(
      (field) => kind === 'example' || previous.get(field.path) !== field.text,
    )
    .map((field) => ({
      id: `${kind}:${section}:${encodeURIComponent(field.path)}`,
      kind,
      section,
      text: field.text,
    }))
}

export function evidencePath(evidence: ContentEvidence) {
  const prefix = `${evidence.kind}:${evidence.section}:`

  if (!evidence.id.startsWith(prefix)) return null

  try {
    return decodeURIComponent(evidence.id.slice(prefix.length))
  } catch {
    return null
  }
}

// 表单按模块替换引用；同一模块的改写记录与无关字段更新复用解析结果。
const derivedFieldsCache = new WeakMap<object, EvidenceField[]>()

export function derivedEvidence(
  metadata: VariantMetadata | null | undefined,
  content: ResumeSchema,
): ContentEvidence[] {
  if (!metadata?.changes) return []

  return metadata.changes.flatMap((change) => {
    if (!(change.section in content)) return []

    const section = content[change.section]

    if (!section) return []

    let fields = derivedFieldsCache.get(section)

    if (!fields) {
      fields = sectionFields(section, '', true)
      derivedFieldsCache.set(section, fields)
    }

    const fieldName =
      getVariantFieldMapping(change.section, change.fieldPath)?.snapshotField ??
      change.fieldPath.split('.').at(-1)

    const field = fields.find((candidate) => {
      const matchesItem =
        change.itemId === 'whole' ||
        candidate.path.includes(`/@${change.itemId}/`)

      return matchesItem && candidate.path.endsWith(`/${fieldName}`)
    })

    if (!field) return []

    const text = plainText(change.after)

    if (!text) return []

    return [
      {
        id: `ai:${change.section}:${encodeURIComponent(field.path)}`,
        kind: 'ai' as const,
        section: change.section,
        text,
      },
    ]
  })
}

const pendingEvidence = new Map<
  string,
  { resumeId: string; ownerId: string | null; evidence: ContentEvidence[] }
>()

const evidenceListeners = new Set<() => void>()
let evidenceRevision = 0

export const subscribeEvidence = (listener: () => void) => {
  evidenceListeners.add(listener)

  return () => {
    evidenceListeners.delete(listener)
  }
}

export const getEvidenceRevision = () => evidenceRevision

function notifyEvidence() {
  evidenceRevision += 1
  evidenceListeners.forEach((listener) => listener())
}

export async function flushPendingEvidence(
  resumeId: string,
  ownerId: string | null,
) {
  const key = JSON.stringify([ownerId, resumeId])
  const pending = pendingEvidence.get(key)

  if (!pending) return

  await updatePreparation(resumeId, ownerId, (record) => {
    const ids = new Set(pending.evidence.map((item) => item.id))
    const resolutions = { ...record.resolutions }

    pending.evidence.forEach((item) => {
      delete resolutions[item.id]
    })

    return {
      ...record,
      evidence: [
        ...record.evidence.filter((item) => !ids.has(item.id)),
        ...pending.evidence,
      ],
      resolutions,
    }
  })

  if (pendingEvidence.get(key) === pending) pendingEvidence.delete(key)
}

/** 正文成功后独立记录；失败不抛回正文写入，导出时重试附属记录。 */
export async function recordPreparationEvidence(
  resumeId: string,
  ownerId: string | null,
  evidence: ContentEvidence[],
  failureMessage: string,
) {
  if (!evidence.length) return

  const key = JSON.stringify([ownerId, resumeId])
  const previous = pendingEvidence.get(key)?.evidence ?? []

  pendingEvidence.set(key, {
    resumeId,
    ownerId,
    evidence: [
      ...new Map(
        [...previous, ...evidence].map((item) => [item.id, item]),
      ).values(),
    ],
  })

  notifyEvidence()

  try {
    await flushPendingEvidence(resumeId, ownerId)
  } catch {
    toast.error(failureMessage)
  } finally {
    notifyEvidence()
  }
}

export async function recordAppliedAiEvidence(
  resumeId: string,
  ownerId: string | null,
  section: ORDERType,
  after: unknown,
  before?: unknown,
) {
  await recordPreparationEvidence(
    resumeId,
    ownerId,
    collectSectionEvidence(section, after, 'ai', before),
    '简历已更新，但 AI 来源记录保存失败，请在导出检查中重试',
  )
}
