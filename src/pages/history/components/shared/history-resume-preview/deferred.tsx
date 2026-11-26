import { historyComponent } from '../../../utils/load-component'
import { createDeferredComponent } from '@/components/deferred-content'
import { PaperSkeleton } from '@/components/loading-skeleton'

export const HistoryPreview = createDeferredComponent(
  historyComponent(() => import('./index'), 'HistoryPreviewDocument'),
  '版本预览',
  <PaperSkeleton
    label='正在加载版本预览'
    className='mx-auto max-w-[794px] shadow-sm'
  />,
  { wrapFallback: false },
)
