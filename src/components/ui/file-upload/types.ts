'use client'

import * as React from 'react'

type Direction = 'ltr' | 'rtl'

export interface FileState {
  file: File
  progress: number
  error?: string
  status: 'idle' | 'uploading' | 'error' | 'success'
}

export interface StoreState {
  files: Map<File, FileState>
  dragOver: boolean
  invalid: boolean
}

export type StoreAction =
  | { type: 'ADD_FILES'; files: File[] }
  | { type: 'SET_FILES'; files: File[] }
  | { type: 'SET_PROGRESS'; file: File; progress: number }
  | { type: 'SET_SUCCESS'; file: File }
  | { type: 'SET_ERROR'; file: File; error: string }
  | { type: 'REMOVE_FILE'; file: File }
  | { type: 'SET_DRAG_OVER'; dragOver: boolean }
  | { type: 'SET_INVALID'; invalid: boolean }
  | { type: 'CLEAR' }

export type Store = {
  getState: () => StoreState
  dispatch: (action: StoreAction) => void
  subscribe: (listener: () => void) => () => void
}

export interface FileUploadContextValue {
  inputId: string
  dropzoneId: string
  listId: string
  labelId: string
  disabled: boolean
  dir: Direction
  inputRef: React.RefObject<HTMLInputElement | null>
  urlCache: WeakMap<File, string>
}

export interface FileUploadProps extends Omit<
  React.ComponentProps<'div'>,
  'defaultValue' | 'onChange'
> {
  value?: File[]
  defaultValue?: File[]
  onValueChange?: (files: File[]) => void
  onAccept?: (files: File[]) => void
  onFileAccept?: (file: File) => void
  onFileReject?: (file: File, message: string) => void
  onFileValidate?: (file: File) => string | null | undefined
  onUpload?: (
    files: File[],
    options: {
      onProgress: (file: File, progress: number) => void
      onSuccess: (file: File) => void
      onError: (file: File, error: Error) => void
    },
  ) => Promise<void> | void
  accept?: string
  maxFiles?: number
  maxSize?: number
  dir?: Direction
  label?: string
  name?: string
  asChild?: boolean
  disabled?: boolean
  invalid?: boolean
  multiple?: boolean
  required?: boolean
}

export interface FileUploadDropzoneProps extends React.ComponentProps<'div'> {
  asChild?: boolean
}

export interface FileUploadTriggerProps extends React.ComponentProps<'button'> {
  asChild?: boolean
}

export interface FileUploadListProps extends React.ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical'
  asChild?: boolean
  forceMount?: boolean
}

export interface FileUploadItemContextValue {
  id: string
  fileState: FileState | undefined
  nameId: string
  sizeId: string
  statusId: string
  messageId: string
}

export interface FileUploadItemProps extends React.ComponentProps<'div'> {
  value: File
  asChild?: boolean
}

export interface FileUploadItemPreviewProps extends React.ComponentProps<'div'> {
  render?: (file: File, fallback: () => React.ReactNode) => React.ReactNode
  asChild?: boolean
}

export interface FileUploadItemMetadataProps extends React.ComponentProps<'div'> {
  asChild?: boolean
  size?: 'default' | 'sm'
}

export interface FileUploadItemProgressProps extends React.ComponentProps<'div'> {
  variant?: 'linear' | 'circular' | 'fill'
  size?: number
  asChild?: boolean
  forceMount?: boolean
}

export interface FileUploadItemDeleteProps extends React.ComponentProps<'button'> {
  asChild?: boolean
}

export interface FileUploadClearProps extends React.ComponentProps<'button'> {
  forceMount?: boolean
  asChild?: boolean
}
