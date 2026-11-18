import type { Ref } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import useResumeListStore from '../../store'

export function LibraryFilters({
  resultsId,
  allTriggerRef,
}: {
  resultsId: string
  allTriggerRef: Ref<HTMLButtonElement>
}) {
  const filterMode = useResumeListStore((state) => state.filterMode)
  const setLibraryFilter = useResumeListStore((state) => state.setLibraryFilter)

  return (
    <Tabs
      value={filterMode}
      onValueChange={(value) =>
        setLibraryFilter(value as 'all' | 'roots' | 'variants')
      }
      className='min-w-0'
    >
      <TabsList className='max-w-full' aria-label='简历分类'>
        <TabsTrigger
          ref={allTriggerRef}
          value='all'
          id={`${resultsId}-all`}
          aria-controls={resultsId}
        >
          全部
        </TabsTrigger>
        <TabsTrigger
          value='roots'
          id={`${resultsId}-roots`}
          aria-controls={resultsId}
        >
          原始简历
        </TabsTrigger>
        <TabsTrigger
          value='variants'
          id={`${resultsId}-variants`}
          aria-controls={resultsId}
        >
          岗位版本
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
