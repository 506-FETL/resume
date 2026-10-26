import type { RefObject } from 'react'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { memo } from 'react'
import { useCheckLayout } from '../../hooks/use-check-layout'
import { useResumeChecks } from '../../hooks/use-resume-checks'

/** 检查的订阅与计算留在独立边界，不能使整个编辑页面随结果重绘。 */
function CheckRuntime({
  rootRef,
  documentState,
  review,
}: {
  rootRef: RefObject<HTMLDivElement | null>
  documentState: ResumeDocumentState
  review: boolean
}) {
  useResumeChecks()
  useCheckLayout(rootRef, documentState, review)

  return null
}

export default memo(CheckRuntime)
