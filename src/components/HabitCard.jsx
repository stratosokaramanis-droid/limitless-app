import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptics } from '../utils/haptics.js'
import { sounds } from '../utils/sounds.js'

const HOLD_DURATION = 1000

export default function HabitCard({
  item,
  index,
  total,
  onDone,
  onSkip
}) {
  const [isHolding, setIsHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const rafRef = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    if (!isHolding) return undefined

    const step = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const nextProgress = Math.min(elapsed / HOLD_DURATION, 1)
      setProgress(nextProgress)

      if (nextProgress >= 1) {
        setIsHolding(false)
        startRef.current = null
        setCompleted(true)
        haptics.success()
        sounds.complete()
        setTimeout(onDone, 350)
        return
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [isHolding, onDone])

  const handlePointerDown = () => {
    haptics.tap()
    setProgress(0)
    startRef.current = null
    setIsHolding(true)
  }

  const handlePointerUp = () => {
    if (progress < 1) {
      setIsHolding(false)
      setProgress(0)
    }
  }

  // Step dots
  const dots = Array.from({ length: total }, (_, i) => (
    <div
      key={i}
      className={`rounded-full transition-all duration-300 ${
        i < index ? 'h-[6px] w-[6px] bg-white/40' :
        i === index ? 'h-[6px] w-5 bg-white' :
        'h-[6px] w-[6px] bg-white/[0.08]'
      }`}
    />
  ))

  return (
    <div className="flex h-full flex-col px-6">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 pt-6 pb-2">
        {dots}
        <span className="ml-auto text-[13px] font-medium tabular-nums text-white/25">
          {index + 1}/{total}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center pb-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h1 className="text-[28px] font-bold tracking-tight leading-tight text-white">
            {item.title}
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed text-white/40">
            {item.description}
          </p>
        </motion.div>
      </div>

      {/* Actions */}
      <div className="space-y-3 pb-10">
        {item.needsPulse && (
          <motion.a
            whileTap={{ scale: 0.97 }}
            className="flex items-center justify-center rounded-2xl bg-white/[0.06] px-5 py-3.5 text-[15px] font-medium text-white/50"
            href="https://t.me/limitless_pulse_bot"
            target="_blank"
            rel="noreferrer"
            onClick={() => haptics.tap()}
          >
            Open Pulse
          </motion.a>
        )}

        <motion.button
          whileTap={!isHolding ? { scale: 0.97 } : undefined}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-full overflow-hidden rounded-2xl bg-white/[0.08] px-5 py-[18px]"
          animate={isHolding ? { scale: [0.98, 1.02, 0.98] } : { scale: 1 }}
          transition={isHolding ? { repeat: Infinity, duration: 0.6 } : {}}
        >
          <div
            className="absolute inset-0"
            style={{
              width: `${progress * 100}%`,
              transition: 'none',
              background: `rgba(48, 209, 88, ${0.1 + progress * 0.3})`
            }}
          />
          <AnimatePresence mode="wait" initial={false}>
            {completed ? (
              <motion.span
                key="check"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="relative block text-[15px] font-semibold text-white"
              >
                Done
              </motion.span>
            ) : (
              <motion.span
                key="label"
                className="relative block text-[15px] font-semibold text-white"
              >
                {isHolding ? 'Holding...' : 'Hold \u2014 Done'}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <button
          onClick={() => {
            haptics.tap()
            onSkip()
          }}
          className="mx-auto block py-2 text-[13px] font-medium text-white/20 active:text-white/40"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
