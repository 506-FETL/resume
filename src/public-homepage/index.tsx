import type { CSSProperties } from 'react'
import { ArrowUp, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DURATION, EASE } from '@/lib/motion'
import { WORKSPACE_PATH } from '@/lib/workspace-path'
import ClosingDesk from './components/closing-desk'
import { CoverPaperclip, PaperMark } from './components/cover-marks'
import FeatureGuide from './components/feature-guide'
import VersionDemo from './components/version-demo'
import { useDeskMotion } from './hooks/use-desk-motion'
import { useHomeReading } from './hooks/use-home-reading'
import './homepage.css'

const coverTitle = '简历工作台'

const timing = {
  '--fast': `${DURATION.fast}s`,
  '--base': `${DURATION.base}s`,
  '--slow': `${DURATION.slow}s`,
  '--ease': `cubic-bezier(${EASE.out.join(',')})`,
} as CSSProperties

function WorkspaceLink({ compact = false }: { compact?: boolean }) {
  return (
    <Button asChild className={compact ? 'home-nav-entry' : 'home-entry'}>
      <a href={WORKSPACE_PATH}>
        进入工作台 <ArrowUpRight aria-hidden size={19} />
      </a>
    </Button>
  )
}

export default function PublicHomepage() {
  const hero = useDeskMotion()
  const { role, selectRole } = useHomeReading()

  return (
    <div className='public-home' id='top' style={timing} tabIndex={-1}>
      <a href='#main' className='home-skip'>
        跳到正文
      </a>
      <header className='home-mast'>
        <div className='home-width'>
          <a className='home-brand' href='#top' aria-label='GResume 首页'>
            <PaperMark /> GResume
          </a>
          <nav aria-label='首页导航'>
            <WorkspaceLink compact />
          </nav>
        </div>
      </header>
      <main id='main' tabIndex={-1}>
        <div className='cover-runway'>
          <section
            className='home-hero'
            aria-labelledby='home-title'
            ref={hero}
          >
            <div className='cover-spine' aria-hidden='true'>
              <i />
              <i />
            </div>
            <div className='cover-grain' aria-hidden='true' />
            <div className='cover-layout home-width'>
              <div className='cover-mastline'>
                <h1 id='home-title' aria-label={coverTitle}>
                  {Array.from(coverTitle, (letter) => (
                    <span
                      className='cover-letter'
                      key={letter}
                      aria-hidden='true'
                    >
                      {letter}
                    </span>
                  ))}
                </h1>
                <CoverPaperclip />
              </div>
              <div className='home-intro'>
                <p className='cover-lead'>
                  <span>选模板写简历 ·&nbsp;</span>
                  <span>按岗位各存一版</span>
                </p>
                <p className='cover-description'>
                  AI 可以帮你改写项目经历
                  <br />
                  投了哪家、哪天面试，也能记下来
                </p>
                <div className='home-actions'>
                  <WorkspaceLink />
                </div>
              </div>
              <div className='cover-object'>
                <VersionDemo role={role} onRoleChange={selectRole} />
              </div>
            </div>
          </section>
        </div>
        <FeatureGuide role={role} />
      </main>
      <footer
        id='after-guide'
        className='home-foot'
        aria-labelledby='end-title'
        tabIndex={-1}
      >
        <div className='end-layout home-width'>
          <div className='end-copy'>
            <h2 id='end-title'>
              写<span>自己</span>的简历
            </h2>
            <p>
              第一次写，可以挑一份示例
              <br />
              旧稿也能导入，PDF、DOCX 都行
            </p>
            <div className='home-actions'>
              <WorkspaceLink />
            </div>
          </div>
          <ClosingDesk role={role} />
        </div>
        <div className='end-colophon home-width'>
          <span className='end-brand'>
            <PaperMark /> GResume
          </span>
          <a href='#top'>
            回到封面 <ArrowUp size={15} aria-hidden />
          </a>
        </div>
      </footer>
    </div>
  )
}
