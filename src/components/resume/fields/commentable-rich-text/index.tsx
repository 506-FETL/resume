import type { CSSProperties } from 'react'
import type { RichTextStyleElement } from '@/lib/resume-template/declarative/types'
import { Element } from 'html-react-parser'
import { cloneElement, isValidElement, useMemo } from 'react'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'
import {
  normalizeCommentRichTextBlock,
  projectCommentRichTextBlocks,
} from '@/features/resume-comments/anchors/projection'
import { parseSanitizedHtml } from '@/lib/safe-html'
import { useCommentProjectionNode } from '../projection'

const COMMENT_RICH_TEXT_BLOCK_TAGS = new Set([
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
])

function elementHasNestedCommentBlock(element: Element): boolean {
  return element.childNodes.some((child) => {
    if (!(child instanceof Element)) {
      return false
    }

    return (
      COMMENT_RICH_TEXT_BLOCK_TAGS.has(child.name) ||
      elementHasNestedCommentBlock(child)
    )
  })
}

function domNodeText(node: Element['childNodes'][number]): string {
  if (node.type === 'text') {
    return node.data
  }
  if (!(node instanceof Element)) {
    return ''
  }
  if (node.name === 'br') {
    return '\n'
  }

  return node.childNodes.map(domNodeText).join('')
}

export function CommentableRichText({
  nodeKey,
  fieldLabel,
  html,
  style,
  elementStyles,
  projection = 'primary',
}: {
  nodeKey: string
  fieldLabel: string
  html: string
  style?: CSSProperties
  elementStyles?: Partial<Record<RichTextStyleElement, CSSProperties>>
  projection?: 'primary' | 'display'
}) {
  const node = useCommentProjectionNode(nodeKey)
  const { font, spacing, theme } = useResumeContext()

  // 渲染器每次生成样式对象，但相同样式不应使未编辑的 HTML 重复净化解析。
  const stylesKey = JSON.stringify(elementStyles ?? null)

  const parsedStyles = useMemo(
    () => JSON.parse(stylesKey) as typeof elementStyles,
    [stylesKey],
  )

  const { content, projectedBlocks, blockOrdinal } = useMemo(() => {
    const projectedBlocks = projectCommentRichTextBlocks(html)
    let blockOrdinal = 0

    const content = parseSanitizedHtml(html, undefined, {
      transform(reactNode, domNode) {
        if (typeof reactNode === 'string') return reactNode
        if (!isValidElement<{ style?: CSSProperties }>(reactNode)) return null
        if (!(domNode instanceof Element)) return reactNode

        const elementStyle =
          parsedStyles?.[domNode.name as RichTextStyleElement]

        if (elementStyle) {
          // 只补充净化后元素的样式，保留解析器生成的子节点、key 和评论锚点。
          // eslint-disable-next-line @eslint-react/no-clone-element
          return cloneElement(reactNode, {
            style: { ...elementStyle, ...reactNode.props.style },
          })
        }

        return reactNode
      },
      replace(domNode) {
        if (
          !(domNode instanceof Element) ||
          !COMMENT_RICH_TEXT_BLOCK_TAGS.has(domNode.name) ||
          elementHasNestedCommentBlock(domNode)
        ) {
          return
        }

        const blockText = normalizeCommentRichTextBlock(
          domNode.childNodes.map(domNodeText).join(''),
        )

        const projectedBlock = projectedBlocks[blockOrdinal]

        if (
          !blockText ||
          !projectedBlock ||
          blockText !== projectedBlock.text
        ) {
          return
        }

        if (projection === 'primary')
          domNode.attribs['data-comment-block-ordinal'] = String(blockOrdinal)

        blockOrdinal += 1
      },
    })

    return { content, projectedBlocks, blockOrdinal }
  }, [html, projection, parsedStyles])

  if (!node) return null

  const canUseParsedContent = blockOrdinal === projectedBlocks.length

  const useContainerAsOnlyBlock =
    projectedBlocks.length === 1 && blockOrdinal === 0

  return (
    <div
      data-comment-node-key={projection === 'primary' ? nodeKey : undefined}
      data-comment-field-label={
        projection === 'primary' ? fieldLabel : undefined
      }
      data-comment-block-ordinal={
        projection === 'primary' && useContainerAsOnlyBlock ? '0' : undefined
      }
      className='max-w-none wrap-break-word [&_blockquote]:m-0 [&_li]:my-0 [&_li>p]:m-0 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-[20px] [&_p]:m-0 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-[20px]'
      style={{
        fontSize: font.contentSize,
        lineHeight: spacing.proseLineHeight,
        color: theme.textPrimary,
        ...style,
      }}
    >
      {canUseParsedContent || useContainerAsOnlyBlock
        ? content
        : node.blocks.map((block) => (
            <span
              key={`${block.startGraphemeOffset}-${block.endGraphemeOffset}`}
              data-comment-block-ordinal={
                projection === 'primary' ? block.ordinal : undefined
              }
              className='block whitespace-pre-wrap'
            >
              {projectedBlocks[block.ordinal]?.text}
            </span>
          ))}
    </div>
  )
}
