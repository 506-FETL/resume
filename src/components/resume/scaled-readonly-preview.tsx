import type { Ref } from 'react'
import type { ResumeDocumentStateChange } from './pagination/types'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useCallback, useEffect, useState } from 'react'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'
import { getBuiltInTemplateManifest } from '@/lib/resume-template/runtime/get-built-in-manifest'
import { getManifestFromTemplateBinding } from '@/lib/resume-template/runtime/get-manifest-from-binding'
import ScaledResumeDocument from './pagination/scaled-resume-document'

interface ScaledReadonlyPreviewProps {
  data: TemplateResumeData
  appearance?: Partial<ResumeAppearanceConfig> | null
  manifest?: TemplateManifest | null
  className?: string
  documentRef?: Ref<HTMLDivElement>
  sourceRef?: Ref<HTMLDivElement>
  onDocumentStateChange?: ResumeDocumentStateChange
  onDocumentReadyChange?: (ready: boolean) => void
}

export default function ScaledReadonlyPreview({
  data,
  appearance,
  manifest: manifestOverride,
  className,
  documentRef,
  sourceRef,
  onDocumentStateChange,
  onDocumentReadyChange,
}: ScaledReadonlyPreviewProps) {
  const [manifest, setManifest] = useState(() => getBuiltInTemplateManifest(data.type))
  const documentVersion = JSON.stringify([
    data,
    manifest.id,
    manifest.version,
    appearance,
  ])

  useEffect(() => {
    let cancelled = false

    async function loadManifest() {
      if (manifestOverride) {
        setManifest(manifestOverride)
        return
      }

      const fallbackManifest = getBuiltInTemplateManifest(data.templateBinding?.basedOnResumeType ?? data.type)

      if (!data.templateBinding) {
        setManifest(fallbackManifest)
        return
      }

      try {
        const resolvedManifest = await getManifestFromTemplateBinding(data.templateBinding)
        if (!cancelled) {
          setManifest(resolvedManifest ?? fallbackManifest)
        }
      }
      catch {
        if (!cancelled) {
          setManifest(fallbackManifest)
        }
      }
    }

    loadManifest()

    return () => {
      cancelled = true
    }
  }, [data.templateBinding, data.type, manifestOverride])

  const handleDocumentStateChange: ResumeDocumentStateChange = useCallback((state) => {
    onDocumentStateChange?.(state)
    onDocumentReadyChange?.(state.status === 'ready')
  }, [onDocumentReadyChange, onDocumentStateChange])

  return (
    <ScaledResumeDocument
      appearance={appearance}
      contentVersion={documentVersion}
      documentRef={documentRef}
      sourceRef={sourceRef}
      onStateChange={handleDocumentStateChange}
      className={className}
    >
      <ResumeTemplateRuntime
        data={data}
        manifest={manifest}
        appearance={appearance}
      />
    </ScaledResumeDocument>
  )
}
