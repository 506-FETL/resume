import type { RefObject } from 'react'
import CommentGuide from './comment-guide'
import SortingGuide from './sorting-guide'

export default function EditorGuides({
  commentEnabled,
  sortingEnabled,
  contextKey,
  rootRef,
  editPanelRef,
  mobile,
}: {
  commentEnabled: boolean
  sortingEnabled: boolean
  contextKey: string
  rootRef: RefObject<HTMLDivElement | null>
  editPanelRef: RefObject<HTMLDivElement | null>
  mobile: boolean
}) {
  return (
    <>
      <CommentGuide
        enabled={commentEnabled}
        contextKey={contextKey}
        rootRef={rootRef}
      />
      <SortingGuide
        enabled={sortingEnabled}
        editPanelRef={editPanelRef}
        contextKey={contextKey}
        mobile={mobile}
      />
    </>
  )
}
