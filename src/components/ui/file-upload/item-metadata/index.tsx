'use client'

import type { FileUploadItemMetadataProps } from '../types'
import { useFileUploadContext } from '../upload-context'
import { ITEM_METADATA_NAME } from '../constants'
import { useFileUploadItemContext } from '../item-context'
import { Slot as SlotPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { formatBytes } from '../utils'

export function FileUploadItemMetadata(props: FileUploadItemMetadataProps) {
  const {
    asChild,
    size = 'default',
    children,
    className,
    ...metadataProps
  } = props

  const context = useFileUploadContext(ITEM_METADATA_NAME)
  const itemContext = useFileUploadItemContext(ITEM_METADATA_NAME)

  if (!itemContext.fileState) return null

  const ItemMetadataPrimitive = asChild ? SlotPrimitive.Slot : 'div'

  return (
    <ItemMetadataPrimitive
      data-slot='file-upload-metadata'
      dir={context.dir}
      {...metadataProps}
      className={cn('flex min-w-0 flex-1 flex-col', className)}
    >
      {children ?? (
        <>
          <span
            id={itemContext.nameId}
            className={cn(
              'truncate text-sm font-medium',
              size === 'sm' && 'text-[13px] leading-snug font-normal',
            )}
          >
            {itemContext.fileState.file.name}
          </span>
          <span
            id={itemContext.sizeId}
            className={cn(
              'truncate text-xs text-muted-foreground',
              size === 'sm' && 'text-[11px] leading-snug',
            )}
          >
            {formatBytes(itemContext.fileState.file.size)}
          </span>
          {itemContext.fileState.error && (
            <span
              id={itemContext.messageId}
              className='text-xs text-destructive'
            >
              {itemContext.fileState.error}
            </span>
          )}
        </>
      )}
    </ItemMetadataPrimitive>
  )
}
