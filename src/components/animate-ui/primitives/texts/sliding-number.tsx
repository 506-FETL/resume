'use client'

import * as React from 'react'
import {
  useSpring,
  useTransform,
  motion,
  useMotionValue,
  type MotionValue,
  type SpringOptions,
  type HTMLMotionProps,
} from 'motion/react'
import useMeasure from 'react-use-measure'

import { useIsInView, type UseIsInViewOptions } from '@/hooks/use-is-in-view'

type SlidingNumberRollerProps = {
  prevValue: number
  value: number
  place: number
  placeKey: string
  revision: number
  displayNumber: number
  transition: SpringOptions
  delay?: number
  onSettled?: (
    revision: number,
    displayNumber: number,
    placeKey: string,
  ) => void
}

function SlidingNumberRoller({
  prevValue,
  value,
  place,
  placeKey,
  revision,
  displayNumber,
  transition,
  delay = 0,
  onSettled,
}: SlidingNumberRollerProps) {
  const startNumber = Math.floor(prevValue / place) % 10
  const targetNumber = Math.floor(value / place) % 10
  const animatedValue = useSpring(startNumber, transition)
  const onSettledRef = React.useRef(onSettled)

  onSettledRef.current = onSettled

  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let didSettle = false

    const markSettled = () => {
      if (didSettle) return

      didSettle = true
      onSettledRef.current?.(revision, displayNumber, placeKey)
    }

    const timeoutId = setTimeout(() => {
      if (
        animatedValue.get() === targetNumber &&
        !animatedValue.isAnimating()
      ) {
        markSettled()

        return
      }

      unsubscribe = animatedValue.on('animationComplete', markSettled)
      animatedValue.set(targetNumber)
    }, delay)

    return () => {
      clearTimeout(timeoutId)
      unsubscribe?.()
    }
  }, [targetNumber, animatedValue, delay, revision, displayNumber, placeKey])

  const [measureRef, { height }] = useMeasure()

  return (
    <span
      ref={measureRef}
      data-slot='sliding-number-roller'
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '1ch',
        overflowX: 'visible',
        overflowY: 'clip',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ visibility: 'hidden' }}>0</span>
      {Array.from({ length: 10 }, (_, i) => (
        <SlidingNumberDisplay
          key={i}
          motionValue={animatedValue}
          number={i}
          height={height}
          transition={transition}
        />
      ))}
    </span>
  )
}

type SlidingNumberDisplayProps = {
  motionValue: MotionValue<number>
  number: number
  height: number
  transition: SpringOptions
}

function SlidingNumberDisplay({
  motionValue,
  number,
  height,
  transition,
}: SlidingNumberDisplayProps) {
  const y = useTransform(motionValue, (latest) => {
    if (!height) return 0

    const currentNumber = latest % 10
    const offset = (10 + number - currentNumber) % 10
    let translateY = offset * height

    if (offset > 5) translateY -= 10 * height

    return translateY
  })

  if (!height) {
    return (
      <span style={{ visibility: 'hidden', position: 'absolute' }}>
        {number}
      </span>
    )
  }

  return (
    <motion.span
      data-slot='sliding-number-display'
      style={{
        y,
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      transition={{ ...transition, type: 'spring' }}
    >
      {number}
    </motion.span>
  )
}

type SlidingNumberProps = Omit<HTMLMotionProps<'span'>, 'children'> & {
  number: number
  fromNumber?: number
  onNumberChange?: (number: number) => void
  onValueAnimationComplete?: (number: number) => void
  padStart?: boolean
  decimalSeparator?: string
  decimalPlaces?: number
  thousandSeparator?: string
  transition?: SpringOptions
  delay?: number
  initiallyStable?: boolean
} & UseIsInViewOptions

function SlidingNumber({
  ref,
  number,
  fromNumber,
  onNumberChange,
  onValueAnimationComplete,
  inView = false,
  inViewMargin = '0px',
  inViewOnce = true,
  padStart = false,
  decimalSeparator = '.',
  decimalPlaces = 0,
  thousandSeparator,
  transition = { stiffness: 200, damping: 20, mass: 0.4 },
  delay = 0,
  initiallyStable = false,
  ...props
}: SlidingNumberProps) {
  const { ref: localRef, isInView } = useIsInView(
    ref as React.Ref<HTMLElement>,
    {
      inView,
      inViewOnce,
      inViewMargin,
    },
  )

  const initialNumeric = Math.abs(Number(number))

  const targetRef = React.useRef({ number, revision: 0 })

  if (targetRef.current.number !== number) {
    targetRef.current = {
      number,
      revision: targetRef.current.revision + 1,
    }
  }

  const prevNumberRef = React.useRef<number>(
    initiallyStable ? initialNumeric : 0,
  )

  const hasAnimated = fromNumber !== undefined

  const motionVal = useMotionValue(
    initiallyStable ? initialNumeric : (fromNumber ?? 0),
  )

  const springVal = useSpring(motionVal, { stiffness: 90, damping: 50 })

  const skippedInitialWhenStable = React.useRef(false)

  React.useEffect(() => {
    if (!hasAnimated) return
    if (initiallyStable && !skippedInitialWhenStable.current) {
      skippedInitialWhenStable.current = true

      return
    }

    const timeoutId = setTimeout(() => {
      if (isInView) motionVal.set(number)
    }, delay)

    return () => clearTimeout(timeoutId)
  }, [hasAnimated, initiallyStable, isInView, number, motionVal, delay])

  const [effectiveNumber, setEffectiveNumber] = React.useState<number>(
    initiallyStable ? initialNumeric : 0,
  )

  React.useEffect(() => {
    if (hasAnimated) {
      const inferredDecimals =
        typeof decimalPlaces === 'number' && decimalPlaces >= 0
          ? decimalPlaces
          : (() => {
              const s = String(number)
              const idx = s.indexOf('.')

              return idx >= 0 ? s.length - idx - 1 : 0
            })()

      const factor = Math.pow(10, inferredDecimals)

      const unsubscribe = springVal.on('change', (latest: number) => {
        const newValue =
          inferredDecimals > 0
            ? Math.round(latest * factor) / factor
            : Math.round(latest)

        if (effectiveNumber !== newValue) {
          setEffectiveNumber(newValue)
          onNumberChange?.(newValue)
        }
      })

      return () => unsubscribe()
    } else {
      setEffectiveNumber(
        initiallyStable ? initialNumeric : !isInView ? 0 : initialNumeric,
      )
    }
  }, [
    hasAnimated,
    springVal,
    isInView,
    number,
    decimalPlaces,
    onNumberChange,
    effectiveNumber,
    initiallyStable,
    initialNumeric,
  ])

  const formatNumber = React.useCallback(
    (num: number) =>
      decimalPlaces != null ? num.toFixed(decimalPlaces) : num.toString(),
    [decimalPlaces],
  )

  const numberStr = formatNumber(effectiveNumber)
  const [newIntStrRaw, newDecStrRaw = ''] = numberStr.split('.')

  const finalIntLength = padStart
    ? Math.max(
        Math.floor(Math.abs(number)).toString().length,
        newIntStrRaw.length,
      )
    : newIntStrRaw.length

  const newIntStr = padStart
    ? newIntStrRaw.padStart(finalIntLength, '0')
    : newIntStrRaw

  const prevFormatted = formatNumber(prevNumberRef.current)
  const [prevIntStrRaw = '', prevDecStrRaw = ''] = prevFormatted.split('.')

  const prevIntStr = padStart
    ? prevIntStrRaw.padStart(finalIntLength, '0')
    : prevIntStrRaw

  const adjustedPrevInt = React.useMemo(() => {
    return prevIntStr.length > finalIntLength
      ? prevIntStr.slice(-finalIntLength)
      : prevIntStr.padStart(finalIntLength, '0')
  }, [prevIntStr, finalIntLength])

  const adjustedPrevDec = React.useMemo(() => {
    if (!newDecStrRaw) return ''

    return prevDecStrRaw.length > newDecStrRaw.length
      ? prevDecStrRaw.slice(0, newDecStrRaw.length)
      : prevDecStrRaw.padEnd(newDecStrRaw.length, '0')
  }, [prevDecStrRaw, newDecStrRaw])

  React.useEffect(() => {
    if (isInView || initiallyStable) {
      prevNumberRef.current = effectiveNumber
    }
  }, [effectiveNumber, isInView, initiallyStable])

  const intPlaces = React.useMemo(
    () =>
      Array.from({ length: finalIntLength }, (_, i) =>
        Math.pow(10, finalIntLength - i - 1),
      ),
    [finalIntLength],
  )

  const decPlaces = React.useMemo(
    () =>
      newDecStrRaw
        ? Array.from({ length: newDecStrRaw.length }, (_, i) =>
            Math.pow(10, newDecStrRaw.length - i - 1),
          )
        : [],
    [newDecStrRaw],
  )

  const expectedRollers = intPlaces.length + decPlaces.length

  const settledRollersRef = React.useRef<{
    revision: number
    displayNumber: number
    placeKeys: Set<string>
  }>({ revision: -1, displayNumber: 0, placeKeys: new Set() })

  const notifiedRevisionRef = React.useRef(-1)

  const handleRollerSettled = React.useCallback(
    (revision: number, displayNumber: number, placeKey: string) => {
      if (revision !== targetRef.current.revision) return
      if (displayNumber !== targetRef.current.number) return

      if (
        settledRollersRef.current.revision !== revision ||
        settledRollersRef.current.displayNumber !== displayNumber
      ) {
        settledRollersRef.current = {
          revision,
          displayNumber,
          placeKeys: new Set(),
        }
      }

      settledRollersRef.current.placeKeys.add(placeKey)

      if (
        settledRollersRef.current.placeKeys.size === expectedRollers &&
        notifiedRevisionRef.current !== revision
      ) {
        notifiedRevisionRef.current = revision
        onValueAnimationComplete?.(targetRef.current.number)
      }
    },
    [expectedRollers, onValueAnimationComplete],
  )

  const newDecValue = newDecStrRaw ? parseInt(newDecStrRaw, 10) : 0
  const prevDecValue = adjustedPrevDec ? parseInt(adjustedPrevDec, 10) : 0

  return (
    <motion.span
      ref={localRef}
      data-slot='sliding-number'
      style={{
        display: 'inline-flex',
        alignItems: 'center',
      }}
      {...props}
    >
      {isInView && Number(number) < 0 && (
        <span style={{ marginRight: '0.25rem' }}>-</span>
      )}

      {intPlaces.map((place, idx) => {
        const digitsToRight = intPlaces.length - idx - 1

        const isSeparatorPosition =
          typeof thousandSeparator !== 'undefined' &&
          digitsToRight > 0 &&
          digitsToRight % 3 === 0

        return (
          <React.Fragment key={`int-${place}`}>
            <SlidingNumberRoller
              prevValue={parseInt(adjustedPrevInt, 10)}
              value={parseInt(newIntStr ?? '0', 10)}
              place={place}
              placeKey={`int-${place}`}
              revision={targetRef.current.revision}
              displayNumber={effectiveNumber}
              transition={transition}
              onSettled={handleRollerSettled}
            />
            {isSeparatorPosition && <span>{thousandSeparator}</span>}
          </React.Fragment>
        )
      })}

      {newDecStrRaw && (
        <>
          <span>{decimalSeparator}</span>
          {decPlaces.map((place) => (
            <SlidingNumberRoller
              key={`dec-${place}`}
              prevValue={prevDecValue}
              value={newDecValue}
              place={place}
              placeKey={`dec-${place}`}
              revision={targetRef.current.revision}
              displayNumber={effectiveNumber}
              transition={transition}
              delay={delay}
              onSettled={handleRollerSettled}
            />
          ))}
        </>
      )}
    </motion.span>
  )
}

export { SlidingNumber, type SlidingNumberProps }
