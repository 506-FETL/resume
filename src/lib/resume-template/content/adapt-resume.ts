import type { AdaptedResumeContent, CommentNodes } from './types'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { adaptProfile } from './adapt-profile'
import { adaptSections } from './adapt-sections'

export function adaptResumeContent(
  data: TemplateResumeData,
  nodes: CommentNodes,
): AdaptedResumeContent {
  return {
    profile: adaptProfile(data, nodes),
    sections: adaptSections(data, nodes),
  }
}
