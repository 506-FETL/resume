import { useLayoutEffect, useState } from 'react'
import { useCommandState } from 'cmdk'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { PopoverContent } from '@/components/ui/popover'
import type {
  ComposerCommandAccessibilityProps,
  ComposerToolsProps,
} from '../../../types'

export function ComposerTools({
  tools,
  query,
  onQueryChange,
  queryMode,
  commandRef,
  textareaRef,
  onSelect,
  onClose,
  onRestoreFocus,
}: ComposerToolsProps) {
  const reduceMotion = useReducedMotion()
  const [selection, setSelection] = useState({ query: '', value: '' })
  const categories = [...new Set(tools.map((tool) => tool.category))]
  const firstValue = tools[0]?.name ?? ''

  const selectedValue =
    selection.query === query &&
    tools.some((tool) => tool.name === selection.value)
      ? selection.value
      : firstValue

  return (
    <PopoverContent
      side='top'
      align='start'
      className='w-[min(28rem,calc(100vw-2rem))] gap-0 p-0'
      style={reduceMotion ? { animationDuration: '0s' } : undefined}
      onOpenAutoFocus={(event) => {
        setSelection({ query, value: firstValue })

        if (queryMode) event.preventDefault()
      }}
      onCloseAutoFocus={(event) => event.preventDefault()}
      onInteractOutside={(event) => {
        if (
          queryMode &&
          event.target instanceof Element &&
          event.target.closest('[data-composer] textarea')
        )
          event.preventDefault()
      }}
      onEscapeKeyDown={() => {
        onRestoreFocus()
        onClose()
      }}
    >
      <Command
        ref={commandRef}
        loop
        shouldFilter={false}
        value={selectedValue}
        onValueChange={(value) => setSelection({ query, value })}
      >
        <ComposerCommandAccessibility
          commandRef={commandRef}
          textareaRef={textareaRef}
          queryMode={queryMode}
        />
        {queryMode ? (
          <div className='px-3 py-2 text-xs text-muted-foreground'>
            选择快捷指令或技能，按 Esc 继续输入
          </div>
        ) : (
          <CommandInput
            aria-label='搜索快捷指令或技能'
            placeholder='搜索快捷指令或技能'
            value={query}
            onValueChange={onQueryChange}
          />
        )}
        <CommandList aria-label='快捷指令与技能'>
          <CommandEmpty>没有匹配的指令或技能</CommandEmpty>
          {categories.map((category) => (
            <CommandGroup key={category} heading={category}>
              {tools
                .filter((tool) => tool.category === category)
                .map((tool) => (
                  <CommandItem
                    key={tool.name}
                    value={tool.name}
                    onMouseDown={(event) => {
                      if (queryMode) event.preventDefault()
                    }}
                    onSelect={() => onSelect(tool)}
                    className='items-start py-2'
                  >
                    {tool.icon}
                    <div className='min-w-0 flex-1 whitespace-normal break-words'>
                      <div>{tool.displayName ?? tool.name}</div>
                      <div className='mt-0.5 text-xs text-muted-foreground'>
                        {tool.description}
                      </div>
                      {tool.sourceLabel && (
                        <div className='mt-0.5 text-xs text-muted-foreground'>
                          来源：{tool.sourceLabel}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </PopoverContent>
  )
}

function ComposerCommandAccessibility({
  commandRef,
  textareaRef,
  queryMode,
}: ComposerCommandAccessibilityProps) {
  const selectedItemId = useCommandState((state) => state.selectedItemId)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    const list = commandRef.current?.querySelector('[cmdk-list]')

    if (!queryMode || !textarea || !list) return

    // cmdk 自行生成列表和选项 ID，外置 textarea 必须关联实际节点。
    textarea.setAttribute('aria-controls', list.id)

    if (selectedItemId)
      textarea.setAttribute('aria-activedescendant', selectedItemId)
    else textarea.removeAttribute('aria-activedescendant')

    return () => {
      textarea.removeAttribute('aria-controls')
      textarea.removeAttribute('aria-activedescendant')
    }
  }, [commandRef, textareaRef, queryMode, selectedItemId])

  return null
}
