import type { FeatureGuideId } from '@/store/feature-guides'

export interface GuideStep {
  target: string
  title: string
  description: string
  hint?: string
  hintDetail?: string
  nextLabel?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  animated?: boolean
  terminal?: boolean
}

export interface FeatureGuideOptions {
  id: FeatureGuideId
  enabled: boolean
  contextKey: string
  steps: readonly GuideStep[]
  prepare?: (index: number) => boolean | void | Promise<boolean | void>
  onStop?: (reason: 'dismiss' | 'takeover' | 'context') => void
  activateTarget?: boolean
}

export interface GuideController {
  active: boolean
  target: HTMLElement | null
  index: number
  busy: boolean
  focusStep: boolean
  step: GuideStep
  count: number
  next: () => void
  close: () => void
  ready: () => void
}
