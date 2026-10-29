import type {
  FieldArrayWithId,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormReturn,
} from 'react-hook-form'
import type { BasicFormInput } from '@/lib/schema'
import { Delete, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { ResumeFieldExitSnapshot } from '../../../shared/resume-field-exit-snapshot'
import { focusBeforeFieldRemoval } from '../../../shared/focus-before-field-removal'

interface CustomFieldsProps {
  form: UseFormReturn<BasicFormInput>
  fields: FieldArrayWithId<BasicFormInput, 'customFields'>[]
  append: UseFieldArrayAppend<BasicFormInput, 'customFields'>
  remove: UseFieldArrayRemove
}

export function CustomFields({
  form,
  fields,
  append,
  remove,
}: CustomFieldsProps) {
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()

  function onAddField() {
    append({ label: '', value: '' })
  }

  return (
    <>
      <motion.div
        layout={reduceMotion ? false : 'position'}
        layoutDependency={fields.length}
        transition={{ layout: reduceMotion ? { duration: 0 } : SPRING.layout }}
        className='inline-flex'
      >
        <Button
          type='button'
          variant='outline'
          size={isMobile ? 'icon' : 'sm'}
          onClick={onAddField}
          data-resume-field-add
          aria-label='添加自定义字段'
          className='mt-6'
        >
          <Plus />
          {!isMobile && '添加自定义字段'}
        </Button>
      </motion.div>
      <div className='mt-6 flex min-w-0 flex-col gap-4'>
        <AnimatePresence initial={false} mode='popLayout'>
          {fields.map((item, index) => (
            <PresenceDiv
              key={item.id}
              data-resume-field-row
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: reduceMotion ? 0 : -4,
                transition: {
                  duration: reduceMotion ? 0 : DURATION.fast,
                  ease: EASE.in,
                },
              }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
                layout: reduceMotion ? { duration: 0 } : SPRING.layout,
              }}
              className='grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] items-end gap-3'
              layout={reduceMotion ? false : 'position'}
            >
              <ResumeFieldExitSnapshot>
                <FormField
                  control={form.control}
                  name={`customFields.${index}.label`}
                  render={({ field }) => (
                    <FormItem className='min-w-0'>
                      <FormLabel>标签</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='标签' />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`customFields.${index}.value`}
                  render={({ field }) => (
                    <FormItem className='min-w-0'>
                      <FormLabel>值</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='值' />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  type='button'
                  variant='destructive'
                  size='icon'
                  aria-label={`删除自定义字段 ${index + 1}`}
                  data-resume-field-remove
                  onClick={(event) => {
                    focusBeforeFieldRemoval(event.currentTarget)
                    remove(index)
                  }}
                >
                  <Delete />
                </Button>
              </ResumeFieldExitSnapshot>
            </PresenceDiv>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
