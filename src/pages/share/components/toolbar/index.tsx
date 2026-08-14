import type { ShareStatusFilter } from '../../utils'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import useShareStore from '../../store'

export default function Toolbar() {
  const {
    resumeMap,
    searchKeyword,
    resumeFilters,
    statusFilter,
    setSearchKeyword,
    setResumeFilters,
    setStatusFilter,
  } = useShareStore()
  const [resumeOpen, setResumeOpen] = useState(false)
  const resumes = useMemo(
    () => Object.values(resumeMap).sort(
      (left, right) => left.displayName.localeCompare(right.displayName),
    ),
    [resumeMap],
  )
  const selectedLabel = resumeFilters.length === 0
    ? '全部简历'
    : resumeFilters.length === 1
      ? (resumes.find(resume => resume.resumeId === resumeFilters[0])?.displayName ?? '已选 1 项')
      : `已选 ${resumeFilters.length} 项`

  const toggleResume = (resumeId: string) => {
    setResumeFilters(
      resumeFilters.includes(resumeId)
        ? resumeFilters.filter(id => id !== resumeId)
        : [...resumeFilters, resumeId],
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/70 p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:min-w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchKeyword}
          onChange={event => setSearchKeyword(event.target.value)}
          placeholder="搜索名称、简历或链接"
          className="pl-9"
        />
      </div>
      <Popover open={resumeOpen} onOpenChange={setResumeOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between sm:w-48">
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
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
                    <Checkbox checked={resumeFilters.includes(resume.resumeId)} />
                    <span className="min-w-0 flex-1 truncate">{resume.displayName}</span>
                    <Check className={cn('size-4', resumeFilters.includes(resume.resumeId) ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {resumeFilters.length > 0 && (
              <div className="border-t p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setResumeFilters([])}
                >
                  <X data-icon="inline-start" />
                  清空选择
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      <Tabs value={statusFilter} onValueChange={value => setStatusFilter(value as ShareStatusFilter)}>
        <TabsList className="grid w-full grid-cols-5 sm:w-auto">
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="active">有效</TabsTrigger>
          <TabsTrigger value="inactive">关闭</TabsTrigger>
          <TabsTrigger value="expired">过期</TabsTrigger>
          <TabsTrigger value="archived">归档</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
