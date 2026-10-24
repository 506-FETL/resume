import type { CSSProperties } from 'react'
import type { TemplateStyleEnvironment } from '@/lib/resume-template/declarative/styles'
import type { TemplateShape } from '@/lib/resume-template/declarative/types'
import { resolveColor } from '@/lib/resume-template/declarative/styles'

export function ShapeView({
  shapes,
  viewBox,
  environment,
  style,
}: {
  shapes: TemplateShape[]
  viewBox: [number, number, number, number]
  environment: TemplateStyleEnvironment
  style?: CSSProperties
}) {
  return (
    <svg
      aria-hidden='true'
      data-resume-decoration
      viewBox={viewBox.join(' ')}
      preserveAspectRatio='none'
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {shapes.map((shape, index) => {
        const paint = {
          fill: shape.fill ? resolveColor(shape.fill, environment) : 'none',
          stroke: shape.stroke
            ? resolveColor(shape.stroke, environment)
            : undefined,
          strokeWidth: shape.strokeWidth,
          opacity: shape.opacity,
          vectorEffect: 'non-scaling-stroke' as const,
        }

        if (shape.kind === 'path')
          return <path key={index} d={shape.d} {...paint} />
        if (shape.kind === 'circle')
          return (
            <circle
              key={index}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.radius}
              {...paint}
            />
          )

        return (
          <rect
            key={index}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={shape.radius}
            {...paint}
          />
        )
      })}
    </svg>
  )
}

/** SVG 是打印正文图形；绝对定位确保开关背景图形不改变正文几何。 */
export function TemplatePaint({ style }: { style: CSSProperties }) {
  if (!style.backgroundColor) return null

  return (
    <svg
      aria-hidden='true'
      data-resume-decoration
      data-template-paint
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
        borderTopLeftRadius: style.borderTopLeftRadius ?? style.borderRadius,
        borderTopRightRadius: style.borderTopRightRadius ?? style.borderRadius,
        borderBottomLeftRadius:
          style.borderBottomLeftRadius ?? style.borderRadius,
        borderBottomRightRadius:
          style.borderBottomRightRadius ?? style.borderRadius,
        overflow: 'hidden',
      }}
    >
      <rect width='100%' height='100%' fill={String(style.backgroundColor)} />
    </svg>
  )
}
