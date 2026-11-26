import StaticResumePaper from '@/components/resume/static-resume-paper'
import { PaperSkeleton } from '@/components/loading-skeleton'
import { useMatchingPreviewPaper } from '../../store/preview-paper'

export default StaticResumePaper

export function PreviewBackground({ contentKey }: { contentKey: string }) {
  const paper = useMatchingPreviewPaper(contentKey)

  return paper ? (
    <StaticResumePaper paper={paper} />
  ) : (
    <PaperSkeleton label='正在加载模板预览' />
  )
}
