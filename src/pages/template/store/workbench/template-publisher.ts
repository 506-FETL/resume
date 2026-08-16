import type { StoreApi } from 'zustand'
import type { WorkbenchState } from './types'
import { toast } from 'sonner'
import { createResumeFromTemplate } from '@/lib/supabase/resume/form'
import { createUserTemplate, updateUserTemplate } from '@/lib/supabase/template'
import useResumeListStore from '@/pages/resume/store'
import useCurrentResumeStore from '@/store/resume/current'
import { updateTemplateMeta, validateTemplateForSave } from '../../utils'
import useTemplateEditorStore from '../editor'
import useOfficialTemplatesStore from '../official-templates'
import { reconcileTemplateForUi } from '../shared'
import useUserTemplatesStore from '../user-templates'

export interface TemplatePublisherSlice {
  createResumeWithTemplate: (sourceKind: 'official' | 'user', templateId: string) => Promise<void>
  deleteUserTemplateRecord: (templateId: string) => Promise<void>
  saveActiveTemplate: () => Promise<void>
  saveActiveTemplateAsCopy: () => Promise<void>
}

type Set = StoreApi<WorkbenchState>['setState']
type Get = StoreApi<WorkbenchState>['getState']

export function createTemplatePublisherSlice(set: Set, get: Get): TemplatePublisherSlice {
  return {
    createResumeWithTemplate: async (sourceKind, templateId) => {
      try {
        const createdResume = await createResumeFromTemplate({
          source: sourceKind,
          templateId,
        })

        useResumeListStore.getState().addResume({
          resume_id: createdResume.resume_id,
          created_at: createdResume.created_at,
          updated_at: createdResume.updated_at,
          type: createdResume.type,
          display_name: createdResume.display_name,
          description: createdResume.description,
          isOffline: false,
        })
        useCurrentResumeStore.getState().setCurrentResume(createdResume.resume_id, createdResume.type)
        get().navigate?.('/resume/editor')
        toast.success('已基于模板创建简历')
      }
      catch (createError) {
        toast.error('创建简历失败', {
          description: createError instanceof Error ? createError.message : '请稍后重试',
        })
      }
    },

    deleteUserTemplateRecord: async (templateId) => {
      try {
        await useUserTemplatesStore.getState().deleteTemplate(templateId)

        if (get().mode === 'editor' && get().source === 'user' && get().selectedTemplateId === templateId)
          get().openLibrary('mine')

        toast.success('模板已删除')
      }
      catch (deleteError) {
        toast.error('删除模板失败', {
          description: deleteError instanceof Error ? deleteError.message : '请稍后重试',
        })
        throw deleteError
      }
    },

    saveActiveTemplate: async () => {
      const editorState = useTemplateEditorStore.getState()
      const manifestDraft = editorState.manifestDraft

      if (!manifestDraft)
        return

      const nextManifest = updateTemplateMeta(manifestDraft, {
        visibility: 'private',
        status: 'active',
      })
      const validation = validateTemplateForSave(nextManifest)

      if (!validation.valid) {
        const [firstIssue] = validation.issues
        toast.error('模板保存失败', {
          description: firstIssue?.message ?? '请先修正模板配置',
        })
        return
      }

      editorState.markSaving(true)

      try {
        const state = get()
        const selectedOfficialTemplate = useOfficialTemplatesStore.getState().findTemplate(state.selectedTemplateId)
        const selectedUserTemplate = useUserTemplatesStore.getState().findTemplate(state.selectedTemplateId)
        const basedOnTemplateId = state.source === 'official'
          ? selectedOfficialTemplate?.id
          : selectedUserTemplate?.id

        const savedTemplate = editorState.templateId
          ? await updateUserTemplate(editorState.templateId, {
              manifest: nextManifest,
              name: nextManifest.meta.name,
              description: nextManifest.meta.description,
              visibility: 'private',
              status: 'active',
            })
          : await createUserTemplate({
              manifest: nextManifest,
              basedOnTemplateId,
              name: nextManifest.meta.name,
              description: nextManifest.meta.description,
              visibility: 'private',
              status: 'active',
            })

        const syncedTemplate = reconcileTemplateForUi(savedTemplate, {
          manifest: nextManifest,
          name: nextManifest.meta.name,
          description: nextManifest.meta.description,
          visibility: 'private',
          status: 'active',
        })

        editorState.markSaved({
          templateId: syncedTemplate.id,
          manifest: syncedTemplate.manifest,
        })
        useUserTemplatesStore.getState().upsertAndSync(syncedTemplate)
        set({
          mode: 'editor',
          source: 'user',
          selectedTemplateId: syncedTemplate.id,
        })
        useUserTemplatesStore.getState().setLastOpenedUserTemplateId(syncedTemplate.id)
        toast.success('模板已保存')
      }
      catch (saveError) {
        editorState.markSaving(false)
        toast.error('模板保存失败', {
          description: saveError instanceof Error ? saveError.message : '请稍后重试',
        })
      }
    },

    saveActiveTemplateAsCopy: async () => {
      const editorState = useTemplateEditorStore.getState()
      const manifestDraft = editorState.manifestDraft

      if (!manifestDraft)
        return

      const duplicatedManifest = updateTemplateMeta(manifestDraft, {
        name: `${manifestDraft.meta.name} 副本`,
        visibility: 'private',
        status: 'active',
      })
      const validation = validateTemplateForSave(duplicatedManifest)

      if (!validation.valid) {
        const [firstIssue] = validation.issues
        toast.error('另存为失败', {
          description: firstIssue?.message ?? '请先修正模板配置',
        })
        return
      }

      editorState.markSaving(true)

      try {
        const state = get()
        const selectedOfficialTemplate = useOfficialTemplatesStore.getState().findTemplate(state.selectedTemplateId)
        const selectedUserTemplate = useUserTemplatesStore.getState().findTemplate(state.selectedTemplateId)
        const savedTemplate = await createUserTemplate({
          manifest: duplicatedManifest,
          basedOnTemplateId: editorState.templateId
            ?? selectedOfficialTemplate?.id
            ?? selectedUserTemplate?.id,
          name: duplicatedManifest.meta.name,
          description: duplicatedManifest.meta.description,
          visibility: 'private',
          status: 'active',
        })

        editorState.markSaved({
          templateId: savedTemplate.id,
          manifest: savedTemplate.manifest,
        })
        useUserTemplatesStore.getState().upsertAndSync(savedTemplate)
        set({
          mode: 'editor',
          source: 'user',
          selectedTemplateId: savedTemplate.id,
        })
        useUserTemplatesStore.getState().setLastOpenedUserTemplateId(savedTemplate.id)
        toast.success('已另存为新的个人模板')
      }
      catch (saveError) {
        editorState.markSaving(false)
        toast.error('另存为失败', {
          description: saveError instanceof Error ? saveError.message : '请稍后重试',
        })
      }
    },
  }
}
