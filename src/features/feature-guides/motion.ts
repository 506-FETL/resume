import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { CustomEase } from 'gsap/CustomEase'
import { EASE } from '@/lib/motion'

gsap.registerPlugin(useGSAP, CustomEase)

export const guideEnterEase = CustomEase.create(
  'feature-guide-enter',
  EASE.out.join(','),
)

export const guideExitEase = CustomEase.create(
  'feature-guide-exit',
  EASE.in.join(','),
)

export { gsap, useGSAP }
