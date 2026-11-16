import { createProfileExample } from '@/lib/resume-preparation/profile-example'
import { useCreationDraftStore } from '../../store'

export function prepareProfileDraft() {
  const state = useCreationDraftStore.getState()

  state.patch({
    content: createProfileExample(state.draft.profile),
    contentSource: 'profile',
    creationMode: undefined,
    sourceText: '',
    sourceName: '',
    unassignedText: '',
    warnings: [],
  })

  state.setStep('template')
}
