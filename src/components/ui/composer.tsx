'use client'

import type { FC, ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp02Icon,
  HugeiconsIcon,
  PlusSignIcon,
  ToolsIcon,
} from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/lib/motion'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { FilePreview, type UploadedFile } from '@/components/ui/file-preview'
import {
  SlashCommandDropdown,
  type SlashCommandMatch,
  type Tool,
} from '@/components/ui/slash-command-dropdown'

// Re-export types for convenience
export type { Tool, SlashCommandMatch, UploadedFile }

export interface ComposerContextOption {
  id: string
  label: string
  icon?: ReactNode
  description?: string
  onClick?: () => void
}

export interface ComposerProps {
  /** Placeholder text for the input */
  placeholder?: string
  /** Callback when message is submitted */
  onSubmit?: (message: string, files?: UploadedFile[]) => void
  /** Callback when input value changes */
  onChange?: (value: string) => void
  /** Whether the composer is disabled */
  disabled?: boolean
  /** Whether to show the tools button */
  showToolsButton?: boolean
  /** Callback when a tool is selected from slash command dropdown */
  onToolSelect?: (tool: Tool) => void
  /** Available tools for the slash command dropdown */
  tools?: Tool[]
  /** Callback when attach button is clicked (if no context options) */
  onAttachClick?: () => void
  /** Context options for the plus button dropdown */
  contextOptions?: ComposerContextOption[]
  /** Whether to auto-focus the input */
  autoFocus?: boolean
  /** Maximum rows for the textarea */
  maxRows?: number
  /** Initial value */
  defaultValue?: string
  /** Controlled value */
  value?: string
  /** Additional className for the container */
  className?: string
  /** Attached files to display */
  attachedFiles?: UploadedFile[]
  /** Callback to remove an attached file */
  onRemoveFile?: (id: string) => void
  /** Whether the composer is in loading state */
  isLoading?: boolean
  /** Extra action nodes rendered at the left of the toolbar (after the tool buttons) */
  leadingActions?: ReactNode
  /** Extra action nodes rendered at the right of the toolbar (before the send button) */
  trailingActions?: ReactNode
  /** Content rendered above the textarea, such as selected skill tags. */
  composerHeader?: ReactNode
  /** Allows a controller to submit without text, for example with selected skills. */
  canSubmit?: boolean
}

export const Composer: FC<ComposerProps> = ({
  placeholder = '有什么可以帮你？',
  onSubmit,
  onChange,
  disabled = false,
  showToolsButton = true,
  onToolSelect,
  tools = [],
  onAttachClick,
  contextOptions,
  autoFocus = false,
  maxRows = 8,
  defaultValue = '',
  value,
  className,
  attachedFiles = [],
  onRemoveFile,
  isLoading = false,
  leadingActions,
  trailingActions,
  composerHeader,
  canSubmit: canSubmitOverride,
}) => {
  const [inputValue, setInputValue] = useState(defaultValue)
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState(false)

  const [isCommandDropdownDismissed, setIsCommandDropdownDismissed] =
    useState(false)

  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedToolIndex, setSelectedToolIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const contextSelectionRef = useRef(false)
  const shouldReduceMotion = useReducedMotion()

  // Use controlled or uncontrolled value
  const currentValue = value !== undefined ? value : inputValue

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value

      // Escape 仅关闭当前这次命令菜单；继续编辑时重新显示匹配结果。
      setIsCommandDropdownDismissed(false)
      // 查询变化后不能沿用旧分类或索引，否则 Enter 可能跳过新候选而直接提交。
      setSelectedCategory('all')
      setSelectedToolIndex(0)

      if (value === undefined) {
        setInputValue(newValue)
      }

      onChange?.(newValue)
    },
    [onChange, value],
  )

  // Auto-resize textarea
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentValue triggers resize when content changes
  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) return

    textarea.style.height = 'auto'

    const lineHeight = 24
    const maxHeight = lineHeight * maxRows
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)

    textarea.style.height = `${newHeight}px`
  }, [currentValue, maxRows])

  // Handle form submit
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()

      if (disabled || isLoading) return
      if (
        currentValue.trim() ||
        attachedFiles.length > 0 ||
        canSubmitOverride
      ) {
        onSubmit?.(currentValue, attachedFiles)

        if (value === undefined) {
          setInputValue('')
        }
      }
    },
    [
      currentValue,
      attachedFiles,
      onSubmit,
      value,
      isLoading,
      canSubmitOverride,
      disabled,
    ],
  )

  // Handle tools button click
  const handleToolsClick = useCallback(() => {
    if (isLoading) return

    setIsToolsDropdownOpen(!isToolsDropdownOpen)
    setIsCommandDropdownDismissed(false)
    setSelectedToolIndex(0)
    setIsContextMenuOpen(false)
    // 工具按钮会取得焦点；立即归还给 textarea，保证上下键和 Enter 走同一套处理。
    textareaRef.current?.focus()
  }, [isToolsDropdownOpen, isLoading])

  // Handle tool selection
  const handleToolSelect = useCallback(
    (match: SlashCommandMatch) => {
      onToolSelect?.(match.tool)
      setIsToolsDropdownOpen(false)
      setSelectedToolIndex(0)
      // 必须在用户手势（tap/click）内同步聚焦，移动端（iOS Safari）才会唤起键盘、触发输入；
      // 放进 requestAnimationFrame 会脱离手势链，导致移动端点击工具后无法激活输入框。
      textareaRef.current?.focus()

      // 待新内容渲染完成后再把光标移到末尾（此步可异步，不影响键盘唤起）
      requestAnimationFrame(() => {
        const el = textareaRef.current

        if (el) {
          const len = el.value.length

          el.setSelectionRange(len, len)
        }
      })
    },
    [onToolSelect],
  )

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element

      if (
        !composerRef.current?.contains(target) &&
        !target.closest('.slash-command-dropdown')
      ) {
        setIsToolsDropdownOpen(false)
        setIsCommandDropdownDismissed(true)
        setIsContextMenuOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside)

    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Focus input on mount if autoFocus is true
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  // Convert tools to matches for dropdown
  const toolMatches: SlashCommandMatch[] = tools.map((tool) => ({
    tool,
    score: 1,
  }))

  // Get unique categories
  const categories = ['all', ...new Set(tools.map((t) => t.category))]

  // Slash trigger: typing "/" at the start opens the tools dropdown and filters by query
  const commandTrigger =
    currentValue.startsWith('/') || currentValue.startsWith('$')

  const isSkillSearch = currentValue.startsWith('$')
  const slashActive = tools.length > 0 && commandTrigger
  const slashQuery = slashActive ? currentValue.slice(1).toLowerCase() : ''

  const slashMatches: SlashCommandMatch[] = slashActive
    ? toolMatches.filter(
        (m) =>
          (!isSkillSearch || Boolean(m.tool.skillId)) &&
          (!slashQuery ||
            m.tool.name.toLowerCase().includes(slashQuery) ||
            (m.tool.displayName ?? '').toLowerCase().includes(slashQuery) ||
            m.tool.aliases?.some((alias) =>
              alias.toLowerCase().includes(slashQuery),
            ) ||
            (m.tool.description ?? '').toLowerCase().includes(slashQuery)),
      )
    : []

  // Dropdown is visible either via the tools button or via slash typing
  const dropdownOpen =
    (showToolsButton && isToolsDropdownOpen) ||
    (slashActive && !isCommandDropdownDismissed)

  const dropdownMatches = slashActive ? slashMatches : toolMatches

  const keyboardMatches = useMemo(() => {
    const items =
      selectedCategory === 'all'
        ? dropdownMatches
        : dropdownMatches.filter(
            (match) => match.tool.category === selectedCategory,
          )

    return items
  }, [dropdownMatches, selectedCategory])

  const canSubmit = Boolean(
    currentValue.trim() || attachedFiles.length > 0 || canSubmitOverride,
  )

  // 处理下拉菜单键盘操作。组合输入期间不劫持 Enter，避免打断中文 IME。
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return

      if (dropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()

        if (keyboardMatches.length > 0) {
          setSelectedToolIndex((current) => {
            const direction = e.key === 'ArrowDown' ? 1 : -1

            return (
              (current + direction + keyboardMatches.length) %
              keyboardMatches.length
            )
          })
        }

        return
      }
      if (
        dropdownOpen &&
        e.key === 'Enter' &&
        !e.shiftKey &&
        keyboardMatches[selectedToolIndex]
      ) {
        e.preventDefault()
        handleToolSelect(keyboardMatches[selectedToolIndex])

        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !disabled && !isLoading) {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        setIsToolsDropdownOpen(false)

        if (slashActive) setIsCommandDropdownDismissed(true)

        setIsContextMenuOpen(false)
      }
    },
    [
      disabled,
      dropdownOpen,
      handleSubmit,
      handleToolSelect,
      isLoading,
      keyboardMatches,
      selectedToolIndex,
      slashActive,
    ],
  )

  return (
    <div data-composer className={cn('relative w-full', className)}>
      {/* Main Composer Container - light mode friendly */}
      <div
        ref={composerRef}
        className={cn(
          'relative rounded-3xl px-1 pt-1 pb-2',
          // Light mode: light gray background, Dark mode: zinc-800
          'bg-muted/60 border border-border transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 motion-reduce:transition-none',
        )}
      >
        {/* Slash Command Dropdown - positioned above composer.
				    Opens via the tools button or by typing "/" at the start of the input. */}
        <AnimatePresence>
          {tools.length > 0 && dropdownOpen && dropdownMatches.length > 0 && (
            <PresenceDiv
              className='absolute bottom-full left-0 right-0 mb-2 z-50'
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : 8,
                transition: {
                  duration: shouldReduceMotion ? 0 : DURATION.fast,
                  ease: EASE.in,
                  delay: 0,
                },
              }}
              transition={{
                duration: shouldReduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
              }}
            >
              <SlashCommandDropdown
                matches={dropdownMatches}
                selectedIndex={selectedToolIndex}
                onSelect={handleToolSelect}
                onClose={() => {
                  textareaRef.current?.focus({ preventScroll: true })
                  setIsToolsDropdownOpen(false)
                  setIsCommandDropdownDismissed(true)
                }}
                position={{ left: 0, width: undefined }}
                isVisible={true}
                openedViaButton={!slashActive}
                selectedCategory={selectedCategory}
                categories={categories}
                onCategoryChange={(category) => {
                  setSelectedCategory(category)
                  setSelectedToolIndex(0)
                }}
                className='relative w-full'
                style={{ position: 'relative' }}
              />
            </PresenceDiv>
          )}
        </AnimatePresence>
        {/* Attached Files Preview - using FilePreview component */}
        <FilePreview
          files={attachedFiles}
          onRemove={onRemoveFile}
          className='rounded-xl'
        />
        {composerHeader}

        {/* Textarea Input */}
        <form onSubmit={handleSubmit}>
          <div className='relative px-3'>
            <Textarea
              ref={textareaRef}
              aria-label='消息内容'
              value={currentValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              rows={1}
              className={cn(
                'field-sizing-fixed w-full min-h-0 resize-none rounded-none border-0 bg-transparent px-0 py-3 pr-12 text-base font-normal shadow-none focus-visible:ring-0 dark:bg-transparent md:text-base',
                // Light mode text colors
                'text-foreground',
                'placeholder:text-muted-foreground',
                'focus:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
              )}
              style={{
                minHeight: '24px',
                maxHeight: `min(${24 * maxRows}px, 28dvh)`,
              }}
            />
            {/* Hint for slash commands */}
            <div className='absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground pointer-events-none'>
              <kbd className='rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'>
                /
              </kbd>
              <span>工具</span>
            </div>
          </div>
        </form>

        {/* Toolbar */}
        <div className='flex flex-wrap items-center justify-between gap-2 px-2 pt-1'>
          <div className='flex items-center gap-1.5'>
            {Boolean(contextOptions?.length) && (
              <Popover
                open={isContextMenuOpen}
                onOpenChange={(open) => {
                  setIsContextMenuOpen(open)

                  if (open) {
                    contextSelectionRef.current = false
                    setIsToolsDropdownOpen(false)
                    setIsCommandDropdownDismissed(true)
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    disabled={disabled || isLoading}
                    onClick={contextOptions?.length ? undefined : onAttachClick}
                    className={cn(
                      'size-9 rounded-full bg-muted text-muted-foreground hover:bg-accent',
                      isContextMenuOpen && 'bg-accent',
                    )}
                    aria-label={
                      contextOptions?.length ? '引用简历或职位' : '添加附件'
                    }
                  >
                    <HugeiconsIcon icon={PlusSignIcon} size={23} />
                  </Button>
                </PopoverTrigger>
                {Boolean(contextOptions?.length) && (
                  <PopoverContent
                    side='top'
                    align='start'
                    sideOffset={8}
                    className='max-h-72 w-[min(20rem,calc(100vw-2rem))] gap-0 overflow-y-auto rounded-xl p-1'
                    onCloseAutoFocus={(event) => {
                      if (contextSelectionRef.current) {
                        event.preventDefault()
                        contextSelectionRef.current = false
                        textareaRef.current?.focus({ preventScroll: true })
                      }
                    }}
                  >
                    <p className='px-3 py-2 text-xs text-muted-foreground'>
                      选择本轮要参考的内容
                    </p>
                    {contextOptions?.map((option) => (
                      <Button
                        key={option.id}
                        type='button'
                        variant='ghost'
                        onClick={() => {
                          contextSelectionRef.current = true
                          textareaRef.current?.focus({ preventScroll: true })
                          option.onClick?.()
                          setIsContextMenuOpen(false)
                        }}
                        className='h-auto w-full items-start justify-start gap-2 rounded-lg px-3 py-2 text-left font-normal whitespace-normal'
                      >
                        {option.icon && (
                          <span className='mt-0.5 shrink-0 text-primary'>
                            {option.icon}
                          </span>
                        )}
                        <span className='flex min-w-0 flex-col'>
                          <span className='break-words leading-snug'>
                            {option.label}
                          </span>
                          {option.description && (
                            <span className='text-xs text-muted-foreground'>
                              {option.description}
                            </span>
                          )}
                        </span>
                      </Button>
                    ))}
                  </PopoverContent>
                )}
              </Popover>
            )}

            {!contextOptions?.length && onAttachClick && (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                disabled={disabled || isLoading}
                onClick={onAttachClick}
                aria-label='添加附件'
                className='size-9 rounded-full bg-muted text-muted-foreground hover:bg-accent'
              >
                <HugeiconsIcon icon={PlusSignIcon} size={23} />
              </Button>
            )}

            {/* Tools Button */}
            {showToolsButton && (
              <Button
                type='button'
                onClick={handleToolsClick}
                disabled={disabled || isLoading}
                className={cn(
                  'group relative flex h-9 w-9 items-center justify-center rounded-full cursor-pointer',
                  // Light mode colors
                  'bg-muted text-muted-foreground transition-colors motion-reduce:transition-none',
                  'hover:bg-accent',
                  'disabled:cursor-wait disabled:opacity-70',
                  // Active state
                  isToolsDropdownOpen &&
                    'bg-primary/15 text-primary hover:bg-primary/20',
                )}
                variant='ghost'
                size='icon'
                aria-expanded={dropdownOpen}
                aria-label='浏览全部工具'
              >
                <HugeiconsIcon icon={ToolsIcon} size={23} />
                <span
                  className={cn(
                    'absolute top-0 right-0 size-2 rounded-full bg-primary transition-opacity motion-reduce:transition-none',
                    isToolsDropdownOpen ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden='true'
                />
              </Button>
            )}

            {leadingActions}
          </div>

          {/* Right actions: extra trailing actions + send button */}
          <div className='ml-auto flex min-w-0 items-center gap-1 sm:gap-2'>
            {trailingActions}
            {/* Send Button */}
            <Button
              type='button'
              onClick={() => handleSubmit()}
              disabled={disabled || isLoading || !canSubmit}
              className={cn(
                'flex h-9 w-9 min-w-9 max-w-9 items-center justify-center rounded-full transition-colors motion-reduce:transition-none cursor-pointer',
                'disabled:cursor-not-allowed',
                // Enabled state - primary color background
                canSubmit &&
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                // Disabled state - visible gray background that contrasts with composer
                !canSubmit && 'bg-muted text-muted-foreground',
              )}
              size='icon'
              aria-label='发送消息'
            >
              <HugeiconsIcon icon={ArrowUp02Icon} size={20} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Composer
