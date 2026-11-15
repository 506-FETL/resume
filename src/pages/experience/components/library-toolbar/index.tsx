import { Grid2X2, List, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useExperiencePageStore } from '../../store'
import type { ExperienceFilter } from '../../types'

export default function LibraryToolbar() {
  const { query, filter, view, setQuery, setFilter, setView } =
    useExperiencePageStore()

  return (
    <div className='grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 @min-[700px]/workspace:grid-cols-[auto_minmax(0,1fr)_auto]'>
      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as ExperienceFilter)}
      >
        <TabsList variant='line'>
          <TabsTrigger value='all' data-experience-all>
            全部
          </TabsTrigger>
          <TabsTrigger value='files'>文件</TabsTrigger>
          <TabsTrigger value='paste'>文字</TabsTrigger>
        </TabsList>
      </Tabs>
      <InputGroup className='col-span-2 row-start-2 @min-[700px]/workspace:col-span-1 @min-[700px]/workspace:col-start-2 @min-[700px]/workspace:row-start-1 @min-[700px]/workspace:max-w-sm @min-[700px]/workspace:justify-self-end'>
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          aria-label='搜索资料名称'
          placeholder='搜索资料名称'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <InputGroupAddon align='inline-end'>
            <InputGroupButton
              aria-label='清除搜索'
              onClick={() => setQuery('')}
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      <ButtonGroup
        aria-label='资料显示方式'
        className='col-start-2 row-start-1 @min-[700px]/workspace:col-start-3'
      >
        <Button
          variant='outline'
          size='icon'
          className='aria-pressed:bg-muted aria-pressed:text-foreground'
          aria-label='网格视图'
          aria-pressed={view === 'grid'}
          onClick={() => setView('grid')}
        >
          <Grid2X2 />
        </Button>
        <Button
          variant='outline'
          size='icon'
          className='aria-pressed:bg-muted aria-pressed:text-foreground'
          aria-label='列表视图'
          aria-pressed={view === 'list'}
          onClick={() => setView('list')}
        >
          <List />
        </Button>
      </ButtonGroup>
    </div>
  )
}
