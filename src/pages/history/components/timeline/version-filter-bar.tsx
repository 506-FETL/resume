import type { VersionFilterCriteria, VersionSortOrder } from '../../filter'
import type { ResumeVersionSourceType } from '@/lib/supabase/resume/history'
import { ListFilter, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SOURCE_META } from '../../const'
import { isFilterActive } from '../../filter'

const SOURCE_OPTIONS: Array<{ value: ResumeVersionSourceType | 'all', label: string }> = [
  { value: 'all', label: '全部来源' },
  { value: 'manual', label: SOURCE_META.manual.label },
  { value: 'ai_optimize', label: SOURCE_META.ai_optimize.label },
  { value: 'autosave', label: SOURCE_META.autosave.label },
  { value: 'restore', label: SOURCE_META.restore.label },
]

const SORT_OPTIONS: Array<{ value: VersionSortOrder, label: string }> = [
  { value: 'newest', label: '最新在前' },
  { value: 'oldest', label: '最早在前' },
]

interface VersionFilterBarProps {
  criteria: VersionFilterCriteria
  onChange: (next: VersionFilterCriteria) => void
}

export default function VersionFilterBar({ criteria, onChange }: VersionFilterBarProps) {
  const active = isFilterActive(criteria)

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={criteria.keyword}
          placeholder="搜索版本名、说明或标签"
          className="h-8 pl-8 text-xs"
          onChange={event => onChange({ ...criteria, keyword: event.target.value })}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('relative h-8 shrink-0', active && 'border-primary/40 text-primary')}
            aria-label="筛选与排序"
          >
            <ListFilter className="size-3.5" />
            筛选
            {active && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>来源</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={criteria.source}
            onValueChange={value => onChange({ ...criteria, source: value as ResumeVersionSourceType | 'all' })}
          >
            {SOURCE_OPTIONS.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={criteria.milestoneOnly}
            onCheckedChange={checked => onChange({ ...criteria, milestoneOnly: checked === true })}
          >
            仅看重点版本
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>排序</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={criteria.sort}
            onValueChange={value => onChange({ ...criteria, sort: value as VersionSortOrder })}
          >
            {SORT_OPTIONS.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
