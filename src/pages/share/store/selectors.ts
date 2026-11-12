import type { ShareUiSlice } from './types'

export function hasShareOperationDialog(
  state: ShareUiSlice,
  shareId: string | null,
) {
  if (!shareId) return false

  return (
    (state.settingsDialogOpen && state.settingsShareId === shareId) ||
    (state.archiveDialogOpen && state.archiveShareId === shareId) ||
    (state.deleteDialogOpen && state.deleteShareId === shareId) ||
    (state.versionDialogOpen && state.versionShareId === shareId)
  )
}
