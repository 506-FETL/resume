import { FINE_SPACING_FIELDS, createDraft, validateDraftValue } from './fields'
import type {
  FineSpacingDraft,
  Spacing,
  PendingExit,
  FineSpacingField,
} from './fields'
import type { KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import useResumeConfigStore from '@/store/resume/config'

export function useSpacingSettings() {
  const {
    spacing,
    updateSpacing,
    beginSpacingPreview,
    updateSpacingPreview,
    commitSpacingPreview,
    discardSpacingPreview,
  } = useResumeConfigStore()

  const [open, setOpen] = useState(false)
  const [fineMode, setFineMode] = useState(false)

  const [draft, setDraft] = useState<FineSpacingDraft>(() =>
    createDraft(spacing),
  )

  const [baseline, setBaseline] = useState<Spacing | null>(null)
  const [pendingExit, setPendingExit] = useState<PendingExit | null>(null)
  const fineSessionActiveRef = useRef(false)

  const fieldStates = useMemo(
    () =>
      FINE_SPACING_FIELDS.map((field) => ({
        field,
        validation: validateDraftValue(field, draft[field.key]),
      })),
    [draft],
  )

  const allFieldsValid = fieldStates.every(
    ({ validation }) => validation.error === null,
  )

  const isDirty =
    baseline !== null &&
    fieldStates.some(({ field, validation }) => {
      if (validation.value !== null) {
        return validation.value !== baseline[field.key]
      }

      return draft[field.key] !== createDraft(baseline)[field.key]
    })

  useEffect(
    () => () => {
      if (fineSessionActiveRef.current) {
        discardSpacingPreview()
      }
    },
    [discardSpacingPreview],
  )

  function startFineSession() {
    const nextBaseline = { ...spacing }

    setBaseline(nextBaseline)
    setDraft(createDraft(nextBaseline))
    beginSpacingPreview()
    fineSessionActiveRef.current = true
  }

  function finishExit(action: PendingExit) {
    if (fineSessionActiveRef.current) {
      discardSpacingPreview()
      fineSessionActiveRef.current = false
    }

    setBaseline(null)
    setPendingExit(null)

    if (action === 'close') {
      setOpen(false)

      return
    }

    setFineMode(false)
  }

  function requestExit(action: PendingExit) {
    if (fineMode && isDirty) {
      setPendingExit(action)

      return
    }

    finishExit(action)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true)

      if (fineMode) {
        startFineSession()
      }

      return
    }

    requestExit('close')
  }

  function handleFineModeChange(nextFineMode: boolean) {
    if (nextFineMode) {
      setFineMode(true)
      startFineSession()

      return
    }

    requestExit('coarse')
  }

  function handleDraftChange(field: FineSpacingField, value: string) {
    setDraft((current) => ({ ...current, [field.key]: value }))

    const validation = validateDraftValue(field, value)

    if (validation.value !== null) {
      updateSpacingPreview({ [field.key]: validation.value })
    }
  }

  function handleConfirm() {
    if (!allFieldsValid || !fineSessionActiveRef.current) {
      return
    }

    fineSessionActiveRef.current = false

    if (isDirty) {
      commitSpacingPreview()
    } else {
      discardSpacingPreview()
    }

    setBaseline(null)
    setOpen(false)
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') {
      return
    }

    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )

    if (focusableElements.length === 0) {
      return
    }

    event.preventDefault()

    const currentIndex = focusableElements.indexOf(
      document.activeElement as HTMLElement,
    )

    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusableElements.length - 1
        : currentIndex - 1
      : currentIndex === focusableElements.length - 1
        ? 0
        : currentIndex + 1

    focusableElements[nextIndex]?.focus()
  }

  function handleProtectedDismiss(event: Event) {
    if (!fineMode || !isDirty) {
      return
    }

    event.preventDefault()

    if (pendingExit === null) {
      setPendingExit('close')
    }
  }

  function handleDiscardChanges() {
    if (pendingExit !== null) {
      finishExit(pendingExit)
    }
  }

  return {
    spacing,
    updateSpacing,
    open,
    fineMode,
    draft,
    pendingExit,
    setPendingExit,
    fieldStates,
    allFieldsValid,
    requestExit,
    handleOpenChange,
    handleFineModeChange,
    handleDraftChange,
    handleConfirm,
    handleMenuKeyDown,
    handleProtectedDismiss,
    handleDiscardChanges,
  }
}
