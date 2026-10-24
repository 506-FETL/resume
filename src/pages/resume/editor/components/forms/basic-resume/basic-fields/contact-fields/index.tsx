import type { UseFormReturn } from 'react-hook-form'
import type { BasicFormInput } from '@/lib/schema'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

interface ContactFieldsProps {
  form: UseFormReturn<BasicFormInput>
}

export function ContactFields({ form }: ContactFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name='phone'
        render={({ field }) => (
          <FormItem>
            <FormLabel>联系方式</FormLabel>
            <FormControl>
              <Input placeholder='手机号' {...field} />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name='email'
        render={({ field }) => (
          <FormItem>
            <FormLabel>联系邮箱</FormLabel>
            <FormControl>
              <Input placeholder='you@example.com' {...field} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  )
}
