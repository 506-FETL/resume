import { useId } from 'react'
import { InkPath } from './ink-path'
import type { DemoRole } from './story-example'
import { fieldMetrics, storyExamples } from './story-example'

const blue = '#264f9b'
const red = '#9d402f'

function InkField({
  name,
  value,
  x,
  y,
  advance,
  size,
  color,
}: {
  name: string
  value: string
  x: number
  y: number
  advance: number
  size: number
  color?: string
}) {
  const clipId = useId()
  const glyphs = Array.from(value)
  const stops = glyphs.map((_, index) => index * advance).join(' ')
  const width = glyphs.length * advance
  const guest = name === 'date'
  const editable = guest || name === 'description'
  const ink = guest ? red : blue

  return (
    <g data-field={name} transform={`translate(${x} ${y})`}>
      <defs>
        <clipPath id={clipId}>
          <rect
            data-ink={name}
            x='0'
            y={-size - 2}
            width='0'
            height={size + 8}
          />
        </clipPath>
      </defs>
      <text
        data-field-value=''
        x={stops}
        y='0'
        fill={color}
        fontSize={size}
        clipPath={`url(#${clipId})`}
      >
        {value}
      </text>
      {editable && (
        <g data-caret-track={name}>
          <g data-caret={name} fill={ink}>
            <path
              d={guest ? 'M0 -16v20m-2-20h4' : 'M0 -17v22m-2 0h4'}
              fill='none'
              stroke={ink}
              strokeWidth='1.8'
            />
            <g transform={guest ? 'translate(-41 -36)' : 'translate(-53 6)'}>
              <path
                d={
                  guest ? 'm1 0 39-.5 1 19-7-3H1Z' : 'm1 3 45-.5L53 0v19L1 20Z'
                }
              />
              <text
                x={guest ? 21 : 26}
                y='14'
                fontSize='12.5'
                textAnchor='middle'
                fill='#fffdf3'
              >
                {guest ? '阿禾' : '柳如烟'}
              </text>
            </g>
          </g>
        </g>
      )}
      {editable && (
        <path
          data-field-rule={name}
          d={`M0 3q${width / 2} 1 ${width} 0`}
          clipPath={`url(#${clipId})`}
          fill='none'
          stroke={ink}
          strokeWidth='1.1'
          opacity='.45'
        />
      )}
    </g>
  )
}

export function ProjectFields({ role }: { role: DemoRole }) {
  const example = storyExamples[role]
  const { project } = example

  return (
    <g fill='#292e35'>
      <text x='207' y='169' fontSize='15' fill={blue}>
        项目经历
      </text>
      <text x='206' y='198' fontSize='25'>
        {project.name}
      </text>
      <text x='209' y='224' fontSize='14' fill='#586574'>
        分工
      </text>
      <path
        d='M250 226q39 1 77-1'
        fill='none'
        stroke='#93958b'
        strokeDasharray='3 3'
      />
      <InkField
        name='role'
        x={251}
        y={224}
        value={example.responsibility}
        advance={fieldMetrics.role}
        size={16}
        color={blue}
      />
      <text data-art='original' x='209' y='255' fontSize='16.5'>
        {project.original}
      </text>
      <g data-art='rewrite'>
        <InkField
          name='first'
          x={209}
          y={255}
          advance={fieldMetrics.description}
          size={16}
          value={example.lines[0]}
        />
        <InkField
          name='second'
          x={209}
          y={279}
          advance={fieldMetrics.description}
          size={16}
          value={example.lines[1]}
        />
      </g>
      <InkField
        name='date'
        value={project.period}
        x={338}
        y={169}
        advance={fieldMetrics.date}
        size={15}
        color={red}
      />
      <InkField
        name='description'
        value={example.jointLine}
        x={209}
        y={279}
        advance={fieldMetrics.description}
        size={16}
        color={blue}
      />
      <g data-art='selection'>
        <path
          d={`M207 262l${example.lines[1].length * fieldMetrics.description + 4} -.5v22l-${example.lines[1].length * fieldMetrics.description + 4} 1Z`}
          fill='#577ed9'
          opacity='.23'
        />
      </g>
      <g data-art='evidence' fill='none' stroke={red} strokeWidth='1.9'>
        <InkPath
          data-proof-ink='circle'
          d='M326 214c-4-8-68-8-81-2-10 5-8 14 4 17 17 3 60 2 73-2q9-3 6-10'
        />
        <InkPath data-proof-ink='underline' d='M209 260q39-3 77-1t74-1' />
      </g>
    </g>
  )
}

export function ParsingProof({ role }: { role: DemoRole }) {
  const { project } = storyExamples[role]

  return (
    <g data-art='parsing-proof'>
      <g transform='rotate(-2 314 220)'>
        <path d='m192 154 250-1 1 125-249 2Z' fill='#536a74' opacity='.15' />
        <path
          d='m189 150 252-1-.5 125-249 3Z'
          fill='#edf3ef'
          stroke='#53695c'
          strokeWidth='1.5'
        />
        <path d='m195 180 237-1m-226 17-.5 63' stroke='#aebdb2' fill='none' />
        <text x='204' y='171' fill='#325442' fontSize='17'>
          ATS 纯文本预览
        </text>
        <g fill='#354655' fontSize='15.5'>
          <text x='209' y='201'>
            [项目经历]
          </text>
          <text x='209' y='226'>
            1. {project.name}
          </text>
          <text x='218' y='252'>
            - {project.original}
          </text>
        </g>
      </g>
    </g>
  )
}

export function ChangeProof({ role }: { role: DemoRole }) {
  const { lines, project } = storyExamples[role]

  return (
    <g data-art='change-proof'>
      <g transform='rotate(1 322 239)'>
        <path d='m195 176 260-2 1 121-259 4Z' fill='#434a52' opacity='.14' />
        <path
          d='m191 172 260-1 2 122-260 2Z'
          fill='#fffdf5'
          stroke='#636656'
          strokeWidth='1.6'
        />
        <text x='201' y='192' fill='#374654' fontSize='15'>
          修改前后 · 项目描述
        </text>
        <path d='m196 201 251-1 .2 23-250 1Z' fill='#f9e5d9' />
        <path d='m196 228 251-2 1 45-251 2Z' fill='#e3eddc' />
        <g fontSize='15.5'>
          <text x='201' y='219' fill='#8e473b'>
            − {project.original}
          </text>
          <text x='201' y='246' fill='#284e38'>
            + {lines[0]}
          </text>
          <text x='217' y='266' fill='#284e38'>
            {lines[1]}
          </text>
        </g>
        <g data-art='confirm-change' fill={blue}>
          <InkPath
            data-confirm-ink=''
            d='m350 283 4 4 8-10'
            fill='none'
            stroke={blue}
            strokeWidth='2.1'
          />
          <text x='367' y='287' fontSize='15'>
            确认应用
          </text>
        </g>
      </g>
    </g>
  )
}

function LedgerLine({
  y,
  children,
  mark,
  printed,
}: {
  y: number
  children: string
  mark: string
  printed?: boolean
}) {
  return (
    <g transform={`translate(0 ${y})`}>
      <path
        d='m190-11 12-.4.6 12-12 .4Z'
        fill='none'
        stroke='#718175'
        strokeWidth='1.2'
      />
      <InkPath
        data-check={mark}
        d='m191-6 4 4 9-12'
        fill='none'
        stroke='#2a6548'
        strokeWidth='2.4'
      />
      <text
        data-ledger-line={printed ? undefined : mark}
        x='213'
        y='0'
        fontSize='15'
        fill='#32433e'
      >
        {children}
      </text>
    </g>
  )
}

export function JobLedger({ role }: { role: DemoRole }) {
  const example = storyExamples[role]

  return (
    <g data-art='ledger'>
      <g transform='rotate(-2 310 353)'>
        <path d='m156 306 294-3 2 101-291 3Z' fill='#555c4b' opacity='.18' />
        <path
          d='m152 301 295-3 1 101-6-2-5 3-5-2-6 3-5-3-7 3-5-2-6 3-5-3-242 4Z'
          fill='#f2f3df'
          stroke='#536253'
          strokeWidth='1.7'
        />
        <path
          d='m174 304 1 94'
          fill='none'
          stroke='#9aab96'
          strokeDasharray='3 3'
        />
        {[316, 342, 370, 389].map((y) => (
          <circle
            key={y}
            cx='164'
            cy={y}
            r='2.5'
            fill='#d8dcc8'
            stroke='#98a591'
            strokeWidth='.8'
          />
        ))}
        <path d='m184 327 249-2' fill='none' stroke='#bdc7ad' />
        <g data-art='report-face'>
          <text x='188' y='321' fill='#3d5a47' fontSize='17'>
            检测报告 / 修复清单
          </text>
          <LedgerLine y={352} mark='role' printed>
            补上自己负责的部分
          </LedgerLine>
          <LedgerLine y={379} mark='pending' printed>
            {example.repair}
          </LedgerLine>
        </g>
        <g data-art='agent-face'>
          <text x='188' y='321' fill='#315746' fontSize='17'>
            助手的操作记录
          </text>
          <LedgerLine y={347} mark='read'>
            读取简历和已有的检测报告
          </LedgerLine>
          <LedgerLine y={368} mark='save'>
            保存历史版本「底稿」
          </LedgerLine>
          <LedgerLine y={389} mark='write'>
            写入项目描述
          </LedgerLine>
          <g data-art='confirm-save' transform='rotate(-5 396 361)'>
            <path
              d='m361 349 69-1 1 21-70 1Z'
              fill='#e9eef6'
              stroke={blue}
              strokeWidth='1.3'
            />
            <text
              data-art='saving-label'
              x='395'
              y='365'
              textAnchor='middle'
              fill={blue}
              fontSize='14'
            >
              确认保存
            </text>
            <text
              data-art='saved-label'
              x='395'
              y='365'
              textAnchor='middle'
              fill={blue}
              fontSize='14'
            >
              已存底稿
            </text>
          </g>
        </g>
      </g>
    </g>
  )
}
