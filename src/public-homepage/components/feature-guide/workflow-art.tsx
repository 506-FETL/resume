import { InkPath } from './ink-path'
import { HandPencil } from '../cover-marks'

export function VersionIndex() {
  return (
    <g data-art='versions' transform='rotate(-4 176 191)'>
      <path d='m105 127 81 1 -1 86-80 3Z' fill='#283955' opacity='.2' />
      <path
        d='m100 123 82 1 -1 86-82 3Z'
        fill='#f7df9e'
        stroke='#394052'
        strokeWidth='1.8'
      />
      <path d='M106 169h68' stroke='#ae955e' strokeDasharray='3 3' />
      <path
        data-art='version-selection'
        d='m104 152 67-2 1 11-68 2Z'
        fill='#edb745'
      />
      <text x='109' y='141' fontSize='12'>
        09:10
      </text>
      <text x='109' y='160' fontSize='19'>
        修改前
      </text>
      <text x='109' y='185' fontSize='12'>
        09:35
      </text>
      <text x='109' y='205' fontSize='19'>
        修改后
      </text>
    </g>
  )
}

export function InterviewDate() {
  return (
    <g data-art='interview'>
      <g transform='rotate(-8 240 332)'>
        <path d='m164 269 135-1 4 124-138 2Z' fill='#725f38' opacity='.23' />
        <path
          d='m160 263 136-2 2 125-139 3Z'
          fill='#fff8e6'
          stroke='#483f3a'
          strokeWidth='2'
        />
        <path d='m161 264 134-2 1 27-136 2Z' fill='#a74737' />
        <path
          d='m181 259 1 11m88-12 1 11'
          stroke='#35394b'
          fill='none'
          strokeWidth='4'
        />
        <text x='228' y='283' textAnchor='middle' fontSize='16' fill='#fff7e2'>
          十一月
        </text>
        <text x='229' y='345' textAnchor='middle' fontSize='54' fill='#363d51'>
          11
        </text>
        <InkPath
          data-date-circle=''
          d='M252 302c-24-15-62 4-62 26 1 27 62 29 76 3 7-14-2-26-15-30'
          fill='none'
          stroke='#ac4936'
          strokeWidth='2.3'
        />
        <text x='228' y='376' textAnchor='middle' fontSize='18'>
          14:00 面试
        </text>
        <g data-art='calendar-pencil'>
          <HandPencil />
        </g>
      </g>
    </g>
  )
}
