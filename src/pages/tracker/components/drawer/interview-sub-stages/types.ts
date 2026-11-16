import type { ReactNode } from 'react'
import type { InterviewSubStage } from '../../../types'

type RoundContent = Partial<
  Pick<InterviewSubStage, 'label' | 'start_date' | 'notes'>
>

export interface InterviewSubStagesProps {
  jobId: string
  subStages: InterviewSubStage[]
  canAdd: boolean
  saveStatus: ReactNode
  onAddSubStage: () => string | null
  onDeleteSubStage: (id: string) => void
  onUpdateSubStage: (
    id: string,
    updates: RoundContent,
    immediate?: boolean,
  ) => void
  onFlush: () => void
}
