'use client'

import type { FileUploadDropzoneProps } from '../types'
import { useFileUploadContext } from '../upload-context'
import { DROPZONE_NAME } from '../constants'
import { useStoreContext, useStore } from '../store-context'
import { useValueAsRef } from '@/hooks/use-value-as-ref'
import * as React from 'react'
import { setInputFiles } from '../utils'
import * as SlotPrimitive from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export function FileUploadDropzone(props: FileUploadDropzoneProps) {
  const {
    asChild,
    className,
    onClick: onClickProp,
    onDragOver: onDragOverProp,
    onDragEnter: onDragEnterProp,
    onDragLeave: onDragLeaveProp,
    onDrop: onDropProp,
    onPaste: onPasteProp,
    onKeyDown: onKeyDownProp,
    ...dropzoneProps
  } = props

  const context = useFileUploadContext(DROPZONE_NAME)
  const store = useStoreContext(DROPZONE_NAME)
  const dragOver = useStore((state) => state.dragOver)
  const invalid = useStore((state) => state.invalid)

  const propsRef = useValueAsRef({
    onClick: onClickProp,
    onDragOver: onDragOverProp,
    onDragEnter: onDragEnterProp,
    onDragLeave: onDragLeaveProp,
    onDrop: onDropProp,
    onPaste: onPasteProp,
    onKeyDown: onKeyDownProp,
  })

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      propsRef.current.onClick?.(event)

      if (event.defaultPrevented) return

      const target = event.target

      const isFromTrigger =
        target instanceof HTMLElement &&
        target.closest('[data-slot="file-upload-trigger"]')

      if (!isFromTrigger) {
        context.inputRef.current?.click()
      }
    },
    [context.inputRef, propsRef],
  )

  const onDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragOver?.(event)

      if (event.defaultPrevented) return

      event.preventDefault()
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: true })
    },
    [store, propsRef],
  )

  const onDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragEnter?.(event)

      if (event.defaultPrevented) return

      event.preventDefault()
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: true })
    },
    [store, propsRef],
  )

  const onDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragLeave?.(event)

      if (event.defaultPrevented) return

      const relatedTarget = event.relatedTarget

      if (
        relatedTarget &&
        relatedTarget instanceof Node &&
        event.currentTarget.contains(relatedTarget)
      ) {
        return
      }

      event.preventDefault()
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: false })
    },
    [store, propsRef],
  )

  const onDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDrop?.(event)

      if (event.defaultPrevented) return

      event.preventDefault()
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: false })

      const files = Array.from(event.dataTransfer.files)
      const inputElement = context.inputRef.current

      if (!inputElement) return

      setInputFiles(inputElement, files)
    },
    [store, context.inputRef, propsRef],
  )

  const onPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      propsRef.current.onPaste?.(event)

      if (event.defaultPrevented) return

      event.preventDefault()
      store.dispatch({ type: 'SET_DRAG_OVER', dragOver: false })

      const items = event.clipboardData?.items

      if (!items) return

      const files: File[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        if (item?.kind === 'file') {
          const file = item.getAsFile()

          if (file) {
            files.push(file)
          }
        }
      }

      if (files.length === 0) return

      const inputElement = context.inputRef.current

      if (!inputElement) return

      setInputFiles(inputElement, files)
    },
    [store, context.inputRef, propsRef],
  )

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      propsRef.current.onKeyDown?.(event)

      if (
        !event.defaultPrevented &&
        (event.key === 'Enter' || event.key === ' ')
      ) {
        event.preventDefault()
        context.inputRef.current?.click()
      }
    },
    [context.inputRef, propsRef],
  )

  const DropzonePrimitive = asChild ? SlotPrimitive.Slot : 'div'

  return (
    <DropzonePrimitive
      role='region'
      id={context.dropzoneId}
      aria-controls={`${context.inputId} ${context.listId}`}
      aria-disabled={context.disabled}
      aria-invalid={invalid}
      data-disabled={context.disabled ? '' : undefined}
      data-dragging={dragOver ? '' : undefined}
      data-invalid={invalid ? '' : undefined}
      data-slot='file-upload-dropzone'
      dir={context.dir}
      tabIndex={context.disabled ? undefined : 0}
      {...dropzoneProps}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors outline-none select-none hover:bg-accent/30 focus-visible:border-ring/50 data-dragging:border-primary/30 data-dragging:bg-accent/30 data-invalid:border-destructive data-invalid:ring-destructive/20 data-disabled:pointer-events-none',
        className,
      )}
      onClick={onClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  )
}
