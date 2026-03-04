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

const bodyVariants = {
  collapsed: { height: 0, opacity: 0 },
  open: { height: 'auto', opacity: 1 }
}

const isComplete = (status) => status === 'done' || status === 'skipped'

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
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || 'free')
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(items.map((item, i) => [item.id, i === 0]))
  )
  const [morningCheckinDone, setMorningCheckinDone] = useState(false)
  const [creativeCheckinDone, setCreativeCheckinDone] = useState(false)
  const [faithCardHidden, setFaithCardHidden] = useState(false)
  const [activeCategory, setActiveCategory] = useState(null)

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode)
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

  useEffect(() => {
    if (mode === 'flow') {
      setExpanded(Object.fromEntries(items.map((item) => [item.id, true])))
    }
  }, [mode, items])

  const flatItems = useMemo(() => items.flatMap((category) => category.items), [items])
  const nextIndex = flatItems.findIndex((item) => !isComplete(statuses[item.id]))
  const allComplete = nextIndex === -1

  const doneCount = flatItems.filter((item) => statuses[item.id] === 'done').length
  const skippedCount = flatItems.filter((item) => statuses[item.id] === 'skipped').length

  const flowIndex = items.findIndex((category) =>
    category.items.some((item) => !isComplete(statuses[item.id]))
  )
  const flowCategory = flowIndex === -1 ? null : items[flowIndex]

  const toggleItem = (id) => {
    const current = statuses[id]
    if (current === 'done') {
      onStatusChange(id, null)
    } else {
      onStatusChange(id, 'done')
    }
  }

  if (currentView === 'night-routine') {
    return <NightRoutine onNewDay={onNewDay} />
  }

  if (currentView === 'work-sessions') {
    return <WorkSessions onEnterNightMode={() => onViewChange('night-routine')} />
  }

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

  const visibleCategories = mode === 'flow' ? (flowCategory ? [flowCategory] : []) : items

  // Full-screen HabitCard view for active category
  if (activeCategory) {
    const category = items.find(c => c.id === activeCategory)
    if (!category) { setActiveCategory(null) }
    else {
      const categoryItems = category.items.filter(item => !isComplete(statuses[item.id]))
      if (categoryItems.length === 0) {
        setActiveCategory(null)
      } else {
        const currentItem = categoryItems[0]
        const allCategoryItems = category.items
        const currentIndex = allCategoryItems.findIndex(i => i.id === currentItem.id)
        return (
          <div className="flex-1 flex flex-col">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className="px-6 pt-6 pb-2 text-left text-[13px] font-medium text-white/30"
            >
              ← Back to {category.emoji} {category.title}
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
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-6 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-white/30">Morning block</p>
          <p className="mt-2 text-[22px] font-semibold text-white">Build the day</p>
        </div>
        <button
          type="button"
          onClick={() => setMode(mode === 'free' ? 'flow' : 'free')}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60"
        >
          <span className="h-2 w-2 rounded-full bg-white/40" />
          {mode === 'free' ? 'Flow' : 'Free'}
        </button>
      </div>

      {dayActive && (
        <div className="mt-6 space-y-2">
          {/* Morning check-in status */}
          {morningCheckinDone ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
            >
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="flex-1 text-[13px] font-medium text-white/50">Morning check-in done</p>
              {!creativeCheckinDone && (
                <a
                  href="https://t.me/FaithLimitlessBot"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30"
                >
                  Reopen
                </a>
              )}
            </motion.div>
          ) : !faithCardHidden ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/5"
            >
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
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={() => setFaithCardHidden(false)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-[11px] text-white/20"
            >
              <span>🕊️</span> Show Faith check-in
            </button>
          )}

          {/* Pre-creative check-in status */}
          {morningCheckinDone && (
            creativeCheckinDone ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <p className="flex-1 text-[13px] font-medium text-white/50">Pre-creative check-in done</p>
              </motion.div>
            ) : (
              <motion.a
                href="https://t.me/FaithLimitlessBot"
                target="_blank"
                rel="noreferrer"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-[13px] font-semibold text-white">Pre-creative check-in</p>
                  <p className="mt-1 text-[11px] text-white/40">Talk to Faith before you create</p>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Open</span>
              </motion.a>
            )
          )}
        </div>
      )}

      {mode === 'flow' && (
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/40">Flow mode</p>
          <p className="text-[12px] font-semibold text-white/60">
            {flowIndex === -1 ? items.length : flowIndex + 1}/{items.length}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {visibleCategories.map((category, index) => {
          const total = category.items.length
          const completed = category.items.filter((item) => isComplete(statuses[item.id])).length
          const isExpanded = mode === 'flow' ? true : expanded[category.id]

          return (
            <motion.div
              key={category.id}
              custom={index}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="rounded-3xl border border-white/10 bg-white/[0.04]"
            >
              <button
                type="button"
                onClick={() => {
                  // If all items in this category are complete, just toggle expand
                  const hasIncomplete = category.items.some(item => !isComplete(statuses[item.id]))
                  if (hasIncomplete) {
                    setActiveCategory(category.id)
                    return
                  }
                  if (mode === 'flow') return
                  setExpanded((prev) => ({ ...prev, [category.id]: !prev[category.id] }))
                }}
                className="flex w-full items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[20px]" aria-hidden>
                    {category.emoji}
                  </span>
                  <div className="text-left">
                    <p className="text-[15px] font-semibold text-white">{category.title}</p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                      {completed}/{total} complete
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    {isExpanded ? 'Hide' : 'Open'}
                  </span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="body"
                    variants={bodyVariants}
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 px-5 pb-5">
                      {category.items.map((item) => {
                        const done = statuses[item.id] === 'done'
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left"
                          >
                            <div className={`mt-1 h-4 w-4 rounded-full border ${done ? 'border-white bg-white' : 'border-white/30'}`}>
                              {done && <div className="h-full w-full rounded-full bg-black" />}
                            </div>
                            <div className="flex-1">
                              <p className={`text-[14px] font-semibold ${done ? 'text-white/70 line-through' : 'text-white'}`}>
                                {item.title}
                              </p>
                              <p className="mt-1 text-[12px] text-white/40">{item.description}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
