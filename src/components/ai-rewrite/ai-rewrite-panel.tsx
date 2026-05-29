import type { RewriteCandidate, RewriteSelection, RewriteSessionState } from './types'
import { JdContextInput } from './jd-context-input'
import { RewriteCandidateList } from './rewrite-candidate-list'
import { RewriteStatusView } from './rewrite-status-view'

interface Props {
  state: RewriteSessionState
  selection: RewriteSelection | null
  onApply: (candidate: RewriteCandidate) => void
  onJdDraftChange: (value: string) => void
}

export function AiRewritePanel({ state, selection, onApply, onJdDraftChange }: Props) {
  if (state.status === 'idle' || !state.action || !selection)
    return null

  const isAlignJd = state.action === 'align_jd'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
      {isAlignJd && (
        <JdContextInput value={state.jdDraft} onChange={onJdDraftChange} />
      )}

      <RewriteStatusView state={state} />
      <RewriteCandidateList candidates={state.candidates} onApply={onApply} />
    </div>
  )
}
