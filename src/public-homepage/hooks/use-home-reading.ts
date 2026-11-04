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
    const orientation = window.matchMedia('(orientation: portrait)')

    const saved: ReadingPlace | undefined =
      window.history.state?.homeReading?.place

    let ranges = measure(track, frame)
    let pendingSave: number | undefined

    if (saved) goToPlace(saved, ranges)
    else if (window.location.hash && window.scrollY === 0) {
      document
        .getElementById(window.location.hash.slice(1))
        ?.scrollIntoView({ behavior: 'instant' })
    }

    function save() {
      ranges = measure(track, frame)

      saveReading({
        role: selectedRoleRef.current,
        place: currentPlace(ranges),
      })
    }

    function saveAfterSettling() {
      // WebKit 在连续滚动时也可能逐帧派发 scrollend；等纸停下再写历史记录。
      window.clearTimeout(pendingSave)
      pendingSave = window.setTimeout(save, DURATION.slow * 1000)
    }

    function turn() {
      // 同一幕在横、竖屏占的滚动距离不同，先按转屏前的尺寸找出笔迹进度。
      const place = currentPlace(ranges)

      ranges = measure(track, frame)
      goToPlace(place, ranges)
    }

    document.addEventListener('scrollend', saveAfterSettling)
    window.addEventListener('pagehide', save)
    orientation.addEventListener('change', turn)

    return () => {
      window.clearTimeout(pendingSave)
      document.removeEventListener('scrollend', saveAfterSettling)
      window.removeEventListener('pagehide', save)
      orientation.removeEventListener('change', turn)
    }
  }, [])

  function selectRole(next: DemoRole) {
    selectedRoleRef.current = next
    saveReading({ role: next })
    setRole(next)
  }

  return { role, selectRole }
}
