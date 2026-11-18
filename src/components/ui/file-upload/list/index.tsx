'use client'

import type { FileUploadListProps } from '../types'
import { useFileUploadContext } from '../upload-context'
import { LIST_NAME } from '../constants'
import { useStore } from '../store-context'
import * as SlotPrimitive from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export function FileUploadList(props: FileUploadListProps) {
  const {
    className,
    orientation = 'vertical',
    asChild,
    forceMount,
    ...listProps
  } = props

  const context = useFileUploadContext(LIST_NAME)
  const fileCount = useStore((state) => state.files.size)
  const shouldRender = forceMount || fileCount > 0

  if (!shouldRender) return null

  const ListPrimitive = asChild ? SlotPrimitive.Slot : 'div'

  return (
    <ListPrimitive
      role='list'
      id={context.listId}
      aria-orientation={orientation}
      data-orientation={orientation}
      data-slot='file-upload-list'
      data-state={shouldRender ? 'active' : 'inactive'}
      dir={context.dir}
      {...listProps}
      className={cn(
        'flex flex-col gap-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-top-2 data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=inactive]:slide-out-to-top-2',
        orientation === 'horizontal' && 'flex-row overflow-x-auto p-1.5',
        className,
      )}
    />
  )
}
