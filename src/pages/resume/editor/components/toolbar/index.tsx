import { FileDown, ListChecks } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION } from '@/lib/motion'
import useResumeStore from '@/store/resume/form'
import { useResumeReviewStore } from '../../review-store'
import { useResumeCheckStore } from '../../store/checks'
import {
  CHECK_LEVELS,
  highestCheckSeverity,
} from '../../utils/check-presentation'
import ExportDialog from '../export'
import Preparation from '../preparation'
import { FontSettings } from './font-settings'
import { ResumeHistoryVersionDropdown } from './history-version-dropdown'
import { SpacingSettings } from './spacing-settings'
import TemplateSettings from './template-settings'
import { VariantLineageButton } from './variant-lineage-button'

export default function ResumeConfigToolbar() {
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()
  const isToolbarLoading = useResumeStore((state) => !state.isInitialized)
  const reviewActive = useResumeReviewStore((state) => state.active)
  const editingDisabled = isToolbarLoading || reviewActive
  const requestChecks = useResumeCheckStore((state) => state.requestChecks)

  const issues = useResumeCheckStore((state) => state.issues)
  const count = issues.filter((issue) => !issue.resolved).length
  const severity = highestCheckSeverity(issues)

  return (
    <div
      role='group'
      aria-label='简历工具栏'
      className='flex min-w-0 flex-wrap items-center justify-center gap-x-0.5 gap-y-1 sm:gap-1.5 @max-[46rem]/editor-toolbar:[&_button]:size-9 @max-[46rem]/editor-toolbar:[&_button]:shrink-0 @max-[46rem]/editor-toolbar:[&_button]:p-0 @max-[46rem]/editor-toolbar:[&_button>span]:hidden'
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
        className='mx-0.5 hidden h-5 sm:block @max-[46rem]/editor-toolbar:hidden'
      />
      <div
        role='group'
        aria-label='版本管理'
        className='flex items-center gap-1 sm:gap-2'
      >
        <ResumeHistoryVersionDropdown reviewActive={reviewActive} />

        <VariantLineageButton reviewActive={reviewActive} />
      </div>
      <Preparation isMobile={isMobile} />
      <Button
        variant='outline'
        size={isMobile ? 'icon' : 'sm'}
        disabled={editingDisabled}
        data-severity={severity}
        className={severity ? CHECK_LEVELS[severity].control : undefined}
        style={{ transitionDuration: `${reduced ? 0 : DURATION.fast}s` }}
        aria-label={`检查简历${count ? `，${count}项待查看` : ''}${severity ? `，包含${CHECK_LEVELS[severity].label}` : ''}`}
        onClick={() => requestChecks()}
      >
        <ListChecks data-icon='inline-start' />
        {!isMobile && <span>检查{count ? ` ${count}` : ''}</span>}
      </Button>
      <ExportDialog
        trigger={
          <Button
            aria-label='导出简历'
            size={isMobile ? 'icon' : 'sm'}
            disabled={isToolbarLoading || reviewActive}
            title={reviewActive ? '请先回到当前简历再检查导出' : undefined}
          >
            <FileDown data-icon='inline-start' />
            {!isMobile && <span>导出</span>}
          </Button>
        }
      />
    </div>
  )
}
