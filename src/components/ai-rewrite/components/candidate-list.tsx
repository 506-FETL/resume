import type { RewriteCandidate } from '../types'
import { CandidateCard } from './candidate-card'

interface RewriteCandidateListProps {
  candidates: RewriteCandidate[]
  onApply: (candidate: RewriteCandidate) => void
}

export function RewriteCandidateList({ candidates, onApply }: RewriteCandidateListProps) {
  if (candidates.length === 0)
    return null

  return (
    <div className="grid items-start gap-4 grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
      {candidates.map(candidate => (
        <CandidateCard key={candidate.id} candidate={candidate} onApply={onApply} />
      ))}
    </div>
  )
}
