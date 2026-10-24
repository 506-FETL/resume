import type { Editor } from '@tiptap/react'
import type { ApplicationStatus } from '../../../types'
import { memo, useCallback } from 'react'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import useTrackerStore from '../../../store'

type WorkflowNotesEditorProps = { jobId: string } & (
  | { kind: 'stage'; targetId: ApplicationStatus }
  | { kind: 'round'; targetId: string }
)

function WorkflowNotesEditor({
  jobId,
  kind,
  targetId,
}: WorkflowNotesEditorProps) {
  const notes = useTrackerStore((state) => {
    const job =
      state.selectedJob?.id === jobId
        ? state.selectedJob
        : state.jobs.find((item) => item.id === jobId)
    return (
      (kind === 'stage'
        ? job?.stage_details.find((stage) => stage.stage === targetId)?.notes
        : job?.interview_sub_stages.find((round) => round.id === targetId)
            ?.notes) ?? ''
    )
  })
  const handleChange = useCallback(
    (editor: Editor) => {
      const notes = editor.getHTML()
      if (kind === 'stage')
        useTrackerStore.getState().editStageContent(jobId, targetId, { notes })
      else
        useTrackerStore
          .getState()
          .editInterviewRound(jobId, targetId, { notes })
    },
    [jobId, kind, targetId],
  )

  // 编辑身份变化时重建实例，避免不同职位、阶段或轮次共享撤销历史。
  return (
    <SimpleEditor
      key={`${jobId}-${kind}-${targetId}`}
      content={notes}
      onChange={handleChange}
    />
  )
}

export default memo(WorkflowNotesEditor)
