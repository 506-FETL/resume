import type { ORDERType } from '@/lib/schema'
import { create } from 'zustand'

interface PreparationUiState {
  editRequest: { resumeId: string; section: ORDERType; version: number } | null
  requestEdit: (resumeId: string, section: ORDERType) => void
  clearEditRequest: () => void
}

/** 编辑器在检查弹窗关闭后接收请求，打开桌面编辑栏或手机抽屉。 */
export const usePreparationUiStore = create<PreparationUiState>((set) => ({
  editRequest: null,
  requestEdit: (resumeId, section) =>
    set((state) => ({
      editRequest: {
        resumeId,
        section,
        version: (state.editRequest?.version ?? 0) + 1,
      },
    })),
  clearEditRequest: () => set({ editRequest: null }),
}))
