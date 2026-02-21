import { useState } from 'react'
import { motion } from 'framer-motion'
import { haptics } from '../utils/haptics.js'
import { sounds } from '../utils/sounds.js'
import Confetti from './Confetti.jsx'

export default function CompletionScreen({ doneCount, skippedCount, onGoCreative }) {
  const [showConfetti] = useState(true)

  // Fire celebration on mount
  useState(() => {
    haptics.success()
    sounds.success()
  })

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <Confetti active={showConfetti} />
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="text-center"
      >
        <h1 className="text-[28px] font-bold tracking-tight">Morning done.</h1>
        <div className="mt-4 flex items-center justify-center gap-3 text-[15px] text-white/35">
          <span>{doneCount} completed</span>
          <span className="h-1 w-1 rounded-full bg-white/15" />
          <span>{skippedCount} skipped</span>
        </div>
      </motion.div>

      <div className="w-full space-y-3">
        <motion.a
          whileTap={{ scale: 0.97 }}
          className="flex items-center justify-center rounded-2xl bg-white/[0.06] px-5 py-3.5 text-[15px] font-medium text-white/50"
          href="https://t.me/limitless_dawn_bot"
          target="_blank"
          rel="noreferrer"
          onClick={() => haptics.tap()}
        >
          Log Morning
        </motion.a>

        <button
          onClick={() => {
            haptics.tap()
            onGoCreative()
          }}
          className="mx-auto block py-2 text-[13px] font-medium text-white/20"
        >
          Creative Block
        </button>
      </div>
    </div>
  )
}
