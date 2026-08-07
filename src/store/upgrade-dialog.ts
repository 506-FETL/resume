import { create } from 'zustand'

// 升级 Dialog 的触发来源：超额自动弹出 / 用户主动点击「升级」
export type UpgradeDialogReason = 'quota_exceeded' | 'manual'

interface UpgradeDialogStore {
  open: boolean
  reason: UpgradeDialogReason
  // 额度恢复时间（次日 UTC 0 点 ISO），由超额错误透传，用于友好展示
  resetAt: string | null
  openDialog: (opts?: { reason?: UpgradeDialogReason, resetAt?: string | null }) => void
  setOpen: (open: boolean) => void
}

const useUpgradeDialogStore = create<UpgradeDialogStore>(set => ({
  open: false,
  reason: 'manual',
  resetAt: null,
  openDialog: opts => set({
    open: true,
    reason: opts?.reason ?? 'manual',
    resetAt: opts?.resetAt ?? null,
  }),
  setOpen: open => set({ open }),
}))

export default useUpgradeDialogStore

// 非组件上下文（如 use-chat-stream 捕获超额时）打开升级 Dialog
export function openUpgradeDialog(opts?: { reason?: UpgradeDialogReason, resetAt?: string | null }) {
  useUpgradeDialogStore.getState().openDialog(opts)
}
