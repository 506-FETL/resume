import type { CSSProperties } from 'react'
import type { DemoRole } from './story-example'
import { chapters, totalBeats } from './chapters'
import { InkPath } from './ink-path'
import StoryArt from './story-art'
import { storyExamples } from './story-example'
import { useChapterFocus } from './use-chapter-focus'
import { useStoryScroll } from './use-story-scroll'
import './style.css'

type ChapterId = (typeof chapters)[number]['id']

function PencilArrow() {
  return (
    <svg className='story-leader' aria-hidden='true' viewBox='0 0 115 52'>
      <InkPath data-arrow-shaft='' d='M4 45C35 48 47 33 57 23S83 5 107 7' />
      <InkPath data-arrow-head='' d='m96 3 12 4-8 9' />
    </svg>
  )
}

function HandUnderline() {
  return (
    <svg
      className='story-underline'
      aria-hidden='true'
      viewBox='0 0 100 8'
      preserveAspectRatio='none'
    >
      <InkPath d='M1 5Q24 2 54 4T99 3' />
    </svg>
  )
}

function ChapterMaterial({ id, role }: { id: ChapterId; role: DemoRole }) {
  const example = storyExamples[role]

  switch (id) {
    case 'templates':
      return (
        <div className='story-material story-checklist'>
          <PencilArrow />
          <h3>
            简历模板
            <HandUnderline />
          </h3>
          <ul>
            {['选一份模板', '放上项目经历'].map((item) => (
              <li key={item}>
                <svg
                  viewBox='0 0 18 18'
                  aria-hidden='true'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <InkPath data-template-check='' d='m3 9 4 4 8-10' />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'review':
      return (
        <div className='story-material story-clipping'>
          <PencilArrow />
          <div className='story-clipping-sides'>
            <div data-note-side='job'>
              <h3>看看这个岗位要什么</h3>
              <strong>{example.job}</strong>
              <blockquote>“{example.requirement}”</blockquote>
              <dl className='story-match'>
                <div>
                  <dt>已经写了</dt>
                  <dd>{example.covered}</dd>
                </div>
                <div>
                  <dt>还没写</dt>
                  <dd>{example.missing}</dd>
                </div>
              </dl>
            </div>
            <div data-note-side='report'>
              <h3>检查建议</h3>
              <strong>这段再写具体一点</strong>
              <dl className='story-findings'>
                <div>
                  <dt>你做了哪部分</dt>
                  <dd>只写「参与项目」，看不出你的分工。</dd>
                </div>
                <div>
                  <dt>具体怎么做的</dt>
                  <dd>{example.finding}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )
    case 'assistant':
      return (
        <div className='story-material story-margin-note story-request'>
          <h3>让助手帮忙改</h3>
          <p>“先存下现在这份，再按下面的笔记，帮我改一下项目经历。”</p>
          <div className='story-source-note'>
            <strong>我当时做的事</strong>
            <p>{example.brief}</p>
          </div>
        </div>
      )
    case 'collaboration':
      return null
    case 'history':
      return (
        <div className='story-material story-margin-note'>
          <h3>看看改之前的样子</h3>
          <p>哪句改过、哪天补了日期，都能对照着看。想用原来的，也可以恢复。</p>
        </div>
      )
    case 'sharing':
      return (
        <dl className='story-material story-pair'>
          <div>
            <dt>
              发给朋友看看
              <HandUnderline />
            </dt>
            <dd>
              阿禾能在原句旁留言。你保存修改后，她打开链接就能看到新内容。
            </dd>
          </div>
          <div>
            <dt>
              发给招聘方
              <HandUnderline />
            </dt>
            <dd>
              选好要发的版本。以后再修改，招聘方看到的还是发出时的那份。也能下载
              PDF 或 Word。
            </dd>
          </div>
        </dl>
      )
    case 'followup':
      return (
        <div className='story-material story-margin-note'>
          <h3>11 月 7 日，约好面试</h3>
          <p>
            “这个岗位约了 11 号下午两点面试，帮我改成面试中，把时间也记上。”
          </p>
        </div>
      )
    case 'delivery':
      return (
        <div className='story-material story-log'>
          <h3>投过的，记下来</h3>
          <dl>
            <div>
              <dt>岗位</dt>
              <dd>{example.job}</dd>
            </div>
            <div>
              <dt>哪天投的</dt>
              <dd>
                <time dateTime='2026-11-04'>11 月 4 日</time>
              </dd>
            </div>
            <div>
              <dt>现在进展</dt>
              <dd>已投递</dd>
            </div>
          </dl>
        </div>
      )
  }
}

export default function FeatureGuide({ role }: { role: DemoRole }) {
  const { trackRef, step } = useStoryScroll(role)

  useChapterFocus(step)

  const example = storyExamples[role]

  const descriptions: Record<ChapterId, string> = {
    templates: `柳如烟选好模板，把「${example.project.name}」放在技能前面，准备投${example.job}。`,
    review: `这个岗位要求「${example.missing}」，简历里还没写清楚。先看看招聘系统读到了什么，再按建议修改。柳如烟补上「${example.responsibility}」，清单勾掉第一项，第二项留给助手接着改。`,
    assistant: `助手先看简历和检查建议。柳如烟同意保存修改前的版本，再看助手准备怎么改。确认后，助手把这两句写进简历：${example.lines.join('')}写完后，原清单的第二项也打上勾，两项都完成后再进入下一幕。`,
    collaboration: `柳如烟把第二句改成：${example.jointLine}阿禾同时补上项目时间：${example.project.period}。`,
    history:
      '切到修改前，能看到原来的句子；再切回来，两人刚写的描述和日期都还在。想用原来的版本，也可以恢复。',
    sharing:
      '发给朋友的链接能看到最新保存的内容。发给招聘方的那份会保留下来，之后再改简历也不会改变它。还可以下载 PDF 或 Word。',
    delivery: `11 月 4 日投出简历后，柳如烟在${example.job}这条记录里，记下投递日期和发出去的那份简历。`,
    followup:
      '11 月 7 日收到面试消息。柳如烟确认后，助手把状态改成面试中，记下 11 月 11 日下午两点的面试。',
  }

  return (
    <section
      ref={trackRef}
      id='guide'
      className='story-track'
      style={{ '--beats': totalBeats } as CSSProperties}
      data-step={chapters[step].id}
      aria-label='柳如烟的简历'
      tabIndex={-1}
    >
      {chapters.map((chapter) => (
        <span
          key={chapter.id}
          id={chapter.id}
          className='story-anchor'
          style={{ '--pose': chapter.anchor } as CSSProperties}
          aria-hidden='true'
        />
      ))}
      <ol
        className='story-sr'
        aria-label={`${example.version}简历的制作与投递过程`}
      >
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <strong>{chapter.title}：</strong>
            {descriptions[chapter.id]}
          </li>
        ))}
      </ol>
      <div className='story-frame'>
        <a className='home-skip' href='#after-guide'>
          跳过演示
        </a>
        <div className='story-spread'>
          <div className='story-body'>
            <figure className='story-drawing' aria-hidden='true'>
              <StoryArt role={role} />
            </figure>
            <div className='story-captions'>
              {chapters.map((chapter, i) => (
                <article
                  key={chapter.id}
                  className='story-caption'
                  data-active={step === i}
                  inert={step !== i}
                  aria-hidden={step !== i}
                  aria-labelledby={`story-heading-${chapter.id}`}
                >
                  <header className='story-heading'>
                    <span aria-hidden='true' className='story-page-no'>
                      0{i + 1}
                    </span>
                    <h2 id={`story-heading-${chapter.id}`} tabIndex={-1}>
                      {chapter.title}
                    </h2>
                  </header>
                  <ChapterMaterial id={chapter.id} role={role} />
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
