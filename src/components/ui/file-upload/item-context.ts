'use client'

import * as React from 'react'
import type { FileUploadItemContextValue } from './types'
import { ITEM_NAME } from './constants'

export const FileUploadItemContext =
  React.createContext<FileUploadItemContextValue | null>(null)

export function useFileUploadItemContext(consumerName: string) {
  const context = React.useContext(FileUploadItemContext)

  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ITEM_NAME}\``)
  }

  return context
}
