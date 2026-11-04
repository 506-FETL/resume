import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { useRef } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'

gsap.registerPlugin(useGSAP, CustomEase)

const inkEase = CustomEase.create('resume-ink', EASE.out.join(','))

export function useDeskMotion() {
  const heroRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()

  useGSAP(
    () => {
      if (reduced) return

      const enter = gsap.timeline({
        defaults: { duration: DURATION.slow, ease: inkEase },
      })

      enter
        .from(
          '.cover-letter',
          { yPercent: 23, rotation: -6, opacity: 0, stagger: 0.035 },
          0,
        )
        .from('.cover-paperclip', { y: -18, rotation: 24 }, 0.12)
    },
    { scope: heroRef, dependencies: [reduced], revertOnUpdate: true },
  )

  return heroRef
}
