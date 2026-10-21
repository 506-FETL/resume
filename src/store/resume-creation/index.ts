import { browserResumePersistence } from '@/lib/resume-template/create/browser-persistence'
import { localTemplateSource } from '@/lib/resume-template/source/local'
import useUserStore from '@/store/user'
import { createResumeCreationStore } from './create-store'

export const useResumeCreationStore = createResumeCreationStore({ source: localTemplateSource, persistence: browserResumePersistence, getOwnerId: () => useUserStore.getState().currentUser?.id ?? null })
