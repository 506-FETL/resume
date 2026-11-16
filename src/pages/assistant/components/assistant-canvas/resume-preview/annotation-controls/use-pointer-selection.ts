import type { AnnotationSelectionOptions } from './types'
import { useEffect } from 'react'
import { resolveCanvasSelection } from '../selection'

export function usePointerSelection({
  rootRef,
  model,
  resumeId,
  pointerSelectingRef,
  keyboardFieldRef,
  setSelected,
}: AnnotationSelectionOptions) {
  useEffect(() => {
    const root = rootRef.current

    if (!root) return

    let timer: ReturnType<typeof setTimeout> | undefined
    let armed = false
    let keyboardSelecting = false

    const clear = () => {
      clearTimeout(timer)
      setSelected(null)
    }

    const update = () => {
      if (!armed || pointerSelectingRef.current || keyboardSelecting) return

      const selected = window.getSelection()

      const value = selected?.rangeCount
        ? resolveCanvasSelection(root, selected.getRangeAt(0), model)
        : null

      setSelected(
        value ? { value, documentHash: model.documentHash, resumeId } : null,
      )
    }

    const schedule = () => {
      clear()
      timer = setTimeout(update, 120)
    }

    const cancel = () => {
      armed = false
      pointerSelectingRef.current = false
      keyboardSelecting = false
      keyboardFieldRef.current = null
      clear()
    }

    const start = (event: PointerEvent) => {
      const target = event.target

      if (
        target instanceof Element &&
        target.closest('[data-annotation-bubble]')
      )
        return

      cancel()

      pointerSelectingRef.current =
        target instanceof Node && root.contains(target)
    }

    const finish = () => {
      if (!pointerSelectingRef.current) return

      pointerSelectingRef.current = false
      armed = true
      schedule()
    }

    const selectStart = (event: Event) => {
      if (!(event.target instanceof Node) || !root.contains(event.target))
        return

      armed = true
      keyboardFieldRef.current = null
      clear()

      if (!pointerSelectingRef.current && !keyboardSelecting) schedule()
    }

    const change = () => {
      if (keyboardFieldRef.current) return

      clear()

      if (armed && !pointerSelectingRef.current && !keyboardSelecting)
        schedule()
    }

    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancel()

        return
      }

      const selecting =
        (event.shiftKey &&
          [
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End',
          ].includes(event.key)) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a')

      if (
        selecting &&
        event.target instanceof Node &&
        root.contains(event.target)
      ) {
        keyboardSelecting = true
        keyboardFieldRef.current = null
        armed = true
        clear()
      }
    }

    const keyup = (event: KeyboardEvent) => {
      if (!keyboardSelecting || (event.shiftKey && event.key !== 'Shift'))
        return

      keyboardSelecting = false
      schedule()
    }

    const scroll = () => {
      // 拖选可能带动页面滚动；滚动不能提前结束这次选择。
      if (pointerSelectingRef.current || keyboardSelecting) clear()
      else cancel()
    }

    document.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', cancel)
    window.addEventListener('blur', cancel)
    document.addEventListener('pointerdown', start, true)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', cancel)
    document.addEventListener('selectstart', selectStart)
    document.addEventListener('selectionchange', change)
    document.addEventListener('keydown', keyboard)
    document.addEventListener('keyup', keyup)

    return () => {
      clearTimeout(timer)
      pointerSelectingRef.current = false
      keyboardFieldRef.current = null
      document.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', cancel)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('pointerdown', start, true)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
      document.removeEventListener('selectstart', selectStart)
      document.removeEventListener('selectionchange', change)
      document.removeEventListener('keydown', keyboard)
      document.removeEventListener('keyup', keyup)
    }
  }, [
    rootRef,
    model,
    resumeId,
    pointerSelectingRef,
    keyboardFieldRef,
    setSelected,
  ])
}
