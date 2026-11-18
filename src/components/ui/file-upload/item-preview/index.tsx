'use client'

import type { FileUploadItemPreviewProps } from '../types'
import { useFileUploadItemContext } from '../item-context'
import { ITEM_PREVIEW_NAME } from '../constants'
import { useFileUploadContext } from '../upload-context'
import * as React from 'react'
import { getFileIcon } from '../file-icon'
import * as SlotPrimitive from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export function FileUploadItemPreview(props: FileUploadItemPreviewProps) {
  const { render, asChild, children, className, ...previewProps } = props

  const itemContext = useFileUploadItemContext(ITEM_PREVIEW_NAME)
  const context = useFileUploadContext(ITEM_PREVIEW_NAME)

  const getDefaultRender = React.useCallback(
    (file: File) => {
      if (itemContext.fileState?.file.type.startsWith('image/')) {
        let url = context.urlCache.get(file)

        if (!url) {
          url = URL.createObjectURL(file)
          context.urlCache.set(file, url)
        }

        return (
          <img src={url} alt={file.name} className='size-full object-cover' />
        )
      }

      return getFileIcon(file)
    },
    [itemContext.fileState?.file.type, context.urlCache],
  )

  const onPreviewRender = React.useCallback(
    (file: File) => {
      if (render) {
        return render(file, () => getDefaultRender(file))
      }

      return getDefaultRender(file)
    },
    [render, getDefaultRender],
  )

  if (!itemContext.fileState) return null

  const ItemPreviewPrimitive = asChild ? SlotPrimitive.Slot : 'div'

  return (
    <ItemPreviewPrimitive
      aria-labelledby={itemContext.nameId}
      data-slot='file-upload-preview'
      {...previewProps}
      className={cn(
        'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-accent/50 [&>svg]:size-6',
        className,
      )}
    >
      {onPreviewRender(itemContext.fileState.file)}
      {children}
    </ItemPreviewPrimitive>
  )
}
