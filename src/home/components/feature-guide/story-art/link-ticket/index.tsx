import { ink } from '../const'
import { blue } from '../const'
import { yellow } from '../const'

export function LinkTicket() {
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
