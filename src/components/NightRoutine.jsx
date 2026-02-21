import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import nightRoutineItems from '../data/nightRoutine.js'
import { haptics } from '../utils/haptics.js'
import { sounds } from '../utils/sounds.js'
import Confetti from './Confetti.jsx'

const LS_KEY = 'limitless_night_routine'

const slideVariants = {
  enter: { x: 60, opacity: 0, scale: 0.98 },
  center: { x: 0, opacity: 1, scale: 1 },
  exit: { x: -60, opacity: 0, scale: 0.98 },
}

function HoldButton({ onComplete, label }) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const holdingRef = useRef(false)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!holding) {
      setProgress(0)
      holdingRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    holdingRef.current = true
    const start = Date.now()
    const duration = 1000
    const tick = () => {
      if (!holdingRef.current) return
      const elapsed = Date.now() - start
      const pct = Math.min(elapsed / duration, 1)
      setProgress(pct)
      if (pct >= 1) {
        setHolding(false)
        holdingRef.current = false
        haptics.success()
        sounds.complete()
        onComplete()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [holding, onComplete])

  const cancel = () => {
    holdingRef.current = false
    setHolding(false)
    setProgress(0)
  }

  return (
    <motion.button
      whileTap={!holding ? { scale: 0.97 } : undefined}
      onPointerDown={() => {
        haptics.tap()
        setHolding(true)
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      className="relative w-full overflow-hidden rounded-2xl bg-white/[0.08] px-5 py-[18px]"
      animate={holding ? { scale: [0.98, 1.02, 0.98] } : { scale: 1 }}
      transition={holding ? { repeat: Infinity, duration: 0.6 } : {}}
    >
      <div
        className="absolute inset-0"
        style={{
          width: `${progress * 100}%`,
          transition: 'none',
          background: `rgba(48, 209, 88, ${0.1 + progress * 0.3})`
        }}
      />
      <span className="relative block text-[15px] font-semibold text-white">
        {holding ? 'Holding...' : label}
      </span>
    </motion.button>
  )
}

export default function NightRoutine() {
  const [statuses, setStatuses] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })
  const [showConfetti, setShowConfetti] = useState(false)

  // Persist
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(statuses))
  }, [statuses])

  // Reconcile with server
  useEffect(() => {
    fetch('/api/night-routine')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return
        const today = new Date().toISOString().slice(0, 10)
        if (data.date !== today) return
        setStatuses((prev) => {
          const next = { ...prev }
          for (const item of nightRoutineItems) {
            if (item.field && data[item.field]) {
              next[item.id] = 'done'
            }
          }
          if (data.planCompleted && data.tomorrowPlan) {
            next['finalize-plan'] = 'done'
          }
          return { ...next, ...prev }
        })
      })
      .catch(() => {})
  }, [])

  const markDone = (item) => {
    setStatuses((prev) => ({ ...prev, [item.id]: 'done' }))

    if (item.field) {
      const body = { [item.field]: true }
      if (item.timestampField) body[item.timestampField] = new Date().toISOString()
      fetch('/api/night-routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {})
    }
  }

  const skip = (item) => {
    haptics.tap()
    setStatuses((prev) => ({ ...prev, [item.id]: 'skipped' }))
  }

  const nextIndex = nightRoutineItems.findIndex((item) => !statuses[item.id])
  const allDone = nextIndex === -1

  const nightItems = nightRoutineItems.filter((i) => i.phase === 'night')
  const bedItems = nightRoutineItems.filter((i) => i.phase === 'bed')
  const nightDone = nightItems.every((i) => statuses[i.id])
  const currentItem = !allDone ? nightRoutineItems[nextIndex] : null

  const currentPhase = currentItem?.phase === 'bed' ? 'Bed Routine' : 'Night Routine'
  const phaseItems = currentItem?.phase === 'bed' ? bedItems : nightItems
  const phaseIndex = phaseItems.findIndex((i) => i.id === currentItem?.id) + 1
  const phaseTotal = phaseItems.length

  // Dots for current phase
  const phaseDots = phaseItems.map((item, i) => (
    <div
      key={item.id}
      className={`rounded-full transition-all duration-300 ${
        i < phaseIndex - 1 ? 'h-[6px] w-[6px] bg-white/40' :
        i === phaseIndex - 1 ? 'h-[6px] w-5 bg-white' :
        'h-[6px] w-[6px] bg-white/[0.08]'
      }`}
    />
  ))

  // Check if just completed everything
  useEffect(() => {
    if (allDone && Object.keys(statuses).length > 0) {
      setShowConfetti(true)
      sounds.success()
      haptics.success()
      setTimeout(() => setShowConfetti(false), 2500)
    }
  }, [allDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Completion ────────────────────────────────────
  if (allDone) {
    const doneCount = nightRoutineItems.filter((i) => statuses[i.id] === 'done').length
    const skippedCount = nightRoutineItems.filter((i) => statuses[i.id] === 'skipped').length

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <Confetti active={showConfetti} />
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <h1 className="text-[28px] font-bold tracking-tight">Day complete.</h1>
          <div className="mt-4 flex items-center justify-center gap-3 text-[15px] text-white/35">
            <span>{doneCount} completed</span>
            {skippedCount > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/15" />
                <span>{skippedCount} skipped</span>
              </>
            )}
          </div>
          <p className="mt-6 text-[13px] text-white/15">Rest well. Tomorrow starts fresh.</p>
        </motion.div>
      </div>
    )
  }

  // ─── Transition screen: Night → Bed ────────────────
  if (nightDone && currentItem?.phase === 'bed' && !statuses.__bedStarted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-[13px] font-medium uppercase tracking-widest text-white/25">Night routine done</p>
          <h1 className="mt-2 text-[28px] font-bold tracking-tight">Bed Routine</h1>
          <p className="mt-2 text-[15px] text-white/35">Final wind-down. 4 items.</p>
        </motion.div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            haptics.tap()
            setStatuses((prev) => ({ ...prev, __bedStarted: true }))
          }}
          className="w-full rounded-2xl bg-white/[0.08] px-5 py-[18px] text-[15px] font-semibold text-white"
        >
          Continue
        </motion.button>
      </div>
    )
  }

  // ─── Card ──────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col px-6">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 pt-6 pb-2">
        {phaseDots}
        <span className="ml-auto text-[13px] font-medium text-white/25">
          {currentPhase}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex flex-1 flex-col justify-center pb-8"
        >
          <div className="text-center">
            <h1 className="text-[28px] font-bold tracking-tight">{currentItem.title}</h1>
            <p className="mt-3 text-[15px] text-white/40">{currentItem.description}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Actions */}
      <div className="space-y-3 pb-10">
        {currentItem.lunaLink && (
          <motion.a
            whileTap={{ scale: 0.97 }}
            href="https://t.me/limitless_luna_bot"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-2xl bg-white/[0.06] px-5 py-3.5 text-[15px] font-medium text-white/50"
            onClick={() => haptics.tap()}
          >
            Open Luna
          </motion.a>
        )}

        <HoldButton
          onComplete={() => markDone(currentItem)}
          label={'Hold \u2014 Done'}
        />

        <button
          onClick={() => skip(currentItem)}
          className="mx-auto block py-2 text-[13px] font-medium text-white/20 active:text-white/40"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
