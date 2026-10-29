import type { CheckPatch, ResumeCheckIssue } from '@/lib/resume-checks/types'
import { toast } from 'sonner'
import { proofreadResume } from '@/lib/resume-checks/proofread'
import {
  checkIssueSignature,
  createCheckPatch,
} from '@/lib/resume-checks/targets'
import { updatePreparation } from '@/lib/resume-preparation/storage'
import useResumeStore from '@/store/resume/form'
import useUserStore from '@/store/user'
import { useResumeReviewStore } from '../review-store'
import { usePreparationUiStore } from '../preparation-store'
import { useResumeCheckStore } from '../store/checks'

let request: AbortController | null = null
let undo: { identity: string; patches: CheckPatch[] } | null = null

function isCurrent(identity: string | null) {
  const form = useResumeStore.getState()
  const ownerId = useUserStore.getState().currentUser?.id ?? null

  return (
    form.isInitialized &&
    !useResumeReviewStore.getState().active &&
    identity === `${ownerId ?? 'guest'}:${form.currentResumeId}`
  )
}

export function cancelProofreading(status: 'idle' | 'stale' = 'idle') {
  request?.abort()
  request = null

  if (useResumeCheckStore.getState().proofreadStatus === 'running')
    useResumeCheckStore.setState({ proofreadStatus: status })
}

export async function runProofreading() {
  const state = useResumeCheckStore.getState()

  if (!isCurrent(state.identity) || state.proofreadStatus === 'running') return
  if (!state.ownerId) {
    toast.info('登录后可使用 AI 文字校对，本地检查仍可使用')

    return
  }

  const controller = new AbortController()
  const snapshot = useResumeStore.getState().getPersistedSnapshot()
  const signature = JSON.stringify(snapshot)

  request = controller

  useResumeCheckStore.setState({
    proofreadStatus: 'running',
    proofreadError: null,
    proofreadSignature: signature,
    proofreadIssues: [],
  })

  try {
    const issues = await proofreadResume(snapshot, controller)

    if (request !== controller || !isCurrent(state.identity)) return

    const current = JSON.stringify(
      useResumeStore.getState().getPersistedSnapshot(),
    )

    useResumeCheckStore.setState(
      current === signature
        ? {
            proofreadIssues: issues,
            proofreadStatus: 'ready',
            proofreadError: null,
          }
        : { proofreadStatus: 'stale' },
    )
  } catch (error) {
    if (
      request !== controller ||
      controller.signal.aborted ||
      !isCurrent(state.identity)
    )
      return

    useResumeCheckStore.setState({
      proofreadStatus: 'error',
      proofreadError:
        error instanceof Error ? error.message : '文字校对失败，请重试',
    })
  } finally {
    if (request === controller) request = null
  }
}

export async function keepCheckIssue(issue: ResumeCheckIssue, keep: boolean) {
  const state = useResumeCheckStore.getState()

  if (!state.resumeId || state.busy || !isCurrent(state.identity)) return

  const current = state.issues.find((item) => item.id === issue.id)
  const snapshot = useResumeStore.getState().getPersistedSnapshot()

  const signature =
    issue.source === 'layout'
      ? JSON.stringify(snapshot)
      : checkIssueSignature(snapshot, issue.targets)

  if (current?.signature !== issue.signature || signature !== issue.signature) {
    toast.info('这段内容已变化，请查看新的检查结果')

    return
  }

  useResumeCheckStore.setState({ busy: true })

  try {
    await updatePreparation(state.resumeId, state.ownerId, (record) => {
      const resolutions = { ...record.resolutions }

      if (keep)
        resolutions[issue.id] = {
          signature: issue.signature,
          reason: '已确认保留原文',
        }
      else delete resolutions[issue.id]

      return { ...record, resolutions }
    })

    if (isCurrent(state.identity))
      toast.success(keep ? '已保留原文' : '已恢复提醒')
  } catch (error) {
    if (isCurrent(state.identity))
      toast.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    if (isCurrent(state.identity)) useResumeCheckStore.setState({ busy: false })
  }
}

export function applyCheckSuggestion(issue: ResumeCheckIssue) {
  const state = useResumeCheckStore.getState()

  if (!isCurrent(state.identity) || !state.identity || state.busy) return

  const form = useResumeStore.getState()
  const snapshot = form.getPersistedSnapshot()

  if (checkIssueSignature(snapshot, issue.targets) !== issue.signature) {
    toast.info('原文已变化，请重新检查')

    return
  }

  const patches = createCheckPatch(snapshot, issue)

  if (!patches?.length) {
    toast.info('这处内容需要手动修改，已为你打开填写区域')
    editCheckIssue(issue)

    return
  }

  patches.forEach((patch) => form.updateForm(patch.section, patch.after))
  undo = { identity: state.identity, patches }
  useResumeCheckStore.setState({ canUndo: true, selectedIssueId: null })

  toast.success('已采用建议', {
    action: { label: '撤销', onClick: undoCheckSuggestion },
  })
}

export function undoCheckSuggestion() {
  if (!undo || !isCurrent(undo.identity)) return

  const form = useResumeStore.getState()
  const snapshot = form.getPersistedSnapshot()

  if (
    undo.patches.some(
      (patch) =>
        JSON.stringify(snapshot[patch.section]) !== JSON.stringify(patch.after),
    )
  ) {
    toast.info('这段内容已有新的修改，未覆盖你的更改')
    undo = null
    useResumeCheckStore.setState({ canUndo: false })

    return
  }

  undo.patches.forEach((patch) => form.updateForm(patch.section, patch.before))
  undo = null
  useResumeCheckStore.setState({ canUndo: false })
  toast.success('已撤销修改')
}

export function editCheckIssue(issue: ResumeCheckIssue, targetIndex = 0) {
  const state = useResumeCheckStore.getState()

  if (!state.resumeId || !isCurrent(state.identity)) return

  const target = issue.targets[targetIndex]

  document
    .querySelector<HTMLElement>(
      '[data-resume-check-workspace] [data-check-mode="edit"]',
    )
    ?.focus({ preventScroll: true })

  state.locate(issue.id, targetIndex)
  state.setTab('edit')

  usePreparationUiStore
    .getState()
    .requestEdit(state.resumeId, target?.section ?? issue.section, target)
}
