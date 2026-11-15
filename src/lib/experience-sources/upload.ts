import type { ExtractedExperienceFile } from './types'
import { saveExperienceSource } from './api'
import { useExperienceSourcesStore } from '@/store/experience-sources'

export async function persistExperienceUpload(options: {
  operationId: string
  sourceId?: string
  conversationId?: string
  name: string
  file?: File
  text?: string
  extracted?: ExtractedExperienceFile
  controller: AbortController
  onExtracted: (value: ExtractedExperienceFile) => void
  onSaving: () => void
}) {
  const generation = useExperienceSourcesStore.getState().generation
  const signal = options.controller.signal

  const unsubscribe = useExperienceSourcesStore.subscribe((state) => {
    if (state.generation !== generation) options.controller.abort()
  })

  try {
    let extracted = options.extracted

    if (!extracted) {
      const extract = await import('./extract')

      signal.throwIfAborted()

      extracted = options.file
        ? await extract.extractExperienceFile(options.file, signal)
        : extract.extractExperienceText(options.text ?? '', options.name)

      options.onExtracted(extracted)
    }

    signal.throwIfAborted()
    options.onSaving()

    return await saveExperienceSource({
      operationId: options.operationId,
      sourceId: options.sourceId,
      conversationId: options.conversationId,
      name: options.name,
      extracted,
      file: options.file,
      signal,
    })
  } finally {
    unsubscribe()
  }
}
