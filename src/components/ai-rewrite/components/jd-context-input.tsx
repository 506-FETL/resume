import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { JD_MIN_CHARS } from '../const'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function JdContextInput({ value, onChange }: Props) {
  const len = value.trim().length
  const valid = len >= JD_MIN_CHARS
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">岗位描述（JD）</Label>
        <span className={valid ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
          {`${len} / 至少 ${JD_MIN_CHARS}`}
        </span>
      </div>
      <Textarea
        value={value}
        placeholder="粘贴岗位 JD，AI 将向其关键词靠拢"
        aria-invalid={!valid}
        onChange={e => onChange(e.target.value)}
        className="max-h-40 min-h-20 text-sm"
      />
    </div>
  )
}
