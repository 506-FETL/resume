import dayjs from 'dayjs'
import { CheckCircle, Cloud, FileCheck, HardDrive } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ResumeConfig {
  id: string
  resume_id: string
  display_name: string
  isScored: boolean
  overall_score: number | null
  created_at: string
  isOffline?: boolean
}

export interface ResumeItemProps {
  resume: ResumeConfig
  isSelected: boolean
  onSelect: () => void
}

export function ResumeItem({ resume, isSelected, onSelect }: ResumeItemProps) {
  const getIconAndColor = () => {
    if (resume.isOffline) {
      if (resume.isScored) {
        return { Icon: FileCheck, bgColor: 'bg-green-500/10', iconColor: 'text-green-600' }
      }
      return { Icon: HardDrive, bgColor: 'bg-amber-500/10', iconColor: 'text-amber-600' }
    }
    else {
      if (resume.isScored) {
        return { Icon: FileCheck, bgColor: 'bg-green-500/10', iconColor: 'text-green-600' }
      }
      return { Icon: Cloud, bgColor: 'bg-blue-500/10', iconColor: 'text-blue-600' }
    }
  }

  const { Icon, bgColor, iconColor } = getIconAndColor()

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2.5 sm:p-3 rounded-md border transition-all cursor-pointer',
        isSelected
          ? 'bg-accent border-primary/50 ring-1 ring-primary/20'
          : 'hover:bg-muted/70',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <div className={cn('p-1.5 sm:p-2 rounded shrink-0', bgColor)}>
          <Icon className={cn('size-3.5 sm:size-4', iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <p className="text-xs sm:text-sm font-medium truncate" title={resume.display_name}>
              {resume.display_name}
            </p>
            {resume.isScored
              ? (
                  <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/30 shrink-0 text-[10px] px-1.5 py-0">
                    已打分
                  </Badge>
                )
              : (
                  <Badge variant="outline" className="text-muted-foreground shrink-0 text-[10px] px-1.5 py-0">
                    待分析
                  </Badge>
                )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            <span>{dayjs(resume.created_at).fromNow()}</span>
            {resume.isScored && resume.overall_score != null && resume.overall_score > 0 && (
              <>
                <span>•</span>
                <span className={cn(
                  'font-medium',
                  resume.overall_score >= 80 ? 'text-green-600' : resume.overall_score >= 60 ? 'text-amber-600' : 'text-destructive',
                )}
                >
                  {resume.overall_score}
                  {' '}
                  分
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {isSelected && (
        <div className="text-primary shrink-0 ml-2">
          <CheckCircle className="size-4" />
        </div>
      )}
    </div>
  )
}
