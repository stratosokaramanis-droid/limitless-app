import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

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
        onDone()
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

  const circumference = 2 * Math.PI * 22
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="flex h-full flex-col justify-between bg-card px-6 py-8 text-left">
      <div>
        <div className="mb-4">
          <div className="h-1 w-full bg-white/10">
            <div
              className="h-1 bg-accent"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-gray-400">
            Step {index + 1}/{total}
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-white">{item.title}</h2>
          <p className="text-base leading-relaxed text-gray-400">
            {item.description}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {item.needsPulse ? (
          <a
            className="block w-full border border-white/20 bg-transparent px-4 py-3 text-center text-sm uppercase tracking-wider text-white transition hover:border-white"
            href="https://t.me/limitless_pulse_bot"
            target="_blank"
            rel="noreferrer"
          >
            📲 Open Pulse →
          </a>
        ) : null}

        <button
          className="group relative flex w-full items-center justify-center gap-3 border border-white/20 bg-white/10 px-4 py-4 text-sm uppercase tracking-widest text-white"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="relative h-12 w-12">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 60 60">
              <circle
                cx="30"
                cy="30"
                r="22"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="4"
                fill="none"
              />
              <motion.circle
                cx="30"
                cy="30"
                r="22"
                stroke="#E8E8E8"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset: dashOffset }}
              />
            </svg>
          </div>
          <span className="text-sm">Hold to Done</span>
        </button>

        <button
          onClick={onSkip}
          className="mx-auto block text-xs uppercase tracking-[0.25em] text-gray-500"
        >
          skip
        </button>
      </div>
    </div>
  )
}
