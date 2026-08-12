import type { ShareResumeSummary } from '../../types'
import type { ShareStatusFilter } from '../../utils'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface ShareToolbarProps {
  keyword: string
  resumeIds: string[]
  status: ShareStatusFilter
  resumes: ShareResumeSummary[]
  onKeywordChange: (value: string) => void
  onResumeChange: (value: string[]) => void
  onStatusChange: (value: ShareStatusFilter) => void
}

export default function ShareToolbar({
  keyword,
  resumeIds,
  status,
  resumes,
  onKeywordChange,
  onResumeChange,
  onStatusChange,
}: ShareToolbarProps) {
  const [resumeOpen, setResumeOpen] = useState(false)
  const selectedLabel = resumeIds.length === 0
    ? '全部简历'
    : resumeIds.length === 1
      ? (resumes.find(resume => resume.resumeId === resumeIds[0])?.displayName ?? '已选 1 项')
      : `已选 ${resumeIds.length} 项`

  const toggleResume = (resumeId: string) => {
    onResumeChange(
      resumeIds.includes(resumeId)
        ? resumeIds.filter(id => id !== resumeId)
        : [...resumeIds, resumeId],
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/70 p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:min-w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={event => onKeywordChange(event.target.value)}
          placeholder="搜索名称、简历或链接"
          className="pl-9"
        />
      </div>
      <Popover open={resumeOpen} onOpenChange={setResumeOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between sm:w-48">
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="搜索简历" />
            <CommandList>
              <CommandEmpty>没有匹配的简历</CommandEmpty>
              <CommandGroup>
                {resumes.map(resume => (
                  <CommandItem
                    key={resume.resumeId}
                    value={`${resume.displayName} ${resume.resumeId}`}
                    onSelect={() => toggleResume(resume.resumeId)}
                  >
                    <Checkbox checked={resumeIds.includes(resume.resumeId)} />
                    <span className="min-w-0 flex-1 truncate">{resume.displayName}</span>
                    <Check className={cn('size-4', resumeIds.includes(resume.resumeId) ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {resumeIds.length > 0 && (
              <div className="border-t p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onResumeChange([])}
                >
                  <X data-icon="inline-start" />
                  清空选择
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      <Tabs value={status} onValueChange={value => onStatusChange(value as ShareStatusFilter)}>
        <TabsList className="grid w-full grid-cols-4 sm:w-auto">
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="active">有效</TabsTrigger>
          <TabsTrigger value="inactive">关闭</TabsTrigger>
          <TabsTrigger value="expired">过期</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
