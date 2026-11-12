import type { DemoRole } from './story-example'
import { useId } from 'react'
import { HandPencil } from '../cover-marks'
import {
  FolderBack,
  FolderPocket,
  FolderMascot,
} from '../version-demo/folder-art'
import { demoRoles, storyExamples } from './story-example'
import {
  ChangeProof,
  JobLedger,
  ParsingProof,
  ProjectFields,
} from './editing-art'
import { InterviewDate, VersionIndex } from './workflow-art'
import { InkPath } from './ink-path'

const ink = '#292e35'
const blue = '#2d54b5'
const cobalt = '#4069cc'
const yellow = '#f4cd55'
const paper = '#fffdf3'

function Swatches() {
  return (
    <g data-art='swatches'>
      <g data-swatch='left' transform='rotate(-20 320 357)'>
        <g stroke={ink} strokeWidth='2'>
          <path d='m184 61 258-4 4 319-265 1Z' fill='#a6b5d7' />
          <path d='m180 57 257-4 5 318-266 1Z' fill='#e8ebf7' />
          <path d='m180 57 56-1-2 314-58 2Z' fill={cobalt} />
        </g>
        <g stroke='#dce4ff' fill='none' strokeWidth='2'>
          <path d='m192 100 30-1m-29 9 20-1m-20 62 27-1m-27 8 20-1m-21 60 30-1m-30 9 24-1' />
          <InkPath data-swatch-check='' d='m190 75 9 8 15-14' strokeWidth='3' />
        </g>
        <text x='194' y='147' fill={paper} fontSize='25'>
          A
        </text>
        <path
          d='m249 78 100-2m-100 16 154-2m-154 16 119-1m-119 42 135-3m-136 17 151-3'
          fill='none'
          stroke='#7c8cae'
          strokeWidth='2'
        />
      </g>
      <g data-swatch='right' transform='rotate(18 320 357)'>
        <g stroke={ink} strokeWidth='2'>
          <path d='m200 57 258-2 2 319-262 2Z' fill='#dcc683' />
          <path d='m196 52 258-1 2 319-262 2Z' fill='#fff0b8' />
          <path d='m196 52 258-1 .2 37-259 3Z' fill={yellow} />
        </g>
        <g stroke='#737263' fill='none' strokeWidth='1.6'>
          <path d='m209 106 228-4m-225 10 96-1m-97 12 79-2m38-12 109-2m-109 12 94-2m-95 15 106-2m-108 21 97-1m-96 15 106-1m-106 15 81-1' />
          <path d='m317 109-2 219m-107-107 226-4' />
        </g>
        <text x='418' y='78' fill={ink} fontSize='24'>
          B
        </text>
        <path d='m211 72 34-1m8 0 31-1' stroke={ink} strokeWidth='3' />
      </g>
    </g>
  )
}

function Portrait() {
  return (
    <g
      transform='translate(364 61) rotate(3 34 38)'
      stroke={ink}
      strokeWidth='1.35'
    >
      <path d='m0 3 70-2 1 77-70 2Z' fill='#fff9e8' />
      <path d='m5 8 60-2 1 66-60 2Z' fill='#ecd7bd' stroke='none' />
      <g transform='translate(5 6)'>
        <path
          d='M3 65c7-6 5-20 7-34C12 12 21 5 33 5c16-1 22 12 21 26-1 13 0 20 6 29l-6 5-11-3-12 5-17-3Z'
          fill='#353447'
        />
        <path
          d='M15 56c4-11 3-23 4-31m25-12c8 7 5 18 7 26m-2 7 4 12'
          fill='none'
          stroke='#777084'
          strokeWidth='1'
        />
        <path
          d='M4 66q5-9 19-13l12-3 8 5q10 3 16 10l1 2-56 2Z'
          fill='#52788c'
        />
        <path d='m24 53 2-7 9-2 1 8 5 3-9 8Z' fill='#f4c6ac' />
        <path
          d='M18 29c4-2 12-6 18-15 3 7 6 11 12 14l-2 9c-2 9-9 15-15 15-6 0-12-7-13-15-4-1-6-7-3-9Z'
          fill='#ffdfc5'
        />
        <path
          d='M15 36c-5-8-1-22 9-27 6-3 14-2 18 2-9 0-10 8-16 13l-8 5q0 6 3 11-5 0-6-4Z'
          fill='#393649'
        />
        <path
          d='M19 20c3-5 7-8 13-10m5 4c3 6 6 9 10 12'
          stroke='#82788b'
          fill='none'
          strokeWidth='1'
        />
        <path
          d='m20 31q3-2 7-1m9-2q3-2 7-.5'
          fill='none'
          stroke='#73564f'
          strokeWidth='1.1'
        />
        <path
          d='m19 34 2 1q3-3 7 0m7-2q4-3 7-.5l1-2'
          fill='none'
          strokeWidth='1.6'
        />
        <path d='m25 34-.1 2m14-3-.2 2' strokeWidth='2.2' />
        <path
          d='m32 33-1 6 2 .4'
          stroke='#b67c69'
          fill='none'
          strokeWidth='.9'
        />
        <path d='M29 43q3 1 7-1-2 4-6 3Z' fill='#b96b67' stroke='none' />
        <path d='m20 38 4 1m15-2 3-1' stroke='#eeae9e' strokeWidth='2' />
        <path d='m17 37 1 7' fill='none' stroke='#bb8b38' />
        <circle
          cx='18'
          cy='45'
          r='1.9'
          fill='#ffed9b'
          stroke='#866a40'
          strokeWidth='.7'
        />
        <path d='M22 52q4 4 10 8l-5 6-7-12Zm15 0-5 8 5 3 6-8Z' fill='#fff7e6' />
        <path
          d='m32 60 1 7m-19-6-2 6m37-7 3 7'
          fill='none'
          stroke='#385467'
          strokeWidth='1'
        />
        <path
          d='m43 18 8-4m-6 7 8-4'
          fill='none'
          stroke='#dfb550'
          strokeWidth='1.9'
        />
      </g>
      <path d='m38 0 16-2 1.5 7-16 3Z' fill='#f6d963' strokeWidth='.95' />
    </g>
  )
}

function Resume({ role }: { role: DemoRole }) {
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

function LinkTicket() {
  return (
    <g data-art='link'>
      <g transform='translate(0 40) rotate(5 489 277)'>
        <path
          d='m423 246 172-1 4 74-176 1-16-18 1-40Z'
          fill='#464e5b'
          opacity='.21'
        />
        <path
          d='m421 241 172-2 3 73-176 2-17-17 1-39Z'
          fill='#fff0b2'
          stroke={ink}
          strokeWidth='2.2'
        />
        <path d='m565 243 25-.8 3 66-25 1Z' fill={yellow} />
        <path
          d='m564 244 3 64'
          fill='none'
          stroke={ink}
          strokeWidth='1.2'
          strokeDasharray='3 4'
        />
        <circle
          cx='420'
          cy='273'
          r='4.5'
          fill='#f9f5e4'
          stroke={ink}
          strokeWidth='1.5'
        />
        <path
          d='m441 263 6-6c6-6 14 2 8 8l-5 5q-4 3-7 0m5-4-6 6c-6 6-14-2-8-8l4-4q4-3 8 0'
          fill='none'
          stroke={blue}
          strokeWidth='2.4'
        />
        <text x='463' y='272' fontSize='14' fill={blue}>
          发给招聘方
        </text>
        <text x='434' y='298' fontSize='22' fill={ink}>
          简历链接
        </text>
        <path
          d='m574 253 11-.2m-11 4 11-.2m-11 6 11-.2m-11 7 11-.2m-11 4 11-.2m-11 6 11-.2m-11 4 11-.2m-11 8 11-.2'
          stroke={ink}
          fill='none'
          strokeWidth='1.8'
        />
      </g>
      <g
        transform='translate(449 243) rotate(24)'
        fill='none'
        stroke={ink}
        strokeWidth='1.9'
      >
        <path
          d='M-4 2q0-5 4-5t4 5v7q0 5-4 5t-4-5Zm0 23q0-5 4-5t4 5v7q0 5-4 5t-4-5Zm0 23q0-5 4-5t4 5v7q0 5-4 5t-4-5Z'
          fill='#e4e9df'
        />
        <path d='M0 8q-3 8 0 17m0 7q-3 8 0 16m0 7q-2 10 0 15' strokeWidth='3' />
        <path
          d='m-1 10-.4 9m.4 16-.4 8m.4 15-.4 8'
          stroke='#e4e9df'
          strokeWidth='.9'
        />
      </g>
    </g>
  )
}

function RubberStamp() {
  return (
    <g data-art='stamp-tool' stroke={ink} strokeWidth='2.2'>
      <g transform='translate(17 13) rotate(-13 337 318)'>
        <path d='m295 307 80-1-1.5 14-77 1Z' fill='#242d44' />
        <path d='m292 294 84-1 2 17-87 1Z' fill='#c87943' />
        <path d='m292 294 7-6 73-1 4 6Z' fill='#e7ab68' />
        <path
          d='m306 300 37-1m13 0 13-1m-61 5 16 1'
          stroke='#9b5430'
          strokeWidth='1.4'
          fill='none'
        />
        <path
          d='M318 288q11-13 8-25c-9-5-14-13-10-21 5-13 32-14 39-2 5 9 0 18-11 23q-3 13 9 25Z'
          fill='#d2563f'
        />
        <path
          d='M321 243q4-6 14-7m7 36 5 7'
          stroke='#ffc4a0'
          strokeWidth='2.5'
          fill='none'
        />
      </g>
    </g>
  )
}

function Receipt({ role }: { role: DemoRole }) {
  return (
    <g data-art='receipt'>
      <g transform='rotate(7 452 336)'>
        <path d='m365 274 192 1 1 121-192 1Z' fill='#252e40' opacity='.2' />
        <path
          d='m361 268 191 1 1 117-7-2-7 4-7-4-7 3-7-3-7 4-7-3-7 4-7-4-7 4-7-4-7 3-7-3-7 3-7-3-7 4-7-3-7 3-7-4-7 3-7-3-7 3-7-4-8 3-8-3-8 3-7-2Z'
          fill={paper}
          stroke={ink}
          strokeWidth='1.8'
        />
        <path
          d='m372 307 168 .5m-168 43 168 .5'
          fill='none'
          stroke='#949a93'
          strokeDasharray='3 3'
        />
        <path
          d='m371 282 16-.5-.5 15-16 .5Z'
          fill='#e0e9fa'
          stroke={blue}
          strokeWidth='1.4'
        />
        <InkPath
          data-receipt-check=''
          d='m373 289 5 5 10-13'
          fill='none'
          stroke={blue}
          strokeWidth='2.4'
        />
        <text x='394' y='298' fontSize='22'>
          投递记录
        </text>
        <g data-art='confirm-followup' transform='rotate(-4 457 255)'>
          <path
            d='m399 243 116-1 .5 22-116 2Z'
            fill='#e8efdf'
            stroke='#5b6e59'
            strokeWidth='1.2'
          />
          <InkPath
            data-followup-confirm-ink=''
            d='m408 253 4 4 8-10'
            fill='none'
            stroke='#31523b'
            strokeWidth='1.7'
          />
          <text
            x='467'
            y='259'
            textAnchor='middle'
            fontSize='14'
            fill='#31523b'
          >
            记下来
          </text>
        </g>
        <g data-art='interview-status'>
          <path
            d='m488 280 54-2 1 21-54 1Z'
            fill='#dceada'
            stroke='#4f7757'
            strokeWidth='1.3'
          />
          <text
            x='515'
            y='294'
            textAnchor='middle'
            fontSize='13'
            fill='#385d43'
          >
            面试中
          </text>
        </g>
        <text x='373' y='337' fontSize='20' fill={blue}>
          {storyExamples[role].job}
        </text>
        <text x='373' y='372' fontSize='15'>
          11.04 投出
        </text>
        <path
          d='m499 368 32-1m-24 5 22-1'
          stroke='#8d9589'
          fill='none'
          strokeWidth='1.3'
        />
        <path
          d='m489 263 31-2 .5 11-31 3Z'
          fill='#efd586'
          stroke='#9d8954'
          strokeWidth='1'
        />
      </g>
    </g>
  )
}

export default function StoryArt({ role }: { role: DemoRole }) {
  const pocketClipId = useId()

  return (
    <svg
      viewBox='0 0 640 450'
      aria-hidden='true'
      focusable='false'
      fill={ink}
      strokeLinecap='round'
      strokeLinejoin='round'
      style={{ fontFamily: 'var(--hand)' }}
    >
      <defs>
        <clipPath id={pocketClipId} clipPathUnits='userSpaceOnUse'>
          <rect data-pocket-mask='' x='105' y='-35' width='420' height='470' />
        </clipPath>
      </defs>
      <g data-cover-back=''>
        <FolderBack />
      </g>
      <g data-desk-tools=''>
        <g fill='none' stroke='#9b947e' strokeWidth='1.1' opacity='.52'>
          <path d='m33 59 14-.5m-7-7 .5 14m554 319 14-1m-7-6 .5 14' />
          <path d='m67 357 38-1m-28 5 33-1m402-300 18-.5' />
        </g>
      </g>
      <g data-camera='paper'>
        <g data-art='folder-back'>
          <path
            d='m141 238 5-33q0-5 7-5l84-2 17 18 239-4q6 0 7 8l-9 183-355 1Z'
            fill='#d9a447'
            stroke={ink}
            strokeWidth='2.4'
          />
          <path
            d='m150 231 342-7m-337-17 60-1'
            fill='none'
            stroke='#a77230'
            strokeWidth='1.7'
          />
        </g>
        <g data-template-stack=''>
          <Swatches />
        </g>
        <g data-paper-travel=''>
          <g clipPath={`url(#${pocketClipId})`}>
            <Resume role={role} />
          </g>
        </g>
        <VersionIndex />
        <ParsingProof role={role} />
        <ChangeProof role={role} />
        <JobLedger role={role} />
        <LinkTicket />
        <g data-art='pencil'>
          <HandPencil />
        </g>
        <g data-art='folder-front'>
          <path
            d='m120 254 159-3 18 11 206-8-13 156q-162 4-348 3Z'
            fill='#263958'
            opacity='.24'
          />
          <path
            d='M117 246q78 2 160-2l20 13 204-9-14 155q-160 6-348 4Z'
            fill='#f3c258'
            stroke={ink}
            strokeWidth='2.7'
          />
          <path
            d='m124 252 147-1 22 13 201-8m-353 143q149 1 336-3'
            fill='none'
            stroke='#fff1b4'
            strokeWidth='1.8'
          />
          <path
            d='m149 379 8 18m-2-21 9 21m-1-16 8 16m-.5-13 7 13'
            fill='none'
            stroke='#b88036'
            strokeWidth='1.5'
          />
          <path
            d='m152 290 151-3 1 67-146 4Z'
            fill='#e4e9e4'
            stroke={ink}
            strokeWidth='1.8'
          />
          <path
            d='m157 295 140-3 .5 58-137 3Z'
            fill={paper}
            stroke='#9ca6a5'
            strokeWidth='1'
          />
          <text x='169' y='317' fill={blue} fontSize='13' letterSpacing='1'>
            求职档案 / 01
          </text>
          <text x='169' y='344' fontSize='23'>
            已投的简历
          </text>
        </g>
        <Receipt role={role} />
        <InterviewDate />
      </g>
      <g data-cover-front=''>
        <g data-pocket-fold=''>
          <FolderPocket />
        </g>
        <FolderMascot />
      </g>
    </svg>
  )
}
