import type { ResumeFont, ResumeSpacing, ResumeTheme } from '@/components/resume/runtime/context/resume-context'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'

export function useRuntimeStyles(): { font: ResumeFont, spacing: ResumeSpacing, theme: ResumeTheme } {
  const { font, spacing, theme } = useResumeContext()
  return { font, spacing, theme }
}

export function useRuntimeLayout() {
  const { layout } = useResumeContext()
  return layout
}

export { formatRange } from './duration'
