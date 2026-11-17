import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION } from '@/lib/motion'
import { gsap, useGSAP, guideEnterEase, guideExitEase } from '../../motion'
import type { GuideController } from '../../types'
import GuideContent from './content'
import { cn } from '@/lib/utils'

export default function GuidePopover({
  guide,
  onElement,
}: {
  guide: GuideController
  onElement: (element: HTMLDivElement | null) => void
}) {
  const { active, target, step, index } = guide
  const [open, setOpen] = useState(active)
  const [topInset, setTopInset] = useState(12)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const reduced = useReducedMotion()
  const mobile = useIsMobile()
  const commentHeader = target?.matches('[data-feature-guide-comment-header]')

  const panelHeader =
    commentHeader || target?.matches('[data-feature-guide-canvas-header]')

  const side =
    mobile && panelHeader
      ? commentHeader
        ? 'top'
        : 'bottom'
      : (step.side ?? 'top')

  const mobileCommentHint =
    mobile && index === 0 && target?.matches('[data-resume-comment-trigger]')

  const virtualRef = useMemo(
    () => ({
      current: mobileCommentHint
        ? {
            getBoundingClientRect: () => {
              const rect = target!.getBoundingClientRect()

              return new DOMRect(
                rect.x,
                topInset + 14 - rect.height / 2,
                rect.width,
                rect.height,
              )
            },
          }
        : target!,
    }),
    [target, mobileCommentHint, topInset],
  )

  const setContent = useCallback(
    (element: HTMLDivElement | null) => {
      contentRef.current = element
      onElement(element)
    },
    [onElement],
  )

  useLayoutEffect(() => {
    if (active) setOpen(true)
  }, [active])

  useLayoutEffect(() => {
    const toolbar = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-inset"] > header',
    )

    if (!mobile || index !== 0 || !toolbar) {
      setTopInset(12)

      return
    }

    const update = () => setTopInset(toolbar.getBoundingClientRect().bottom)
    const observer = new ResizeObserver(update)

    observer.observe(toolbar)
    update()

    return () => observer.disconnect()
  }, [mobile, index])

  useLayoutEffect(() => {
    if (guide.focusStep && index > 0)
      contentRef.current?.focus({ preventScroll: true })
  }, [guide.focusStep, index])

  useLayoutEffect(() => {
    if (!guide.busy && document.activeElement === contentRef.current) {
      contentRef.current
        ?.querySelector<HTMLElement>('[data-feature-guide-next]')
        ?.focus({ preventScroll: true })
    }
  }, [guide.busy])

  useGSAP(
    () => {
      const element = contentRef.current

      if (!element || !open) return

      if (active) {
        element.inert = false

        gsap.fromTo(
          element,
          { autoAlpha: 0, y: reduced ? 0 : 3, scale: reduced ? 1 : 0.99 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: reduced ? 0 : DURATION.base,
            ease: guideEnterEase,
          },
        )
      } else {
        if (element.contains(document.activeElement)) {
          const fallback = document.querySelector<HTMLElement>(
            '[data-resume-comment-trigger], #assistant-canvas-trigger, [data-feature-guide-sort]',
          )

          fallback?.focus({ preventScroll: true })
        }

        element.inert = true

        gsap.to(element, {
          autoAlpha: 0,
          y: reduced ? 0 : 4,
          duration: reduced ? 0 : DURATION.fast,
          ease: guideExitEase,
          onComplete: () => setOpen(false),
        })
      }
    },
    {
      scope: contentRef,
      dependencies: [active, open, index, reduced],
      revertOnUpdate: true,
    },
  )

  if (!target) return null

  return (
    <Popover open={open} modal={false}>
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        ref={setContent}
        portalContainer={
          index === 0
            ? target.closest<HTMLElement>('[data-slot="drawer-content"]')
            : undefined
        }
        data-feature-guide-ui
        data-guide-step={index}
        tabIndex={-1}
        aria-label={step.title}
        side={side}
        align={panelHeader ? 'start' : 'center'}
        alignOffset={
          panelHeader && !mobile
            ? target.getBoundingClientRect().height + 12
            : 0
        }
        sideOffset={index === 0 ? 32 : 14}
        collisionPadding={{ top: topInset, bottom: 12, left: 12, right: 12 }}
        updatePositionStrategy='always'
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        className={cn(
          'feature-guide-popover z-80 overflow-y-auto rounded-xl bg-popover/95 shadow-sm ring-1 ring-border/70 backdrop-blur-sm',
          index === 0
            ? 'w-max max-w-[calc(100vw-4.5rem)] gap-0 p-1 max-md:p-0.5'
            : 'w-[min(15.5rem,calc(100vw-1.5rem))] gap-2 p-3',
        )}
        style={{ animation: 'none', maxHeight: 'calc(100dvh - 24px)' }}
      >
        <GuideContent guide={guide} />
      </PopoverContent>
    </Popover>
  )
}
