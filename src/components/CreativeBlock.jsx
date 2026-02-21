import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { haptics } from '../utils/haptics.js'
import { sounds } from '../utils/sounds.js'

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export default function CreativeBlock({ startTime, onStart, onEnterWorkSessions }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!startTime) return undefined
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const elapsed = useMemo(() => {
    if (!startTime) return 0
    return now - startTime
  }, [now, startTime])

  const THREE_HOURS = 3 * 60 * 60 * 1000
  const progressPct = startTime ? Math.min((elapsed / THREE_HOURS) * 100, 100) : 0

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <h1 className="text-[28px] font-bold tracking-tight">Creative Block</h1>
        <p className="mt-2 text-[15px] text-white/35">
          3 hours. No agenda. Create freely.
        </p>
      </motion.div>

      {startTime ? (
        <div className="flex flex-col items-center gap-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="font-mono text-[52px] font-extralight tracking-[0.04em] tabular-nums text-white"
          >
            {formatDuration(elapsed)}
          </motion.div>
          {/* Progress arc */}
          <div className="h-1 w-48 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-white/20"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      ) : (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            haptics.heavy()
            sounds.tap()
            onStart()
          }}
          className="rounded-full bg-white/[0.08] px-10 py-[18px] text-[15px] font-semibold text-white"
        >
          Start Block
        </motion.button>
      )}

      <div className="w-full space-y-3">
        <motion.a
          whileTap={{ scale: 0.97 }}
          className="flex items-center justify-center rounded-2xl bg-white/[0.06] px-5 py-3.5 text-[15px] font-medium text-white/50"
          href="https://t.me/limitless_muse_bot"
          target="_blank"
          rel="noreferrer"
          onClick={() => haptics.tap()}
        >
          Check In
        </motion.a>

        <button
          onClick={() => {
            haptics.tap()
            onEnterWorkSessions()
          }}
          className="mx-auto block py-2 text-[13px] font-medium text-white/20"
        >
          Work Sessions
        </button>
      </div>
    </div>
  )
}
