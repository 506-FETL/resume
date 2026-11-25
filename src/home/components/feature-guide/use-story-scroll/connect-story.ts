import './registration'
import type { DemoRole } from '../story-example'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DURATION } from '@/lib/motion'
import { chapters, totalBeats } from '../chapters'
import { art } from '../editing-motion'
import { createFolderOpening } from '../folder-opening'
import { buildPaperTimeline } from './paper-timeline'

export function connectStory(
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
