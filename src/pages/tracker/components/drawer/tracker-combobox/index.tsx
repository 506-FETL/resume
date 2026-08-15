import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'

export function TrackerCombobox({
  id,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string
  value: string
  options: string[]
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <Combobox
      items={options}
      value={value || null}
      inputValue={value}
      onInputValueChange={onChange}
      onValueChange={nextValue => onChange(nextValue ?? '')}
    >
      <ComboboxInput id={id} placeholder={placeholder} showClear />
      <ComboboxContent>
        <ComboboxEmpty>没有匹配项，可直接使用当前输入</ComboboxEmpty>
        <ComboboxList>
          {(option: string) => (
            <ComboboxItem key={option} value={option}>
              {option}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
