import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
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
import type {
  CommentAnchor,
  CommentAnchorDocumentResult,
} from '@/features/resume-comments/anchors/types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { ATS_FIELD_LABELS, ATS_SECTION_LABELS } from '@/lib/ats/constants'
import { DURATION, EASE } from '@/lib/motion'
import { MessageSquarePlus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { RefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useAssistantStore from '../../../../store'
import { hasVisibleCanvasText, resolveCanvasSelection } from '../selection'
import {
  COMMENT_HIDDEN_PAGE_SELECTOR,
  COMMENT_MEASUREMENT_SOURCE_SELECTOR,
} from '@/features/resume-comments/const'

const FIELD_LABELS: Record<string, string> = {
  ...ATS_FIELD_LABELS,
  photo: '照片',
  gender: '性别',
  birthMonth: '出生年月',
  nation: '民族',
  nativePlace: '籍贯',
  heightCm: '身高',
  weightKg: '体重',
  maritalStatus: '婚姻情况',
  politicalStatus: '政治面貌',
  applicationSchool: '申请院校',
  applicationMajor: '申请专业',
  professionalDegree: '专业与学历',
  age: '年龄',
  height: '身高',
  weight: '体重',
  skill: '技能与熟练程度',
  label: '技能',
  proficiencyLevel: '熟练程度',
  content: '经历描述',
  description: '描述',
}

const PROJECTED_FIELDS: Record<string, string> = {
  birthMonth: 'age',
  heightCm: 'height',
  weightKg: 'weight',
  professional: 'professionalDegree',
  degree: 'professionalDegree',
  label: 'skill',
  proficiencyLevel: 'skill',
}

export default function AnnotationControls({
  rootRef,
  model,
  data,
  resumeId,
  name,
}: {
  rootRef: RefObject<HTMLDivElement | null>
  model: CommentAnchorDocumentResult
  data: TemplateResumeData
  resumeId: string
  name: string
}) {
  const [selected, setSelection] = useState<{
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

  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()

  const fields = useMemo(() => {
    const entryNames = new Map<string, string>()

    for (const section of Object.values(data)) {
      if (!section || typeof section !== 'object') continue

      for (const collection of Object.values(section)) {
        if (!Array.isArray(collection)) continue

        for (const entry of collection) {
          if (!entry || typeof entry !== 'object' || !('entryId' in entry))
            continue

          entryNames.set(
            String(entry.entryId),
            entry.schoolName ||
              entry.companyName ||
              entry.projectName ||
              entry.experienceName ||
              entry.label ||
              entry.name ||
              '',
          )
        }
      }
    }

    const fieldLabel = (sectionKey: string, entryId: string, key: string) =>
      [
        ATS_SECTION_LABELS[sectionKey as keyof typeof ATS_SECTION_LABELS] ??
          '申请信息',
        entryNames.get(entryId),
        key.startsWith('customFields.')
          ? `自定义字段 ${Number(key.split('.')[1]) + 1}`
          : (FIELD_LABELS[key] ?? '字段'),
      ]
        .filter(Boolean)
        .join(' · ')

    const result = new Map(
      model.document.nodes.map((node) => [
        node.nodeKey,
        {
          nodeKey: node.nodeKey,
          label: fieldLabel(node.sectionKey, node.entryId, node.fieldKey),
          text: node.text,
        },
      ]),
    )

    for (const [sectionKey, section] of Object.entries(data)) {
      if (
        !section ||
        typeof section !== 'object' ||
        Array.isArray(section) ||
        !(
          'basics' === sectionKey ||
          sectionKey in ATS_SECTION_LABELS ||
          sectionKey === 'application_info'
        )
      )
        continue

      const appendFields = (
        entry: Record<string, unknown>,
        entryId: string,
      ) => {
        for (const [key, value] of Object.entries(entry)) {
          if (
            !(key in FIELD_LABELS) ||
            (Array.isArray(value) && key === 'customFields')
          )
            continue

          const projectedKey =
            PROJECTED_FIELDS[key] ??
            (/Info$/.test(key)
              ? 'content'
              : /Duration$/.test(key)
                ? 'duration'
                : key)

          const nodeKey = `${sectionKey}/${entryId}/${projectedKey}`
          const label = fieldLabel(sectionKey, entryId, projectedKey)

          const hasContent = Array.isArray(value)
            ? value.some(
                (part) =>
                  typeof part === 'string' && part.trim() && part !== '不填',
              )
            : typeof value === 'string'
              ? Boolean(value.trim()) && value !== '不填'
              : typeof value === 'number'

          if (!result.has(nodeKey))
            result.set(nodeKey, {
              nodeKey,
              label,
              text: hasContent
                ? key === 'photo'
                  ? '已添加照片'
                  : '已有内容，当前未展示'
                : '',
            })
        }
      }

      appendFields(section as Record<string, unknown>, 'singleton')

      for (const value of Object.values(section)) {
        if (!Array.isArray(value)) continue

        for (const entry of value)
          if (
            entry &&
            typeof entry === 'object' &&
            'entryId' in entry &&
            !entry.hidden
          )
            appendFields(entry, String(entry.entryId))
      }
    }

    return [...result.values()]
  }, [model, data])

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

    setSelection(null)
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

  useEffect(() => {
    const root = rootRef.current

    if (!root) return

    const update = () => {
      const selected = window.getSelection()

      const value = selected?.rangeCount
        ? resolveCanvasSelection(root, selected.getRangeAt(0), model)
        : null

      setSelection(
        value ? { value, documentHash: model.documentHash, resumeId } : null,
      )
    }

    const clear = () => setSelection(null)

    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !root.contains(event.target) &&
        !event.target.closest('[data-annotation-bubble]')
      )
        clear()
    }

    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear()
      else if (event.key.startsWith('Arrow') && event.shiftKey) update()
    }

    root.addEventListener('pointerup', update)
    root.addEventListener('keyup', keyboard)
    root.addEventListener('scroll', clear, true)
    window.addEventListener('resize', clear)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keyboard)

    return () => {
      root.removeEventListener('pointerup', update)
      root.removeEventListener('keyup', keyboard)
      root.removeEventListener('scroll', clear, true)
      window.removeEventListener('resize', clear)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', keyboard)
    }
  }, [rootRef, model, resumeId])

  useEffect(() => {
    const root = rootRef.current

    if (!root) return

    const original = new Map<
      HTMLElement,
      {
        tabIndex: string | null
        label: string | null
        shortcuts: string | null
      }
    >()

    const clippingStyles = new Map<HTMLElement, string>()

    const labels = new Map(fields.map((field) => [field.nodeKey, field.label]))

    const restore = (node: HTMLElement) => {
      const previous = original.get(node)

      if (!previous) return

      for (const [attribute, value] of [
        ['tabindex', previous.tabIndex],
        ['aria-label', previous.label],
        ['aria-keyshortcuts', previous.shortcuts],
      ]) {
        if (value === null) node.removeAttribute(attribute!)
        else node.setAttribute(attribute!, value!)
      }

      node.removeAttribute('data-annotation-focusable')
      original.delete(node)
    }

    const updateFields = () => {
      // hidden 会让键盘聚焦滚动分页内部；clip 只裁剪，纸张几何与打印源不变。
      for (const node of root.querySelectorAll<HTMLElement>(
        '[data-resume-page-index] [data-resume-page-viewport], [data-resume-page-index] [data-resume-region-viewport], [data-resume-page-index] [data-resume-page-clip]',
      )) {
        if (clippingStyles.has(node)) continue

        clippingStyles.set(node, node.style.overflow)
        node.style.overflow = 'clip'
      }

      for (const node of root.querySelectorAll<HTMLElement>(
        '[data-comment-node-key]',
      )) {
        if (
          node.closest(COMMENT_HIDDEN_PAGE_SELECTOR) ||
          node.closest(COMMENT_MEASUREMENT_SOURCE_SELECTOR) ||
          !hasVisibleCanvasText(node)
        ) {
          restore(node)
          continue
        }
        if (original.has(node)) continue

        original.set(node, {
          tabIndex: node.getAttribute('tabindex'),
          label: node.getAttribute('aria-label'),
          shortcuts: node.getAttribute('aria-keyshortcuts'),
        })

        node.tabIndex = 0
        node.setAttribute('data-annotation-focusable', '')
        node.setAttribute('aria-keyshortcuts', 'Enter')

        node.setAttribute(
          'aria-label',
          `${labels.get(node.dataset.commentNodeKey ?? '') ?? '简历字段'}，按 Enter 引用到对话`,
        )
      }
    }

    const focusField = (event: FocusEvent) => {
      const node = event.target

      if (
        !(node instanceof HTMLElement) ||
        !node.hasAttribute('data-annotation-focusable')
      )
        return

      const range = document.createRange()

      range.selectNodeContents(node)

      const value = resolveCanvasSelection(root, range, model)

      setSelection(
        value ? { value, documentHash: model.documentHash, resumeId } : null,
      )
    }

    const quoteField = (event: KeyboardEvent) => {
      if (
        event.key !== 'Enter' ||
        event.isComposing ||
        !(event.target instanceof HTMLElement) ||
        !event.target.hasAttribute('data-annotation-focusable')
      )
        return

      event.preventDefault()

      document
        .querySelector<HTMLButtonElement>('[data-annotation-bubble] button')
        ?.click()
    }

    const leaveField = (event: FocusEvent) => {
      const next = event.relatedTarget

      if (
        next instanceof Element &&
        (root.contains(next) || next.closest('[data-annotation-bubble]'))
      )
        return

      setSelection(null)
    }

    // 仅装饰助手的可见分页副本；测量、打印与其他页面不获得交互属性。
    updateFields()

    const observer = new MutationObserver(updateFields)
    const sizeObserver = new ResizeObserver(updateFields)

    sizeObserver.observe(root)

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-comment-page-visibility'],
    })

    root.addEventListener('focusin', focusField)
    root.addEventListener('focusout', leaveField)
    root.addEventListener('keydown', quoteField)

    return () => {
      observer.disconnect()
      sizeObserver.disconnect()
      root.removeEventListener('focusin', focusField)
      root.removeEventListener('focusout', leaveField)
      root.removeEventListener('keydown', quoteField)

      for (const node of original.keys()) restore(node)

      for (const [node, overflow] of clippingStyles)
        node.style.overflow = overflow
    }
  }, [rootRef, fields, model, resumeId])

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
            <motion.div
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
              exit={{ opacity: 0 }}
              transition={{
                duration: reduced ? 0 : DURATION.fast,
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
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
