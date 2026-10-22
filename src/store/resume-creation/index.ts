import { browserResumePersistence } from '@/lib/resume-template/create/browser-persistence'
import { resumeTemplateSource } from '@/lib/resume-template/source'
import useUserStore from '@/store/user'
import { createResumeCreationStore } from './create-store'

export const useResumeCreationStore = createResumeCreationStore({ source: resumeTemplateSource, persistence: browserResumePersistence, getOwnerId: () => useUserStore.getState().currentUser?.id ?? null })
