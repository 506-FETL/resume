import type { RefObject } from 'react'
import type { UIAction } from '@/lib/collaboration'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useEffect, useRef } from 'react'

interface UseConfigBroadcastOptions {
  spacing: ResumeAppearanceConfig['spacing']
  font: ResumeAppearanceConfig['font']
  theme: ResumeAppearanceConfig['theme']
  isApplyingRemote: RefObject<boolean>
  broadcastUIAction: (action: UIAction) => void
}

export function useConfigBroadcast({
  spacing,
  font,
  theme,
  isApplyingRemote,
  broadcastUIAction,
}: UseConfigBroadcastOptions) {
  const previousSpacing = useRef(spacing)
  const previousFont = useRef(font)
  const previousTheme = useRef(theme)

  useEffect(() => {
    if (isApplyingRemote.current)
      return
    if (JSON.stringify(previousSpacing.current) !== JSON.stringify(spacing)) {
      previousSpacing.current = spacing
      broadcastUIAction({ kind: 'config-spacing', data: spacing })
    }
  }, [spacing, broadcastUIAction, isApplyingRemote])

  useEffect(() => {
    if (isApplyingRemote.current)
      return
    if (JSON.stringify(previousFont.current) !== JSON.stringify(font)) {
      previousFont.current = font
      broadcastUIAction({ kind: 'config-font', data: font })
    }
  }, [font, broadcastUIAction, isApplyingRemote])

  useEffect(() => {
    if (isApplyingRemote.current)
      return
    if (JSON.stringify(previousTheme.current) !== JSON.stringify(theme)) {
      previousTheme.current = theme
      broadcastUIAction({ kind: 'config-theme', data: theme })
    }
  }, [theme, broadcastUIAction, isApplyingRemote])
}
