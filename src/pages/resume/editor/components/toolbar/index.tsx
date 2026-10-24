import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/use-mobile'
import useResumeStore from '@/store/resume/form'
import { useResumeReviewStore } from '../../review-store'
import ExportDialog from '../export'
import { FontSettings } from './font-settings'
import { ResumeHistoryVersionDropdown } from './history-version-dropdown'
import { SpacingSettings } from './spacing-settings'
import TemplateSettings from './template-settings'
import { VariantLineageButton } from './variant-lineage-button'

export default function ResumeConfigToolbar() {
  const isMobile = useIsMobile()
  const isToolbarLoading = useResumeStore((state) => !state.isInitialized)
  const reviewActive = useResumeReviewStore((state) => state.active)
  const editingDisabled = isToolbarLoading || reviewActive

  return (
    <div
      role='group'
      aria-label='简历工具栏'
      className='flex min-w-0 flex-wrap items-center justify-center gap-1.5 sm:gap-2'
    >
      <div
        role='group'
        aria-label='排版设置'
        className='flex items-center gap-1 sm:gap-2'
      >
        <SpacingSettings isMobile={isMobile} disabled={editingDisabled} />

        <FontSettings isMobile={isMobile} disabled={editingDisabled} />

        <TemplateSettings isMobile={isMobile} disabled={editingDisabled} />
      </div>
      <Separator
        orientation='vertical'
        className='mx-0.5 hidden h-5 sm:block'
      />
      <div
        role='group'
        aria-label='版本管理'
        className='flex items-center gap-1 sm:gap-2'
      >
        <ResumeHistoryVersionDropdown reviewActive={reviewActive} />

        <VariantLineageButton reviewActive={reviewActive} />
      </div>
      <ExportDialog
        trigger={
          <Button
            aria-label='导出简历'
            size={isMobile ? 'icon' : 'sm'}
            disabled={isToolbarLoading}
          >
            <FileDown data-icon='inline-start' />
            {!isMobile && <span>导出</span>}
          </Button>
        }
      />
    </div>
  )
}
