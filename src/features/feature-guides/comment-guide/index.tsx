import { useState, type RefObject } from 'react'
import CommentDemo from '../comment-demo'
import GuidePresentation from '../components/guide-presentation'
import SelectionDemo, { type GuideSelection } from '../selection'
import { pickGuideSelection } from '../selection/geometry'
import type { GuideStep } from '../types'
import { useFeatureGuide } from '../use-feature-guide'

const steps: GuideStep[] = [
  {
    target: '[data-resume-comment-trigger]',
    title: '选中文字，就能评论',
    hint: '划词评论',
    description: '给某一句话留下建议，之后也能直接找到原文。',
    side: 'left',
  },
  {
    target: '[data-feature-guide-comment-header]',
    title: '建议都在评论栏里',
    description: '在这里查看、回复和解决评论。',
    animated: true,
    side: 'left',
  },
  {
    target: '[data-feature-guide-selection]',
    title: '先划出想讨论的文字',
    description: '在简历预览里拖选一小段正文，再点「评论」。',
    nextLabel: '演示评论',
    animated: true,
    side: 'bottom',
  },
  {
    target: '[data-feature-guide-comment-header]',
    title: '写下建议，再发送',
    description: '评论会带上选中的原文。这里的「666」仅作演示。',
    animated: true,
    side: 'left',
  },
  {
    target: '[data-feature-guide-selection]',
    title: '评论和原文连在一起',
    description: '带评论的文字会高亮，点击就能回到对应讨论。',
    side: 'bottom',
  },
]

export default function CommentGuide({
  enabled,
  contextKey,
  rootRef,
}: {
  enabled: boolean
  contextKey: string
  rootRef: RefObject<HTMLDivElement | null>
}) {
  const [selection, setSelection] = useState<GuideSelection | null>(null)
  const [hasText, setHasText] = useState(true)

  const guide = useFeatureGuide({
    id: 'comments',
    enabled,
    contextKey,
    steps: hasText
      ? steps
      : steps.map((step, index) =>
          index === 1
            ? {
                ...step,
                title: '写好内容后，再划词评论',
                description: '预览里有一段正文时，就能选中文字留下建议。',
                nextLabel: '知道了',
                terminal: true,
              }
            : step,
        ),
    prepare: (index) => {
      if (index === 1) {
        setHasText(
          Boolean(rootRef.current && pickGuideSelection(rootRef.current)),
        )
      }

      if (index !== 2) return

      const next = rootRef.current && pickGuideSelection(rootRef.current)

      setSelection(next)

      return Boolean(next)
    },
  })

  return (
    <>
      <CommentDemo
        blocked={guide.blocked}
        phase={
          guide.active && guide.index === 1
            ? 'intro'
            : guide.active && guide.index === 3
              ? 'send'
              : null
        }
        quote={selection?.text ?? ''}
        onClose={guide.close}
        onReady={guide.ready}
      />
      {selection && (
        <SelectionDemo
          blocked={guide.blocked}
          selection={selection}
          phase={guide.index === 4 ? 'highlight' : 'select'}
          visible={guide.active && (guide.index === 2 || guide.index === 4)}
          playing={guide.presentedIndex === guide.index}
          actionLabel='评论'
          onAction={guide.next}
          onReady={guide.ready}
          onUnavailable={guide.interrupt}
        />
      )}
      <GuidePresentation guide={guide} />
    </>
  )
}
