'use client'

import type {
  FileUploadProps,
  FileState,
  Store,
  FileUploadContextValue,
} from '../types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import * as React from 'react'
import {
  Direction as DirectionPrimitive,
  Slot as SlotPrimitive,
} from 'radix-ui'
import { useRefWithInit } from '@/hooks/use-ref-with-init'
import { useValueAsRef } from '@/hooks/use-value-as-ref'
import { createFileUploadStore } from '../store'
import { StoreContext } from '../store-context'
import { FileUploadContext } from '../upload-context'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/lib/motion'

export function FileUpload(props: FileUploadProps) {
  const reduced = useReducedMotion()

  const {
    value,
    defaultValue,
    onValueChange,
    onAccept,
    onFileAccept,
    onFileReject,
    onFileValidate,
    onUpload,
    accept,
    maxFiles,
    maxSize,
    dir: dirProp,
    label,
    name,
    asChild,
    disabled = false,
    invalid = false,
    multiple = false,
    required = false,
    children,
    className,
    ...rootProps
  } = props

  const inputId = React.useId()
  const dropzoneId = React.useId()
  const listId = React.useId()
  const labelId = React.useId()

  const dir = DirectionPrimitive.useDirection(dirProp)
  const listeners = useRefWithInit(() => new Set<() => void>()).current
  const files = useRefWithInit<Map<File, FileState>>(() => new Map()).current
  const urlCache = useRefWithInit(() => new WeakMap<File, string>()).current
  const inputRef = React.useRef<HTMLInputElement>(null)
  const isControlled = value !== undefined

  const propsRef = useValueAsRef({
    onValueChange,
    onAccept,
    onFileAccept,
    onFileReject,
    onFileValidate,
    onUpload,
  })

  const store = React.useMemo<Store>(
    () =>
      createFileUploadStore({ files, propsRef, urlCache, listeners, invalid }),
    [listeners, files, invalid, propsRef, urlCache],
  )

  const acceptTypes = React.useMemo(
    () => accept?.split(',').map((t) => t.trim().toLowerCase()) ?? null,
    [accept],
  )

  const onProgress = useRefWithInit(() => {
    let frame = 0

    return (file: File, progress: number) => {
      if (frame) return

      frame = requestAnimationFrame(() => {
        frame = 0

        store.dispatch({
          type: 'SET_PROGRESS',
          file,
          progress: Math.min(Math.max(0, progress), 100),
        })
      })
    }
  }).current

  React.useEffect(() => {
    if (isControlled) {
      store.dispatch({ type: 'SET_FILES', files: value })
    } else if (
      defaultValue &&
      defaultValue.length > 0 &&
      !store.getState().files.size
    ) {
      store.dispatch({ type: 'SET_FILES', files: defaultValue })
    }
  }, [value, defaultValue, isControlled, store])

  React.useEffect(() => {
    return () => {
      for (const file of files.keys()) {
        const cachedUrl = urlCache.get(file)

        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl)
        }
      }
    }
  }, [files, urlCache])

  const onFilesUpload = React.useCallback(
    async (files: File[]) => {
      try {
        for (const file of files) {
          store.dispatch({ type: 'SET_PROGRESS', file, progress: 0 })
        }

        if (propsRef.current.onUpload) {
          await propsRef.current.onUpload(files, {
            onProgress,
            onSuccess: (file) => {
              store.dispatch({ type: 'SET_SUCCESS', file })
            },
            onError: (file, error) => {
              store.dispatch({
                type: 'SET_ERROR',
                file,
                error: error.message ?? 'Upload failed',
              })
            },
          })
        } else {
          for (const file of files) {
            store.dispatch({ type: 'SET_SUCCESS', file })
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed'

        for (const file of files) {
          store.dispatch({
            type: 'SET_ERROR',
            file,
            error: errorMessage,
          })
        }
      }
    },
    [store, propsRef, onProgress],
  )

  const onFilesChange = React.useCallback(
    (originalFiles: File[]) => {
      if (disabled) return

      let filesToProcess = [...originalFiles]
      let invalid = false

      if (maxFiles) {
        const currentCount = store.getState().files.size
        const remainingSlotCount = Math.max(0, maxFiles - currentCount)

        if (remainingSlotCount < filesToProcess.length) {
          const rejectedFiles = filesToProcess.slice(remainingSlotCount)

          invalid = true

          filesToProcess = filesToProcess.slice(0, remainingSlotCount)

          for (const file of rejectedFiles) {
            let rejectionMessage = `Maximum ${maxFiles} files allowed`

            if (propsRef.current.onFileValidate) {
              const validationMessage = propsRef.current.onFileValidate(file)

              if (validationMessage) {
                rejectionMessage = validationMessage
              }
            }

            propsRef.current.onFileReject?.(file, rejectionMessage)
          }
        }
      }

      const acceptedFiles: File[] = []
      const rejectedFiles: { file: File; message: string }[] = []

      for (const file of filesToProcess) {
        let rejected = false
        let rejectionMessage = ''

        if (propsRef.current.onFileValidate) {
          const validationMessage = propsRef.current.onFileValidate(file)

          if (validationMessage) {
            rejectionMessage = validationMessage
            propsRef.current.onFileReject?.(file, rejectionMessage)
            rejected = true
            invalid = true
            continue
          }
        }

        if (acceptTypes) {
          const fileType = file.type.toLowerCase()
          const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`

          if (
            !acceptTypes.some(
              (type) =>
                type === fileType ||
                type === fileExtension ||
                (type.includes('/*') &&
                  fileType.startsWith(type.replace('/*', '/'))),
            )
          ) {
            rejectionMessage = 'File type not accepted'
            propsRef.current.onFileReject?.(file, rejectionMessage)
            rejected = true
            invalid = true
          }
        }

        if (maxSize && file.size > maxSize) {
          rejectionMessage = 'File too large'
          propsRef.current.onFileReject?.(file, rejectionMessage)
          rejected = true
          invalid = true
        }

        if (!rejected) {
          acceptedFiles.push(file)
        } else {
          rejectedFiles.push({ file, message: rejectionMessage })
        }
      }

      if (invalid) {
        store.dispatch({ type: 'SET_INVALID', invalid })

        setTimeout(() => {
          store.dispatch({ type: 'SET_INVALID', invalid: false })
        }, 2000)
      }

      if (acceptedFiles.length > 0) {
        store.dispatch({ type: 'ADD_FILES', files: acceptedFiles })

        if (isControlled && propsRef.current.onValueChange) {
          const currentFiles = Array.from(store.getState().files.values()).map(
            (f) => f.file,
          )

          propsRef.current.onValueChange([...currentFiles])
        }

        if (propsRef.current.onAccept) {
          propsRef.current.onAccept(acceptedFiles)
        }

        for (const file of acceptedFiles) {
          propsRef.current.onFileAccept?.(file)
        }

        if (propsRef.current.onUpload) {
          requestAnimationFrame(() => {
            void onFilesUpload(acceptedFiles)
          })
        }
      }
    },
    [
      store,
      isControlled,
      propsRef,
      onFilesUpload,
      maxFiles,
      acceptTypes,
      maxSize,
      disabled,
    ],
  )

  const onInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])

      onFilesChange(files)
      event.target.value = ''
    },
    [onFilesChange],
  )

  const contextValue = React.useMemo<FileUploadContextValue>(
    () => ({
      dropzoneId,
      inputId,
      listId,
      labelId,
      dir,
      disabled,
      inputRef,
      urlCache,
    }),
    [dropzoneId, inputId, listId, labelId, dir, disabled, urlCache],
  )

  const RootPrimitive = asChild ? SlotPrimitive.Slot : 'div'

  return (
    <StoreContext.Provider value={store}>
      <FileUploadContext.Provider value={contextValue}>
        <RootPrimitive
          data-disabled={disabled ? '' : undefined}
          data-slot='file-upload'
          dir={dir}
          {...rootProps}
          className={cn(
            'relative flex flex-col gap-2 [&_*]:duration-(--file-upload-motion-duration) [&_*]:ease-(--file-upload-motion-ease) [&_*]:[animation-duration:var(--file-upload-motion-duration)]',
            className,
          )}
          style={
            {
              ...rootProps.style,
              '--file-upload-motion-duration': `${reduced ? 0 : DURATION.base}s`,
              '--file-upload-motion-ease': `cubic-bezier(${EASE.out.join(',')})`,
            } as React.CSSProperties
          }
        >
          {children}
          <input
            type='file'
            id={inputId}
            aria-labelledby={labelId}
            aria-describedby={dropzoneId}
            ref={inputRef}
            tabIndex={-1}
            accept={accept}
            name={name}
            className='sr-only'
            disabled={disabled}
            multiple={multiple}
            required={required}
            onChange={onInputChange}
          />
          <div id={labelId} className='sr-only'>
            {label ?? 'File upload'}
          </div>
        </RootPrimitive>
      </FileUploadContext.Provider>
    </StoreContext.Provider>
  )
}
