'use client'

import type { Dispatch, SetStateAction, RefObject } from 'react'

export interface Props {
  defaultId: string
  className?: string
  gapPx?: number // tabs 区域与内容区间距（主轴方向）
  offsetX?: number // 线条从按钮偏移量，避免压住按钮圆角
  padding?: number // 内容区内边距（影响线条落点）
  minHeight?: number // 内容区最小高度
  strokeWidth?: number // 轮廓线粗细
  orientation?: 'horizontal' | 'vertical' // 布局方向：horizontal 左右，vertical 上下
  stroke?: string
  fill?: string
  radius?: number
  controlDown?: number
  /** 使用父容器的可用高度，内容区内部滚动，不再由内容撑高整个组件 */
  fillAvailableHeight?: boolean
}

interface BoxState {
  x: number
  y: number
  w: number
  h: number
  totalHeight: number
}

export interface SideTabsState {
  active: string
  box: BoxState
  outlineD: string
}

export type SideTabsAction =
  | { type: 'set-active'; value: string | ((prev: string) => string) }
  | { type: 'set-box'; value: BoxState }
  | { type: 'set-outline'; value: string }

export interface SideTabsContextValue {
  active: string
  setActive: Dispatch<SetStateAction<string>>
  box: BoxState
  padding: number
  outlineD: string
  containerRef: RefObject<HTMLDivElement | null>
  tabsRef: RefObject<HTMLDivElement | null>
  btnRefs: RefObject<Record<string, HTMLButtonElement | null>>
  contentRef: RefObject<HTMLDivElement | null>
  computeBox: () => void
  computeOutline: () => void
  recomputeGeometry: () => void
}
