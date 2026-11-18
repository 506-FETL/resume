'use client'

import type { FileUploadTriggerProps } from '../types'
import { useFileUploadContext } from '../upload-context'
import { TRIGGER_NAME } from '../constants'
import { useValueAsRef } from '@/hooks/use-value-as-ref'
import * as React from 'react'
import * as SlotPrimitive from '@radix-ui/react-slot'

export function FileUploadTrigger(props: FileUploadTriggerProps) {
  const { asChild, onClick: onClickProp, ...triggerProps } = props

  const context = useFileUploadContext(TRIGGER_NAME)

  const propsRef = useValueAsRef({
    onClick: onClickProp,
  })

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      propsRef.current.onClick?.(event)

      if (event.defaultPrevented) return

      context.inputRef.current?.click()
    },
    [context.inputRef, propsRef],
  )

  const TriggerPrimitive = asChild ? SlotPrimitive.Slot : 'button'

  return (
    <TriggerPrimitive
      type='button'
      aria-controls={context.inputId}
      data-disabled={context.disabled ? '' : undefined}
      data-slot='file-upload-trigger'
      {...triggerProps}
      disabled={context.disabled}
      onClick={onClick}
    />
  )
}
