import useUserStore from '@/store/user'
import { createResumePreviewStore } from './preview-cache-state'

export { createResumePreviewStore } from './preview-cache-state'

export const useResumePreviewStore = createResumePreviewStore(
  async (request, signal, retry) => {
    const sourcePromise = import('@/lib/resume-access').then((module) => {
      signal.throwIfAborted()

      return module.getAccessibleResumeById(request.resumeId)
    })

    const [source, { prepareResumePreview }] = await Promise.all([
      sourcePromise,
      import('../components/resume-card/resume-focus-preview/generate-preview'),
    ])

    signal.throwIfAborted()

    return prepareResumePreview(source, request, signal, retry)
  },
  useUserStore.getState().currentUser?.id ?? null,
)

useUserStore.subscribe((state) => {
  useResumePreviewStore.getState().resetAccount(state.currentUser?.id ?? null)
})
