'use client'

import type * as LabelPrimitive from '@radix-ui/react-label'
import type { ControllerProps, FieldPath, FieldValues } from 'react-hook-form'
import { Slot } from '@radix-ui/react-slot'
import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import * as React from 'react'
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
} from 'react-hook-form'

import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const Form = FormProvider

export interface FormFeedback {
  severity: 'error' | 'warning' | 'suggestion'
  message: string
}

const FormFeedbackContext = React.createContext<Record<string, FormFeedback>>(
  {},
)

const FormFeedbackProvider = FormFeedbackContext.Provider

const FEEDBACK_STYLES = {
  error: { icon: CircleAlert, color: 'text-red-700 dark:text-red-300' },
  warning: { icon: TriangleAlert, color: 'text-amber-700 dark:text-amber-300' },
  suggestion: { icon: Info, color: 'text-blue-700 dark:text-blue-300' },
}

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
)

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext>
  )
}

function useFormField() {
  const fieldContext = React.use(FormFieldContext)
  const itemContext = React.use(FormItemContext)
  const feedback = React.use(FormFeedbackContext)[fieldContext.name]
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>')
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    formFeedbackId: `${id}-form-item-feedback`,
    feedback,
    ...fieldState,
  }
}

interface FormItemContextValue {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
)

function FormItem({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  const id = React.useId()
  const field = React.use(FormFieldContext)
  const feedback = React.use(FormFeedbackContext)[field.name]

  return (
    <FormItemContext value={{ id }}>
      <div
        data-slot='form-item'
        data-form-field={field.name}
        data-feedback={feedback?.severity}
        role={feedback ? 'group' : undefined}
        aria-describedby={feedback ? `${id}-form-item-feedback` : undefined}
        className={cn('grid gap-2', className)}
        {...props}
      >
        {children}
        {feedback && (
          <span id={`${id}-form-item-feedback`} className='sr-only'>
            {feedback.message}
          </span>
        )}
      </div>
    </FormItemContext>
  )
}

function FormLabel({
  className,
  children,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const { error, formItemId, feedback } = useFormField()
  const style = feedback ? FEEDBACK_STYLES[feedback.severity] : null
  const Icon = style?.icon

  return (
    <Label
      data-slot='form-label'
      data-error={!!error}
      className={cn(
        'data-[error=true]:text-destructive',
        style?.color,
        className,
      )}
      htmlFor={formItemId}
      {...props}
    >
      {children}
      {Icon && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              role='img'
              aria-label={feedback?.message}
              className='inline-flex shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
            >
              <Icon className='size-3.5' aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent className='max-w-64'>
            {feedback?.message}
          </TooltipContent>
        </Tooltip>
      )}
    </Label>
  )
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const {
    error,
    formItemId,
    formDescriptionId,
    formMessageId,
    formFeedbackId,
    feedback,
  } = useFormField()

  return (
    <Slot
      data-slot='form-control'
      id={formItemId}
      aria-describedby={[
        formDescriptionId,
        error && formMessageId,
        feedback && formFeedbackId,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-invalid={!!error}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot='form-description'
      id={formDescriptionId}
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? '') : props.children

  if (!body) {
    return null
  }

  return (
    <p
      data-slot='form-message'
      id={formMessageId}
      className={cn('text-destructive text-sm', className)}
      {...props}
    >
      {body}
    </p>
  )
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormFeedbackProvider,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
}
