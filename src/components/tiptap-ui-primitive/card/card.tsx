'use client'

import * as React from 'react'
import { cn } from '@/lib/tiptap-utils'
import '@/components/tiptap-ui-primitive/card/card.scss'

function Card({
  ref,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  ref?: React.RefObject<HTMLDivElement | null>
}) {
  return <div ref={ref} className={cn('tiptap-card', className)} {...props} />
}

Card.displayName = 'Card'

function CardHeader({
  ref,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  ref?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={ref} className={cn('tiptap-card-header', className)} {...props} />
  )
}

CardHeader.displayName = 'CardHeader'

function CardBody({
  ref,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  ref?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={ref} className={cn('tiptap-card-body', className)} {...props} />
  )
}

CardBody.displayName = 'CardBody'

function CardItemGroup({
  ref,
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical'
} & { ref?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={ref}
      data-orientation={orientation}
      className={cn('tiptap-card-item-group', className)}
      {...props}
    />
  )
}

CardItemGroup.displayName = 'CardItemGroup'

function CardGroupLabel({
  ref,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  ref?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      ref={ref}
      className={cn('tiptap-card-group-label', className)}
      {...props}
    />
  )
}

CardGroupLabel.displayName = 'CardGroupLabel'

function CardFooter({
  ref,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  ref?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={ref} className={cn('tiptap-card-footer', className)} {...props} />
  )
}

CardFooter.displayName = 'CardFooter'

export { Card, CardBody, CardFooter, CardGroupLabel, CardHeader, CardItemGroup }
