import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { ChangelogEntry } from './components/changelog-entry'
import { useReadChangelog } from './hooks/use-read-changelog'
import { changelogEntries } from './store'

export default function ChangelogPage() {
  useReadChangelog()

  return (
    <PageLayout className='max-w-5xl'>
      <PageHeader
        title='更新日志'
        description='查看 GResume 的功能更新与体验改进。'
      />
      <div className='pt-2'>
        <div className='relative'>
          {changelogEntries.map((entry) => (
            <ChangelogEntry key={entry.frontmatter.date} entry={entry} />
          ))}
        </div>
      </div>
    </PageLayout>
  )
}
