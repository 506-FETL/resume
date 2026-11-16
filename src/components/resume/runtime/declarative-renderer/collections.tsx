import type {
  TemplateNode,
  RenderScope,
} from '@/lib/resume-template/declarative/types'
import {
  conditionMatches,
  resolveText,
  resolveList,
  itemIdentity,
} from '@/lib/resume-template/declarative/bindings'
import type {
  TemplateRenderContext,
  NodePresentation,
  RenderNodes,
} from './types'
import type { ReactNode } from 'react'
import { resolveLayoutStyle } from '@/lib/resume-template/declarative/styles'
import { ShapeView } from '../template-shapes'

function hasItemLabel(nodes: TemplateNode[], scope: RenderScope): boolean {
  return nodes.some(
    (node) =>
      conditionMatches(node.when, scope) &&
      ((node.type === 'text' &&
        node.binding === 'item.label' &&
        Boolean(resolveText(node, scope).trim())) ||
        (node.type === 'box' && hasItemLabel(node.children, scope))),
  )
}

export function renderCollectionsNode(
  node: Extract<
    TemplateNode,
    { type: 'box' | 'repeat' | 'sections' | 'blocks' }
  >,
  scope: RenderScope,
  context: TemplateRenderContext,
  presentation: NodePresentation,
  renderNodes: RenderNodes,
): ReactNode {
  const { definition, environment, additionalProfileFields, chargeNodes } =
    context

  const { style, common, paint } = presentation

  switch (node.type) {
    case 'box': {
      const children = renderNodes(node.children, scope)

      if (!node.decoration?.length && children.every((child) => child === null))
        return null
      if (node.decoration?.length) chargeNodes(1 + node.decoration.length)

      return (
        <div
          key={node.id}
          {...common}
          style={{
            minWidth: 0,
            position: 'relative',
            isolation: 'isolate',
            ...resolveLayoutStyle(node.layout),
            ...style,
          }}
        >
          {paint}
          {node.decoration && node.viewBox && (
            <ShapeView
              shapes={node.decoration}
              viewBox={node.viewBox}
              environment={environment}
              style={{ position: 'absolute', inset: 0 }}
            />
          )}
          {children}
        </div>
      )
    }

    case 'repeat': {
      const items = [
        ...resolveList(node.source, scope, node.fieldOrder, node.fieldKeys),
        ...(additionalProfileFields.get(`${scope.region?.id}/${node.id}`) ??
          []),
      ]

      if (!items.length) return null

      const renderedItems = items
        .map((item, itemIndex) => {
          const itemScope = {
            ...scope,
            item,
            itemIndex,
            itemCount: items.length,
          }

          return {
            identity: itemIdentity(item),
            children: renderNodes(node.children, {
              ...itemScope,
              itemLabelVisible: hasItemLabel(node.children, itemScope),
            }),
          }
        })
        .filter((item) => item.children.some((child) => child !== null))

      if (!renderedItems.length) return null

      chargeNodes(renderedItems.length)

      if (node.separator) chargeNodes(Math.max(0, renderedItems.length - 1))

      return (
        <div
          key={node.id}
          {...common}
          style={{
            position: 'relative',
            isolation: 'isolate',
            minWidth: 0,
            ...resolveLayoutStyle(node.layout),
            ...style,
          }}
        >
          {paint}
          {renderedItems.map((item, index) => (
            <div
              key={item.identity}
              data-template-entry={item.identity}
              style={{
                minWidth: 0,
                display:
                  node.layout === 'row' || node.layout === 'wrap'
                    ? 'flex'
                    : undefined,
                alignItems: 'baseline',
                columnGap: style.columnGap ?? style.gap,
              }}
            >
              {index > 0 && node.separator && (
                <span aria-hidden='true' data-resume-decoration>
                  {node.separator}
                </span>
              )}
              {item.children}
            </div>
          ))}
        </div>
      )
    }

    case 'sections':
      if (!(scope.sections ?? []).length) return null

      chargeNodes((scope.sections ?? []).length)

      return (
        <div
          key={node.id}
          {...common}
          style={{
            position: 'relative',
            isolation: 'isolate',
            display: 'flex',
            flexDirection: 'column',
            gap: `${environment.numbers.sectionSpacing}px`,
            ...style,
          }}
        >
          {paint}
          {(scope.sections ?? []).map((section, sectionIndex) => (
            <section
              key={section.key}
              id={`resume-section-${section.key}`}
              data-section={section.key}
              style={{ minWidth: 0 }}
            >
              {renderNodes(scope.region?.section ?? definition.section, {
                ...scope,
                section,
                sectionIndex,
              })}
            </section>
          ))}
        </div>
      )
    case 'blocks':
      if (!scope.section?.blocks.length) return null

      chargeNodes(scope.section?.blocks.length ?? 0)

      return (
        <div
          key={node.id}
          {...common}
          style={{
            position: 'relative',
            isolation: 'isolate',
            display: 'flex',
            flexDirection: 'column',
            gap: `${environment.numbers.entrySpacing}px`,
            ...style,
          }}
        >
          {paint}
          {scope.section?.blocks.map((block, index) => (
            <div key={`${block.kind}-${index}`} data-content-kind={block.kind}>
              {renderNodes(
                scope.region?.contentByKind?.[block.kind] ??
                  definition.contentByKind[block.kind],
                { ...scope, block },
              )}
            </div>
          ))}
        </div>
      )
  }
}
