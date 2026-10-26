import type { ORDERType } from '@/lib/schema'
import type { CheckTarget } from '@/lib/resume-checks/types'
import { create } from 'zustand'

interface PreparationUiState {
  editRequest: {
    resumeId: string
    section: ORDERType
    version: number
    target?: CheckTarget
  } | null
  requestEdit: (
    resumeId: string,
    section: ORDERType,
    target?: CheckTarget,
  ) => void
  clearEditRequest: () => void
}

/** 编辑器在检查弹窗关闭后接收请求，打开桌面编辑栏或手机抽屉。 */
export const usePreparationUiStore = create<PreparationUiState>((set) => ({
  editRequest: null,
  requestEdit: (resumeId, section, target) =>
    set((state) => ({
      editRequest: {
        resumeId,
        section,
        target,
        version: (state.editRequest?.version ?? 0) + 1,
      },
    })),
  clearEditRequest: () => set({ editRequest: null }),
}))
