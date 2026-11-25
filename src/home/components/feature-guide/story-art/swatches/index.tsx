import { InkPath } from '../../ink-path'
import { ink } from '../const'
import { cobalt } from '../const'
import { yellow } from '../const'
import { paper } from '../const'

export function Swatches() {
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
