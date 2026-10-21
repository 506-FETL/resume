import { Element } from 'html-react-parser'
import { normalizeCommentRichTextBlock, projectCommentRichTextBlocks } from '@/features/resume-comments/anchors/projection'
import { parseSanitizedHtml } from '@/lib/safe-html'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'
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
    return COMMENT_RICH_TEXT_BLOCK_TAGS.has(child.name)
      || elementHasNestedCommentBlock(child)
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
}: {
  nodeKey: string
  fieldLabel: string
  html: string
}) {
  const node = useCommentProjectionNode(nodeKey)
  const { font, spacing, theme } = useResumeContext()

  if (!node) {
    return null
  }

  const projectedBlocks = projectCommentRichTextBlocks(html)
  let blockOrdinal = 0
  const content = parseSanitizedHtml(html, undefined, {
    replace(domNode) {
      if (
        !(domNode instanceof Element)
        || !COMMENT_RICH_TEXT_BLOCK_TAGS.has(domNode.name)
        || elementHasNestedCommentBlock(domNode)
      ) {
        return
      }

      const blockText = normalizeCommentRichTextBlock(domNode.childNodes.map(domNodeText).join(''))
      const projectedBlock = projectedBlocks[blockOrdinal]
      if (!blockText || !projectedBlock || blockText !== projectedBlock.text) {
        return
      }

      domNode.attribs['data-comment-block-ordinal'] = String(blockOrdinal)
      blockOrdinal += 1
    },
  })
  const canUseParsedContent = blockOrdinal === projectedBlocks.length
  const useContainerAsOnlyBlock = projectedBlocks.length === 1 && blockOrdinal === 0

  return (
    <div
      data-comment-node-key={nodeKey}
      data-comment-field-label={fieldLabel}
      data-comment-block-ordinal={useContainerAsOnlyBlock ? '0' : undefined}
      className="max-w-none wrap-break-word [&_blockquote]:m-0 [&_li]:my-0 [&_li>p]:m-0 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5"
      style={{
        fontSize: font.contentSize,
        lineHeight: spacing.proseLineHeight,
        color: theme.textPrimary,
      }}
    >
      {canUseParsedContent || useContainerAsOnlyBlock
        ? content
        : node.blocks.map(block => (
            <span
              key={`${block.startGraphemeOffset}-${block.endGraphemeOffset}`}
              data-comment-block-ordinal={block.ordinal}
              className="block whitespace-pre-wrap"
            >
              {projectedBlocks[block.ordinal]?.text}
            </span>
          ))}
    </div>
  )
}
