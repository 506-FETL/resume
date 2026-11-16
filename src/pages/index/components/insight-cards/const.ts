// 图表统一高度与内边距：left=0 避免 Y 轴刻度被推出容器左缘裁切
export const CHART_HEIGHT = 'h-[140px]'

export const CHART_MARGIN = { top: 4, right: 8, left: 0, bottom: 0 } as const

// 数值型 X 轴（首尾刻度贴着绘图区边缘）需要更大的右侧留白，否则最后一个刻度文案会被卡片裁掉
export const NUMERIC_AXIS_CHART_MARGIN = {
  top: 4,
  right: 28,
  left: 0,
  bottom: 0,
} as const
