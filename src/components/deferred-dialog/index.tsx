import type { ComponentType, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { loadComponent } from '@/lib/load-component'
import { useDialogOpener } from '@/hooks/use-dialog-opener'
import { OpeningFeedback } from './opening-feedback'

interface DeferredDialogProps<Props> {
  loadingTitle?: string
  open: boolean
  onClose: () => void
  children: (
    Content: ComponentType<Props>,
    opener: HTMLElement | null,
  ) => ReactNode
}

type DeferredPanel<Props> = ComponentType<DeferredDialogProps<Props>> & {
  preload: () => void
}

export function deferDialog<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
  title: string,
): DeferredPanel<Props>

export function deferDialog<Props extends object, Key extends string>(
  load: () => Promise<Record<Key, ComponentType<Props>>>,
  title: string,
  name: Key,
): DeferredPanel<Props>

export function deferDialog<Props extends object, Key extends string>(
  load: () => Promise<Record<Key, ComponentType<Props>>>,
  title: string,
  name: Key = 'default' as Key,
) {
  const loadEntry = loadComponent(load, name)
  let loaded: ComponentType<Props> | undefined

  function loadOnce() {
    return loadEntry().then(({ default: Component }) => {
      loaded = Component

      return Component
    })
  }

  function DeferredDialog({
    open,
    onClose,
    children,
    loadingTitle = title,
  }: DeferredDialogProps<Props>) {
    const [Content, setContent] = useState<ComponentType<Props> | null>(null)
    const [failed, setFailed] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const opener = useDialogOpener(open)

    const ready = loaded

    if (open && !Content && ready) setContent(() => ready)

    useEffect(() => {
      if (!open || Content) return

      let active = true

      setFailed(false)

      loadOnce().then(
        (Component) => {
          if (active) setContent(() => Component)
        },
        () => {
          if (active) setFailed(true)
        },
      )

      return () => {
        active = false
      }
    }, [open, Content, attempt])

    function feedback(retry?: () => void) {
      return (
        open && (
          <OpeningFeedback
            title={loadingTitle}
            opener={opener}
            onClose={onClose}
            onRetry={retry}
          />
        )
      )
    }

    if (!Content)
      return feedback(failed ? () => setAttempt((n) => n + 1) : undefined)

    return (
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary }) =>
          feedback(resetErrorBoundary)
        }
      >
        {children(Content, opener)}
      </ErrorBoundary>
    )
  }

  return Object.assign(DeferredDialog, {
    preload: () => {
      loadOnce().catch(() => {})
    },
  })
}
