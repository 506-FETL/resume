import type { FieldRendererProps } from './types'
import { isEmptyValue } from '@/pages/optimize/utils'
import { ObjectValue } from './object-value'
import { EmptyValue } from './types'

export function ObjectArrayValue({ value, variant }: FieldRendererProps<Array<Record<string, unknown>>>) {
  if (isEmptyValue(value))
    return <EmptyValue />

  return (
    <div className="flex flex-col gap-2">
      {value.map(item => (
        <ObjectValue key={`obj-${JSON.stringify(item)}`} value={item} variant={variant} />
      ))}
    </div>
  )
}
