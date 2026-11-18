import type {
  ResumePreviewRequest,
  ResumePreviewPaper,
  RenderResumePreview,
} from '../../../store/preview-types'
import type { AccessibleResumeRecord } from '@/lib/resume-access'
import type { PersistedResumeSnapshot } from '@/lib/schema/resume/persisted'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { resolveTemplateReference } from '@/lib/resume-template/binding'
import { templateKey } from '@/lib/resume-template/source/types'
import { useResumeTemplateStore } from '@/store/resume-template'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers/transform'
import { releasePreviewPaper } from '../../../store/preview-types'
import PreviewGenerator from './preview-generator'

export async function prepareResumePreview(
  source: AccessibleResumeRecord,
  request: ResumePreviewRequest,
  signal: AbortSignal,
  retry: boolean,
): Promise<RenderResumePreview> {
  signal.throwIfAborted()

  const snapshot = mapSourceToPersistedSnapshot(source)
  const ref = resolveTemplateReference(snapshot.templateBinding)

  await useResumeTemplateStore.getState().loadDefinition(ref)

  signal.throwIfAborted()

  const resource =
    useResumeTemplateStore.getState().definitions[templateKey(ref)]

  if (resource?.status === 'error') throw resource.error

  return () => generateResumePreview(snapshot, request.resumeId, signal, retry)
}

async function generateResumePreview(
  snapshot: PersistedResumeSnapshot,
  resumeId: string,
  signal: AbortSignal,
  retry: boolean,
) {
  signal.throwIfAborted()

  const container = document.createElement('div')

  container.inert = true
  container.setAttribute('aria-hidden', 'true')
  container.dataset.resumePreviewGenerator = resumeId
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
