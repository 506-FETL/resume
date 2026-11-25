import { useLayoutEffect, useRef, useState } from 'react'
import { DURATION } from '@/lib/motion'
import type { DemoRole } from '../components/feature-guide/story-example'

type Spread = 'cover' | 'guide' | 'ending'

type Ranges = Record<Spread, readonly [number, number]>

interface ReadingPlace {
  spread: Spread
  progress: number
}

function measure(track: HTMLElement, frame: HTMLElement): Ranges {
  const top = track.getBoundingClientRect().top + window.scrollY
  const end = top + track.offsetHeight - frame.offsetHeight

  return {
    cover: [0, top],
    guide: [top, end],
    ending: [end, document.documentElement.scrollHeight - window.innerHeight],
  }
}

function currentPlace(ranges: Ranges): ReadingPlace {
  const y = window.scrollY

  const spread =
    y < ranges.guide[0] ? 'cover' : y < ranges.guide[1] ? 'guide' : 'ending'

  const [start, end] = ranges[spread]

  return { spread, progress: (y - start) / (end - start) }
}

function goToPlace(place: ReadingPlace, ranges: Ranges) {
  const [start, end] = ranges[place.spread]

  window.scrollTo({
    top: start + (end - start) * place.progress,
    behavior: 'instant',
  })
}

function saveReading(change: { role?: DemoRole; place?: ReadingPlace }) {
  const state = window.history.state

  window.history.replaceState(
    { ...state, homeReading: { ...state?.homeReading, ...change } },
    '',
  )
}

export function useHomeReading() {
  const [role, setRole] = useState<DemoRole>(() =>
    window.history.state?.homeReading?.role === 'frontend'
      ? 'frontend'
      : 'design',
  )

  const selectedRoleRef = useRef(role)

  useLayoutEffect(() => {
    const track = document.getElementById('guide')!
    const frame = track.querySelector<HTMLElement>('.story-frame')!

    const saved: ReadingPlace | undefined =
      window.history.state?.homeReading?.place

    let ranges = measure(track, frame)
    let viewportWidth = window.innerWidth
    let viewportHeight = window.innerHeight
    let pendingSave: number | undefined
    let restoreFrame: number | undefined

    if (saved) {
      goToPlace(saved, ranges)

      // WebKit 会在首轮布局后执行旧锚点滚动；下一帧以记录的位置收束。
      restoreFrame = window.requestAnimationFrame(() => {
        ranges = measure(track, frame)
        goToPlace(saved, ranges)
      })
    } else if (window.location.hash && window.scrollY === 0) {
      document
        .getElementById(window.location.hash.slice(1))
        ?.scrollIntoView({ behavior: 'instant' })
    }

    let reading = currentPlace(ranges)

    function rememberReading() {
      if (
        window.innerWidth !== viewportWidth ||
        window.innerHeight !== viewportHeight
      )
        return

      reading = currentPlace(ranges)
    }

    function save() {
      ranges = measure(track, frame)
      reading = currentPlace(ranges)

      saveReading({
        role: selectedRoleRef.current,
        place: reading,
      })
    }

    function saveAfterSettling() {
      // WebKit 在连续滚动时也可能逐帧派发 scrollend；等纸停下再写历史记录。
      window.clearTimeout(pendingSave)
      pendingSave = window.setTimeout(save, DURATION.slow * 1000)
    }

    function turn() {
      // 横屏变短时浏览器会先收回 scrollY；保留转屏前最后一次真实滚动的进度。
      window.clearTimeout(pendingSave)
      viewportWidth = window.innerWidth
      viewportHeight = window.innerHeight

      ranges = measure(track, frame)
      goToPlace(reading, ranges)
    }

    document.addEventListener('scroll', rememberReading, { passive: true })
    document.addEventListener('scrollend', saveAfterSettling)
    window.addEventListener('pagehide', save)
    window.addEventListener('resize', turn)

    return () => {
      window.clearTimeout(pendingSave)

      if (restoreFrame !== undefined) window.cancelAnimationFrame(restoreFrame)

      document.removeEventListener('scroll', rememberReading)
      document.removeEventListener('scrollend', saveAfterSettling)
      window.removeEventListener('pagehide', save)
      window.removeEventListener('resize', turn)
    }
  }, [])

  function selectRole(next: DemoRole) {
    selectedRoleRef.current = next
    saveReading({ role: next })
    setRole(next)
  }

  return { role, selectRole }
}
