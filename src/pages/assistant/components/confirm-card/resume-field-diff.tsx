import { DiffView } from '../diff/diff-view'

interface ResumeFieldDiffProps {
  before: unknown
  after: unknown
}

export function ResumeFieldDiff({ before, after }: ResumeFieldDiffProps) {
  return <DiffView before={before} after={after} />
}
