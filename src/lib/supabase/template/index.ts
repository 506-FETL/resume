import type { OfficialTemplateCatalogItem } from '@/lib/resume-template/registry/official-template-catalog'
import type { TemplateManifest, TemplateRecord } from '@/lib/resume-template/schema'
import { cloneTemplateManifest } from '@/lib/resume-template/defaults'
import { cloneUserTemplateRecord, createTemplateDraftFromOfficialTemplate } from '@/lib/resume-template/editor'
import { getOfficialTemplateCatalogItem } from '@/lib/resume-template/registry/official-template-catalog'
import supabase from '../client'
import { getCurrentUser } from '../user'

type TemplateVisibility = TemplateRecord['meta']['visibility']
type TemplateStatus = TemplateRecord['meta']['status']

interface ResumeTemplateRow {
  template_id: string
  user_id: string
  family_id: string
  based_on_template_id: string | null
  name: string
  description: string | null
  visibility: TemplateVisibility
  status: TemplateStatus
  manifest: TemplateManifest
  created_at: string
  updated_at: string
}

export interface CreateUserTemplateInput {
  manifest: TemplateManifest
  basedOnTemplateId?: string
  name?: string
  description?: string
  visibility?: TemplateVisibility
  status?: TemplateStatus
}

export interface UpdateUserTemplatePatch {
  manifest?: TemplateManifest
  basedOnTemplateId?: string
  name?: string
  description?: string
  visibility?: TemplateVisibility
  status?: TemplateStatus
}

export type TemplateSourceKind = 'official' | 'user'

export type ResolvedTemplateSource = {
  kind: 'official'
  template: OfficialTemplateCatalogItem
} | {
  kind: 'user'
  template: TemplateRecord
}

function ensureUserTemplateManifest(
  manifest: TemplateManifest,
  userId: string,
  patch?: {
    name?: string
    description?: string
    visibility?: TemplateVisibility
    status?: TemplateStatus
  },
): TemplateManifest {
  const clonedManifest = cloneTemplateManifest(manifest)

  return {
    ...clonedManifest,
    meta: {
      ...clonedManifest.meta,
      name: patch?.name ?? clonedManifest.meta.name,
      description: patch?.description ?? clonedManifest.meta.description,
      ownerType: 'user' as const,
      ownerId: userId,
      visibility: patch?.visibility ?? clonedManifest.meta.visibility,
      status: patch?.status ?? clonedManifest.meta.status,
    },
  }
}

export function mapRowToTemplateRecord(row: ResumeTemplateRow): TemplateRecord {
  const manifest = ensureUserTemplateManifest(row.manifest, row.user_id, {
    name: row.name,
    description: row.description ?? undefined,
    visibility: row.visibility,
    status: row.status,
  })

  return {
    id: row.template_id,
    manifest: {
      ...manifest,
      id: row.template_id,
      familyId: row.family_id,
    },
    source: {
      kind: 'user',
      familyId: row.family_id,
      basedOnTemplateId: row.based_on_template_id ?? undefined,
    },
    meta: {
      name: row.name,
      description: row.description ?? undefined,
      ownerId: row.user_id,
      visibility: row.visibility,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  }
}

export async function mapTemplateRecordToInsertPayload(
  userId: string,
  input: CreateUserTemplateInput,
) {
  const manifest = ensureUserTemplateManifest(input.manifest, userId, {
    name: input.name,
    description: input.description,
    visibility: input.visibility ?? input.manifest.meta.visibility,
    status: input.status ?? input.manifest.meta.status,
  })

  return {
    user_id: userId,
    family_id: manifest.familyId,
    based_on_template_id: input.basedOnTemplateId ?? null,
    name: input.name ?? manifest.meta.name,
    description: input.description ?? manifest.meta.description ?? null,
    visibility: input.visibility ?? manifest.meta.visibility,
    status: input.status ?? manifest.meta.status,
    manifest,
  }
}

export async function mapTemplateRecordToUpdatePayload(
  userId: string,
  current: TemplateRecord,
  patch: UpdateUserTemplatePatch,
) {
  const nextManifest = patch.manifest
    ? ensureUserTemplateManifest(patch.manifest, userId, {
        name: patch.name ?? current.meta.name,
        description: patch.description ?? current.meta.description,
        visibility: patch.visibility ?? current.meta.visibility,
        status: patch.status ?? current.meta.status,
      })
    : ensureUserTemplateManifest(current.manifest, userId, {
        name: patch.name ?? current.meta.name,
        description: patch.description ?? current.meta.description,
        visibility: patch.visibility ?? current.meta.visibility,
        status: patch.status ?? current.meta.status,
      })

  return {
    family_id: nextManifest.familyId,
    based_on_template_id: patch.basedOnTemplateId ?? current.source.basedOnTemplateId ?? null,
    name: patch.name ?? current.meta.name,
    description: patch.description ?? current.meta.description ?? null,
    visibility: patch.visibility ?? current.meta.visibility,
    status: patch.status ?? current.meta.status,
    manifest: nextManifest,
  }
}

async function requireCurrentUser() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  return user
}

export async function listUserTemplates() {
  const user = await requireCurrentUser()
  const { data, error } = await supabase
    .from('resume_templates')
    .select('template_id,user_id,family_id,based_on_template_id,name,description,visibility,status,manifest,created_at,updated_at')
    .eq('user_id', user.id)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data as ResumeTemplateRow[]).map(mapRowToTemplateRecord)
}

export async function getUserTemplateById(templateId: string) {
  const user = await requireCurrentUser()
  const { data, error } = await supabase
    .from('resume_templates')
    .select('template_id,user_id,family_id,based_on_template_id,name,description,visibility,status,manifest,created_at,updated_at')
    .eq('user_id', user.id)
    .eq('template_id', templateId)
    .single()

  if (error) {
    throw error
  }

  return mapRowToTemplateRecord(data as ResumeTemplateRow)
}

export async function createUserTemplate(input: CreateUserTemplateInput) {
  const user = await requireCurrentUser()
  const payload = await mapTemplateRecordToInsertPayload(user.id, input)

  const { data, error } = await supabase
    .from('resume_templates')
    .insert(payload)
    .select('template_id,user_id,family_id,based_on_template_id,name,description,visibility,status,manifest,created_at,updated_at')
    .single()

  if (error) {
    throw error
  }

  return mapRowToTemplateRecord(data as ResumeTemplateRow)
}

export async function resolveTemplateSource(
  source: TemplateSourceKind,
  templateId: string,
): Promise<ResolvedTemplateSource> {
  if (source === 'official') {
    const template = getOfficialTemplateCatalogItem(templateId)

    if (!template) {
      throw new Error('官方模板不存在')
    }

    return {
      kind: 'official',
      template,
    }
  }

  return {
    kind: 'user',
    template: await getUserTemplateById(templateId),
  }
}

export async function copyTemplateToUserLibrary(
  source: TemplateSourceKind,
  templateId: string,
) {
  const resolved = await resolveTemplateSource(source, templateId)

  if (resolved.kind === 'official') {
    return createUserTemplate({
      manifest: createTemplateDraftFromOfficialTemplate(resolved.template.id),
      basedOnTemplateId: resolved.template.id,
      name: `${resolved.template.title} 副本`,
      description: resolved.template.description,
      visibility: 'private',
      status: 'active',
    })
  }

  const clonedRecord = cloneUserTemplateRecord(resolved.template)

  return createUserTemplate({
    manifest: cloneTemplateManifest(clonedRecord.manifest),
    basedOnTemplateId: clonedRecord.source.basedOnTemplateId,
    name: clonedRecord.meta.name,
    description: clonedRecord.meta.description,
    visibility: 'private',
    status: 'active',
  })
}

export async function updateUserTemplate(templateId: string, patch: UpdateUserTemplatePatch) {
  const current = await getUserTemplateById(templateId)
  const user = await requireCurrentUser()
  const payload = await mapTemplateRecordToUpdatePayload(user.id, current, patch)

  const { data, error } = await supabase
    .from('resume_templates')
    .update(payload)
    .eq('user_id', user.id)
    .eq('template_id', templateId)
    .select('template_id,user_id,family_id,based_on_template_id,name,description,visibility,status,manifest,created_at,updated_at')

  if (error) {
    throw error
  }

  if (data && data.length > 0) {
    return mapRowToTemplateRecord(data[0] as ResumeTemplateRow)
  }

  // UPDATE 未返回行（可能因 RLS 策略），回退到重新查询
  return getUserTemplateById(templateId)
}

export async function archiveUserTemplate(templateId: string) {
  const current = await getUserTemplateById(templateId)
  const user = await requireCurrentUser()
  const payload = await mapTemplateRecordToUpdatePayload(user.id, current, {
    status: 'archived',
  })
  const { error } = await supabase
    .from('resume_templates')
    .update(payload)
    .eq('user_id', user.id)
    .eq('template_id', templateId)

  if (error) {
    throw error
  }
}

export async function deleteUserTemplate(templateId: string) {
  const user = await requireCurrentUser()
  const { data, error } = await supabase
    .from('resume_templates')
    .delete()
    .eq('user_id', user.id)
    .eq('template_id', templateId)
    .select('template_id')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('模板不存在或删除失败')
  }
}
