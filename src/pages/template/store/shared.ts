import type { TemplateRecord } from '@/lib/resume-template/schema'
import { updateTemplateMeta } from '../utils'

export type TemplateWorkbenchMode = 'library' | 'editor'
export type TemplateWorkbenchSource = 'official' | 'user' | null
export type TemplateWorkbenchTab = 'official' | 'mine'

export interface LoadTemplateOptions {
  silent?: boolean
}

export interface TemplateUiPatch {
  manifest?: TemplateRecord['manifest']
  name?: string
  description?: string
  visibility?: TemplateRecord['meta']['visibility']
  status?: TemplateRecord['meta']['status']
}

export function upsertTemplate(templates: TemplateRecord[], template: TemplateRecord) {
  const nextTemplates = [template, ...templates.filter(item => item.id !== template.id)]
  return nextTemplates.sort((left: TemplateRecord, right: TemplateRecord) =>
    new Date(right.meta.updatedAt).getTime() - new Date(left.meta.updatedAt).getTime(),
  )
}

export function mergeUserTemplates(remoteTemplates: TemplateRecord[], localTemplates: TemplateRecord[]) {
  const localTemplateMap = new Map(localTemplates.map(template => [template.id, template]))
  const mergedTemplates = remoteTemplates.map((template) => {
    const localTemplate = localTemplateMap.get(template.id)

    if (!localTemplate) {
      return template
    }

    return new Date(localTemplate.meta.updatedAt).getTime() > new Date(template.meta.updatedAt).getTime()
      ? localTemplate
      : template
  })

  for (const template of localTemplates) {
    if (!remoteTemplates.some(item => item.id === template.id)) {
      mergedTemplates.push(template)
    }
  }

  return mergedTemplates.sort((left, right) =>
    new Date(right.meta.updatedAt).getTime() - new Date(left.meta.updatedAt).getTime(),
  )
}

export function reconcileLastOpenedUserTemplateId(templates: TemplateRecord[], templateId: string | null) {
  if (!templateId) {
    return null
  }

  return templates.some(template => template.id === templateId) ? templateId : null
}

export function reconcileTemplateForUi(template: TemplateRecord, patch: TemplateUiPatch) {
  const nextManifest = patch.manifest ?? updateTemplateMeta(template.manifest, {
    name: patch.name ?? template.meta.name,
    description: patch.description ?? template.meta.description,
    visibility: patch.visibility ?? template.meta.visibility,
    status: patch.status ?? template.meta.status,
  })
  const updatedAt = new Date().toISOString()

  return {
    ...template,
    manifest: nextManifest,
    meta: {
      ...template.meta,
      name: patch.name ?? nextManifest.meta.name,
      description: patch.description ?? nextManifest.meta.description,
      visibility: patch.visibility ?? nextManifest.meta.visibility,
      status: patch.status ?? nextManifest.meta.status,
      updatedAt,
    },
  }
}
