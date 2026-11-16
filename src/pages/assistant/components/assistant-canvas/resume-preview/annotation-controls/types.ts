import type { RefObject, Dispatch, SetStateAction } from 'react'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { CommentAnchorDocumentResult } from '@/features/resume-comments/anchors/types'
import type { resolveCanvasSelection } from '../selection'

export interface AnnotationControlsProps {
  rootRef: RefObject<HTMLDivElement | null>
  model: CommentAnchorDocumentResult
  data: TemplateResumeData
  resumeId: string
  name: string
}

export type AnnotationSelection = {
  value: NonNullable<ReturnType<typeof resolveCanvasSelection>>
  documentHash: string
  resumeId: string
} | null

export interface AnnotationSelectionOptions extends Pick<
  AnnotationControlsProps,
  'rootRef' | 'model' | 'resumeId'
> {
  pointerSelectingRef: RefObject<boolean>
  keyboardFieldRef: RefObject<HTMLElement | null>
  setSelected: Dispatch<SetStateAction<AnnotationSelection>>
}
