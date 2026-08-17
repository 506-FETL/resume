import type { Transition, Variants } from 'motion/react'

/**
 * 全局动效预设：收敛本仓库既有的动效风格，供新功能复用，保持一致的缓动与时长。
 *
 * 使用约定：
 * - 所有动效都应配合 `useReducedMotion()` 降级（duration 归零或去掉位移/缩放）。
 * - 进入 = 淡入 + 轻微上移/缩放；退出更短、曲线更急。
 * - 折叠/展开、tab 切换、列表入场等交互都应带过渡，不要瞬间出现。
 */

// —— 缓动曲线 ——
export const EASE = {
  /** 招牌进入曲线（easeOutExpo 类），用于大多数进入动画 */
  out: [0.22, 1, 0.36, 1] as const,
  /** 更快的进入，用于弹窗内容等 */
  outSoft: [0.16, 1, 0.3, 1] as const,
  /** 退出曲线，比进入更急 */
  in: [0.4, 0, 1, 1] as const,
} as const

// —— 时长档位（秒）——
export const DURATION = {
  /** 微交互 / 退出 */
  fast: 0.14,
  /** 标准项 / 内容（主力档） */
  base: 0.2,
  /** 稍大过渡 */
  slow: 0.28,
} as const

// —— spring 预设 ——
export const SPRING = {
  /** 布局排序（reorder / board / 卡片位移） */
  layout: { type: 'spring', stiffness: 500, damping: 40 } as const,
  /** 弹性入场 */
  bounce: { type: 'spring', stiffness: 300, damping: 24 } as const,
} as const

// —— 常用 transition ——
export const TRANSITION = {
  enter: { duration: DURATION.base, ease: EASE.out } satisfies Transition,
  exit: { duration: DURATION.fast, ease: EASE.in } satisfies Transition,
} as const

// —— 常用 variants ——
/** 淡入 + 轻微上移 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: TRANSITION.enter },
  exit: { opacity: 0, y: 8, transition: TRANSITION.exit },
}

/** 淡入 + 轻微缩放 */
export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: TRANSITION.enter },
  exit: { opacity: 0, scale: 0.96, transition: TRANSITION.exit },
}

/**
 * 列表项错峰入场的 delay 计算：`delay: staggerDelay(index)`。
 * 与项目现有 `index * 0.02~0.04` 惯例一致。
 */
export function staggerDelay(index: number, step = 0.03): number {
  return index * step
}
