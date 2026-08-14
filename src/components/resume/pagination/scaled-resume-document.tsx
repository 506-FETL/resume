import type { PropsWithChildren, Ref } from 'react'
import type { ResumeDocumentStateChange } from './types'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useLayoutEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import CanonicalPagedDocument from './canonical-paged-document'

interface ScaledResumeDocumentProps {
  appearance?: Partial<ResumeAppearanceConfig> | null
  contentVersion: string
  documentRef?: Ref<HTMLDivElement>
  sourceRef?: Ref<HTMLDivElement>
  onStateChange?: ResumeDocumentStateChange
  className?: string
}

export default function ScaledResumeDocument({
  children,
  appearance,
  contentVersion,
  documentRef,
  sourceRef,
  onStateChange,
  className,
}: PropsWithChildren<ScaledResumeDocumentProps>) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [scaledSize, setScaledSize] = useState<{
    width: number
    height: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!viewport || !canvas)
      return

    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const width = canvas.offsetWidth
        const height = canvas.offsetHeight
        const nextScale = width > 0
          ? Math.min(1, viewport.clientWidth / width)
          : 1

        setScale(current =>
          Math.abs(current - nextScale) < 0.001 ? current : nextScale)
        setScaledSize((current) => {
          const next = {
            width: width * nextScale,
            height: height * nextScale,
          }
          if (
            current
            && Math.abs(current.width - next.width) < 1
            && Math.abs(current.height - next.height) < 1
          ) {
            return current
          }
          return next
        })
      })
    }

    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(canvas)
    measure()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [canvas, viewport])

  return (
    <div ref={setViewport} className={cn('w-full min-w-0', className)}>
      <div className="flex justify-center">
        <div
          className="relative"
          style={scaledSize
            ? {
                width: `${scaledSize.width}px`,
                height: `${scaledSize.height}px`,
              }
            : undefined}
        >
          <div
            ref={setCanvas}
            data-resume-scale={scale}
            className="absolute left-0 top-0 origin-top-left"
            style={{
              transform: `scale(${scale})`,
              visibility: scaledSize ? 'visible' : 'hidden',
              width: 'fit-content',
            }}
          >
            <CanonicalPagedDocument
              appearance={appearance}
              contentVersion={contentVersion}
              documentRef={documentRef}
              sourceRef={sourceRef}
              onStateChange={onStateChange}
              commentOverlayRoot
            >
              {children}
            </CanonicalPagedDocument>
          </div>
        </div>
      </div>
    </div>
  )
}
