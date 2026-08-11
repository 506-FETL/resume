import type { Ref } from 'react'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useEffect, useLayoutEffect, useState } from 'react'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'
import { getBuiltInTemplateManifest } from '@/lib/resume-template/runtime/get-built-in-manifest'
import { getManifestFromTemplateBinding } from '@/lib/resume-template/runtime/get-manifest-from-binding'
import { cn } from '@/lib/utils'
import PagedResumeShell from './paged-resume-shell'

interface ScaledReadonlyPreviewProps {
  data: TemplateResumeData
  appearance?: Partial<ResumeAppearanceConfig> | null
  manifest?: TemplateManifest | null
  className?: string
  documentRef?: Ref<HTMLDivElement>
  onDocumentReadyChange?: (ready: boolean) => void
}

export default function ScaledReadonlyPreview({
  data,
  appearance,
  manifest: manifestOverride,
  className,
  documentRef,
  onDocumentReadyChange,
}: ScaledReadonlyPreviewProps) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [scaledHeight, setScaledHeight] = useState<number | null>(null)
  const [scaledWidth, setScaledWidth] = useState<number | null>(null)
  const [manifest, setManifest] = useState(() => getBuiltInTemplateManifest(data.type))
  const documentVersion = JSON.stringify([
    data,
    manifest.id,
    manifest.version,
    appearance,
  ])

  useEffect(() => {
    onDocumentReadyChange?.(false)
  }, [data, manifestOverride, onDocumentReadyChange])

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

  useLayoutEffect(() => {
    if (!viewport || !canvas) {
      return
    }

    let frameId = 0

    const measure = () => {
      cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        const availableWidth = viewport.clientWidth
        const contentWidth = canvas.offsetWidth
        const contentHeight = canvas.offsetHeight

        if (!availableWidth || !contentWidth || !contentHeight) {
          setScale(1)
          setScaledWidth(null)
          setScaledHeight(null)
          return
        }

        const nextScale = Math.min(1, availableWidth / contentWidth)
        setScale(current => Math.abs(current - nextScale) < 0.001 ? current : nextScale)
        setScaledWidth((current) => {
          const nextWidth = contentWidth * nextScale
          return current !== null && Math.abs(current - nextWidth) < 1 ? current : nextWidth
        })
        setScaledHeight((current) => {
          const nextHeight = contentHeight * nextScale
          return current !== null && Math.abs(current - nextHeight) < 1 ? current : nextHeight
        })
      })
    }

    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(viewport)
    resizeObserver.observe(canvas)
    window.addEventListener('resize', measure)
    measure()

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [canvas, data, viewport])

  return (
    <div ref={setViewport} className={cn('w-full min-w-0', className)}>
      <div className="flex justify-center">
        <div
          className="relative"
          style={scaledHeight === null || scaledWidth === null
            ? undefined
            : {
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
              }}
        >
          <div
            ref={setCanvas}
            className="absolute left-0 top-0 origin-top-left"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              visibility: scaledHeight === null || scaledWidth === null ? 'hidden' : 'visible',
              width: 'fit-content',
            }}
          >
            <PagedResumeShell
              ref={documentRef}
              appearance={appearance}
              onReadyChange={onDocumentReadyChange}
              contentVersion={documentVersion}
            >
              <ResumeTemplateRuntime data={data} manifest={manifest} appearance={appearance} />
            </PagedResumeShell>
          </div>
        </div>
      </div>
    </div>
  )
}
