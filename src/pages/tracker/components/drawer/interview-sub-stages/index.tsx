import type { CSSProperties, ReactNode } from 'react'
import type { InterviewSubStage } from '../../../types'
import dayjs from 'dayjs'
import { CalendarIcon, Check, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PresenceDiv } from '@/components/motion/presence-item'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import WorkflowDateField from '../workflow-date-field'
import WorkflowNotesEditor from '../workflow-notes-editor'

type RoundContent = Partial<
  Pick<InterviewSubStage, 'label' | 'start_date' | 'notes'>
>

interface InterviewSubStagesProps {
  jobId: string
  subStages: InterviewSubStage[]
  canAdd: boolean
  saveStatus: ReactNode
  onAddSubStage: () => string | null
  onDeleteSubStage: (id: string) => void
  onUpdateSubStage: (
    id: string,
    updates: RoundContent,
    immediate?: boolean,
  ) => void
  onFlush: () => void
}

function roundStatusLabel(round: InterviewSubStage) {
  if (round.is_history)
    return `历史 · ${round.status === '已完成' ? '已通过' : round.status === '已拒绝' ? '已结束' : '已记录'}`

  return round.status === '已完成'
    ? '已通过'
    : round.status === '已拒绝'
      ? '已结束'
      : round.status === '进行中'
        ? '进行中'
        : '已记录'
}

export function InterviewSubStages({
  jobId,
  subStages,
  canAdd,
  saveStatus,
  onAddSubStage,
  onDeleteSubStage,
  onUpdateSubStage,
  onFlush,
}: InterviewSubStagesProps) {
  const reduce = useReducedMotion()
  const isNarrow = useIsMobile(640)
  const cardWidth = isNarrow ? 9 : 10
  const connectorWidth = isNarrow ? 1.25 : 1.5
  const [selectedId, setSelectedId] = useState(subStages.at(-1)?.id ?? '')

  const [deletedRound, setDeletedRound] = useState<InterviewSubStage | null>(
    null,
  )

  const [deleteOpen, setDeleteOpen] = useState(false)

  const selectedRound =
    subStages.find((round) => round.id === selectedId) ?? subStages.at(-1)

  const activeRoundId = selectedRound?.id

  const selectedIndex = subStages.findIndex(
    (round) => round.id === selectedRound?.id,
  )

  const selectedLabel = selectedRound?.label || `第 ${selectedIndex + 1} 轮面试`
  const focusNewRound = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const deletedRef = useRef(false)
  const exitingRoundIdRef = useRef<string | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)

  const revealSelectedRound = useCallback(() => {
    const viewport = scrollRef.current
    const trigger = activeRoundId && triggerRefs.current.get(activeRoundId)

    if (!viewport || !trigger || exitingRoundIdRef.current) return

    const viewportBox = viewport.getBoundingClientRect()
    const triggerBox = trigger.getBoundingClientRect()

    if (
      triggerBox.left < viewportBox.left ||
      triggerBox.right > viewportBox.right
    ) {
      viewport.scrollTo({
        left:
          viewport.scrollLeft +
          triggerBox.left -
          viewportBox.left -
          (viewport.clientWidth - triggerBox.width) / 2,
        behavior: reduce ? 'instant' : 'smooth',
      })
    }
  }, [activeRoundId, reduce])

  useEffect(() => {
    if (subStages.some((round) => round.id === exitingRoundIdRef.current))
      exitingRoundIdRef.current = null
  }, [subStages])

  useEffect(() => {
    const viewport = scrollRef.current
    let viewportWidth = viewport?.clientWidth

    revealSelectedRound()

    const observer = new ResizeObserver(() => {
      if (viewport?.clientWidth === viewportWidth) return

      viewportWidth = viewport?.clientWidth
      revealSelectedRound()
    })

    if (viewport) observer.observe(viewport)

    const frame =
      focusNewRound.current === activeRoundId
        ? requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.focus({ preventScroll: true })
              inputRef.current.select()
              focusNewRound.current = null
            }
          })
        : null

    return () => {
      observer.disconnect()

      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [activeRoundId, subStages.length, revealSelectedRound])

  const handleSelect = (id: string) => {
    if (id === selectedRound?.id) return
    if (panelRef.current?.contains(document.activeElement))
      triggerRefs.current.get(id)?.focus({ preventScroll: true })

    onFlush()
    setSelectedId(id)
  }

  const handleAdd = () => {
    onFlush()

    const id = onAddSubStage()

    if (id) {
      focusNewRound.current = id
      setSelectedId(id)
    }
  }

  return (
    <section
      className='min-w-0 space-y-3 sm:space-y-4'
      aria-label='面试轮次'
      style={
        {
          '--ui-motion-fast': `${reduce ? 0 : DURATION.fast}s`,
        } as CSSProperties
      }
    >
      <header className='flex flex-wrap items-center justify-between gap-3'>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className='flex items-center gap-2 text-base font-semibold outline-none'
        >
          面试轮次
          <Badge variant='secondary' className='font-normal'>
            {subStages.length} 轮
          </Badge>
        </h3>
        {!selectedRound && saveStatus}
      </header>
      {!selectedRound ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : DURATION.base, ease: EASE.out }}
          className='flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-5 py-8 text-center'
        >
          <span className='flex size-10 items-center justify-center rounded-full bg-muted'>
            <MessageSquare className='size-5 text-muted-foreground' />
          </span>
          <p className='text-sm font-medium'>还没有面试记录</p>
          {canAdd && (
            <Button
              ref={addRef}
              variant='outline'
              size='sm'
              onClick={handleAdd}
            >
              <Plus className='size-3.5' />
              添加首轮面试
            </Button>
          )}
        </motion.div>
      ) : (
        <Tabs
          value={selectedRound.id}
          onValueChange={handleSelect}
          activationMode='manual'
          className='min-w-0 gap-3 sm:gap-4'
        >
          <div
            ref={scrollRef}
            className='scrollbar-thin-subtle -mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1 [overflow-anchor:none]'
          >
            <div className='flex w-max min-w-full items-stretch p-1'>
              <TabsList
                aria-label='选择面试轮次'
                className='relative w-max justify-start rounded-none bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto'
              >
                <AnimatePresence
                  initial={false}
                  onExitComplete={() => {
                    exitingRoundIdRef.current = null
                    revealSelectedRound()
                  }}
                >
                  {subStages.map((round, index) => {
                    const current = round.status === '进行中'
                    const passed = round.status === '已完成'
                    const label = round.label || `第 ${index + 1} 轮面试`

                    const lineWidth =
                      index < subStages.length - 1 ? connectorWidth : 0

                    return (
                      <PresenceDiv
                        key={round.id}
                        className='flex shrink-0 items-center [&[inert]]:overflow-hidden'
                        initial={
                          reduce ? false : { opacity: 0, y: 8, width: 0 }
                        }
                        animate={{
                          opacity: 1,
                          y: 0,
                          width: `${cardWidth + lineWidth}rem`,
                        }}
                        exit={{
                          opacity: 0,
                          width: 0,
                          transition: {
                            width: {
                              duration: reduce ? 0 : DURATION.base,
                              ease: EASE.out,
                            },
                            opacity: {
                              duration: reduce ? 0 : DURATION.fast,
                              ease: EASE.in,
                            },
                          },
                        }}
                        transition={{
                          duration: reduce ? 0 : DURATION.base,
                          ease: EASE.out,
                        }}
                      >
                        <TabsTrigger
                          value={round.id}
                          ref={(node) => {
                            if (node) triggerRefs.current.set(round.id, node)
                            else triggerRefs.current.delete(round.id)
                          }}
                          aria-label={`第 ${index + 1} 轮：${label}，${roundStatusLabel(round)}`}
                          title={label}
                          className='h-auto w-36 flex-none flex-col items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left font-normal whitespace-normal transition-colors after:hidden hover:bg-muted/40 data-[state=active]:border-primary/40 data-[state=active]:bg-primary/5 data-[state=active]:shadow-none sm:w-40 dark:data-[state=active]:border-primary/40 dark:data-[state=active]:bg-primary/10'
                          style={{
                            transitionDuration: `${reduce ? 0 : DURATION.fast}s`,
                          }}
                        >
                          <span className='flex w-full min-w-0 items-center gap-2'>
                            <span
                              className={cn(
                                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                                current
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-muted text-muted-foreground',
                              )}
                            >
                              {passed ? (
                                <Check className='size-3.5' />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <span className='truncate text-sm font-medium'>
                              {label}
                            </span>
                          </span>
                          <span className='flex w-full items-center justify-between gap-2 text-[11px] text-muted-foreground'>
                            <span className='inline-flex items-center gap-1'>
                              <CalendarIcon className='size-3' />
                              {round.start_date
                                ? dayjs(round.start_date).format('M月D日')
                                : '待安排'}
                            </span>
                            <span className={cn(current && 'text-foreground')}>
                              {roundStatusLabel(round)}
                            </span>
                          </span>
                        </TabsTrigger>
                        <motion.span
                          aria-hidden='true'
                          initial={false}
                          animate={{ width: `${lineWidth}rem` }}
                          transition={{
                            duration: reduce ? 0 : DURATION.base,
                            ease: EASE.out,
                          }}
                          className={cn(
                            'h-px shrink-0',
                            passed ? 'bg-primary/30' : 'bg-border',
                          )}
                        />
                      </PresenceDiv>
                    )
                  })}
                </AnimatePresence>
              </TabsList>
              {canAdd && (
                <div className='flex shrink-0 items-center'>
                  <span
                    aria-hidden='true'
                    className='h-px w-5 shrink-0 bg-border sm:w-6'
                  />
                  <Button
                    ref={addRef}
                    variant='outline'
                    onClick={handleAdd}
                    className='h-full w-36 flex-col gap-1.5 rounded-lg border-dashed bg-transparent px-3 py-2.5 text-muted-foreground shadow-none transition-colors hover:text-foreground sm:w-40'
                    style={{
                      transitionDuration: `${reduce ? 0 : DURATION.fast}s`,
                    }}
                  >
                    <Plus className='size-5' />
                    <span className='text-xs'>添加下一轮</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
          <TabsContent
            key={selectedRound.id}
            ref={panelRef}
            value={selectedRound.id}
            asChild
            className='min-w-0 space-y-4 rounded-xl border bg-card p-3 sm:p-4'
          >
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduce ? 0 : DURATION.base,
                ease: EASE.out,
              }}
            >
              <div className='flex flex-wrap items-center justify-between gap-2 border-b pb-3'>
                <div className='flex min-w-0 items-center gap-2'>
                  <span className='truncate text-sm font-medium'>
                    {selectedLabel}
                  </span>
                  <Badge
                    variant='outline'
                    className='shrink-0 rounded-full text-[11px] font-normal'
                  >
                    {roundStatusLabel(selectedRound)}
                  </Badge>
                </div>
                <div className='flex items-center gap-2'>
                  {saveStatus}
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={`删除${selectedLabel}`}
                    onClick={(event) => {
                      deleteTriggerRef.current = event.currentTarget
                      deletedRef.current = false
                      setDeletedRound(selectedRound)
                      setDeleteOpen(true)
                    }}
                    className='text-muted-foreground hover:text-destructive'
                  >
                    <Trash2 className='size-3.5' />
                  </Button>
                </div>
              </div>
              <div className='grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]'>
                <div className='space-y-2'>
                  <label
                    htmlFor={`round-label-${selectedRound.id}`}
                    className='text-xs font-medium text-muted-foreground'
                  >
                    轮次名称
                  </label>
                  <Input
                    ref={inputRef}
                    id={`round-label-${selectedRound.id}`}
                    value={selectedRound.label}
                    onChange={(event) =>
                      onUpdateSubStage(selectedRound.id, {
                        label: event.target.value,
                      })
                    }
                    onBlur={onFlush}
                    placeholder={`第 ${selectedIndex + 1} 轮面试`}
                  />
                </div>
                <WorkflowDateField
                  label='面试日期'
                  value={selectedRound.start_date}
                  onChange={(value) =>
                    onUpdateSubStage(
                      selectedRound.id,
                      { start_date: value },
                      true,
                    )
                  }
                />
              </div>
              <div
                className='space-y-2'
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    onFlush()
                }}
              >
                <p className='text-xs font-medium text-muted-foreground'>
                  面试笔记
                </p>
                <WorkflowNotesEditor
                  jobId={jobId}
                  kind='round'
                  targetId={selectedRound.id}
                />
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      )}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          className='max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto break-words'
          style={{
            animationDuration: `${reduce ? 0 : deleteOpen ? DURATION.base : DURATION.fast}s`,
            animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()

            if (deletedRef.current) {
              const target =
                (selectedRound && triggerRefs.current.get(selectedRound.id)) ||
                addRef.current ||
                headingRef.current

              target?.focus({ preventScroll: true })
            } else {
              deleteTriggerRef.current?.focus({ preventScroll: true })
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>删除这轮面试？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deletedRound?.label || '该轮面试'}
              」的日期和笔记将一并删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保留</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() => {
                const deleting = deletedRound?.id

                if (!deleting) return

                deletedRef.current = true
                exitingRoundIdRef.current =
                  subStages.length > 1 ? deleting : null

                if (selectedRound?.id === deleting) {
                  const next =
                    subStages[selectedIndex + 1] ?? subStages[selectedIndex - 1]

                  setSelectedId(next?.id ?? '')
                }

                onDeleteSubStage(deleting)
              }}
            >
              删除轮次
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
