import type { HistoryCurrentResume } from '../../types'
import { Sparkles } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

interface TimelineEmptyStateProps {
  currentResume: HistoryCurrentResume | null
}

export default function TimelineEmptyState({ currentResume }: TimelineEmptyStateProps) {
  return (
    <Empty className="min-h-44 px-3 py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Sparkles />
        </EmptyMedia>
        <EmptyTitle className="text-sm">还没有保存版本</EmptyTitle>
        {!currentResume && <EmptyDescription>先选择一份云端简历。</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  )
}
