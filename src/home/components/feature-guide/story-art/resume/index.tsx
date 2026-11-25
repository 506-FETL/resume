import type { DemoRole } from '../../story-example'
import { demoRoles, storyExamples } from '../../story-example'
import { ProjectFields } from '../../editing-art'
import { InkPath } from '../../ink-path'
import { ink } from '../const'
import { blue } from '../const'
import { cobalt } from '../const'
import { yellow } from '../const'
import { paper } from '../const'
import { Portrait } from '../portrait/index'
import { RubberStamp } from '../rubber-stamp/index'

export function Resume({ role }: { role: DemoRole }) {
  return (
    <g data-art='resume'>
      <g stroke={ink} strokeWidth='2.3'>
        <path
          d='m184 47 256-2 26 25 1 313q-132 5-283 7Z'
          fill='#a8ab9e'
          stroke='none'
        />
        <path
          d='M178 40q130 2 257-2l27 26q-1 168 2 318-126 5-285 5 2-175-1-347Z'
          fill={paper}
        />
      </g>
      <g data-art='layout'>
        <path d='m181 44 253-3 26 26-1 75-278 4Z' fill='#dce7f6' />
        <path d='m181 44 8 1 1 334-8 3Z' fill={cobalt} />
        <path d='m201 138 246-4 1 5-246 5Z' fill={cobalt} />
        <g fill='none' stroke={yellow} strokeWidth='7'>
          <InkPath data-section-mark='' d='m201 174 14-1' />
          <InkPath data-section-mark='' d='m201 313 5-.5' />
        </g>
      </g>
      <g stroke={ink} fill='none'>
        <path d='m435 39-2 26 29-1Z' fill='#eadfaf' strokeWidth='2' />
        <path d='m438 57 3-5m2 9 3-4m4 4 2-2' strokeWidth='1' />
        <path d='m207 144q98 1 226-4m-225 178q109 1 225-3' strokeWidth='1.25' />
        <path d='m205 363 161-2' stroke='#95988d' />
      </g>
      <g fill={ink}>
        {demoRoles.map((version) => (
          <text
            key={version}
            className='home-role-copy'
            data-selected={role === version}
            x='209'
            y='75'
            fontSize='14'
            letterSpacing='1.6'
          >
            {storyExamples[version].version}
          </text>
        ))}
        <text x='207' y='120' fontSize='43' letterSpacing='1'>
          柳如烟
        </text>
      </g>
      <Portrait />
      <ProjectFields role={role} />
      <text x='208' y='338' fontSize='14' fill='#575e5f'>
        专业技能
      </text>
      <text x='208' y='356' fontSize='13.5' fill={ink}>
        {storyExamples[role].project.skills}
      </text>
      <text x='387' y='367' fill='#484e52' fontSize='15'>
        01/01
      </text>
      <g transform='translate(410 299) scale(.72) translate(-354 -331)'>
        <g data-art='stamp'>
          <g transform='rotate(-13 354 331)' stroke={blue}>
            <path
              d='M320 313q35-2 70 0l-.5 34-70 1Z'
              fill='#e9eff8'
              strokeWidth='2.7'
            />
            <path
              d='m324 317 61-.5-.2 26-61 1Z'
              fill='none'
              strokeWidth='1.1'
              strokeDasharray='41 3 15 1'
            />
            <text
              x='354'
              y='337'
              textAnchor='middle'
              fill={blue}
              stroke='none'
              fontSize='17'
            >
              V1.0
            </text>
          </g>
        </g>
        <RubberStamp />
      </g>
    </g>
  )
}
