import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

gsap.registerPlugin(MotionPathPlugin)

// pathLength=1 的进度必须写到 SVG 属性。CSS 像素插值会将小数取整。
export const drawStroke = (duration: number) => ({
  attr: { 'stroke-dashoffset': 0 },
  ease: 'none',
  duration,
})

export function traceWithPencil(
  timeline: gsap.core.Timeline,
  pencil: gsap.TweenTarget,
  path: SVGPathElement,
  start: number,
  duration: number,
) {
  timeline
    .to(path, drawStroke(duration), start)
    .to(
      pencil,
      { motionPath: { path, resolution: 32 }, duration, ease: 'none' },
      start,
    )
}
