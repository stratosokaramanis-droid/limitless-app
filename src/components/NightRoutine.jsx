import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import nightRoutineItems from '../data/nightRoutine.js'

const LS_KEY = 'limitless_night_routine'

const slideVariants = {
  enter: { x: 120, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -120, opacity: 0 },
}

function HoldButton({ onComplete, label }) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)

  useEffect(() => {
    if (!holding) { setProgress(0); return }
    const start = Date.now()
    const duration = 1000
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(elapsed / duration, 1)
      setProgress(pct)
      if (pct >= 1) { onComplete(); return }
      requestAnimationFrame(tick)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [holding, onComplete])

  return (
    <button
      onPointerDown={() => setHolding(true)}
      onPointerUp={() => setHolding(false)}
      onPointerLeave={() => setHolding(false)}
      className="relative w-full overflow-hidden border border-white/20 bg-white/10 px-4 py-3 text-sm uppercase tracking-wider text-white"
    >
      <div
        className="absolute inset-0 bg-white/20 transition-none"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative">{label}</span>
    </button>
  )
}

export default function NightRoutine() {
  const [statuses, setStatuses] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

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
          // finalize-plan has no field, mark done if plan is completed
          if (data.planCompleted && data.tomorrowPlan) {
            next['finalize-plan'] = 'done'
          }
          return { ...next, ...prev } // local wins for items in progress
        })
      })
      .catch(() => {})
  }, [])

  const markDone = (item) => {
    setStatuses((prev) => ({ ...prev, [item.id]: 'done' }))

    // POST to server
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
    setStatuses((prev) => ({ ...prev, [item.id]: 'skipped' }))
  }

  const nextIndex = nightRoutineItems.findIndex((item) => !statuses[item.id])
  const allDone = nextIndex === -1

  const nightItems = nightRoutineItems.filter((i) => i.phase === 'night')
  const bedItems = nightRoutineItems.filter((i) => i.phase === 'bed')
  const nightDone = nightItems.every((i) => statuses[i.id])
  const currentItem = !allDone ? nightRoutineItems[nextIndex] : null

  // Phase label
  const currentPhase = currentItem?.phase === 'bed' ? 'Bed Routine' : 'Night Routine'
  const phaseIndex = currentItem?.phase === 'bed'
    ? bedItems.findIndex((i) => i.id === currentItem.id) + 1
    : nightItems.findIndex((i) => i.id === currentItem?.id) + 1
  const phaseTotal = currentItem?.phase === 'bed' ? bedItems.length : nightItems.length

  // ─── Completion ────────────────────────────────────
  if (allDone) {
    const doneCount = nightRoutineItems.filter((i) => statuses[i.id] === 'done').length
    const skippedCount = nightRoutineItems.filter((i) => statuses[i.id] === 'skipped').length

    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <h2 className="text-2xl font-semibold">Day complete.</h2>
        <div className="space-y-2 text-sm text-gray-400">
          <p>✅ {doneCount} completed</p>
          {skippedCount > 0 && <p>⏭ {skippedCount} skipped</p>}
        </div>
        <p className="text-xs text-gray-600">Rest well. Tomorrow starts fresh.</p>
      </div>
    )
  }

  // ─── Transition screen: Night → Bed ────────────────
  if (nightDone && currentItem?.phase === 'bed' && !statuses.__bedStarted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Night routine done</p>
          <h2 className="mt-2 text-2xl font-semibold">Bed Routine</h2>
          <p className="mt-2 text-sm text-gray-400">Final wind-down. 4 items.</p>
        </div>
        <button
          onClick={() => setStatuses((prev) => ({ ...prev, __bedStarted: true }))}
          className="w-full border border-white/20 bg-white/10 px-4 py-3 text-xs uppercase tracking-[0.3em] text-white"
        >
          Continue →
        </button>
      </div>
    )
  }

  // ─── Card ──────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      {/* Progress bar */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="text-xs uppercase tracking-wider text-gray-500">{currentPhase}</span>
        <span className="ml-auto text-xs text-gray-600">{phaseIndex} / {phaseTotal}</span>
      </div>
      <div className="mx-4 h-0.5 bg-white/10">
        <div
          className="h-full bg-white/30 transition-all duration-300"
          style={{ width: `${(phaseIndex / phaseTotal) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center"
        >
          <div>
            <h2 className="text-2xl font-semibold">{currentItem.title}</h2>
            <p className="mt-2 text-sm text-gray-400">{currentItem.description}</p>
          </div>

          {currentItem.lunaLink && (
            <a
              href="https://t.me/limitless_luna_bot"
              target="_blank"
              rel="noreferrer"
              className="w-full border border-white/20 bg-white/10 px-4 py-3 text-center text-sm uppercase tracking-wider text-white"
            >
              💬 Open Luna →
            </a>
          )}

          <HoldButton
            onComplete={() => markDone(currentItem)}
            label="Hold — Done"
          />

          <button
            onClick={() => skip(currentItem)}
            className="text-xs uppercase tracking-[0.25em] text-gray-600"
          >
            Skip
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
