import type {
  ExampleOption,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { Check } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { DURATION } from '@/lib/motion'
import { exampleKey } from '@/lib/resume-template/source/types'
import { cn } from '@/lib/utils'
import { useTemplatePrefetch } from '../../hooks/use-template-prefetch'
import { useTemplatePageStore } from '../../store.ts'

function ExampleChoice({
  item,
  example,
  name,
  disabled,
}: {
  item: TemplateCatalogItem
  example: ExampleOption
  name: string
  disabled: boolean
}) {
  const selectedExample =
    useTemplatePageStore((state) => state.selectedExamples[item.templateId]) ??
    item.defaultExample
  const selectExample = useTemplatePageStore((state) => state.selectExample)
  const prefetchEvents = useTemplatePrefetch(item, example, disabled)
  const reduceMotion = useReducedMotion()
  const transitionStyle = {
    transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s`,
  }
  const selected = exampleKey(selectedExample) === exampleKey(example)

  return (
    <label
      {...prefetchEvents}
      className={cn(
        'relative flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-disabled:cursor-not-allowed has-disabled:opacity-60',
        selected
          ? 'border-foreground/50 bg-muted/40'
          : 'border-border hover:border-foreground/25 hover:bg-muted/25',
      )}
      style={transitionStyle}
    >
      <input
        type='radio'
        name={name}
        value={exampleKey(example)}
        checked={selected}
        onChange={() => selectExample(item.templateId, example)}
        className='sr-only'
      />
      <span className='min-w-0 flex-1 space-y-1'>
        <span className='block text-sm font-medium'>{example.name}</span>
        {example.description && (
          <span className='block text-xs leading-5 text-muted-foreground'>
            {example.description}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input',
        )}
        style={transitionStyle}
      >
        <Check
          className={cn(
            'size-3 transition-opacity',
            selected ? 'opacity-100' : 'opacity-0',
          )}
          style={transitionStyle}
        />
      </span>
    </label>
  )
}

export default function ExamplePicker({
  item,
  disabled = false,
}: {
  item: TemplateCatalogItem
  disabled?: boolean
}) {
  const name = useId()
  return (
    <fieldset disabled={disabled} className='min-w-0 space-y-3'>
      <legend className='mb-3 text-sm font-medium'>选择示例内容</legend>
      {item.examples.map((example) => (
        <ExampleChoice
          key={exampleKey(example)}
          item={item}
          example={example}
          name={name}
          disabled={disabled}
        />
      ))}
    </fieldset>
  )
}
