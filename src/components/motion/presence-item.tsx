import type { HTMLMotionProps } from 'motion/react'
import type { DOMAttributes, Ref, SyntheticEvent } from 'react'
import { useLayoutEffect, useRef } from 'react'
import { motion, useIsPresent } from 'motion/react'

type GuardedEvents<Element extends HTMLElement> = Pick<
  DOMAttributes<Element>,
  | 'onClickCapture'
  | 'onPointerDownCapture'
  | 'onKeyDownCapture'
  | 'onChangeCapture'
  | 'onSubmitCapture'
>

function usePresenceGuard<Element extends HTMLElement>(
  props: GuardedEvents<Element>,
) {
  const isPresent = useIsPresent()

  const guard =
    <Event extends SyntheticEvent<Element>>(handler?: (event: Event) => void) =>
    (event: Event) => {
      if (!isPresent) {
        event.preventDefault()
        event.stopPropagation()

        return
      }

      handler?.(event)
    }

  // 捕获阶段也覆盖 React portal 内的按钮，避免退出期间再次提交旧行的操作。
  return {
    inert: !isPresent,
    'aria-hidden': !isPresent || undefined,
    onClickCapture: guard(props.onClickCapture),
    onPointerDownCapture: guard(props.onPointerDownCapture),
    onKeyDownCapture: guard(props.onKeyDownCapture),
    onChangeCapture: guard(props.onChangeCapture),
    onSubmitCapture: guard(props.onSubmitCapture),
  }
}

export function PresenceDiv(
  props: HTMLMotionProps<'div'> & { ref?: Ref<HTMLDivElement> },
) {
  const guard = usePresenceGuard(props)

  return <motion.div {...props} {...guard} />
}

export function PresenceListItem(
  props: HTMLMotionProps<'li'> & { ref?: Ref<HTMLLIElement> },
) {
  const guard = usePresenceGuard(props)

  return <motion.li {...props} {...guard} />
}

export function PresenceTableRow(
  props: HTMLMotionProps<'tr'> & { ref?: Ref<HTMLTableRowElement> },
) {
  const guard = usePresenceGuard(props)

  return <motion.tr {...props} {...guard} />
}

/** 路由退出前将焦点交给稳定容器，再隔离旧页面和它的 Portal。 */
export function PresencePage(props: HTMLMotionProps<'div'>) {
  const ref = useRef<HTMLDivElement | null>(null)

  const {
    inert,
    'aria-hidden': ariaHidden,
    ...events
  } = usePresenceGuard(props)

  useLayoutEffect(() => {
    const page = ref.current

    if (!page) return

    if (inert && page.contains(document.activeElement)) {
      page.parentElement?.focus({ preventScroll: true })
    }

    page.inert = inert

    if (ariaHidden) page.setAttribute('aria-hidden', 'true')
    else page.removeAttribute('aria-hidden')
  }, [ariaHidden, inert])

  return <motion.div {...props} {...events} ref={ref} />
}
