import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { useCreationDraftStore } from '@/pages/resume/components/create-resume-card/store'

function readFrame(time: number) {
  const gallery = document.querySelector<HTMLElement>('[data-template-gallery]')
  const details = document.querySelector<HTMLElement>('[data-template-details]')

  const form = details?.querySelector<HTMLElement>(
    '[data-template-details-form]',
  )

  const background = details?.querySelector<HTMLElement>(
    '[data-template-background]',
  )

  const backgroundImage = background?.querySelector('img')

  const selected = [
    ...document.querySelectorAll<HTMLElement>(
      '[data-template-motion-card][data-template-active=true]',
    ),
  ].map((card) => {
    const rect = card.getBoundingClientRect()

    return {
      layer: card.closest('[data-template-gallery]') ? 'gallery' : 'details',
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      transform: getComputedStyle(card).transform,
      opacity: getComputedStyle(card).opacity,
    }
  })

  return {
    time: Math.round(time * 100) / 100,
    step: useCreationDraftStore.getState().step,
    selected,
    nonSelectedOpacity: [
      ...(gallery?.querySelectorAll<HTMLElement>(
        '[data-template-motion-card][data-template-active=false]',
      ) ?? []),
    ].map((card) => getComputedStyle(card.parentElement!).opacity),
    formOpacity: form ? getComputedStyle(form).opacity : null,
    formTransform: form ? getComputedStyle(form).transform : null,
    background: background
      ? {
          maskImage: getComputedStyle(background).maskImage,
          borderWidth: getComputedStyle(background).borderWidth,
          objectFit: backgroundImage
            ? getComputedStyle(backgroundImage).objectFit
            : null,
          objectPosition: backgroundImage
            ? getComputedStyle(backgroundImage).objectPosition
            : null,
          buttons: background.querySelectorAll('button').length,
          selectionFrames: background.querySelectorAll(
            '[data-template-selection]',
          ).length,
          titles: background.querySelectorAll('[title]').length,
          icons: background.querySelectorAll('svg').length,
        }
      : null,
    galleryScrollTop: gallery?.scrollTop ?? null,
    detailsScrollTop: details?.scrollTop ?? null,
    selectedSlotVisible: (() => {
      const slot = gallery?.querySelector<HTMLElement>(
        '[data-template-slot-selected=true]',
      )

      if (!slot || !gallery) return null

      const selectedRect = slot.getBoundingClientRect()
      const galleryRect = gallery.getBoundingClientRect()

      return (
        selectedRect.bottom > galleryRect.top &&
        selectedRect.top < galleryRect.bottom
      )
    })(),
    detailsLayout: (() => {
      const preview = details?.querySelector<HTMLElement>(
        '[data-template-selected-preview]',
      )

      if (!preview || !form) return null

      const previewRect = preview.getBoundingClientRect()
      const formRect = form.getBoundingClientRect()

      return {
        previewBottom: previewRect.bottom,
        previewWidth: previewRect.width,
        formTop: formRect.top,
      }
    })(),
  }
}

type Frame = ReturnType<typeof readFrame>

type Sample = {
  state: 'armed' | 'recording' | 'complete'
  startedBy: string
  frames: Frame[]
  events: { time: number; label: string }[]
}

export default function AnimationSampler({
  dialog,
}: {
  dialog: HTMLElement | null
}) {
  const outputRef = useRef<HTMLOutputElement>(null)
  const frameRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const sampleRef = useRef<Sample | null>(null)

  function publish() {
    const output = outputRef.current

    if (!output || !sampleRef.current) return

    output.dataset.state = sampleRef.current.state
    output.textContent = JSON.stringify(sampleRef.current)
  }

  function arm() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    frameRef.current = null
    sampleRef.current = {
      state: 'armed',
      startedBy: 'button',
      frames: [readFrame(0)],
      events: [],
    }

    publish()
  }

  useEffect(() => {
    function start(label: string) {
      const now = performance.now()

      if (sampleRef.current?.state === 'recording') {
        sampleRef.current.events.push({
          time: now - startTimeRef.current,
          label,
        })

        return
      }

      startTimeRef.current = now
      sampleRef.current = {
        state: 'recording',
        startedBy: label,
        frames: [readFrame(0)],
        events: [{ time: 0, label }],
      }

      publish()

      const tick = (timestamp: number) => {
        const sample = sampleRef.current

        if (!sample || sample.state !== 'recording') return

        sample.frames.push(readFrame(timestamp - startTimeRef.current))

        if (timestamp - startTimeRef.current < 600)
          frameRef.current = requestAnimationFrame(tick)
        else {
          frameRef.current = null
          sample.state = 'complete'
          publish()
        }
      }

      frameRef.current = requestAnimationFrame(tick)
    }

    function pointerDown(event: PointerEvent) {
      const button =
        event.target instanceof Element ? event.target.closest('button') : null

      const label = button?.textContent?.trim()
      const step = useCreationDraftStore.getState().step

      if (
        (step === 'template' || step === 'details') &&
        (label === '下一步' || label === '返回')
      )
        start(`pointerdown:${label}`)
    }

    const unsubscribe = useCreationDraftStore.subscribe((state, previous) => {
      if (
        state.step !== previous.step &&
        ['template', 'details'].includes(state.step) &&
        ['template', 'details'].includes(previous.step)
      )
        start(`step:${previous.step}→${state.step}`)
    })

    document.addEventListener('pointerdown', pointerDown, true)

    return () => {
      unsubscribe()
      document.removeEventListener('pointerdown', pointerDown, true)

      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return (
    <>
      <output
        ref={outputRef}
        id='creation-animation-sample'
        data-creation-motion-sample
        hidden
      />
      {dialog &&
        createPortal(
          <Button
            variant='secondary'
            size='sm'
            style={{
              position: 'absolute',
              left: 20,
              bottom: 65,
              height: 24,
              fontSize: 10,
              paddingInline: 6,
              zIndex: 20,
            }}
            onClick={arm}
            title='点击后再点下一步或返回；600ms 后可读取隐藏 output'
          >
            开始动画采样
          </Button>,
          dialog,
        )}
    </>
  )
}
