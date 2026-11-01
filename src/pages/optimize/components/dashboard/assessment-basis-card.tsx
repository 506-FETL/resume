import { useIsMobile } from '@/hooks/use-mobile'
import { BrainCircuit, ChevronDown, Layers3, Sparkles } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useId, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { SCORE_ICONS, SCORE_LABELS } from '../../const'
import useAtsStore from '../../store'
import ProTips from '../pro-tips'
import ScoresRadarChart from './scores-radar-chart'

export default function AssessmentBasisCard() {
  const { currentAtsConfig, loading } = useAtsStore()
  const isMobile = useIsMobile()
  const rationaleId = useId()
  const [rationaleOpen, setRationaleOpen] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const assessment = currentAtsConfig?.meta?.assessment

  if (!loading && !currentAtsConfig?.scores) return <ProTips />

  if (!assessment || currentAtsConfig?.meta?.rubricVersion !== '2.0') {
    return (
      <div className='min-w-0 space-y-4'>
        <ScoresRadarChart scores={currentAtsConfig?.scores} loading={loading} />
        <ProTips />
      </div>
    )
  }

  const scoreRationales = Object.entries(currentAtsConfig.scores ?? {}).filter(
    ([, score]) => score.rationale,
  )

  return (
    <Collapsible
      open={!isMobile || open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && contentRef.current?.contains(document.activeElement)) {
          triggerRef.current?.focus()
        }

        setOpen(nextOpen)
      }}
      asChild
    >
      <section className='min-w-0 border-t pt-6'>
        <header>
          {isMobile ? (
            <CollapsibleTrigger asChild>
              <Button
                ref={triggerRef}
                variant='ghost'
                className='h-auto w-full justify-between gap-3 px-0 py-2 hover:bg-transparent'
              >
                <span className='flex items-center gap-2 text-lg font-semibold'>
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
          ) : (
            <h2 className='flex items-center gap-2 text-lg font-semibold tracking-tight'>
              <BrainCircuit
                aria-hidden
                className='size-4 text-muted-foreground'
              />
              评分依据
            </h2>
          )}
        </header>
        <CollapsibleContent
          ref={contentRef}
          inert={isMobile && !open}
          style={reduceMotion ? { animationDuration: '0s' } : undefined}
        >
          <div className='pt-5'>
            <div className='mb-6 max-w-[75ch] space-y-3'>
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
            </div>
            <div className='grid min-w-0 items-start gap-8 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-10'>
              <div className='min-w-0 space-y-6'>
                <ScoresRadarChart
                  scores={currentAtsConfig.scores}
                  loading={loading}
                  embedded
                />
                <ProTips embedded />
              </div>
              <div className='min-w-0'>
                <p className='mb-1 text-sm font-medium'>各维度判断理由</p>
                <Accordion
                  type='multiple'
                  value={
                    isMobile
                      ? rationaleOpen
                      : scoreRationales.map(([key]) => key)
                  }
                  onValueChange={setRationaleOpen}
                  className='min-w-0'
                >
                  {scoreRationales.map(([key, score]) => {
                    const Icon = SCORE_ICONS[key as keyof typeof SCORE_ICONS]

                    return (
                      <AccordionItem
                        key={key}
                        value={key}
                        className='min-w-0 border-border/60'
                      >
                        {isMobile ? (
                          <AccordionTrigger
                            id={`${rationaleId}-${key}`}
                            className='min-h-14 items-center py-3 hover:no-underline'
                          >
                            <span className='flex min-w-0 flex-1 items-center gap-3 pr-1'>
                              <Icon
                                aria-hidden
                                className='size-4 shrink-0 text-muted-foreground'
                              />
                              <span className='min-w-0 flex-1 wrap-break-word font-medium'>
                                {SCORE_LABELS[
                                  key as keyof typeof SCORE_LABELS
                                ] ?? key}
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
                        ) : (
                          <h3
                            id={`${rationaleId}-${key}`}
                            className='flex min-h-14 items-center py-3'
                          >
                            <span className='flex min-w-0 flex-1 items-center gap-3 pr-1'>
                              <Icon
                                aria-hidden
                                className='size-4 shrink-0 text-muted-foreground'
                              />
                              <span className='min-w-0 flex-1 wrap-break-word font-medium'>
                                {SCORE_LABELS[
                                  key as keyof typeof SCORE_LABELS
                                ] ?? key}
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
                          </h3>
                        )}
                        <AccordionContent
                          aria-labelledby={`${rationaleId}-${key}`}
                          className='pr-2 pb-5 text-sm leading-6 text-muted-foreground sm:pl-7'
                        >
                          <p className='max-w-[72ch] wrap-break-word'>
                            {score.rationale}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </div>
            </div>

            <div className='mt-8 space-y-5 border-t border-border/60 pt-5'>
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
                  <ul className='grid min-w-0 gap-x-8 gap-y-3 sm:grid-cols-2'>
                    {assessment.evidenceSignals.map((signal) => (
                      <li
                        key={signal}
                        className='flex min-w-0 items-start gap-2.5'
                      >
                        <span
                          aria-hidden
                          className='mt-2.5 size-1 shrink-0 rounded-full bg-muted-foreground'
                        />
                        <span className='wrap-break-word min-w-0 text-sm leading-6'>
                          {signal}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
