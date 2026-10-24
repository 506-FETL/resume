import { Coins, ExternalLink, FileText, MapPin } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import useTrackerStore from '../../store'
import { selectTrackerDrawerJob } from '../../store/selectors'

export default function DrawerMetaBar() {
  const { selectedJob } = useTrackerStore(
    useShallow((state) => ({
      selectedJob: selectTrackerDrawerJob(state),
    })),
  )

  if (!selectedJob) return null

  const items: {
    icon: typeof MapPin
    label: string
    muted?: boolean
    href?: string
  }[] = []
  if (selectedJob.location)
    items.push({ icon: MapPin, label: selectedJob.location })
  if (selectedJob.salary) items.push({ icon: Coins, label: selectedJob.salary })
  items.push({
    icon: FileText,
    label: selectedJob.resume_id ? '已绑定简历' : '未绑定简历',
    muted: !selectedJob.resume_id,
  })
  if (selectedJob.job_url) {
    items.push({
      icon: ExternalLink,
      label: '打开 JD',
      href: selectedJob.job_url,
    })
  }

  return (
    <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs'>
      {items.map((item) => {
        const Icon = item.icon
        if (item.href) {
          return (
            <a
              key={item.label}
              href={item.href}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 text-primary hover:underline'
            >
              <Icon className='size-3.5' />
              {item.label}
            </a>
          )
        }
        return (
          <span
            key={item.label}
            className={`inline-flex items-center gap-1.5 ${item.muted ? 'text-muted-foreground' : 'text-foreground/80'}`}
          >
            <Icon className='size-3.5' />
            {item.label}
          </span>
        )
      })}
    </div>
  )
}
