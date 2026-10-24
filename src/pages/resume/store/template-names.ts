import type { StoreApi } from 'zustand'
import type { ResumeListState } from './types'
import { resumeTemplateSource } from '@/lib/resume-template/source'

export type TemplateNameState =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; name: string | null }

export interface TemplateNamesSlice {
  templateNames: Record<string, TemplateNameState>
  loadTemplateName: (templateId: string, force?: boolean) => Promise<void>
}

export function createTemplateNamesSlice(
  set: StoreApi<ResumeListState>['setState'],
  get: StoreApi<ResumeListState>['getState'],
): TemplateNamesSlice {
  return {
    templateNames: {},
    loadTemplateName: async (templateId, force = false) => {
      const current = get().templateNames[templateId]

      if (
        current?.status === 'loading' ||
        (!force && current?.status === 'ready')
      )
        return

      const update = (value: TemplateNameState) =>
        set((state) => ({
          templateNames: { ...state.templateNames, [templateId]: value },
        }))

      update({ status: 'loading' })

      try {
        const name = await resumeTemplateSource.getTemplateName(templateId, {
          force,
        })

        update({ status: 'ready', name })
      } catch {
        update({ status: 'error' })
      }
    },
  }
}
