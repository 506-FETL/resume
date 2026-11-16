import type { AnnotationControlsProps } from './types'
import { buildAnnotationFields } from './fields'
import { usePointerSelection } from './use-pointer-selection'
import { useFocusableFields } from './use-focusable-fields'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { CommentAnchor } from '@/features/resume-comments/anchors/types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { PresenceDiv } from '@/components/motion/presence-item'
import { MessageSquarePlus } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useAssistantStore from '../../../../store'
import type { resolveCanvasSelection } from '../selection'

export default function AnnotationControls({
  rootRef,
  model,
  data,
  resumeId,
  name,
}: AnnotationControlsProps) {
  const [selected, setSelected] = useState<{
    value: NonNullable<ReturnType<typeof resolveCanvasSelection>>
    documentHash: string
    resumeId: string
  } | null>(null)

  const selection =
    selected?.documentHash === model.documentHash &&
    selected.resumeId === resumeId
      ? selected.value
      : null

  const addedRef = useRef(false)
  const pointerSelectingRef = useRef(false)
  const keyboardFieldRef = useRef<HTMLElement | null>(null)

  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()

  const fields = useMemo(
    () => buildAnnotationFields(model, data),
    [model, data],
  )

  const add = (
    anchors: CommentAnchor[],
    field?: { nodeKey: string; label: string },
  ) => {
    addedRef.current = true

    const excerpt = anchors.map((anchor) => anchor.exactQuote).join(' · ')

    useAssistantStore.getState().addComposerReferences([
      {
        type: 'reference',
        kind: 'annotation',
        id: crypto.randomUUID(),
        label: field
          ? `${name} · ${field.label}`
          : `${name} · ${excerpt.slice(0, 36)}${excerpt.length > 36 ? '…' : ''}`,
        resumeId,
        documentHash: model.documentHash,
        anchors,
        ...(field ? { fields: [field] } : {}),
      },
    ])

    setSelected(null)
    setOpen(false)
    window.getSelection()?.removeAllRanges()

    if (useAssistantStore.getState().layoutMode === 'drawer') {
      useAssistantStore.setState({
        canvasMobileOpen: false,
        focusComposerOnCanvasClose: true,
      })

      return
    }

    document
      .querySelector<HTMLTextAreaElement>('[data-composer] textarea')
      ?.focus({ preventScroll: true })
  }

  usePointerSelection({
    rootRef,
    model,
    resumeId,
    pointerSelectingRef,
    keyboardFieldRef,
    setSelected,
  })

  useFocusableFields({
    rootRef,
    model,
    resumeId,
    pointerSelectingRef,
    keyboardFieldRef,
    setSelected,
    fields,
  })

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size='sm' variant='ghost' className='shrink-0'>
            <MessageSquarePlus className='size-4' />
            引用字段
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align='end'
          className='w-[min(24rem,calc(100vw-2rem))] p-0'
          style={reduced ? { animationDuration: '0s' } : undefined}
          onCloseAutoFocus={(event) => {
            if (!addedRef.current) return

            event.preventDefault()
            addedRef.current = false

            document
              .querySelector<HTMLTextAreaElement>('[data-composer] textarea')
              ?.focus({ preventScroll: true })
          }}
        >
          <Command>
            <CommandInput placeholder='搜索简历字段' />
            <CommandList>
              <CommandEmpty>没有匹配的字段</CommandEmpty>
              {fields.map((field) => (
                <CommandItem
                  key={field.nodeKey}
                  value={`${field.label} ${field.text}`}
                  onSelect={() => add([], field)}
                >
                  <span className='min-w-0'>
                    <span className='block'>{field.label}</span>
                    <span className='block truncate text-xs text-muted-foreground'>
                      {field.text.slice(0, 70) || '尚未填写'}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {createPortal(
        <AnimatePresence>
          {selection && (
            <PresenceDiv
              key='selection-reference'
              data-annotation-bubble
              className='fixed z-50'
              style={{
                left: Math.max(
                  8,
                  Math.min(selection.rect.left, window.innerWidth - 160),
                ),
                top: Math.max(
                  8,
                  Math.min(selection.rect.bottom + 8, window.innerHeight - 48),
                ),
              }}
              initial={reduced ? false : { opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                transition: {
                  duration: reduced ? 0 : DURATION.fast,
                  ease: EASE.in,
                },
              }}
              transition={{
                duration: reduced ? 0 : DURATION.base,
                ease: EASE.out,
              }}
            >
              <Button
                size='sm'
                variant='outline'
                className='rounded-xl bg-popover shadow-md'
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => add(selection.anchors)}
              >
                <MessageSquarePlus />
                引用到对话
              </Button>
            </PresenceDiv>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
