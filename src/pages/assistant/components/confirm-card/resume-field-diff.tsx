import { FieldDiffView } from '../diff/field-diff-view'

interface ResumeFieldDiffProps {
  sectionKey: string
  before: unknown
  after: unknown
}

export function ResumeFieldDiff({ sectionKey, before, after }: ResumeFieldDiffProps) {
  return <FieldDiffView sectionKey={sectionKey} before={before} after={after} />
}
