// 将badge修改为一个下拉选择框，可以修改对应的状态
import type { ApplicationStatus } from '../types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// 状态选项配置
const STATUS_OPTIONS: { value: ApplicationStatus, label: string }[] = [
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'screen', label: 'Screen' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
]

interface StatusSelectProps {
  value: ApplicationStatus
  onChange: (value: ApplicationStatus) => void
}

export function StatusSelect({ value, onChange }: StatusSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      {/* 触发器 选中当前值 */}
      <SelectTrigger className="w-24 md:w-28 shrink-0">
        <SelectValue placeholder="Select a status" />
      </SelectTrigger>
      {/* 下拉内容 */}
      <SelectContent>
        {STATUS_OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
