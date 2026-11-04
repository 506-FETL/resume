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
            排版清单
            <HandUnderline />
          </h3>
          <ul>
            {['选单栏模板', '项目经历放前面', '预览分页，导出 PDF 或 Word'].map(
              (item) => (
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
              ),
            )}
          </ul>
        </div>
      )
    case 'review':
      return (
        <div className='story-material story-clipping'>
          <PencilArrow />
          <div className='story-clipping-sides'>
            <div data-note-side='job'>
              <h3>职位描述比对</h3>
              <strong>{example.job}</strong>
              <blockquote>“{example.requirement}”</blockquote>
              <dl className='story-match'>
                <div>
                  <dt>已覆盖</dt>
                  <dd>{example.covered}</dd>
                </div>
                <div>
                  <dt>待补</dt>
                  <dd>{example.missing}</dd>
                </div>
              </dl>
            </div>
            <div data-note-side='report'>
              <h3>五维检测 / 项目经历</h3>
              <strong>先改这两处</strong>
              <dl className='story-findings'>
                <div>
                  <dt>内容充分度</dt>
                  <dd>原文只说参与了项目，哪一块是你负责的？</dd>
                </div>
                <div>
                  <dt>成果与证据强度</dt>
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
          <h3>柳如烟给助手的留言</h3>
          <p>
            “先存一份底稿，再照这条笔记改一下「{example.project.name}」那段。”
          </p>
          <div className='story-source-note'>
            <strong>项目笔记</strong>
            <p>{example.brief}</p>
          </div>
        </div>
      )
    case 'collaboration':
      return null
    case 'history':
      return (
        <div className='story-material story-margin-note'>
          <h3>早上的底稿还在</h3>
          <p>
            底稿里的「{example.project.name}
            」还没填日期。对照合改稿，能看见两人分别改了什么，也能恢复到这一版。
          </p>
        </div>
      )
    case 'sharing':
      return (
        <dl className='story-material story-pair'>
          <div>
            <dt>
              请人审阅
              <HandUnderline />
            </dt>
            <dd>阿禾能看到最新保存的稿子。开了评论，就能在原句旁留言。</dd>
          </div>
          <div>
            <dt>
              正式投递
              <HandUnderline />
            </dt>
            <dd>
              投{example.job}
              用的是这份合改稿。以后改简历，招聘方手里的版本也不会变。
            </dd>
          </div>
        </dl>
      )
    case 'followup':
      return (
        <div className='story-material story-margin-note'>
          <h3>11 月 7 日，约到一面</h3>
          <p>
            “帮我把{example.job}这条改成面试中。11
            日下午两点一面，记到下一步里。”
          </p>
        </div>
      )
    case 'delivery':
      return (
        <div className='story-material story-log'>
          <h3>投递单</h3>
          <dl>
            <div>
              <dt>岗位</dt>
              <dd>{example.job}</dd>
            </div>
            <div>
              <dt>投递日期</dt>
              <dd>
                <time dateTime='2026-11-04'>11 月 4 日</time>
              </dd>
            </div>
            <div>
              <dt>投递状态</dt>
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
    templates: `柳如烟选了单栏模板，把「${example.project.name}」放在专业技能之前，准备投${example.job}。`,
    review: `对照职位描述，简历里还没写到「${example.missing}」。ATS 纯文本能读出项目原句。检测报告指出分工没写清楚，柳如烟补上了「${example.responsibility}」。`,
    assistant: `助手先读这份简历和已有的检测报告。柳如烟确认保存底稿，再核对修改前后的差别。确认应用后，助手把这两句写进简历：${example.lines.join('')}`,
    collaboration: `柳如烟重写了第二句：${example.jointLine}阿禾同时在这页补上项目时间：${example.project.period}。`,
    history: '打开底稿能找回原句；换回合改稿，两人刚写的描述和日期都还在。',
    sharing:
      '审阅链接随保存更新。留给招聘方的链接固定在这份合改稿，之后编辑不会改变它。',
    delivery: `11 月 4 日投出简历后，柳如烟把这份固定稿记在${example.job}岗位下。`,
    followup:
      '11 月 7 日收到面试邀请。柳如烟确认后，助手把状态改成面试中，记下 11 月 11 日下午两点的一面。',
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
