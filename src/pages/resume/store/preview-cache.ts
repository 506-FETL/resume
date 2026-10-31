import useUserStore from '@/store/user'
import { createResumePreviewStore } from './preview-cache-state'

export { createResumePreviewStore } from './preview-cache-state'

export const useResumePreviewStore = createResumePreviewStore(
  async (...args) => {
    const { generateResumePreview } =
      await import('../components/resume-card/resume-focus-preview/generate-preview')

    return generateResumePreview(...args)
  },
  useUserStore.getState().currentUser?.id ?? null,
)

useUserStore.subscribe((state) => {
  useResumePreviewStore.getState().resetAccount(state.currentUser?.id ?? null)
})
