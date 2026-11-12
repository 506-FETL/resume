import type { DemoRole } from './story-example'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { chapters, totalBeats } from './chapters'
import { drawStroke, traceWithPencil } from '../ink-motion'
import { addEditingMotion, art } from './editing-motion'
import { createFolderOpening } from './folder-opening'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const left = '[data-swatch="left"]'
const right = '[data-swatch="right"]'
const folder = [art('folder-back'), art('folder-front')].join(',')
const endTime = chapters.length

function buildPaperTimeline(
  track: HTMLElement,
  role: DemoRole,
  portrait: boolean,
) {
  const sheet = art('resume')
  const ticket = art('link')
  const stamp = art('stamp')
  const handle = art('stamp-tool')
  const calendarPencil = art('calendar-pencil')
  const dateCircle = track.querySelector<SVGPathElement>('[data-date-circle]')!
  const dateStart = dateCircle.getPointAtLength(0)
  const dateEnd = dateCircle.getPointAtLength(dateCircle.getTotalLength())

  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: 'sine.inOut' },
  })

  gsap.set('[data-camera="paper"]', { svgOrigin: '320 238' })
  gsap.set(sheet, { svgOrigin: '320 213', x: 0, y: 0, rotation: 0 })
  gsap.set(art('layout'), { opacity: 0 })

  gsap.set(ticket, {
    autoAlpha: 0,
    x: -96,
    y: -12,
    rotation: -19,
    scale: 0.8,
    svgOrigin: '420 270',
  })

  gsap.set(handle, {
    autoAlpha: 0,
    x: 43,
    y: -82,
    rotation: 18,
    svgOrigin: '354 331',
  })

  gsap.set(stamp, {
    autoAlpha: 0,
    scale: 1.04,
    rotation: 10,
    svgOrigin: '354 331',
  })

  gsap.set(folder, { autoAlpha: 0, y: 180 })

  gsap.set(art('receipt'), {
    autoAlpha: 0,
    y: -63,
    x: 32,
    rotation: -14,
    svgOrigin: '450 330',
  })

  gsap.set(
    [
      art('versions'),
      art('interview'),
      art('interview-status'),
      art('confirm-followup'),
    ].join(','),
    { autoAlpha: 0 },
  )

  gsap.set(art('versions'), { x: 32, rotation: 4, svgOrigin: '145 161' })
  gsap.set(art('interview'), { y: -51, rotation: 12, svgOrigin: '228 328' })
  gsap.set(art('version-selection'), { y: 44 })

  gsap.set(calendarPencil, {
    autoAlpha: 0,
    x: dateStart.x + 24,
    y: dateStart.y - 30,
    rotation: -7,
    scale: 0.48,
    svgOrigin: '0 0',
  })

  const captions = track.querySelectorAll<HTMLElement>('.story-caption')

  gsap.set(captions, { autoAlpha: 0, y: 8 })
  gsap.set(captions[0], { autoAlpha: 1, y: 0 })

  captions.forEach((caption, index) => {
    if (index === 0) return

    timeline
      .to(
        captions[index - 1],
        { autoAlpha: 0, y: -8, duration: 0.1 },
        index - 0.1,
      )
      .to(caption, { autoAlpha: 1, y: 0, duration: 0.14 }, index)
  })

  timeline
    .addLabel('template', 0)
    .to('.story-checklist [data-arrow-shaft]', drawStroke(0.23), 0.03)
    .to('.story-checklist [data-arrow-head]', drawStroke(0.09), 0.26)
    .to('.story-checklist .story-underline path', drawStroke(0.23), 0.06)
    .to('[data-template-check]', { ...drawStroke(0.12), stagger: 0.3 }, 0.28)
    .to('[data-swatch-check]', drawStroke(0.18), 0.15)
    .to(left, { attr: { transform: 'rotate(-31 320 357)' }, duration: 0.21 }, 0)
    .to(right, { attr: { transform: 'rotate(29 320 357)' }, duration: 0.24 }, 0)
    .to(sheet, { rotation: -3, y: -20, x: -10, duration: 0.29 }, 0.05)
    .to(
      left,
      { attr: { transform: 'rotate(-3 320 357)' }, duration: 0.48 },
      0.29,
    )
    .to(
      right,
      { attr: { transform: 'rotate(4 320 357)' }, duration: 0.42 },
      0.33,
    )
    .to(sheet, { x: 0, y: 0, rotation: 0, duration: 0.38 }, 0.38)
    .to(art('layout'), { opacity: 1, duration: 0.32 }, 0.4)
    .to('[data-section-mark]', { ...drawStroke(0.13), stagger: 0.13 }, 0.46)
    .to(art('swatches'), { autoAlpha: 0, duration: 0.22 }, 0.77)

  timeline
    .to('.story-clipping [data-arrow-shaft]', drawStroke(0.18), 1.08)
    .to('.story-clipping [data-arrow-head]', drawStroke(0.07), 1.26)

  addEditingMotion(timeline, track, role, portrait)

  const combined = [
    art('rewrite'),
    '[data-field="description"]',
    '[data-field="date"]',
  ].join(',')

  timeline
    .addLabel('compare', 4)
    .to(
      art('versions'),
      { autoAlpha: 1, x: 0, rotation: 0, duration: 0.27 },
      'compare',
    )
    .to(art('version-selection'), { y: 0, duration: 0.16 }, 4.16)
    .to(combined, { opacity: 0, duration: 0.08 }, 4.25)
    .to(art('original'), { opacity: 1, duration: 0.1 }, 4.33)
    .to(art('version-selection'), { y: 44, duration: 0.16 }, 4.62)
    .to(art('original'), { opacity: 0, duration: 0.08 }, 4.66)
    .to(combined, { opacity: 1, duration: 0.12 }, 4.74)
    .to(art('versions'), { autoAlpha: 0, x: 22, duration: 0.15 }, 4.96)
    .addLabel('share', 5)
    .to(
      '.story-pair .story-underline path',
      { ...drawStroke(0.25), stagger: 0.33 },
      5.17,
    )
    .to('[data-camera="paper"]', { scale: 1, y: 0, x: -16, duration: 0.3 }, 5.0)
    .to(sheet, { rotation: -4, x: -25, y: -12, duration: 0.32 }, 'share')
    .to(
      handle,
      { autoAlpha: 1, x: 3, y: -34, rotation: 2, duration: 0.2 },
      5.02,
    )
    .to(
      handle,
      { y: 0, x: 0, rotation: 0, duration: 0.14, ease: 'power2.in' },
      5.22,
    )
    .addLabel('stamp-contact', 5.36)
    .to(
      stamp,
      { autoAlpha: 1, rotation: 0, scale: 1, duration: 0.06 },
      'stamp-contact',
    )
    .to(
      handle,
      { x: 18, y: -62, rotation: 9, autoAlpha: 0, duration: 0.21 },
      5.43,
    )
    .to(sheet, { y: -9, duration: 0.06 }, 'stamp-contact')
    .to(sheet, { y: -12, duration: 0.12 }, 5.43)
    .to(
      ticket,
      { autoAlpha: 1, x: -12, y: 0, scale: 1, rotation: 8, duration: 0.28 },
      5.48,
    )
    .to(ticket, { rotation: 0, duration: 0.12 }, 5.76)
    .addLabel('file', 6)
    .to('[data-camera="paper"]', { x: 0, duration: 0.28 }, 'file')
    .to(
      ticket,
      { x: 62, y: -46, rotation: 14, autoAlpha: 0, duration: 0.24 },
      'file',
    )
    .to(
      sheet,
      { y: -40, x: 0, scale: 0.9, rotation: 4, duration: 0.26 },
      'file',
    )
    .to(folder, { y: 0, autoAlpha: 1, duration: 0.36 }, 6.1)
    .to(sheet, { y: 37, rotation: -2, scale: 0.84, duration: 0.34 }, 6.36)
    .to(
      art('receipt'),
      { autoAlpha: 1, y: 0, x: 0, rotation: 0, duration: 0.28 },
      6.61,
    )
    .to('[data-receipt-check]', drawStroke(0.1), 6.89)
    .addLabel('follow-up', 7)
    .to(art('confirm-followup'), { autoAlpha: 1, duration: 0.12 }, 7.08)
    .to('[data-followup-confirm-ink]', drawStroke(0.08), 7.23)
    .to(art('interview-status'), { autoAlpha: 1, duration: 0.16 }, 7.32)
    .to(art('confirm-followup'), { autoAlpha: 0, duration: 0.12 }, 7.51)
    .to(
      art('interview'),
      { autoAlpha: 1, y: 0, rotation: 0, duration: 0.22 },
      7.34,
    )
    .to(
      calendarPencil,
      {
        autoAlpha: 1,
        x: dateStart.x,
        y: dateStart.y,
        rotation: 0,
        duration: 0.1,
      },
      7.57,
    )

  traceWithPencil(timeline, calendarPencil, dateCircle, 7.67, 0.21)

  timeline
    .to(
      calendarPencil,
      {
        autoAlpha: 0,
        x: dateEnd.x + 22,
        y: dateEnd.y - 30,
        rotation: 8,
        duration: 0.1,
      },
      7.88,
    )
    .addLabel('end', endTime)

  return timeline
}

function connectStory(
  track: HTMLElement,
  role: DemoRole,
  reduced: boolean,
  portrait: boolean,
  showStep: (index: number) => void,
) {
  const frame = track.querySelector<HTMLElement>('.story-frame')!
  const opening = createFolderOpening(track, reduced)
  const timeline = buildPaperTimeline(track, role, portrait)
  const captions = track.querySelectorAll('.story-caption')
  const playhead = { position: 0 }
  let start = 0
  let guideTop = 0
  let handoff = 0
  let end = 0
  let previousOpening = -1
  let previousScroll = -1
  let renderFrame: number | undefined
  let layoutChanged = false
  let current = -1
  let mounted = true

  function measure() {
    layoutChanged = false
    opening.refreshLayout()
    start = opening.start()
    handoff = opening.handoff()
    guideTop = track.getBoundingClientRect().top + window.scrollY
    end = guideTop + track.offsetHeight - frame.offsetHeight
    previousOpening = -1
  }

  function render() {
    if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame)

    renderFrame = undefined

    if (layoutChanged) {
      driver.refresh()

      return
    }

    const scrollY = window.scrollY
    const y = end * playhead.position
    const open = gsap.utils.clamp(0, 1, (y - start) / (guideTop - start))

    const beat = gsap.utils.clamp(
      0,
      totalBeats,
      ((y - guideTop) / (end - guideTop)) * totalBeats,
    )

    const next = chapters.findIndex((chapter) => beat < chapter.end)
    const index = next === -1 ? chapters.length - 1 : next
    const chapter = chapters[index]
    const time = index + (beat - chapter.start) / chapter.beats

    timeline.time(reduced ? (open < 1 ? 0 : chapter.pose) : time)

    if (reduced) {
      gsap.set(captions, {
        autoAlpha: (i: number) => (i === index ? 1 : 0),
        y: 0,
      })

      gsap.set([art('pencil'), art('calendar-pencil')].join(','), {
        autoAlpha: 0,
      })
    }

    // 缓动与原生滚动共用一次绘制，封面停在起点时仍跟随页面位置。
    if (
      open !== previousOpening ||
      ((scrollY < handoff || previousScroll < handoff) &&
        scrollY !== previousScroll)
    )
      opening.draw(open, scrollY)

    previousOpening = open
    previousScroll = scrollY

    if (index === current) return

    current = index
    showStep(index)
  }

  function scheduleRender() {
    if (renderFrame !== undefined) return

    renderFrame = window.requestAnimationFrame(render)
  }

  function scheduleLayout() {
    layoutChanged = true
    scheduleRender()
  }

  measure()

  const scrub = gsap.to(playhead, {
    position: 1,
    paused: true,
    ease: 'none',
    duration: 1,
    onUpdate: scheduleRender,
  })

  const driver = ScrollTrigger.create({
    // 开夹开始前仍跟踪页头滚出，避免固定画布到起点时一次补偿整段位移。
    start: 0,
    end: () => end,
    animation: scrub,
    scrub: reduced ? true : DURATION.slow,
    onRefreshInit: measure,
    onRefresh: (self) => {
      scrub.progress(self.progress)
      render()
    },
    onUpdate: scheduleRender,
  })

  document.fonts.ready.then(() => {
    if (mounted) driver.refresh()
  })

  window.addEventListener('resize', scheduleLayout)

  return () => {
    mounted = false
    window.removeEventListener('resize', scheduleLayout)

    if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame)
  }
}

export function useStoryScroll(role: DemoRole) {
  const trackRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)

  useGSAP(
    () => {
      const track = trackRef.current!
      const media = gsap.matchMedia(track)

      media.add(
        {
          all: 'all',
          portrait: '(max-width: 1024px) and (orientation: portrait)',
        },
        (context) =>
          connectStory(
            track,
            role,
            reduced,
            Boolean(context.conditions?.portrait),
            setStep,
          ),
      )

      return () => media.revert()
    },
    { scope: trackRef, dependencies: [role, reduced], revertOnUpdate: true },
  )

  return { trackRef, step }
}
