import type { RefObject } from 'react'
import { useDesktopSortLayout } from './use-desktop-sort-layout'
import { useResumeCheckStore } from '@/pages/resume/editor/store/checks'
import GuidePresentation from '../components/guide-presentation'
import { useFeatureGuide } from '../use-feature-guide'

export default function SortingGuide({
  enabled,
  editPanelRef,
  contextKey,
  mobile,
}: {
  enabled: boolean
  editPanelRef: RefObject<HTMLDivElement | null>
  contextKey: string
  mobile: boolean
}) {
  const editing = useResumeCheckStore((state) => state.tab === 'edit')

  const layoutReady = useDesktopSortLayout(
    editPanelRef,
    enabled && editing && !mobile,
  )

  const guide = useFeatureGuide({
    id: 'sorting',
    enabled: enabled && editing && (mobile || layoutReady),
    contextKey,
    steps: [
      {
        target: mobile
          ? 'button[data-feature-guide-sort]'
          : '[data-editor-section] [data-feature-guide-sort]',
        title: '把更重要的经历放前面',
        hint: mobile ? '这里能调整栏目顺序' : '栏目可以拖动排序',
        description: mobile
          ? '点这里调整栏目顺序。栏目内的经历，也能用上下箭头移动。'
          : '拖动栏目左侧的手柄调整顺序。栏目内的经历，用上下箭头移动。',
        nextLabel: '知道了',
        side: mobile ? 'top' : 'left',
      },
    ],
  })

  return <GuidePresentation guide={guide} />
}
