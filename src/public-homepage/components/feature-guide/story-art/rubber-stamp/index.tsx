import { ink } from '../const'

export function RubberStamp() {
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
