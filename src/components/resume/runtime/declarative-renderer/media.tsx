import type {
  TemplateNode,
  RenderScope,
} from '@/lib/resume-template/declarative/types'
import type { TemplateRenderContext, NodePresentation } from './types'
import type { ReactNode } from 'react'
import { resolveBinding } from '@/lib/resume-template/declarative/bindings'
import { ShapeView } from '../template-shapes'
import { resolveColor } from '@/lib/resume-template/declarative/styles'
import { TemplateResolutionError } from '@/lib/resume-template/definition-schema'

export function renderMediaNode(
  node: Extract<TemplateNode, { type: 'shape' | 'meter' | 'photo' | 'image' }>,
  scope: RenderScope,
  context: TemplateRenderContext,
  presentation: NodePresentation,
): ReactNode {
  const { definition, environment, assetUrls, chargeNodes } = context
  const { style, common, paint } = presentation

  switch (node.type) {
    case 'shape': {
      const variant = node.binding
        ? String(resolveBinding(node.binding, scope) ?? '')
        : ''

      const shapes =
        node.variants && Object.hasOwn(node.variants, variant)
          ? node.variants[variant]
          : node.shapes

      if (!shapes.length) return null

      chargeNodes(1 + shapes.length)

      return (
        <div
          key={node.id}
          {...common}
          data-resume-decoration
          aria-hidden='true'
          style={{
            position: 'relative',
            isolation: 'isolate',
            minWidth: 0,
            ...style,
          }}
        >
          {paint}
          <ShapeView
            shapes={shapes}
            viewBox={node.viewBox}
            environment={environment}
          />
        </div>
      )
    }

    case 'meter': {
      chargeNodes(3)

      const value = Number(resolveBinding(node.binding, scope))

      return (
        <div
          key={node.id}
          {...common}
          data-resume-decoration
          aria-hidden='true'
          style={{ position: 'relative', flexGrow: 1, height: 6, ...style }}
        >
          <svg
            width='100%'
            height='100%'
            style={{
              display: 'block',
              borderRadius: style.borderRadius,
              overflow: 'hidden',
            }}
          >
            <rect
              width='100%'
              height='100%'
              fill={resolveColor(node.track, environment)}
            />
            <rect
              width={`${Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0}%`}
              height='100%'
              fill={resolveColor(node.fill, environment)}
            />
          </svg>
        </div>
      )
    }

    case 'photo': {
      const photo = scope.profile?.photo

      if (!photo) return null

      return (
        <img
          key={node.id}
          {...common}
          data-resume-photo
          src={photo.dataUrl}
          alt={node.alt ?? '个人照片'}
          width={photo.width}
          height={photo.height}
          style={{
            display: 'block',
            maxWidth: '100%',
            objectFit: 'cover',
            flexShrink: 0,
            ...style,
          }}
        />
      )
    }

    case 'image': {
      const asset = definition.assets.find((asset) => asset.id === node.asset)!

      const url = assetUrls?.get(asset.id)

      if (!url) {
        if (asset.required)
          throw new TemplateResolutionError(
            'LOAD_FAILED',
            '模板必需素材尚未就绪',
          )

        return null
      }
      if (!url.startsWith('blob:'))
        throw new TemplateResolutionError(
          'INVALID_DEFINITION',
          '模板素材必须由校验后的本地资源呈现',
        )

      return (
        <img
          key={node.id}
          {...common}
          data-resume-decoration
          src={url}
          alt={node.alt}
          width={asset.width}
          height={asset.height}
          style={{ display: 'block', maxWidth: '100%', ...style }}
        />
      )
    }
  }
}
