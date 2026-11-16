import type { RefObject, ReactNode } from 'react'
import {
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  useEffect,
} from 'react'
import type {
  ContainerRegistration,
  DragSession,
  ActiveDrag,
  PreviewSettlement,
} from '../types'
import type { MotionValue } from 'motion/react'
import { DURATION, EASE } from '@/lib/motion'

export function useDragPreview({
  containersRef,
  sessionRef,
  overlayX,
  overlayY,
  active,
  children,
  reduceMotion,
}: {
  containersRef: RefObject<Map<string, ContainerRegistration>>
  sessionRef: RefObject<DragSession | null>
  overlayX: MotionValue<number>
  overlayY: MotionValue<number>
  active: ActiveDrag | null
  children: ReactNode
  reduceMotion: boolean
}) {
  const reduceMotionRef = useRef(reduceMotion)

  const previewElementRef = useRef<HTMLDivElement | null>(null)

  const previewAnimationRef = useRef<Animation | null>(null)

  const settlementRef = useRef<PreviewSettlement | null>(null)

  const [preview, setPreview] = useState<ActiveDrag | null>(null)

  // 偏好变化不重绑全局监听，避免清理监听时中断仍在跟手的拖拽。
  reduceMotionRef.current = reduceMotion

  const clearPreview = useCallback(() => {
    settlementRef.current = null
    previewAnimationRef.current?.cancel()
    previewAnimationRef.current = null
    setPreview(null)
  }, [])

  const settlePreview = useCallback(() => {
    const settlement = settlementRef.current
    const element = previewElementRef.current

    if (!settlement) return
    if (!element || reduceMotionRef.current) {
      clearPreview()

      return
    }

    const { session } = settlement

    const target = [...containersRef.current.values()]
      .map((container) =>
        container.element.querySelector<HTMLElement>(
          `[data-motion-drag-item="${CSS.escape(session.itemId)}"]`,
        ),
      )
      .find((item) => item !== null)

    // 保存队列尚未更新卡片时，保留松手位置，等真实布局就绪再落位。
    if (
      settlement.pendingDrop &&
      target?.dataset.motionDragContainerId === session.sourceId
    )
      return

    const targetRect = target?.getBoundingClientRect()

    const currentTransform = previewAnimationRef.current
      ? getComputedStyle(element).transform
      : `translate3d(${overlayX.get()}px, ${overlayY.get()}px, 0)`

    const targetTransform = targetRect
      ? `translate3d(${targetRect.left - session.startRect.left}px, ${targetRect.top - session.startRect.top}px, 0) scale(${targetRect.width / session.startRect.width}, ${targetRect.height / session.startRect.height})`
      : currentTransform

    if (settlement.targetTransform === targetTransform) return

    settlement.targetTransform = targetTransform
    previewAnimationRef.current?.cancel()

    const animation = element.animate(
      [
        { transform: currentTransform, opacity: 1 },
        { transform: targetTransform, opacity: targetRect ? 1 : 0 },
      ],
      {
        duration: (targetRect ? DURATION.base : DURATION.fast) * 1000,
        easing: `cubic-bezier(${EASE.out.join(',')})`,
        fill: 'forwards',
      },
    )

    previewAnimationRef.current = animation
    animation.onfinish = () => {
      // React 卸载提交前保留终点，避免取消 WAAPI 后闪回松手位置。
      element.style.transform = targetTransform
      element.style.opacity = targetRect ? '1' : '0'
      clearPreview()
    }
  }, [clearPreview, overlayX, overlayY])

  useLayoutEffect(() => {
    settlePreview()
  }, [active, children, preview, settlePreview])

  useEffect(() => {
    if (reduceMotion && !sessionRef.current?.active) clearPreview()
  }, [clearPreview, reduceMotion])

  return {
    preview,
    setPreview,
    previewElementRef,
    previewAnimationRef,
    settlementRef,
    clearPreview,
    settlePreview,
  }
}
