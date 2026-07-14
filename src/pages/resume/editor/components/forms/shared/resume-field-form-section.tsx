import type { ReactNode } from 'react'
import type { FieldArrayWithId, FieldValues, UseFormReturn } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface ResumeFieldFormSectionProps<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>
  fields: FieldArrayWithId<TFieldValues>[]
  remove: (index: number) => void
  onAddItem: () => void
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
  formId,
  title,
  addLabel,
  className,
  renderItem,
}: ResumeFieldFormSectionProps<TFieldValues>) {
  const isMobile = useIsMobile()

  return (
    <Form {...form}>
      <form id={formId} className={cn('flex flex-col gap-6', className)}>
        {fields.map((item, index) => (
          <motion.div key={item.id} layout>
            {index > 0 && <Separator className="my-6" />}

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {title}
                  {fields.length > 1 ? `#${index + 1}` : ''}
                </h3>
                {fields.length > 1 && (
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

              {renderItem(index, item)}
            </div>
          </motion.div>
        ))}

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
