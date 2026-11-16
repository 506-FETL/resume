import type {
  TemplateNode,
  RenderScope,
} from '@/lib/resume-template/declarative/types'
import type { TemplateRenderContext, NodePresentation } from './types'
import type { ReactNode } from 'react'
import {
  resolveText,
  resolveField,
  resolveRichText,
} from '@/lib/resume-template/declarative/bindings'
import { CommentableText } from '@/components/resume/fields/commentable-text'
import { CommentableRichText } from '@/components/resume/fields/commentable-rich-text'
import { resolveTemplateStyle } from '@/lib/resume-template/declarative/styles'

export function renderTextNode(
  node: Extract<TemplateNode, { type: 'text' | 'field' | 'richText' }>,
  scope: RenderScope,
  context: TemplateRenderContext,
  presentation: NodePresentation,
): ReactNode {
  const { definition, environment, chargeNodes, claimProjection } = context
  const { style, common, paint } = presentation

  switch (node.type) {
    case 'text': {
      const text = resolveText(node, scope)

      if (!text) return null

      return (
        <span
          key={node.id}
          {...common}
          style={{
            position: 'relative',
            isolation: 'isolate',
            overflowWrap: 'anywhere',
            ...style,
          }}
        >
          {paint}
          {text}
        </span>
      )
    }

    case 'field': {
      const field = resolveField(node.binding, scope)

      if (!field?.text.trim()) return null

      claimProjection(field.nodeKey, node.projection)

      const label = field.label.trim()
      const text = field.text.trimStart()

      const hasLabelPrefix =
        label &&
        text.startsWith(label) &&
        /^[：:]/u.test(text.slice(label.length).trimStart())

      const showLabel =
        (node.showLabel || (field.labelRequired && !scope.itemLabelVisible)) &&
        Boolean(label) &&
        !hasLabelPrefix

      chargeNodes(1 + (showLabel ? 1 : 0))

      return (
        <span
          key={node.id}
          {...common}
          style={{
            position: 'relative',
            isolation: 'isolate',
            minWidth: 0,
            overflowWrap: 'anywhere',
            ...style,
          }}
        >
          {paint}
          {showLabel && <span>{field.label}：</span>}
          <CommentableText
            nodeKey={field.nodeKey}
            fieldLabel={field.label}
            projection={node.projection}
          >
            {field.text}
          </CommentableText>
          {node.suffix}
        </span>
      )
    }

    case 'richText': {
      const richText = resolveRichText(node.binding, scope)

      if (!richText?.field.text.trim()) return null

      claimProjection(richText.field.nodeKey, node.projection)
      // 富文本沿用净化与投影链路；预算按原始标签计数可安全高估，不静默截断正文。
      chargeNodes(1 + (richText.html.match(/<[a-z][^>]*>/gi)?.length ?? 0))

      return (
        <div
          key={node.id}
          {...common}
          style={{
            position: 'relative',
            isolation: 'isolate',
            minWidth: 0,
            ...style,
          }}
        >
          {paint}
          <CommentableRichText
            nodeKey={richText.field.nodeKey}
            fieldLabel={richText.field.label}
            html={richText.html}
            projection={node.projection}
            style={{
              fontSize: 'inherit',
              lineHeight: 'inherit',
              color: 'inherit',
            }}
            elementStyles={
              node.elementStyles
                ? Object.fromEntries(
                    Object.entries(node.elementStyles).map(([tag, styleId]) => [
                      tag,
                      resolveTemplateStyle(
                        definition.styles[styleId],
                        environment,
                      ),
                    ]),
                  )
                : undefined
            }
          />
        </div>
      )
    }
  }
}
