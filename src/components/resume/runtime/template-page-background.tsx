import type { TemplateDefinition } from '@/lib/resume-template/declarative/types'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useId } from 'react'
import {
  resolveTemplatePage,
  TEMPLATE_PAGE_HEIGHT,
  TEMPLATE_PAGE_WIDTH,
} from '@/lib/resume-template/declarative/page'
import {
  createTemplateStyleEnvironment,
  resolveColor,
} from '@/lib/resume-template/declarative/styles'
import { ShapeView } from './template-shapes'

/** 整页坐标绘制；regionId 可限定只绘制该区域的底色。 */
export function TemplatePageBackground({
  definition,
  appearance,
  regionId,
  pageIndex = 0,
}: {
  definition: TemplateDefinition
  appearance: ResumeAppearanceConfig
  regionId?: string
  pageIndex?: number
}) {
  const patternId = useId()
  const page = resolveTemplatePage(definition, appearance)
  const environment = createTemplateStyleEnvironment(definition, appearance)
  const pattern = definition.page.pattern
  return (
    <div
      aria-hidden='true'
      data-resume-decoration
      data-template-page-background
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox={`0 0 ${TEMPLATE_PAGE_WIDTH} ${TEMPLATE_PAGE_HEIGHT}`}
        preserveAspectRatio='none'
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      >
        {!regionId && page.background && (
          <rect width='100%' height='100%' fill={page.background} />
        )}
        {page.regions
          .filter((region) => !regionId || region.id === regionId)
          .map(
            (region) =>
              region.background && (
                <rect
                  key={region.id}
                  x={region.outerLeft}
                  y={region.outerTop}
                  width={region.outerWidth}
                  height={region.outerHeight}
                  fill={region.background}
                />
              ),
          )}
        {!regionId && pattern && (
          <>
            <defs>
              <pattern
                id={patternId}
                width={pattern.spacing}
                height={pattern.spacing}
                patternUnits='userSpaceOnUse'
              >
                <circle
                  cx={pattern.spacing / 2}
                  cy={pattern.spacing / 2}
                  r={pattern.radius}
                  fill={resolveColor(pattern.color, environment)}
                  opacity={pattern.opacity}
                />
              </pattern>
            </defs>
            <rect width='100%' height='100%' fill={`url(#${patternId})`} />
          </>
        )}
      </svg>
      {!regionId &&
        definition.page.decoration &&
        (!definition.page.decorationFirstPageOnly || pageIndex === 0) && (
          <ShapeView
            shapes={definition.page.decoration}
            viewBox={[0, 0, 794, 1123]}
            environment={environment}
            style={{ position: 'absolute', inset: 0 }}
          />
        )}
    </div>
  )
}
