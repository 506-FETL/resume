import type {
  GenerateResumePreview,
  ResumePreviewPaper,
} from '../../../store/preview-types'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { getAccessibleResumeById } from '@/lib/resume-access'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers/transform'
import { releasePreviewPaper } from '../../../store/preview-types'
import PreviewGenerator from './preview-generator'

export const generateResumePreview: GenerateResumePreview = async (
  request,
  signal,
  retry,
) => {
  signal.throwIfAborted()

  const source = await getAccessibleResumeById(request.resumeId)

  signal.throwIfAborted()

  const snapshot = mapSourceToPersistedSnapshot(source)
  const container = document.createElement('div')

  container.inert = true
  container.setAttribute('aria-hidden', 'true')
  container.dataset.resumePreviewGenerator = request.resumeId
  container.style.cssText =
    'position:fixed;top:0;left:0;width:210mm;height:0;overflow:hidden;opacity:0;pointer-events:none'

  document.body.append(container)

  const root = createRoot(container)
  let abort: () => void

  try {
    return await new Promise<ResumePreviewPaper>((resolve, reject) => {
      abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })

      root.render(
        <ErrorBoundary fallback={null} onError={reject}>
          <PreviewGenerator
            snapshot={snapshot}
            signal={signal}
            retry={retry}
            onReady={(paper) => {
              if (signal.aborted) releasePreviewPaper(paper)
              else resolve(paper)
            }}
            onError={reject}
          />
        </ErrorBoundary>,
      )
    })
  } finally {
    signal.removeEventListener('abort', abort!)
    root.unmount()
    container.remove()
  }
}
