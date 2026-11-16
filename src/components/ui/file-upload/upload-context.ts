'use client'

import * as React from 'react'
import type { FileUploadContextValue } from './types'
import { ROOT_NAME } from './constants'

export const FileUploadContext =
  React.createContext<FileUploadContextValue | null>(null)

export function useFileUploadContext(consumerName: string) {
  const context = React.useContext(FileUploadContext)

  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``)
  }

  return context
}
