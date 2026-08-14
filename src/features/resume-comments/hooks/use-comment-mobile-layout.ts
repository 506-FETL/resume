import { useEffect, useState } from 'react'

export const COMMENT_MOBILE_LAYOUT_QUERY = [
  '(max-width: 767px)',
  '(hover: none) and (pointer: coarse) and (max-width: 1024px)',
].join(', ')

function readCommentMobileLayout() {
  return typeof window !== 'undefined'
    && window.matchMedia(COMMENT_MOBILE_LAYOUT_QUERY).matches
}

export function useCommentMobileLayout() {
  const [isMobileLayout, setIsMobileLayout] = useState(readCommentMobileLayout)

  useEffect(() => {
    const media = window.matchMedia(COMMENT_MOBILE_LAYOUT_QUERY)
    const update = () => setIsMobileLayout(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])

  return isMobileLayout
}
