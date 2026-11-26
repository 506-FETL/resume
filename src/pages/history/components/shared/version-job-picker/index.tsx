import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import useUserStore from '@/store/user'
import {
  historyJobLabel,
  useJobSummaries,
} from '../../../hooks/use-job-summaries'
import { useJobOptions } from '../../../store/options'
import HistoryOptionPicker from '../option-picker'

export default function VersionJobPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: string | null) => void
}) {
  const data = useJobOptions()
  const selected = useJobSummaries(value)
  const owner = useUserStore((state) => state.currentUser?.id)

  return (
    <Field>
      <FieldLabel>关联岗位</FieldLabel>
      <HistoryOptionPicker
        emptyLabel='暂无可选岗位'
        label='关联岗位'
        value={value}
        data={data}
        noneLabel='不关联'
        trigger={
          value
            ? (selected.options[0]?.label ??
              (selected.loading ? '正在读取关联岗位' : '岗位信息暂不可用'))
            : '不关联'
        }
        onOpen={() => {
          if (owner) data.load(owner, 'open')
        }}
        onMore={() => {
          if (owner) data.load(owner, 'more')
        }}
        itemId={(row) => row.id}
        itemLabel={historyJobLabel}
        onChange={(id) => onChange(id || null)}
      />
      {selected.error && (
        <div role='alert' className='flex items-center gap-2'>
          <FieldDescription>{selected.error}</FieldDescription>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={selected.retry}
          >
            重试
          </Button>
        </div>
      )}
    </Field>
  )
}
