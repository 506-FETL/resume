import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePresence } from 'motion/react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION } from '@/lib/motion'
import { gsap, useGSAP, guideEnterEase, guideExitEase } from '../../motion'
import type { GuideController } from '../../types'
import GuideContent from './content'
import { usePopoverTravel } from './use-popover-travel'
import { cn } from '@/lib/utils'

export default function GuidePopover({
  guide,
  reveal,
  onElement,
}: {
  guide: GuideController
  reveal: boolean
  onElement: (element: HTMLDivElement | null) => void
}) {
  const { target, step, targetIndex: index } = guide
  const [present, safeToRemove] = usePresence()
  const removeRef = useRef(safeToRemove)
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [card, setCard] = useState<HTMLDivElement | null>(null)
  const mobile = useIsMobile()

  const mobileSortingHint =
    mobile && index === 0 && target?.matches('[data-feature-guide-sort]')

  // 排序提示位于抽屉上方，须避开内容层裁切并保留抽屉焦点范围。
  const [portalContainer] = useState(() =>
    target?.closest<HTMLElement>(
      mobileSortingHint
        ? '[data-slot="drawer-popup"]'
        : '[data-slot="drawer-content"]',
    ),
  )

  const [positioned, setPositioned] = useState(false)
  const [topInset, setTopInset] = useState(12)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const anchorRectRef = useRef<DOMRect | null>(null)
  const presentRef = useRef(present)
  const reduced = useReducedMotion()

  presentRef.current = present
  removeRef.current = safeToRemove

  usePopoverTravel({
    element,
    card,
    index,
    present,
    reduced,
    onArrive: guide.presented,
  })

  const finishExit = useCallback(() => {
    // 零时长的完成回调也须等父级 Presence 登记本次退出。
    queueMicrotask(() => {
      if (!presentRef.current) removeRef.current?.()
    })
  }, [])

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
      current: {
        contextElement: target!,
        getBoundingClientRect: () => {
          if (presentRef.current || !anchorRectRef.current) {
            const rect = target!.getBoundingClientRect()

            anchorRectRef.current = mobileCommentHint
              ? new DOMRect(
                  Math.max(
                    rect.x,
                    (contentRef.current?.offsetWidth ?? 0) + 80 + 12,
                  ),
                  topInset + 14 - rect.height / 2,
                  rect.width,
                  rect.height,
                )
              : mobileSortingHint
                ? new DOMRect(
                    rect.x,
                    Math.max(
                      rect.y,
                      (contentRef.current?.offsetHeight ?? 0) + 80 + 12,
                    ),
                    rect.width,
                    rect.height,
                  )
                : rect
          }

          return anchorRectRef.current
        },
      },
    }),
    [target, mobileCommentHint, mobileSortingHint, topInset],
  )

  const setContent = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node
    setElement(node)
  }, [])

  useLayoutEffect(() => {
    onElement(positioned ? element : null)

    return () => onElement(null)
  }, [element, onElement, positioned])

  useLayoutEffect(() => {
    const toolbar = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-inset"] > header',
    )

    if (!mobile || index !== 0 || mobileSortingHint || !toolbar) {
      setTopInset(12)

      return
    }

    const update = () => setTopInset(toolbar.getBoundingClientRect().bottom)
    const observer = new ResizeObserver(update)

    observer.observe(toolbar)
    update()

    return () => observer.disconnect()
  }, [mobile, index, mobileSortingHint])

  useLayoutEffect(() => {
    if (
      present &&
      guide.presentedIndex === index &&
      guide.focusStep &&
      index > 0
    )
      contentRef.current?.focus({ preventScroll: true })
  }, [guide.focusStep, guide.presentedIndex, index, present])

  useLayoutEffect(() => {
    if (
      present &&
      guide.presentedIndex === index &&
      !guide.busy &&
      document.activeElement === contentRef.current
    ) {
      contentRef.current
        ?.querySelector<HTMLElement>('[data-feature-guide-next]')
        ?.focus({ preventScroll: true })
    }
  }, [guide.busy, guide.presentedIndex, index, present])

  useGSAP(
    () => {
      if (!element || !positioned) {
        if (!present) finishExit()

        return
      }

      if (!present && element.contains(document.activeElement)) {
        document
          .querySelector<HTMLElement>(
            '[data-resume-comment-trigger], #assistant-canvas-trigger, [data-feature-guide-sort]',
          )
          ?.focus({ preventScroll: true })
      }

      element.inert = !present || !reveal

      if (present && !reveal) {
        gsap.set(element, {
          autoAlpha: 0,
          y: reduced ? 0 : 8,
          scale: reduced ? 1 : 0.98,
        })

        return
      }

      gsap.to(element, {
        autoAlpha: present ? 1 : 0,
        y: reduced || present ? 0 : 4,
        scale: 1,
        duration: reduced ? 0 : present ? DURATION.slow : DURATION.fast,
        ease: present ? guideEnterEase : guideExitEase,
        overwrite: true,
        onComplete: () => {
          if (!present) finishExit()
          else guide.presented(index)
        },
      })
    },
    {
      scope: contentRef,
      dependencies: [element, finishExit, present, positioned, reduced, reveal],
    },
  )

  if (!target) return null

  return (
    <Popover open modal={false}>
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        ref={setContent}
        portalContainer={portalContainer}
        data-feature-guide-ui
        data-guide-step={index}
        data-guide-presented={guide.presentedIndex === index || undefined}
        data-guide-exiting={!present || undefined}
        aria-hidden={!reveal || undefined}
        tabIndex={-1}
        aria-label={step.title}
        side={side}
        align={panelHeader ? 'start' : 'center'}
        alignOffset={
          panelHeader && !mobile
            ? virtualRef.current.getBoundingClientRect().height + 12
            : 0
        }
        sideOffset={index === 0 ? 80 : 14}
        collisionPadding={{ top: topInset, bottom: 12, left: 12, right: 12 }}
        updatePositionStrategy='always'
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          setPositioned(true)
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        className='feature-guide-popover z-80 w-max gap-0 bg-transparent p-0 shadow-none ring-0'
      >
        <div
          ref={setCard}
          data-feature-guide-card
          className={cn(
            'flex flex-col overflow-y-auto rounded-xl bg-popover/95 shadow-sm ring-1 ring-border/70 backdrop-blur-sm',
            index === 0
              ? 'w-max max-w-[calc(100vw-4.5rem)] gap-0 p-1 max-md:p-0.5'
              : 'w-[min(15.5rem,calc(100vw-1.5rem))] gap-2 p-3',
          )}
          style={{ maxHeight: 'calc(100dvh - 24px)' }}
        >
          <GuideContent guide={{ ...guide, index }} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
