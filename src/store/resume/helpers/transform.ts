import type { FormDataMap, PersistableResumeState, ResumeFormPayload } from '../const'
import type { AutomergeResumeDocument } from '@/lib/automerge'
import type { PersistedResumeSnapshot, ResumeAppearancePatch } from '@/lib/schema'
import { get } from 'lodash'
import { DEFAULT_ORDER, DEFAULT_VISIBILITY, migrateOrder, migrateVisibility, normalizeResumeAppearance, normalizeResumeSection, normalizeResumeType, resolveResumeTemplateBinding } from '@/lib/schema'
import { FORM_DATA_KEYS, FORM_FIELD_DEFAULTS } from '../const'
import { sanitizeDeep } from './sanitize'

export function setFormDataField<K extends keyof FormDataMap>(
  target: FormDataMap,
  key: K,
  value: FormDataMap[K],
) {
  target[key] = value
}

export function mapSnapshotToState(snapshot: PersistedResumeSnapshot): PersistableResumeState {
  const formData = {} as FormDataMap

  for (const key of FORM_DATA_KEYS) {
    setFormDataField(formData, key, snapshot[key])
  }

  return {
    ...formData,
    order: snapshot.order,
    visibility: snapshot.visibility,
    type: snapshot.type,
    templateBinding: resolveResumeTemplateBinding(snapshot.templateBinding, snapshot.type),
  }
}

export function hasPersistedAppearance(source: unknown): source is ResumeAppearancePatch {
  const record = source as Record<string, unknown> | null | undefined
  return record != null && (
    record.spacing !== undefined
    || record.font !== undefined
    || record.theme !== undefined
  )
}

export function mergeSnapshotAppearance(
  snapshot: PersistedResumeSnapshot,
  source: ResumeAppearancePatch | null | undefined,
): PersistedResumeSnapshot {
  return {
    ...snapshot,
    ...normalizeResumeAppearance(source),
  }
}

export function mapSourceToPersistedSnapshot(
  doc: Partial<AutomergeResumeDocument> | null | undefined,
): PersistedResumeSnapshot {
  const source = doc as Record<string, any> | undefined
  const formData = {} as FormDataMap
  const type = normalizeResumeType(get(source, 'type', 'default'))
  const templateBinding = sanitizeDeep(
    get(source, 'templateBinding', get(source, 'template_binding')),
  )

  for (const key of FORM_DATA_KEYS) {
    const { legacyKey } = FORM_FIELD_DEFAULTS[key]
    const value = get(source, key)
      ?? (legacyKey ? get(source, legacyKey) : undefined)
    setFormDataField(
      formData,
      key,
      normalizeResumeSection(key, sanitizeDeep(value)),
    )
  }

  return {
    ...formData,
    order: migrateOrder(sanitizeDeep(get(source, 'order', DEFAULT_ORDER))),
    visibility: migrateVisibility(sanitizeDeep(get(source, 'visibility', DEFAULT_VISIBILITY))),
    type,
    templateBinding: resolveResumeTemplateBinding(templateBinding, type),
    ...normalizeResumeAppearance(source),
  }
}

export function getFormPayload(state: PersistableResumeState): ResumeFormPayload {
  const formData = {} as FormDataMap

  for (const key of FORM_DATA_KEYS) {
    setFormDataField(formData, key, state[key])
  }

  return {
    ...formData,
    order: state.order,
    visibility: state.visibility,
    type: state.type,
    templateBinding: resolveResumeTemplateBinding(state.templateBinding, state.type),
  }
}
