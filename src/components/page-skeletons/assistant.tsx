import { FileText, PanelRight, Search, SquarePen } from 'lucide-react'
import { useState } from 'react'
import { LoadingRegion, PaperSkeleton } from '@/components/loading-skeleton'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { readAssistantCanvasPreferences } from '@/pages/assistant/canvas-preferences'
import { CHAT_MIN_WIDTH } from '@/pages/assistant/const'

export function AssistantMessagesSkeleton() {
  return (
    <LoadingRegion
      label='正在加载消息'
      className='mx-auto flex w-full max-w-4xl flex-col gap-6 px-3 py-6 sm:px-6 lg:px-8'
    >
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className={
            item === 0
              ? 'ml-auto w-2/3 space-y-2 rounded-2xl bg-muted/40 p-4'
              : 'w-5/6 space-y-3 py-2'
          }
        >
          <Skeleton className='h-4 w-3/4' />
          <Skeleton className='h-3 w-full' />
          <Skeleton className='h-3 w-2/3' />
        </div>
      ))}
    </LoadingRegion>
  )
}

export function AssistantConversationListSkeleton() {
  return (
    <LoadingRegion
      label='正在加载对话列表'
      className='flex h-full min-h-0 flex-col gap-1 overflow-hidden px-2 py-1'
    >
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} className='h-9 w-full rounded-lg' />
      ))}
    </LoadingRegion>
  )
}

export function AssistantNavigationSkeleton() {
  return (
    <>
      <SidebarGroup className='shrink-0'>
        <SidebarGroupLabel>对话</SidebarGroupLabel>
        <SidebarMenu>
          {[
            { label: '新建对话', icon: SquarePen },
            { label: '搜索历史', icon: Search },
          ].map(({ label, icon: Icon }) => (
            <SidebarMenuItem key={label}>
              <SidebarMenuButton disabled>
                <Icon />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
      <div className='flex min-h-0 flex-1 flex-col group-data-[collapsible=icon]:hidden'>
        <AssistantConversationListSkeleton />
      </div>
    </>
  )
}

export function AssistantPageSkeleton() {
  const [canvas] = useState(readAssistantCanvasPreferences)

  return (
    <div className='@container/assistant flex h-full min-h-0 w-full overflow-hidden bg-background'>
      <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
        <header className='flex h-16 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-5'>
          <SidebarTrigger aria-label='切换侧边栏' />
          <div className='min-w-0 flex-1'>
            <Skeleton className='h-6 w-24' />
          </div>
          <AnimatedThemeToggler aria-label='切换主题' />
          <Button disabled variant='ghost' size='icon-sm' aria-label='打开画布'>
            <PanelRight />
          </Button>
        </header>
        <div className='min-h-0 flex-1 overflow-hidden'>
          <AssistantMessagesSkeleton />
        </div>
        <div className='shrink-0 border-t bg-background/90 py-3'>
          <div className='mx-auto w-full max-w-4xl px-3 sm:px-6 lg:px-8'>
            <div className='rounded-xl border'>
              <div className='min-h-16 p-3'>
                <Skeleton className='h-5 w-44' />
              </div>
              <div className='flex flex-wrap items-center gap-1.5 px-2.5 pt-1.5 pb-2'>
                <Skeleton className='size-8 rounded-full' />
                <Skeleton className='size-8 rounded-full' />
                <Skeleton className='h-8 w-24 rounded-full' />
                <Skeleton className='ml-auto size-8 rounded-full' />
              </div>
            </div>
            <Skeleton className='mt-1.5 h-4 w-32' />
          </div>
        </div>
      </div>
      {canvas.open && (
        <aside
          style={{
            width: `min(${canvas.width}px, calc(100cqw - ${CHAT_MIN_WIDTH}px))`,
          }}
          className='hidden h-full shrink-0 flex-col border-l bg-muted/25 @min-[740px]/assistant:flex'
        >
          <div className='flex h-12 shrink-0 items-center border-b px-3 text-sm font-medium'>
            画布
          </div>
          <div className='flex h-[53px] shrink-0 items-center border-b p-2 text-sm'>
            简历预览
          </div>
          <div className='flex shrink-0 items-center gap-2 border-b px-3 py-2 text-sm'>
            <FileText className='size-4 shrink-0 text-muted-foreground' />
            <span className='font-medium'>当前简历</span>
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]'>
            <div className='p-3'>
              <AssistantCanvasPreviewSkeleton />
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}

export function AssistantCanvasPreviewSkeleton() {
  return (
    <PaperSkeleton label='正在加载简历预览' className='mx-auto max-w-[794px]' />
  )
}
