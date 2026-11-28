import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { ChangelogEntry } from './components/changelog-entry'
import { useReadChangelog } from './hooks/use-read-changelog'
import { changelogEntries } from './store'

export default function ChangelogPage() {
  useReadChangelog()

  return (
    <PageLayout>
      <PageHeader title='更新日志' />
      <div className='relative'>
        {changelogEntries.map((entry) => (
          <ChangelogEntry key={entry.frontmatter.date} entry={entry} />
        ))}
      </div>
    </PageLayout>
  )
}
