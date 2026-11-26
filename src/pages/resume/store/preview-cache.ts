import useUserStore from '@/store/user'
import { createResumePreviewStore } from './preview-cache-state'
import { readResumePreviewSource } from './preview-source'

export { createResumePreviewStore } from './preview-cache-state'

export const useResumePreviewStore = createResumePreviewStore(
  async (request, signal, retry) => {
    const [source, { prepareResumePreview }] = await Promise.all([
      readResumePreviewSource(request, signal),
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
