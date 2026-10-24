import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  icon?: LucideIcon
}

export default function MetricCard({
  label,
  value,
  icon: Icon,
}: MetricCardProps) {
  return (
    <div className='min-w-0 py-2'>
      <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
        {Icon && <Icon className='size-3.5 shrink-0' />}
        <span>{label}</span>
      </div>
      <div className='mt-2 break-words text-sm font-medium'>{value}</div>
    </div>
  )
}
