import type { DemoRole } from '../../story-example'
import { useId } from 'react'
import { HandPencil } from '../../../cover-marks'
import {
  FolderBack,
  FolderPocket,
  FolderMascot,
} from '../../../version-demo/folder-art'
import { ChangeProof, JobLedger, ParsingProof } from '../../editing-art'
import { InterviewDate, VersionIndex } from '../../workflow-art'
import { ink } from '../const'
import { blue } from '../const'
import { paper } from '../const'
import { Swatches } from '../swatches/index'
import { Resume } from '../resume/index'
import { LinkTicket } from '../link-ticket/index'
import { Receipt } from '../receipt/index'

export function StoryArt({ role }: { role: DemoRole }) {
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
