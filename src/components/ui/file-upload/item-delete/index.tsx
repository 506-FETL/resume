'use client'

import type { FileUploadItemDeleteProps } from '../types'
import { useStoreContext } from '../store-context'
import { ITEM_DELETE_NAME } from '../constants'
import { useFileUploadItemContext } from '../item-context'
import * as React from 'react'
import { Slot as SlotPrimitive } from 'radix-ui'

export function FileUploadItemDelete(props: FileUploadItemDeleteProps) {
  const { asChild, onClick: onClickProp, ...deleteProps } = props

  const store = useStoreContext(ITEM_DELETE_NAME)
  const itemContext = useFileUploadItemContext(ITEM_DELETE_NAME)

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event)

      if (!itemContext.fileState || event.defaultPrevented) return

      store.dispatch({
        type: 'REMOVE_FILE',
        file: itemContext.fileState.file,
      })
    },
    [store, itemContext.fileState, onClickProp],
  )

  if (!itemContext.fileState) return null

  const ItemDeletePrimitive = asChild ? SlotPrimitive.Slot : 'button'

  return (
    <ItemDeletePrimitive
      type='button'
      aria-controls={itemContext.id}
      aria-describedby={itemContext.nameId}
      data-slot='file-upload-item-delete'
      {...deleteProps}
      onClick={onClick}
    />
  )
}
