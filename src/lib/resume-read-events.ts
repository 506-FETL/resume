type ResumeReadListener = (resumeId: string | undefined) => void

const listeners = new Set<ResumeReadListener>()

export function notifyResumeReadChanged(resumeId?: string): void {
  listeners.forEach((listener) => listener(resumeId))
}

export function subscribeResumeReadChanges(listener: ResumeReadListener) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
