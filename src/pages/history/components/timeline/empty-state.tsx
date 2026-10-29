import type { HistoryCurrentResume } from '../../types'
import { History } from 'lucide-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

interface TimelineEmptyStateProps {
  currentResume: HistoryCurrentResume | null
}

export default function TimelineEmptyState({
  currentResume,
}: TimelineEmptyStateProps) {
  return (
    <Empty className='min-h-44 px-3 py-6'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <History />
        </EmptyMedia>
        <EmptyTitle className='text-sm'>还没有保存版本</EmptyTitle>
        <EmptyDescription>
          {currentResume
            ? '准备投递或做较大修改前，点击上方“保存当前版本”，以后可以比较或恢复。'
            : '先选择一份云端简历，再保存版本。'}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
