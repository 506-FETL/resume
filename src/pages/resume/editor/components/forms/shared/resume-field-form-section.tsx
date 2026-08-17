import type { ReactNode } from 'react'
import type { FieldArrayWithId, FieldValues, UseFormReturn } from 'react-hook-form'
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface ResumeFieldFormSectionProps<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>
  fields: FieldArrayWithId<TFieldValues>[]
  remove: (index: number) => void
  onAddItem: () => void
  /** 传入则渲染「上移/下移」按钮以调整多项顺序（复用 useFieldArray 的 move） */
  move?: (from: number, to: number) => void
  formId: string
  title: string
  addLabel: string
  className?: string
  renderItem: (index: number, field: FieldArrayWithId<TFieldValues>) => ReactNode
}

export function ResumeFieldFormSection<TFieldValues extends FieldValues>({
  form,
  fields,
  remove,
  onAddItem,
  move,
  formId,
  title,
  addLabel,
  className,
  renderItem,
}: ResumeFieldFormSectionProps<TFieldValues>) {
  const isMobile = useIsMobile()
  const multiple = fields.length > 1

  return (
    <Form {...form}>
      <form id={formId} className={cn('flex flex-col gap-6', className)}>
        {fields.map((item, index) => {
          const hidden = form.watch(`items.${index}.hidden` as any)
          return (
            <motion.div key={item.id} layout>
              {index > 0 && <Separator className="my-6" />}

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className={cn('text-sm font-medium text-muted-foreground', hidden && 'opacity-50')}>
                    {title}
                    {multiple ? `#${index + 1}` : ''}
                  </h3>
                  <div className="flex items-center gap-0.5">
                    {multiple && move && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={index === 0}
                              onClick={() => move(index, index - 1)}
                              aria-label={`上移${title}#${index + 1}`}
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>上移</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={index === fields.length - 1}
                              onClick={() => move(index, index + 1)}
                              aria-label={`下移${title}#${index + 1}`}
                            >
                              <ArrowDown className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>下移</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            form.setValue(`items.${index}.hidden` as any, !hidden as any, { shouldDirty: true })
                          }}
                          aria-label={`${hidden ? '显示' : '隐藏'}${title}${multiple ? `#${index + 1}` : ''}`}
                        >
                          {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{hidden ? '显示此项' : '隐藏此项（内容保留）'}</TooltipContent>
                    </Tooltip>
                    {multiple && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="h-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        {!isMobile && <span className="ml-1">删除</span>}
                      </Button>
                    )}
                  </div>
                </div>

                <div className={cn(hidden && 'opacity-50')}>
                  {renderItem(index, item)}
                </div>
              </div>
            </motion.div>
          )
        })}

        <Button
          type="button"
          variant="outline"
          size={isMobile ? 'sm' : 'default'}
          onClick={onAddItem}
          className="w-full sm:w-auto"
        >
          <Plus className="size-4" />
          {!isMobile && <span className="ml-2">{addLabel}</span>}
        </Button>
      </form>
    </Form>
  )
}
