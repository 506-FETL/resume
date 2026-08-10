import type { UseFormReturn } from 'react-hook-form'
import type { BasicFormInput } from '@/lib/schema'
import { Cake } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { MonthPicker } from '@/components/ui/month-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { genderOptions, workYearsOptions } from '../../const'

interface PersonalFieldsProps {
  form: UseFormReturn<BasicFormInput>
}

export function PersonalFields({ form }: PersonalFieldsProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>您的姓名</FormLabel>
            <FormControl>
              <Input placeholder="输入您的姓名" {...field} />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="gender"
        render={({ field }) => (
          <FormItem>
            <FormLabel>性别</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="请选择性别" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  {genderOptions.map(o => (
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
        name="birthMonth"
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>出生年月</FormLabel>
              <FormControl>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" id="date">
                      {field.value ? field.value : '选择年月'}
                      <Cake />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <MonthPicker
                      value={field.value}
                      disableFuture
                      onChange={(next) => {
                        field.onChange(next)
                        setOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </FormControl>
            </FormItem>
          )
        }}
      />
      <FormField
        control={form.control}
        name="workYears"
        render={({ field }) => (
          <FormItem>
            <FormLabel>工作年限</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="不填" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  {workYearsOptions.map(o => (
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
