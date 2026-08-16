import type { TemplateManifest } from '../schema'
import type { ResumeTemplateBinding, ResumeType } from '@/lib/schema'
import type { TemplateSourceKind } from '@/lib/supabase/template'
import { getUserTemplateById } from '@/lib/supabase/template'
import { cloneTemplateManifest } from '../defaults'
import { getOfficialTemplateCatalogItem } from '../registry/official-template-catalog'

function resolveLegacyResumeTypeFromOfficialTemplateId(templateId?: string | null) {
  if (!templateId) {
    return 'default'
  }

  return getOfficialTemplateCatalogItem(templateId)?.source.legacyResumeType ?? 'default'
}

async function getUserSourceManifest(templateId: string) {
  const template = await getUserTemplateById(templateId)

  return {
    manifest: cloneTemplateManifest(template.manifest),
    resumeType: resolveLegacyResumeTypeFromOfficialTemplateId(
      template.source.basedOnTemplateId ?? template.manifest.id,
    ),
  }
}

export async function getManifestFromTemplateBinding(
  binding?: ResumeTemplateBinding | null,
): Promise<TemplateManifest | null> {
  if (!binding) {
    return null
  }

  if (binding.source === 'official') {
    const officialTemplate = getOfficialTemplateCatalogItem(binding.templateId)
    return officialTemplate ? cloneTemplateManifest(officialTemplate.manifest) : null
  }

  // Legacy community bindings are recognized but never resolved across users.
  if (binding.source === 'community') {
    return null
  }

  const { manifest } = await getUserSourceManifest(binding.templateId)
  return manifest
}

export async function getResumeTypeFromTemplateSource(
  source: TemplateSourceKind,
  templateId: string,
): Promise<ResumeType> {
  if (source === 'official') {
    return resolveLegacyResumeTypeFromOfficialTemplateId(templateId)
  }

  const { resumeType } = await getUserSourceManifest(templateId)
  return resumeType
}
