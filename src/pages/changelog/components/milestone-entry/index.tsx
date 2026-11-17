import type { MDXComponents } from 'mdx/types'
import type { ChangelogEntry } from '../../types'
import { ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useReleaseMotion } from '../../hooks/use-release-motion'
import { ReleaseCover } from '../release-cover'
import { ReleaseFeature, ReleaseFeatures } from '../release-feature'

const components: MDXComponents = { ReleaseFeature, ReleaseFeatures }

export function MilestoneEntry({ entry }: { entry: ChangelogEntry }) {
  const { frontmatter, Content } = entry
  const entrance = useReleaseMotion()

  return (
    <>
      <article
        className='release-story'
        aria-labelledby={`release-${frontmatter.version}`}
      >
        <ReleaseCover release={frontmatter} />

        <div className='release-body'>
          <div className='release-body-heading'>
            <p>这一版，能为你做些什么</p>
            <span>从准备到投递</span>
          </div>
          <Content components={components} />
        </div>

        <motion.footer className='release-closing' {...entrance}>
          <p>谢谢你，陪 GResume 写到 1.0。</p>
          <span>感谢每一次试用、反馈和建议。欢迎从今天的这份简历继续。</span>
          <Button asChild variant='outline'>
            <Link to='/resume'>
              打开我的简历
              <ArrowRight aria-hidden='true' />
            </Link>
          </Button>
        </motion.footer>
      </article>
      <div className='mb-8 flex items-center gap-4'>
        <h2 className='shrink-0 text-sm font-medium text-muted-foreground'>
          此前的更新
        </h2>
        <div className='h-px flex-1 bg-border' />
      </div>
    </>
  )
}
