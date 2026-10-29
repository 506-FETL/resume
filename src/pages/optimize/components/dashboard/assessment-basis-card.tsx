import { BrainCircuit, ChevronDown, Layers3, Sparkles } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SCORE_LABELS } from '../../const'
import useAtsStore from '../../store'

export default function AssessmentBasisCard() {
  const { currentAtsConfig } = useAtsStore()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const assessment = currentAtsConfig?.meta?.assessment

  if (!assessment || currentAtsConfig?.meta?.rubricVersion !== '2.0')
    return null

  const scoreRationales = Object.entries(currentAtsConfig.scores ?? {}).filter(
    ([, score]) => score.rationale,
  )

  return (
    <Collapsible
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && contentRef.current?.contains(document.activeElement)) {
          triggerRef.current?.focus()
        }

        setOpen(nextOpen)
      }}
      asChild
    >
      <Card className='min-w-0 gap-0 overflow-hidden py-0 shadow-none'>
        <CardHeader className='p-0'>
          <CollapsibleTrigger asChild>
            <Button
              ref={triggerRef}
              variant='ghost'
              className='h-auto w-full justify-between gap-3 rounded-none p-4 md:p-5'
            >
              <span className='flex items-center gap-2 text-base font-semibold'>
                <BrainCircuit
                  aria-hidden
                  className='size-4 text-muted-foreground'
                />
                评分依据
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 shrink-0 transition-transform duration-(--ui-motion-base) ease-(--ui-motion-enter-ease)',
                  open && 'rotate-180',
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent
          ref={contentRef}
          inert={!open}
          style={reduceMotion ? { animationDuration: '0s' } : undefined}
        >
          <CardContent className='p-0'>
            <div className='space-y-3 border-t px-4 py-4 md:px-5'>
              <div className='flex flex-wrap gap-2'>
                <Badge variant='secondary'>内容自适应评分 2.0</Badge>
                {assessment.inferredTarget && (
                  <Badge
                    variant='outline'
                    className='max-w-full whitespace-normal wrap-break-word'
                  >
                    参考岗位：{assessment.inferredTarget}
                  </Badge>
                )}
              </div>
              {assessment.candidateProfile && (
                <p className='wrap-break-word text-sm leading-6 text-muted-foreground'>
                  {assessment.candidateProfile}
                </p>
              )}
              {currentAtsConfig.readabilityIndex?.summary && (
                <p className='wrap-break-word text-sm leading-6 text-muted-foreground'>
                  可读性：{currentAtsConfig.readabilityIndex.summary}
                </p>
              )}
              <p className='text-xs font-medium text-muted-foreground'>
                各维度判断理由
              </p>
            </div>
            <Accordion
              type='single'
              collapsible
              className='grid items-start gap-2 px-4 pb-4 md:grid-cols-2 md:px-5 md:pb-5'
            >
              {scoreRationales.map(([key, score], index) => (
                <AccordionItem
                  key={key}
                  value={key}
                  className={cn(
                    'rounded-xl border border-transparent bg-muted/25 px-3 transition-[background-color,border-color] duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease) last:border-b hover:border-primary/15 hover:bg-muted/40 data-[state=open]:border-primary/20 data-[state=open]:bg-primary/4 md:px-4',
                    index === scoreRationales.length - 1 &&
                      scoreRationales.length % 2 === 1 &&
                      'md:col-span-2',
                  )}
                >
                  <AccordionTrigger className='min-h-14 items-center py-3 hover:no-underline'>
                    <span className='flex min-w-0 flex-1 items-center gap-3 pr-1'>
                      <span className='flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-[10px] font-semibold tabular-nums text-muted-foreground shadow-xs'>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className='min-w-0 flex-1 truncate font-medium'>
                        {SCORE_LABELS[key as keyof typeof SCORE_LABELS] ?? key}
                      </span>
                      <span className='flex shrink-0 items-baseline gap-0.5 tabular-nums'>
                        <span className='text-lg font-semibold tracking-tight text-foreground'>
                          {score.score}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          /{score.max}
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className='border-t border-border/50 pt-3 pr-8 text-sm leading-6 text-muted-foreground'>
                    <div className='flex items-start gap-2.5'>
                      <Sparkles className='mt-1 size-3.5 shrink-0 text-primary' />
                      <p>{score.rationale}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className='space-y-4 border-t border-border/60 bg-muted/10 p-4 md:p-5'>
              <div className='flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-4'>
                <div className='flex shrink-0 items-center gap-2 pt-1 text-xs font-medium text-muted-foreground'>
                  <Layers3 className='size-3.5' />
                  参与评估
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                  {assessment.evaluatedSections.map((section) => (
                    <Badge
                      key={section}
                      variant='outline'
                      className='rounded-full bg-background/80 px-2.5 font-normal'
                    >
                      {section}
                    </Badge>
                  ))}
                </div>
              </div>

              {assessment.evidenceSignals.length > 0 && (
                <div className='min-w-0 space-y-2.5'>
                  <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                    <Sparkles className='size-3.5' />
                    参考内容
                  </div>
                  <div className='grid min-w-0 gap-2 sm:grid-cols-2'>
                    {assessment.evidenceSignals.map((signal, index) => (
                      <div
                        key={signal}
                        className='flex min-w-0 items-start gap-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2.5'
                      >
                        <span className='mt-0.5 text-[10px] font-semibold tabular-nums text-primary/70'>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className='wrap-break-word min-w-0 text-sm leading-6'>
                          {signal}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
