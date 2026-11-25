const ink = '#202324'

export function FolderBack() {
  return (
    <g>
      <defs>
        <pattern
          id='cover-ink-dots'
          width='5'
          height='5'
          patternUnits='userSpaceOnUse'
          patternTransform='rotate(-13)'
        >
          <circle cx='1.5' cy='1.5' r='1.1' fill={ink} />
        </pattern>
        <pattern
          id='cover-paper-grain'
          width='33'
          height='31'
          patternUnits='userSpaceOnUse'
        >
          <path
            d='m4 7 1.5-.3m15 11 2-.6m5 11 1.3-.4'
            fill='none'
            stroke='#775124'
            strokeWidth='1.15'
            strokeLinecap='round'
          />
        </pattern>
      </defs>
      <g stroke={ink} strokeWidth='3.8' strokeLinejoin='round'>
        <path
          d='M49 91q-2-13 10-14l44-3 13-21q3-6 13-6l87-2q8 0 12 11l6 12 284-6q12-1 12 10l4 260q1 14-12 14L73 361Z'
          fill='#ce9130'
        />
        <path
          d='M53 90q-2-10 10-10l46-3 12-21q2-5 10-5l82-2q6 1 10 11l6 12 282-5q12-1 12 9l3 258-449 21Z'
          fill='#f5bd4c'
          strokeWidth='2'
        />
        <path
          d='m116 72 11-15 79-2M72 98l28-2'
          fill='none'
          stroke='#936b32'
          strokeWidth='1.8'
          strokeLinecap='round'
        />
        <path d='m134 95 351-49 32 236-360 42Z' fill='#cddcf6' />
        <path
          d='m150 97 324-45m-15 10 15-2'
          fill='none'
          stroke='#6e83a1'
          strokeWidth='1.4'
          strokeLinecap='round'
        />
        <g data-pocket-gussets='' strokeWidth='1.9'>
          <path d='m50 202 12 31-5 24 12 23-6 18 15 50-5-82Z' fill='#c98834' />
          <path d='m519 200-9 36 13 20-8 24 13 52 2-36Z' fill='#bf7e2d' />
          <path d='m60 236 11 40m447-36 9 49' fill='none' stroke='#f6c566' />
        </g>
      </g>
    </g>
  )
}

export function FolderPocket() {
  return (
    <g>
      <g stroke={ink} strokeLinejoin='round' strokeLinecap='round'>
        <path
          d='m37 205 108-3q10 0 17 6l17 15 332-9q15-1 16 11l11 108q1 13-14 17l-443 13q-14 0-17-12l-35-130q-3-15 8-16Z'
          fill={ink}
          strokeWidth='5'
        />
        <path
          d='m36 199 108-3q9 0 16 6l18 15 334-8q10 0 11 11l10 109q1 12-12 15L80 357q-13 1-16-12L29 214q-3-13 7-15Z'
          fill='#f8bd48'
          strokeWidth='4'
        />
        <path
          d='m35 202 108-3q9 0 15 6l18 15 338-8q6 0 7 8l9 104-449 26Z'
          fill='url(#cover-paper-grain)'
          stroke='none'
          opacity='.5'
        />
        <path
          d='m35 205 110-3q5 0 11 5l18 16q4 3 12 2l322-8'
          fill='none'
          stroke='#ffe49a'
          strokeWidth='3.5'
        />
        <path
          d='m67 329 9 21 432-12m-397 6 285-8m81-3 35-1m8-81 6 68'
          fill='none'
          stroke='#876226'
          strokeWidth='1.5'
        />
        <path d='m510 341 17-16-6 16Z' fill='#db952d' strokeWidth='1.5' />
        <path
          d='m74 345 37 8-33 1Z'
          fill='url(#cover-ink-dots)'
          stroke='none'
        />
      </g>
      <g
        transform='rotate(-3 213 283)'
        stroke={ink}
        strokeLinejoin='round'
        strokeLinecap='round'
      >
        <path d='m99 249 206 2-1 67-202-1Z' fill='#d49c3b' stroke='none' />
        <path d='m98 244 204 3-1 66-202-1Z' fill='#fff4c9' strokeWidth='2.4' />
        <path
          d='m106 251 187 2-1 52-185-1Z'
          fill='none'
          stroke='#a28445'
          strokeWidth='1.2'
        />
        <path
          d='m96 260-1-12 14-1m-11 14-1-11 12-1'
          fill='none'
          strokeWidth='1.5'
        />
        <text
          x='200'
          y='294'
          textAnchor='middle'
          fill={ink}
          stroke='none'
          fontSize='36'
          fontWeight='700'
        >
          示例简历
        </text>
      </g>
      <g
        transform='rotate(12 429 277)'
        stroke='#2248a3'
        fill='none'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <path
          d='M372 279c0-17 25-31 58-31 35 0 61 12 61 28 0 18-26 33-60 33s-59-12-59-30Z'
          strokeWidth='4'
          strokeDasharray='105 2 38 3 147'
        />
        <path
          d='M378 279c0-13 22-24 52-25 29 0 54 8 55 23 0 13-22 24-52 26-31 1-54-8-55-24Z'
          strokeWidth='1.4'
        />
        <path
          d='m385 277 29-10-8 20-6-8-15-2Zm15 2 14-12'
          fill='#f5c555'
          strokeWidth='2'
        />
        <text
          x='444'
          y='288'
          textAnchor='middle'
          fill='#2248a3'
          stroke='none'
          fontSize='22'
          fontWeight='700'
        >
          001
        </text>
      </g>
    </g>
  )
}

export function FolderMascot() {
  return (
    <g>
      <g stroke={ink} strokeLinejoin='round' strokeLinecap='round'>
        <path
          d='M186 356q-1 17-19 31l-15 9m231-47q17 25 47 23l1 15'
          fill='none'
          strokeWidth='15'
        />
        <path
          d='M187 357q0 14-16 26m212-31q14 21 41 18'
          fill='none'
          stroke='#fff2cd'
          strokeWidth='4'
        />
        <g transform='rotate(13 149 397)'>
          <path d='m146 381 27 7-7 17-28-9Z' fill='#fff7de' strokeWidth='3' />
          <path
            d='m150 384-5 10m11-8-4 9m11-7-4 9'
            fill='none'
            strokeWidth='1.5'
          />
          <path
            d='m145 394 17 5q6 2 10-1 4 8 2 18l-43 2q-18 0-29-10-7-7-3-15 5-11 18-9 9 1 16 8l7-3Z'
            fill='#3456ad'
            strokeWidth='3.4'
          />
          <path
            d='M100 398q9 14 32 14l42-2 1 7q-25 4-46 3-23-1-29-11-3-5 0-11Z'
            fill='#fff3ce'
            strokeWidth='2.7'
          />
          <path
            d='m132 390-8 5m14-3-7 6m13-4-6 6'
            fill='none'
            stroke='#fff3ce'
            strokeWidth='2.3'
          />
        </g>
        <g transform='rotate(-11 433 388)'>
          <path d='m420 379 24-1 1 20-24 1Z' fill='#fff7de' strokeWidth='2.8' />
          <path
            d='m425 381 1 12m5-13 1 12m5-13 1 12'
            fill='none'
            strokeWidth='1.4'
          />
          <path
            d='m417 391 23-1q8-8 13-4l7 5q17-5 29 1 12 6 12 16l-82 2q-8-4-2-19Z'
            fill='#3456ad'
            strokeWidth='3.3'
          />
          <path
            d='m416 403 84-2 1 7q-11 4-79 4-8 0-6-9Z'
            fill='#fff3ce'
            strokeWidth='2.6'
          />
          <path
            d='m459 391 5 6m0-7 6 6m0-7 6 6'
            fill='none'
            stroke='#fff3ce'
            strokeWidth='2.3'
          />
        </g>
        <g data-pocket-hands=''>
          <path
            d='M51 278Q13 273 21 237l9-28m499 57q38-3 35-55'
            fill='none'
            strokeWidth='14'
          />
          <path
            d='M49 277Q16 270 24 242m507 22q28-5 31-32'
            fill='none'
            stroke='#fff3ce'
            strokeWidth='3.8'
          />
          <g transform='rotate(-12 36 206)' fill='#fff9e9'>
            <path d='m14 218 22 5 4-13-24-7Z' strokeWidth='2.7' />
            <path
              d='M19 207q-10-5-10-16 0-7 5-13l1-26q1-7 6-6 6 1 5 9l1 15 10-13q4-5 8-2 4 3 0 9l-5 10q11-6 13 0 2 4-10 13-3 9-10 18-6 6-14 2Z'
              strokeWidth='3.3'
            />
            <path
              d='m21 185 7-9m1 12 7-7m-15 17q6 0 10-6'
              fill='none'
              strokeWidth='1.7'
            />
          </g>
          <g fill='#fff9e9'>
            <path d='m554 218 18-5-4-12-19 5Z' strokeWidth='2.7' />
            <path
              d='M563 208q11-4 9-16-1-9-13-17-7-7-15-9-11-3-15 1-2 3 1 6-12-4-15 1-2 4 8 10-10-2-12 2-2 5 13 11l15 5q15 9 24 6Z'
              strokeWidth='3.5'
            />
            <path
              d='m530 173 16 6m-23 5 19 5m10 3q1-8 8-12'
              fill='none'
              strokeWidth='1.8'
            />
          </g>
        </g>
      </g>
    </g>
  )
}
