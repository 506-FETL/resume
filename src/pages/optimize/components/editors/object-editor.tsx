import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FIELD_LABEL_MAP } from '../../const'

function ObjectEditor({ value, onChange }: {
  value: Record<string, unknown>
  onChange: (val: Record<string, unknown>) => void
}) {
  const entries = Object.entries(value).filter(([k]) => !k.startsWith('_'))

  return (
    <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
      {entries.map(([key, val]) => (
        <div key={key} className="space-y-1">
          <label className="text-xs text-muted-foreground">
            {FIELD_LABEL_MAP[key] || key}
          </label>
          {typeof val === 'string' && val.length > 50
            ? (
                <Textarea
                  value={String(val)}
                  onChange={e => onChange({ ...value, [key]: e.target.value })}
                  className="min-h-16 resize-none"
                />
              )
            : (
                <Input
                  value={String(val || '')}
                  onChange={e => onChange({ ...value, [key]: e.target.value })}
                  className="h-9"
                />
              )}
        </div>
      ))}
    </div>
  )
}

export default ObjectEditor
