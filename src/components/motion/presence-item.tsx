import type { HTMLMotionProps } from 'motion/react'
import type { DOMAttributes, Ref, SyntheticEvent } from 'react'
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
