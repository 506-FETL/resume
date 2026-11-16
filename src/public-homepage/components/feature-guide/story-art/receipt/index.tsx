import type { DemoRole } from '../../story-example'
import { storyExamples } from '../../story-example'
import { InkPath } from '../../ink-path'
import { ink } from '../const'
import { blue } from '../const'
import { paper } from '../const'

export function Receipt({ role }: { role: DemoRole }) {
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
