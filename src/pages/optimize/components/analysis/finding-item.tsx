import type { Severity } from '../../types'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { hasUnresolvedSuggestionInput, isAtsFindingPending } from '@/lib/ats'
import { cn } from '@/lib/utils'
import { severityConfig } from '../../const'
import useAtsStore from '../../store'
import IssueFix from './Issue-fix'

interface FindingItemProps {
  id: string
  severity: Severity
  featured?: boolean
}

export default function FindingItem({
  id,
  severity,
  featured = false,
}: FindingItemProps) {
  const { currentAtsConfig } = useAtsStore()

  const finding = currentAtsConfig?.findings?.[severity]?.find(
    (item) => item.id === id,
  )

  const [open, setOpen] = useState(featured)
  const hasToggledRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const config = severityConfig[severity]

  useEffect(() => {
    if (featured && !hasToggledRef.current) setOpen(true)
  }, [featured])

  if (!finding) return null

  const suggestions = finding.fix.suggestions || []
  const needsUserInput = hasUnresolvedSuggestionInput(suggestions)
  const isFixed = !isAtsFindingPending(finding)
  const evidence = finding.why.evidence[0]

  return (
    <Collapsible
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && contentRef.current?.contains(document.activeElement)) {
          triggerRef.current?.focus()
        }

        hasToggledRef.current = true
        setOpen(nextOpen)
      }}
      className={cn(
        'min-w-0 border-b border-border/60 last:border-b-0',
        featured && 'mb-5 border-border pb-2',
      )}
    >
      <CollapsibleTrigger asChild>
        <Button
          ref={triggerRef}
          variant='ghost'
          className={cn(
            'h-auto min-h-16 w-full justify-between gap-3 rounded-xl px-2 py-4 text-left whitespace-normal aria-expanded:bg-transparent aria-expanded:hover:bg-muted dark:aria-expanded:hover:bg-muted/50',
            featured && 'items-start py-5',
          )}
        >
          <span className='flex min-w-0 flex-1 items-start gap-2.5 text-left sm:gap-3'>
            {isFixed ? (
              <span className='mt-1 shrink-0 rounded-full bg-green-100 p-1 text-green-600 dark:bg-green-900/30'>
                <Check aria-hidden className='size-3' />
              </span>
            ) : (
              <span className={cn('mt-1.5 shrink-0', config.textColor)}>
                <config.icon aria-hidden className='size-4' />
              </span>
            )}
            <span className='flex min-w-0 flex-col gap-2'>
              <span
                className={cn(
                  'wrap-break-word pr-2 text-sm leading-6 font-medium whitespace-normal',
                  featured && 'text-xl leading-8 font-semibold tracking-tight',
                  isFixed && 'text-muted-foreground',
                )}
              >
                {finding.title}
              </span>
              {featured ? (
                <span className='flex flex-wrap items-center gap-2'>
                  <Badge
                    variant='secondary'
                    className={cn(config.badgeBg, config.badgeText)}
                  >
                    优先处理
                  </Badge>
                  <span className={cn('text-xs font-normal', config.badgeText)}>
                    {config.label}
                  </span>
                </span>
              ) : isFixed ? (
                <span className='text-xs font-normal text-green-700 dark:text-green-300'>
                  已修复
                </span>
              ) : null}
            </span>
          </span>
          {!featured && !isFixed && (
            <span
              className={cn('shrink-0 text-xs font-normal', config.badgeText)}
            >
              {config.label}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-(--ui-motion-base) ease-(--ui-motion-enter-ease) [[data-state=open]>&]:rotate-180',
              featured && 'mt-2',
            )}
            style={reduceMotion ? { transitionDuration: '0s' } : undefined}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        ref={contentRef}
        inert={!open}
        style={reduceMotion ? { animationDuration: '0s' } : undefined}
        className='overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down'
      >
        <div className='px-2 pb-6 sm:pl-9'>
          <div
            className={cn(
              'grid max-w-[72ch] gap-6 text-sm',
              featured && 'max-w-none md:grid-cols-2 md:gap-8',
            )}
          >
            <div className='min-w-0 space-y-5'>
              <div className='space-y-2'>
                <h3 className='text-xs font-medium text-muted-foreground'>
                  为什么需要调整
                </h3>
                <p className='wrap-break-word leading-7'>
                  {finding.why.summary}
                </p>
              </div>

              {evidence && (
                <div className='space-y-2'>
                  <h3 className='text-xs font-medium text-muted-foreground'>
                    简历中的内容
                  </h3>
                  {evidence.text && (
                    <blockquote className='border-l border-border pl-3'>
                      <p className='line-clamp-4 wrap-break-word leading-6 text-foreground/80'>
                        {evidence.text}
                      </p>
                    </blockquote>
                  )}
                  <p className='wrap-break-word text-xs leading-5 text-muted-foreground'>
                    {[
                      evidence.locate.sectionLabel,
                      evidence.locate.itemLabel,
                      evidence.locate.fieldLabel,
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                  </p>
                </div>
              )}
            </div>

            <div className='min-w-0 space-y-4'>
              <div className='space-y-2'>
                <h3 className='text-xs font-medium text-muted-foreground'>
                  修复建议
                </h3>
                <p className='wrap-break-word leading-7'>
                  {finding.fix.summary}
                </p>

                {finding.fix.steps.length > 0 && (
                  <ul className='space-y-2 pt-1'>
                    {finding.fix.steps.map((step) => (
                      <li
                        key={step}
                        className='flex items-start gap-2 text-xs leading-5 text-muted-foreground'
                      >
                        <span className='mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60' />
                        <span className='min-w-0 wrap-break-word'>{step}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <IssueFix id={id} severity={severity}>
                <Button
                  size='sm'
                  variant={isFixed ? 'outline' : 'default'}
                  className={cn(
                    'text-xs font-medium',
                    !isFixed &&
                      severity === 'high' &&
                      'bg-destructive text-white hover:bg-destructive/90',
                    !isFixed &&
                      severity === 'medium' &&
                      'bg-amber-700 text-white hover:bg-amber-800',
                    !isFixed &&
                      severity === 'low' &&
                      'bg-blue-600 text-white hover:bg-blue-700',
                    isFixed &&
                      'border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-900 dark:text-green-300 dark:hover:bg-green-950 dark:hover:text-green-200',
                  )}
                >
                  {isFixed
                    ? '查看详情'
                    : needsUserInput
                      ? '补充信息并修复'
                      : '查看并修复'}
                </Button>
              </IssueFix>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
