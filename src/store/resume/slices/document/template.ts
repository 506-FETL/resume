import type { ResumeTemplateBinding } from '@/lib/schema'
import { useResumeTemplateStore } from '@/store/resume-template'

export function preloadTemplate(binding?: ResumeTemplateBinding) {
  if (!binding) return

  useResumeTemplateStore.getState().loadDefinition({
    templateId: binding.templateId,
    templateVersion: binding.templateVersion,
  })
}
