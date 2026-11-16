'use client'

import type { SlidingNumberProps } from '../types'
import { useIsInView } from '@/hooks/use-is-in-view'
import * as React from 'react'
import { useMotionValue, useSpring, motion } from 'motion/react'
import { SlidingNumberRoller } from '../roller'

export function SlidingNumber({
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
