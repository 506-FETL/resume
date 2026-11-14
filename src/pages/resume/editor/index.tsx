import { createDeferredComponent } from '@/components/deferred-content'
import { RouteSkeleton } from '@/components/route-skeleton'
import { useResumeLoader } from './hooks/use-resume-loader'

const EditorWorkspace = createDeferredComponent(
  () => import('./components/editor-workspace'),
  '简历编辑页',
  <RouteSkeleton pathname='/resume/editor' />,
  { wrapFallback: false },
)

export default function Editor() {
  const { currentUser, loading } = useResumeLoader()

  return <EditorWorkspace currentUser={currentUser} loading={loading} />
}
