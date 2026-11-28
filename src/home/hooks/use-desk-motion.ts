import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { useRef } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE, staggerDelay } from '@/lib/motion'

gsap.registerPlugin(useGSAP, CustomEase)

const inkEase = CustomEase.create('resume-ink', EASE.out.join(','))
const pressEase = CustomEase.create('resume-stamp-press', EASE.in.join(','))

export function useDeskMotion() {
  const homeRef = useRef<HTMLDivElement>(null)
  const skipIntroRef = useRef(false)
  const reduced = useReducedMotion()

  useGSAP(
    () => {
      if (reduced) skipIntroRef.current = true
      if (skipIntroRef.current || !startsOnCover()) return

      const intro = buildCoverIntro()
      const events = new AbortController()
      const finish = () => intro.progress(1)

      intro.eventCallback('onComplete', () => events.abort())
      window.addEventListener('pagehide', finish, { signal: events.signal })

      window.addEventListener(
        'scroll',
        () => {
          if (window.scrollY > 0) finish()
        },
        { passive: true, signal: events.signal },
      )

      return () => events.abort()
    },
    { scope: homeRef, dependencies: [reduced], revertOnUpdate: true },
  )

  return homeRef
}

function startsOnCover() {
  const [navigation] = performance.getEntriesByType(
    'navigation',
  ) as PerformanceNavigationTiming[]

  return (
    window.scrollY === 0 &&
    (!window.location.hash || window.location.hash === '#top') &&
    navigation?.type !== 'back_forward'
  )
}

function buildCoverIntro() {
  const intro = gsap.timeline({
    defaults: { duration: DURATION.slow, ease: inkEase },
  })

  const letters = {
    yPercent: 14,
    rotation: -5,
    opacity: 0,
    stagger: staggerDelay(1),
  }

  // 入袋只移动裁切内的纸，外层纸张和夹袋的坐标由滚动演示控制。
  return intro
    .from('.cover-letter:nth-child(-n+2)', letters, 0)
    .from('.cover-letter:nth-child(n+3)', letters, DURATION.fast)
    .from(
      '[data-cover-insert]',
      { x: 13, y: -46, rotation: 4, svgOrigin: '320 213', opacity: 0 },
      DURATION.base,
    )
    .fromTo(
      '[data-cover-stamp]',
      { autoAlpha: 0, x: 24, y: -52, rotation: 9, svgOrigin: '430 278' },
      { autoAlpha: 1, x: 4, y: -24, rotation: 3, duration: DURATION.base },
      DURATION.slow + DURATION.fast,
    )
    .to('[data-cover-stamp]', {
      x: 0,
      y: 0,
      rotation: 0,
      duration: DURATION.fast,
      ease: pressEase,
    })
    .addLabel('contact')
    .from(
      '[data-cover-postmark]',
      { opacity: 0, duration: DURATION.fast / 2 },
      'contact',
    )
    .to('[data-cover-stamp]', {
      autoAlpha: 0,
      x: 12,
      y: -42,
      rotation: 6,
      duration: DURATION.base,
    })
}
