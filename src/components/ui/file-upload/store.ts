'use client'

import type {
  FileState,
  FileUploadProps,
  Store,
  StoreState,
  StoreAction,
} from './types'
import * as React from 'react'

export function createFileUploadStore({
  files,
  propsRef,
  urlCache,
  listeners,
  invalid,
}: {
  files: Map<File, FileState>
  propsRef: React.RefObject<
    Pick<
      FileUploadProps,
      | 'onValueChange'
      | 'onAccept'
      | 'onFileAccept'
      | 'onFileReject'
      | 'onFileValidate'
      | 'onUpload'
    >
  >
  urlCache: WeakMap<File, string>
  listeners: Set<() => void>
  invalid: boolean
}): Store {
  const storeState: { current: StoreState } = {
    current: {
      files,
      dragOver: false,
      invalid: invalid,
    },
  }

  function reducer(state: StoreState, action: StoreAction): StoreState {
    switch (action.type) {
      case 'ADD_FILES': {
        for (const file of action.files) {
          files.set(file, {
            file,
            progress: 0,
            status: 'idle',
          })
        }

        if (propsRef.current.onValueChange) {
          const fileList = Array.from(files.values()).map(
            (fileState) => fileState.file,
          )

          propsRef.current.onValueChange(fileList)
        }

        return { ...state, files }
      }

      case 'SET_FILES': {
        const newFileSet = new Set(action.files)

        for (const existingFile of files.keys()) {
          if (!newFileSet.has(existingFile)) {
            files.delete(existingFile)
          }
        }

        for (const file of action.files) {
          const existingState = files.get(file)

          if (!existingState) {
            files.set(file, {
              file,
              progress: 0,
              status: 'idle',
            })
          }
        }

        return { ...state, files }
      }

      case 'SET_PROGRESS': {
        const fileState = files.get(action.file)

        if (fileState) {
          files.set(action.file, {
            ...fileState,
            progress: action.progress,
            status: 'uploading',
          })
        }

        return { ...state, files }
      }

      case 'SET_SUCCESS': {
        const fileState = files.get(action.file)

        if (fileState) {
          files.set(action.file, {
            ...fileState,
            progress: 100,
            status: 'success',
          })
        }

        return { ...state, files }
      }

      case 'SET_ERROR': {
        const fileState = files.get(action.file)

        if (fileState) {
          files.set(action.file, {
            ...fileState,
            error: action.error,
            status: 'error',
          })
        }

        return { ...state, files }
      }

      case 'REMOVE_FILE': {
        const cachedUrl = urlCache.get(action.file)

        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl)
          urlCache.delete(action.file)
        }

        files.delete(action.file)

        if (propsRef.current.onValueChange) {
          const fileList = Array.from(files.values()).map(
            (fileState) => fileState.file,
          )

          propsRef.current.onValueChange(fileList)
        }

        return { ...state, files }
      }

      case 'SET_DRAG_OVER': {
        return { ...state, dragOver: action.dragOver }
      }

      case 'SET_INVALID': {
        return { ...state, invalid: action.invalid }
      }

      case 'CLEAR': {
        for (const file of files.keys()) {
          const cachedUrl = urlCache.get(file)

          if (cachedUrl) {
            URL.revokeObjectURL(cachedUrl)
            urlCache.delete(file)
          }
        }

        files.clear()

        if (propsRef.current.onValueChange) {
          propsRef.current.onValueChange([])
        }

        return { ...state, files, invalid: false }
      }

      default:
        return state
    }
  }

  return {
    getState: () => storeState.current,
    dispatch: (action) => {
      storeState.current = reducer(storeState.current, action)

      for (const listener of listeners) {
        listener()
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
  }
}
