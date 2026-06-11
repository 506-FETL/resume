import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn } from 'react-hook-form'
import type { BasicFormInput } from '@/lib/schema'
import { Delete, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useIsMobile } from '@/hooks/use-mobile'

interface CustomFieldsProps {
  form: UseFormReturn<BasicFormInput>
  fields: FieldArrayWithId<BasicFormInput, 'customFields'>[]
  append: UseFieldArrayAppend<BasicFormInput, 'customFields'>
  remove: UseFieldArrayRemove
}

export function CustomFields({ form, fields, append, remove }: CustomFieldsProps) {
  const isMobile = useIsMobile()

  function onAddField() {
    append({ label: '', value: '' })
  }

  return (
    <>
      <Button type="button" variant="outline" size={isMobile ? 'icon' : 'sm'} onClick={onAddField} className="mt-6">
        <Plus />
        {!isMobile && '添加自定义字段'}
      </Button>
      <div className="mt-6 grid gap-4 justify-items-start sm:grid-cols-2 md:grid-cols-3">
        {fields.map((item, index) => (
          <motion.div key={item.id} transition={{ duration: 0.2 }} className="flex gap-2 items-end" layout>
            <FormField
              control={form.control}
              name={`customFields.${index}.label`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标签</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="标签" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`customFields.${index}.value`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>值</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="值" />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="button" variant="destructive" size={isMobile ? 'icon' : 'sm'} onClick={() => remove(index)}>
              <Delete />
              {!isMobile && '删除'}
            </Button>
          </motion.div>
        ))}
      </div>
    </>
  )
}
