import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import HabitCard from './HabitCard.jsx'
import CompletionScreen from './CompletionScreen.jsx'
import CreativeBlock from './CreativeBlock.jsx'
import WorkSessions from './WorkSessions.jsx'
import NightRoutine from './NightRoutine.jsx'

const MODE_KEY = 'limitless_morning_mode'

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i } })
}

const isComplete = (status) => status === 'done' || status === 'skipped'

// Phase timeline row — same style as DashboardTab
function PhaseRow({ label, status, stat, index }) {
  const dotClass =
    status === 'done' ? 'bg-white' :
    status === 'active' ? 'bg-white/30 ring-2 ring-white/20' :
    'bg-white/[0.06]'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + index * 0.06, duration: 0.35 }}
      className="flex items-center gap-4"
    >
      <div className="flex w-6 justify-center">
        <div className={`relative h-3 w-3 rounded-full ${dotClass}`}>
          {status === 'active' && (
            <div className="absolute inset-0 animate-ping rounded-full bg-white/20" />
          )}
        </div>
      </div>
      <span className={`flex-1 text-[15px] font-medium ${
        status === 'done' ? 'text-white/50' :
        status === 'active' ? 'text-white' :
        'text-white/20'
      }`}>
        {label}
      </span>
      {stat && (
        <span className="text-[13px] font-medium tabular-nums text-white/25">{stat}</span>
      )}
    </motion.div>
  )
}

export default function MorningRoutine({
  items,
  statuses,
  currentView,
  onStatusChange,
  onViewChange,
  creativeBlockStartTime,
  onStartCreativeBlock,
  onNewDay,
  dayActive
}) {
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || 'flow')
  const [activeCategory, setActiveCategory] = useState(null)
  const [flowActive, setFlowActive] = useState(false) // whether user tapped Continue in flow mode
  const [morningCheckinDone, setMorningCheckinDone] = useState(false)
  const [creativeCheckinDone, setCreativeCheckinDone] = useState(false)
  const [faithCardHidden, setFaithCardHidden] = useState(false)

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode)
    // Reset states when switching modes
    setActiveCategory(null)
    setFlowActive(false)
  }, [mode])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    fetch('/api/morning-state')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.date === today && d?.energyScore != null) setMorningCheckinDone(true) })
      .catch(() => {})
    fetch('/api/creative-state')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.date === today && d?.energyScore != null) setCreativeCheckinDone(true) })
      .catch(() => {})
  }, [])

  const flatItems = useMemo(() => items.flatMap((category) => category.items), [items])
  const allComplete = flatItems.every(item => isComplete(statuses[item.id]))
  const doneCount = flatItems.filter(item => statuses[item.id] === 'done').length
  const skippedCount = flatItems.filter(item => statuses[item.id] === 'skipped').length

  // Special views
  if (currentView === 'night-routine') return <NightRoutine onNewDay={onNewDay} />
  if (currentView === 'work-sessions') return <WorkSessions onEnterNightMode={() => onViewChange('night-routine')} />
  if (currentView === 'creative-block') {
    return (
      <CreativeBlock
        startTime={creativeBlockStartTime}
        onStart={onStartCreativeBlock}
        onEnterWorkSessions={() => onViewChange('work-sessions')}
      />
    )
  }
  if (allComplete || currentView === 'completed') {
    return (
      <CompletionScreen
        doneCount={doneCount}
        skippedCount={skippedCount}
        onGoCreative={() => onViewChange('creative-block')}
      />
    )
  }

  // ─── FLOW MODE ───────────────────────────────────────────────────────────────
  if (mode === 'flow') {
    const nextItem = flatItems.find(item => !isComplete(statuses[item.id]))
    const currentIndex = nextItem ? flatItems.indexOf(nextItem) : 0
    const currentCategoryIndex = nextItem
      ? items.findIndex(cat => cat.items.some(i => i.id === nextItem.id))
      : -1

    // Phase stats for the timeline
    function getCatStatus(i) {
      const cat = items[i]
      const done = cat.items.every(item => isComplete(statuses[item.id]))
      if (done) return 'done'
      if (i === currentCategoryIndex) return 'active'
      return 'upcoming'
    }
    function getCatStat(i) {
      const cat = items[i]
      const done = cat.items.filter(item => isComplete(statuses[item.id])).length
      return `${done}/${cat.items.length}`
    }

    // FLOW ACTIVE — full screen card, nothing else
    if (flowActive && nextItem) {
      return (
        <div className="flex-1 flex flex-col">
          <HabitCard
            item={nextItem}
            index={currentIndex}
            total={flatItems.length}
            onDone={() => onStatusChange(nextItem.id, 'done')}
            onSkip={() => onStatusChange(nextItem.id, 'skipped')}
          />
        </div>
      )
    }

    // FLOW HOME — phase timeline + Continue button (exactly like the home screen)
    return (
      <div className="flex flex-1 flex-col px-6 py-8">
        {/* Header with mode toggle */}
        <div className="flex items-center justify-between">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[13px] font-medium text-white/25"
          >
            Morning Block
          </motion.p>
          <button
            type="button"
            onClick={() => setMode('free')}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50"
          >
            Free
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8">
          {/* Timeline */}
          <div className="space-y-5">
            {items.map((category, i) => (
              <PhaseRow
                key={category.id}
                label={`${category.emoji} ${category.title}`}
                status={getCatStatus(i)}
                stat={getCatStat(i)}
                index={i}
              />
            ))}
          </div>

          {/* Continue button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setFlowActive(true)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full rounded-2xl bg-white/[0.08] px-5 py-[18px] text-[15px] font-semibold text-white"
          >
            Continue
          </motion.button>
        </div>
      </div>
    )
  }

  // ─── FREE MODE ────────────────────────────────────────────────────────────────

  // Full-screen HabitCard for active category
  if (activeCategory) {
    const category = items.find(c => c.id === activeCategory)
    if (category) {
      const pending = category.items.filter(item => !isComplete(statuses[item.id]))
      if (pending.length > 0) {
        const currentItem = pending[0]
        const allCategoryItems = category.items
        const currentIndex = allCategoryItems.findIndex(i => i.id === currentItem.id)
        return (
          <div className="flex-1 flex flex-col">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className="px-6 pt-6 pb-2 text-left text-[13px] font-medium text-white/30"
            >
              ← {category.emoji} {category.title}
            </button>
            <HabitCard
              item={currentItem}
              index={currentIndex}
              total={allCategoryItems.length}
              onDone={() => onStatusChange(currentItem.id, 'done')}
              onSkip={() => onStatusChange(currentItem.id, 'skipped')}
            />
          </div>
        )
      } else {
        // All done in this category, go back
        setActiveCategory(null)
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-6 pb-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-white/30">Morning block</p>
          <p className="mt-2 text-[22px] font-semibold text-white">Build the day</p>
        </div>
        <button
          type="button"
          onClick={() => setMode('flow')}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60"
        >
          Flow
        </button>
      </div>

      {/* Faith cards */}
      {dayActive && (
        <div className="mt-6 space-y-2">
          {morningCheckinDone ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="flex-1 text-[13px] font-medium text-white/50">Morning check-in done</p>
            </div>
          ) : !faithCardHidden ? (
            <div className="rounded-2xl border border-white/10 bg-white/5">
              <a
                href="https://t.me/FaithLimitlessBot"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-4 py-4"
              >
                <div>
                  <p className="text-[14px] font-semibold text-white">Talk to Faith 🕊️</p>
                  <p className="mt-1 text-[12px] text-white/40">Morning check-in</p>
                </div>
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/50">Open</span>
              </a>
              <button
                type="button"
                onClick={() => setFaithCardHidden(true)}
                className="w-full border-t border-white/5 py-2 text-[11px] text-white/20"
              >
                Hide
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFaithCardHidden(false)}
              className="flex items-center gap-2 py-2 text-[11px] text-white/20"
            >
              🕊️ Show Faith check-in
            </button>
          )}

          {morningCheckinDone && (
            creativeCheckinDone ? (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <p className="text-[13px] font-medium text-white/50">Pre-creative check-in done</p>
              </div>
            ) : (
              <a
                href="https://t.me/FaithLimitlessBot"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-[13px] font-semibold text-white">Pre-creative check-in</p>
                  <p className="mt-1 text-[11px] text-white/40">Talk to Faith before you create</p>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Open</span>
              </a>
            )
          )}
        </div>
      )}

      {/* Category cards */}
      <div className="mt-6 space-y-4">
        {items.map((category, index) => {
          const total = category.items.length
          const completed = category.items.filter(item => isComplete(statuses[item.id])).length
          const allDone = completed === total

          return (
            <motion.button
              key={category.id}
              type="button"
              custom={index}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              whileTap={{ scale: 0.98 }}
              onClick={() => !allDone && setActiveCategory(category.id)}
              className="w-full rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[20px]">{category.emoji}</span>
                  <div>
                    <p className={`text-[15px] font-semibold ${allDone ? 'text-white/40' : 'text-white'}`}>
                      {category.title}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                      {completed}/{total} done
                    </p>
                  </div>
                </div>
                {allDone ? (
                  <div className="h-2 w-2 rounded-full bg-white/40" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                )}
              </div>

              {/* Mini progress bar */}
              <div className="mt-3 h-0.5 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/30 transition-all duration-500"
                  style={{ width: `${(completed / total) * 100}%` }}
                />
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
