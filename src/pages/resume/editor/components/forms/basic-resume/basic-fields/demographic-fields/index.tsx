import type { UseFormReturn } from 'react-hook-form'
import type { BasicFormInput } from '@/lib/schema'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { maritalStatusOptions, politicalStatusOptions } from '../../const'

interface DemographicFieldsProps {
  form: UseFormReturn<BasicFormInput>
}

export function DemographicFields({ form }: DemographicFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name='maritalStatus'
        render={({ field }) => (
          <FormItem>
            <FormLabel>婚姻状况</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='不填' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  {maritalStatusOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='heightCm'
        render={({ field }) => (
          <FormItem>
            <FormLabel>身高(cm)</FormLabel>
            <FormControl>
              <InputOTP
                pattern={REGEXP_ONLY_DIGITS}
                value={field.value ? String(field.value) : ''}
                onChange={(v) => {
                  field.onChange(Number(v))
                }}
                maxLength={3}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
              </InputOTP>
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name='weightKg'
        render={({ field }) => (
          <FormItem>
            <FormLabel>体重(kg)</FormLabel>
            <FormControl>
              <InputOTP
                pattern={REGEXP_ONLY_DIGITS}
                value={field.value ? String(field.value) : ''}
                onChange={(v) => {
                  field.onChange(Number(v))
                }}
                maxLength={3}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
              </InputOTP>
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='nation'
        render={({ field }) => (
          <FormItem>
            <FormLabel>民族</FormLabel>
            <FormControl>
              <Input placeholder='请输入民族' {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='nativePlace'
        render={({ field }) => (
          <FormItem>
            <FormLabel>籍贯</FormLabel>
            <FormControl>
              <Input placeholder='四川 / 江苏南京' {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='politicalStatus'
        render={({ field }) => (
          <FormItem>
            <FormLabel>政治面貌</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='共青团员' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  {politicalStatusOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
    </>
  )
}
