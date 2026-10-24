import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { ChangelogEntry } from './components/changelog-entry'
import { loadChangelogEntries } from './utils'

const entries = loadChangelogEntries()

export default function ChangelogPage() {
  return (
    <PageLayout className='max-w-5xl'>
      <PageHeader
        title='更新日志'
        description='查看 GResume 的功能更新与体验改进。'
      />
      <div className='pt-2'>
        <div className='relative'>
          {entries.map((entry) => (
            <ChangelogEntry key={entry.frontmatter.date} entry={entry} />
          ))}
        </div>
      </div>
    </PageLayout>
  )
}
