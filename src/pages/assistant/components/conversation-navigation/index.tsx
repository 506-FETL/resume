import { ChevronDown, MessageSquare, Search, SquarePen, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { readableConversationTitle } from '../../composer-references'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import useAssistantStore from '../../store'
import ConversationList from '../conversation-list'

export default function ConversationNavigation({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const isMobile = useIsMobile()
  const { startNewConversation, openSearch } = useAssistantNavigation()
  const initializing = useAssistantStore((state) => state.initializing)
  const reduceMotion = useReducedMotion()

  const trigger = (
    <Button
      variant='ghost'
      className='max-w-full justify-start gap-2 rounded-xl px-2.5'
      aria-label={`切换对话：${readableConversationTitle(title)}`}
    >
      <MessageSquare className='size-4 shrink-0 text-muted-foreground' />
      <h1 className='truncate text-base font-semibold'>
        {readableConversationTitle(title)}
      </h1>
      <ChevronDown className='size-3.5 shrink-0 text-muted-foreground' />
    </Button>
  )

  const content = (
    <>
      <div className='grid shrink-0 gap-2 border-b pb-2'>
        <div className='flex items-center gap-1'>
          <div className='relative min-w-0 flex-1'>
            <Search className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              aria-label='搜索近期对话'
              placeholder='搜索近期对话'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className='pl-8'
            />
          </div>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='关闭对话菜单'
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>
        <Button
          variant='ghost'
          className='justify-start'
          data-assistant-new-conversation=''
          disabled={initializing}
          onClick={() => {
            startNewConversation()
            setOpen(false)
          }}
        >
          <SquarePen />
          新建对话
        </Button>
        <Button
          variant='ghost'
          className='justify-start text-muted-foreground'
          onClick={() => {
            setOpen(false)
            openSearch()
          }}
        >
          <Search />
          搜索全部历史
        </Button>
      </div>
      <ConversationList query={query} onNavigate={() => setOpen(false)} />
    </>
  )

  const handleOpenChange = (next: boolean) => {
    if (next) setQuery('')

    setOpen(next)
  }

  if (isMobile)
    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={handleOpenChange}
        trigger={trigger}
        contentClassName='h-[min(34rem,80dvh)]'
      >
        <ResponsiveDialogHeader className='shrink-0 pb-2'>
          <ResponsiveDialogTitle>切换对话</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='sr-only'>
            搜索近期对话、打开完整历史，或创建新的对话。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className='flex min-h-0 flex-1 flex-col gap-3 px-3 pb-4'>
          {content}
        </div>
      </ResponsiveDialog>
    )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align='start'
        sideOffset={8}
        className='flex max-h-[min(32rem,70dvh)] w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 p-2'
        style={reduceMotion ? { animationDuration: '0s' } : undefined}
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}
