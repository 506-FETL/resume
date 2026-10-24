import type { Editor } from '@tiptap/react'
import * as React from 'react'

type Orientation = 'horizontal' | 'vertical' | 'both'

interface MenuNavigationOptions<T> {
  /**
   * Tiptap 编辑器实例；用于在编辑器场景下监听键盘事件。
   */
  editor?: Editor | null
  /**
   * 菜单容器元素的 ref；非编辑器场景下会绑定键盘事件到该元素。
   */
  containerRef?: React.RefObject<HTMLElement | null>
  /**
   * 当前搜索词；变化时可用于重置默认选中项。
   */
  query?: string
  /**
   * 参与导航的候选项数组。
   */
  items: T[]
  /**
   * 用户确认选择某一项时触发的回调。
   */
  onSelect?: (item: T) => void
  /**
   * 用户请求关闭菜单时触发的回调。
   */
  onClose?: () => void
  /**
   * 菜单的导航方向。
   * 默认为 `vertical`，即主要响应上下方向键。
   *
   * @default "vertical"
   */
  orientation?: Orientation
  /**
   * 菜单打开时是否自动选中第一项。
   *
   * @default true
   */
  autoSelectFirstItem?: boolean
}

/**
 * 为菜单、下拉面板和命令面板提供统一的键盘导航能力。
 *
 * Hook 会监听目标容器上的键盘事件，处理以下常见交互：
 * - 方向键或 `Tab` 在列表项之间切换焦点索引
 * - `Home` / `End` 快速跳到首尾
 * - `Enter` 触发当前项选择
 * - `Escape` 请求关闭菜单
 *
 * 同时支持两种使用方式：
 * - 绑定到 Tiptap 编辑器 DOM
 * - 绑定到普通容器元素 ref
 *
 * @param options 菜单导航配置
 * @param options.editor Tiptap 编辑器实例；提供后会优先监听编辑器 DOM
 * @param options.containerRef 普通菜单容器 ref；未提供 editor 时使用
 * @param options.query 当前搜索词；变化时可触发选中项重置
 * @param options.items 可导航的数据项数组
 * @param options.onSelect 用户确认选择某一项时的回调
 * @param options.onClose 用户请求关闭菜单时的回调
 * @param options.orientation 菜单布局方向，决定响应哪些方向键
 * @param options.autoSelectFirstItem 菜单初始化或搜索词变化时是否自动选中首项
 * @returns 当前选中索引，以及供外部手动控制选中项的 setter
 */
export function useMenuNavigation<T>({
  editor,
  containerRef,
  query,
  items,
  onSelect,
  onClose,
  orientation = 'vertical',
  autoSelectFirstItem = true,
}: MenuNavigationOptions<T>) {
  const [selectedIndex, setSelectedIndex] = React.useState<number>(
    autoSelectFirstItem ? 0 : -1,
  )

  React.useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if (!items.length) return false

      const moveNext = () =>
        setSelectedIndex((currentIndex) => {
          if (currentIndex === -1) return 0
          return (currentIndex + 1) % items.length
        })

      const movePrev = () =>
        setSelectedIndex((currentIndex) => {
          if (currentIndex === -1) return items.length - 1
          return (currentIndex - 1 + items.length) % items.length
        })

      switch (event.key) {
        case 'ArrowUp': {
          if (orientation === 'horizontal') return false
          event.preventDefault()
          movePrev()
          return true
        }

        case 'ArrowDown': {
          if (orientation === 'horizontal') return false
          event.preventDefault()
          moveNext()
          return true
        }

        case 'ArrowLeft': {
          if (orientation === 'vertical') return false
          event.preventDefault()
          movePrev()
          return true
        }

        case 'ArrowRight': {
          if (orientation === 'vertical') return false
          event.preventDefault()
          moveNext()
          return true
        }

        case 'Tab': {
          event.preventDefault()
          if (event.shiftKey) {
            movePrev()
          } else {
            moveNext()
          }
          return true
        }

        case 'Home': {
          event.preventDefault()
          setSelectedIndex(0)
          return true
        }

        case 'End': {
          event.preventDefault()
          setSelectedIndex(items.length - 1)
          return true
        }

        case 'Enter': {
          if (event.isComposing) return false
          event.preventDefault()
          if (selectedIndex !== -1 && items[selectedIndex]) {
            onSelect?.(items[selectedIndex])
          }
          return true
        }

        case 'Escape': {
          event.preventDefault()
          onClose?.()
          return true
        }

        default:
          return false
      }
    }

    let targetElement: HTMLElement | null = null

    if (editor) {
      targetElement = editor.view.dom
    } else if (containerRef?.current) {
      targetElement = containerRef.current
    }

    if (targetElement) {
      targetElement.addEventListener('keydown', handleKeyboardNavigation, true)

      return () => {
        targetElement?.removeEventListener(
          'keydown',
          handleKeyboardNavigation,
          true,
        )
      }
    }

    return undefined
  }, [
    editor,
    containerRef,
    items,
    selectedIndex,
    onSelect,
    onClose,
    orientation,
  ])

  React.useEffect(() => {
    if (query) {
      setSelectedIndex(autoSelectFirstItem ? 0 : -1)
    }
  }, [query, autoSelectFirstItem])

  return {
    selectedIndex: items.length ? selectedIndex : undefined,
    setSelectedIndex,
  }
}
