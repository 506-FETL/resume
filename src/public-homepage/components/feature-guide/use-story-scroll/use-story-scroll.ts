import './registration'
import type { DemoRole } from '../story-example'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { connectStory } from './connect-story'

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
