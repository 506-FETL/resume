import * as React from 'react'

import type { FileItem, UploadOptions } from './types'

export function useFileUpload(options: UploadOptions) {
  const [fileItems, setFileItems] = React.useState<FileItem[]>([])

  const uploadFile = async (file: File): Promise<string | null> => {
    if (file.size > options.maxSize) {
      const error = new Error(
        `File size exceeds maximum allowed (${options.maxSize / 1024 / 1024}MB)`,
      )

      options.onError?.(error)

      return null
    }

    const abortController = new AbortController()
    const fileId = crypto.randomUUID()

    const newFileItem: FileItem = {
      id: fileId,
      file,
      progress: 0,
      status: 'uploading',
      abortController,
    }

    setFileItems((prev) => [...prev, newFileItem])

    try {
      if (!options.upload) {
        throw new Error('Upload function is not defined')
      }

      const url = await options.upload(
        file,
        (event: { progress: number }) => {
          setFileItems((prev) =>
            prev.map((item) =>
              item.id === fileId ? { ...item, progress: event.progress } : item,
            ),
          )
        },
        abortController.signal,
      )

      if (!url) throw new Error('Upload failed: No URL returned')

      if (!abortController.signal.aborted) {
        setFileItems((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? { ...item, status: 'success', url, progress: 100 }
              : item,
          ),
        )

        options.onSuccess?.(url)

        return url
      }

      return null
    } catch (error) {
      if (!abortController.signal.aborted) {
        setFileItems((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? { ...item, status: 'error', progress: 0 }
              : item,
          ),
        )

        options.onError?.(
          error instanceof Error ? error : new Error('Upload failed'),
        )
      }

      return null
    }
  }

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    if (!files || files.length === 0) {
      options.onError?.(new Error('No files to upload'))

      return []
    }

    if (options.limit && files.length > options.limit) {
      options.onError?.(
        new Error(
          `Maximum ${options.limit} file${options.limit === 1 ? '' : 's'} allowed`,
        ),
      )

      return []
    }

    const uploadPromises = files.map((file) => uploadFile(file))
    const results = await Promise.all(uploadPromises)

    return results.filter((url): url is string => url !== null)
  }

  const removeFileItem = (fileId: string) => {
    setFileItems((prev) => {
      const fileToRemove = prev.find((item) => item.id === fileId)

      if (fileToRemove?.abortController) {
        fileToRemove.abortController.abort()
      }
      if (fileToRemove?.url) {
        URL.revokeObjectURL(fileToRemove.url)
      }

      return prev.filter((item) => item.id !== fileId)
    })
  }

  const clearAllFiles = () => {
    fileItems.forEach((item) => {
      if (item.abortController) {
        item.abortController.abort()
      }
      if (item.url) {
        URL.revokeObjectURL(item.url)
      }
    })

    setFileItems([])
  }

  return {
    fileItems,
    uploadFiles,
    removeFileItem,
    clearAllFiles,
  }
}
