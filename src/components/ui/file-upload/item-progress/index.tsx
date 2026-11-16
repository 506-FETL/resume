'use client'

import type { FileUploadItemProgressProps } from '../types'
import { useFileUploadItemContext } from '../item-context'
import { ITEM_PROGRESS_NAME } from '../constants'
import { Slot as SlotPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export function FileUploadItemProgress(props: FileUploadItemProgressProps) {
  const {
    variant = 'linear',
    size = 40,
    asChild,
    forceMount,
    className,
    ...progressProps
  } = props

  const itemContext = useFileUploadItemContext(ITEM_PROGRESS_NAME)

  if (!itemContext.fileState) return null

  const shouldRender = forceMount || itemContext.fileState.progress !== 100

  if (!shouldRender) return null

  const ItemProgressPrimitive = asChild ? SlotPrimitive.Slot : 'div'

  switch (variant) {
    case 'circular': {
      const circumference = 2 * Math.PI * ((size - 4) / 2)

      const strokeDashoffset =
        circumference - (itemContext.fileState.progress / 100) * circumference

      return (
        <ItemProgressPrimitive
          role='progressbar'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={itemContext.fileState.progress}
          aria-valuetext={`${itemContext.fileState.progress}%`}
          aria-labelledby={itemContext.nameId}
          data-slot='file-upload-progress'
          {...progressProps}
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            className,
          )}
        >
          <svg
            className='-rotate-90 transform'
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            fill='none'
            stroke='currentColor'
          >
            <circle
              className='text-primary/20'
              strokeWidth='2'
              cx={size / 2}
              cy={size / 2}
              r={(size - 4) / 2}
            />
            <circle
              className='text-primary transition-[stroke-dashoffset] duration-300 ease-linear'
              strokeWidth='2'
              strokeLinecap='round'
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              cx={size / 2}
              cy={size / 2}
              r={(size - 4) / 2}
            />
          </svg>
        </ItemProgressPrimitive>
      )
    }

    case 'fill': {
      const progressPercentage = itemContext.fileState.progress
      const topInset = 100 - progressPercentage

      return (
        <ItemProgressPrimitive
          role='progressbar'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercentage}
          aria-valuetext={`${progressPercentage}%`}
          aria-labelledby={itemContext.nameId}
          data-slot='file-upload-progress'
          {...progressProps}
          className={cn(
            'absolute inset-0 bg-primary/50 transition-[clip-path] duration-300 ease-linear',
            className,
          )}
          style={{
            clipPath: `inset(${topInset}% 0% 0% 0%)`,
          }}
        />
      )
    }

    default:
      return (
        <ItemProgressPrimitive
          role='progressbar'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={itemContext.fileState.progress}
          aria-valuetext={`${itemContext.fileState.progress}%`}
          aria-labelledby={itemContext.nameId}
          data-slot='file-upload-progress'
          {...progressProps}
          className={cn(
            'relative h-1.5 w-full overflow-hidden rounded-full bg-muted',
            className,
          )}
        >
          <div
            className='h-full w-full flex-1 bg-primary transition-transform duration-300 ease-linear'
            style={{
              transform: `translateX(-${100 - itemContext.fileState.progress}%)`,
            }}
          />
        </ItemProgressPrimitive>
      )
  }
}
