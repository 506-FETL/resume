import { ChevronDown, ClipboardCheck } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useId, useRef, useState } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import useAtsStore from '../../store'

export default function RepairChecklist() {
  const { currentAtsConfig, loading, revertFixChecklist } = useAtsStore()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const checkboxGroupId = useId()
  const fixList = currentAtsConfig?.fixChecklist ?? []
  const completed = fixList.filter((item) => item.isDone).length
  const progress = fixList.length ? (completed / fixList.length) * 100 : 0

  return (
    <section className='min-w-0'>
      <header className='pb-4'>
        <h2 className='flex items-center gap-2 text-base font-semibold'>
          <ClipboardCheck
            aria-hidden
            className='size-4 text-muted-foreground'
          />
          修复清单
        </h2>
      </header>
      <div>
        <AnimatedContent
          animationKey={
            loading
              ? 'loading'
              : !currentAtsConfig
                ? 'unassessed'
                : fixList.length === 0
                  ? 'empty'
                  : 'checklist'
          }
        >
          {loading ? (
            <div
              role='status'
              className='flex items-center gap-2 text-sm text-muted-foreground'
            >
              <Spinner
                aria-hidden
                className='size-4 motion-reduce:animate-none'
              />
              正在整理建议…
            </div>
          ) : fixList.length === 0 ? (
            <p className='text-sm leading-6 text-muted-foreground'>
              {currentAtsConfig
                ? '本次检测没有待处理建议。'
                : '检测后可在这里记录处理进度。'}
            </p>
          ) : (
            <Collapsible
              open={open}
              onOpenChange={(nextOpen) => {
                if (
                  !nextOpen &&
                  contentRef.current?.contains(document.activeElement)
                ) {
                  triggerRef.current?.focus()
                }

                setOpen(nextOpen)
              }}
            >
              <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1'>
                <p className='text-sm font-medium tabular-nums'>
                  已处理 {completed} / {fixList.length} 项
                </p>
                <CollapsibleTrigger asChild>
                  <Button
                    ref={triggerRef}
                    variant='ghost'
                    size='sm'
                    className='-mr-2 text-xs text-muted-foreground'
                  >
                    {open ? '收起清单' : '查看清单'}
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        'size-3.5 transition-transform duration-(--ui-motion-base) ease-(--ui-motion-enter-ease)',
                        open && 'rotate-180',
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <Progress
                value={progress}
                aria-label={`已处理 ${completed} 项，共 ${fixList.length} 项`}
                className='mt-2 h-1.5'
              />
              <p className='mt-2 text-xs leading-5 text-muted-foreground'>
                勾选只记录进度，具体修改请查看问题详情。
              </p>
              <CollapsibleContent
                ref={contentRef}
                inert={!open}
                style={reduceMotion ? { animationDuration: '0s' } : undefined}
              >
                <div className='mt-5 space-y-4'>
                  {fixList.map((item) => (
                    <div key={item.id} className='flex items-start gap-3'>
                      <Checkbox
                        id={`${checkboxGroupId}-${item.id}`}
                        checked={item.isDone}
                        onCheckedChange={() => revertFixChecklist(item.id)}
                        className='mt-0.5 shrink-0'
                      />
                      <label
                        htmlFor={`${checkboxGroupId}-${item.id}`}
                        className='min-w-0 flex-1 cursor-pointer space-y-1.5'
                      >
                        <span
                          className={cn(
                            'block wrap-break-word text-sm leading-5 transition-colors duration-(--ui-motion-fast)',
                            item.isDone && 'text-muted-foreground line-through',
                          )}
                        >
                          {item.title}
                        </span>
                        <Badge
                          variant='outline'
                          className={
                            item.option === 'required'
                              ? 'border-destructive/20 bg-destructive/5 text-destructive'
                              : 'font-normal text-muted-foreground'
                          }
                        >
                          {item.option === 'required' ? '需处理' : '可选建议'}
                        </Badge>
                      </label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </AnimatedContent>
      </div>
    </section>
  )
}
