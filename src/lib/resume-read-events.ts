interface ResumeReadReceipt {
  owner: string
  label: { resume_id: string; display_name: string; updated_at: string }
}

type ResumeReadListener = (
  resumeId: string | undefined,
  receipt?: ResumeReadReceipt,
) => void

const listeners = new Set<ResumeReadListener>()

export function notifyResumeReadChanged(
  resumeId?: string,
  receipt?: ResumeReadReceipt,
): void {
  listeners.forEach((listener) => listener(resumeId, receipt))
}

export function subscribeResumeReadChanges(listener: ResumeReadListener) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
