import type { useResumeLoader } from '../../hooks/use-resume-loader'

export type EditorWorkspaceProps = Pick<
  ReturnType<typeof useResumeLoader>,
  'currentUser' | 'loading'
>
