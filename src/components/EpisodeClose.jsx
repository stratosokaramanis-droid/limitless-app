import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

function RatingIcon({ value, size = 20 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (value) {
    case 'fire': return <svg {...p}><path d="M12 22c-2-3-8-7-8-13a8 8 0 0116 0c0 6-6 10-8 13z" /></svg>
    case 'grind': return <svg {...p}><path d="M4 14l4-4 4 4 8-8" /><path d="M16 6h4v4" /></svg>
    case 'numb': return <svg {...p}><path d="M4 12h16" /></svg>
    case 'breakthrough': return <svg {...p}><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" /></svg>
    case 'sleepwalk': return <svg {...p}><path d="M2 12c2-2 4-3 6-3s4 1 6 3 4 3 6 3 4-1 6-3" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="8" /></svg>
  }
}

const RATINGS = [
  { value: 'fire', label: 'Fire' },
  { value: 'grind', label: 'Grind' },
  { value: 'numb', label: 'Numb' },
  { value: 'breakthrough', label: 'Break' },
  { value: 'sleepwalk', label: 'Sleep' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.06, duration: 0.4 } }),
}

export default function EpisodeClose({ episode, onClose }) {
  const [rating, setRating] = useState(episode?.rating || null)
  const [showCredits, setShowCredits] = useState(false)
  const [saving, setSaving] = useState(false)

  const plotPoints = episode?.plotPoints || []

  const handleRate = async (value) => {
    setRating(value)
    try {
      await fetch('/api/episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: value }),
      })
    } catch {}
  }

  const handleClose = async () => {
    if (saving) return
    setSaving(true)
    try {
      await fetch('/api/episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })
    } catch {}
    onClose?.()
    setSaving(false)
  }

  return (
    <div className="flex flex-1 flex-col px-6 py-8 overflow-y-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center pt-4"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/15">
          Episode {episode?.number || '?'}
        </p>
        <h1 className="mt-3 text-[28px] font-bold tracking-tight text-white">
          Episode Complete
        </h1>
        {episode?.title && (
          <p className="mt-2 text-[14px] italic text-white/30">"{episode.title}"</p>
        )}
        <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </motion.div>

      {/* Key Scenes */}
      {plotPoints.length > 0 && (
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mt-8">
          <p className="text-[11px] uppercase tracking-widest text-white/20 mb-3">Key Scenes</p>
          <div className="space-y-2">
            {plotPoints.map((pt, i) => {
              const time = pt.timestamp ? new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
              return (
                <motion.div
                  key={pt.id || i}
                  custom={i + 1}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  className="flex items-start gap-3 rounded-xl bg-white/[0.03] px-4 py-3"
                >
                  <span className="mt-0.5 text-[10px] text-white/15 tabular-nums shrink-0 w-10">
                    {time || `#${i + 1}`}
                  </span>
                  <span className="text-[13px] text-white/40">{pt.description}</span>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Episode stats */}
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show"
        className="mt-6 flex gap-3"
      >
        <div className="flex-1 rounded-xl bg-white/[0.03] px-4 py-3 text-center">
          <span className="block text-[18px] font-bold text-white/50 tabular-nums">{plotPoints.length}</span>
          <span className="block text-[10px] text-white/20">Scenes</span>
        </div>
        <div className="flex-1 rounded-xl bg-white/[0.03] px-4 py-3 text-center">
          <span className="block text-[18px] font-bold text-white/50">{episode?.status === 'closed' ? 'Closed' : 'Open'}</span>
          <span className="block text-[10px] text-white/20">Status</span>
        </div>
      </motion.div>

      {/* Rating */}
      <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-8">
        <p className="text-[11px] uppercase tracking-widest text-white/20 mb-3">Rate This Episode</p>
        <div className="flex justify-between gap-2">
          {RATINGS.map(({ value, label }) => (
            <motion.button
              key={value}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleRate(value)}
              className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 flex-1 transition-colors ${
                rating === value
                  ? 'bg-white/[0.12] ring-1 ring-white/20'
                  : 'bg-white/[0.03]'
              }`}
            >
              <span className={rating === value ? 'text-white/70' : 'text-white/25'}>
                <RatingIcon value={value} size={20} />
              </span>
              <span className={`text-[9px] font-medium ${rating === value ? 'text-white/60' : 'text-white/20'}`}>
                {label}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Credits toggle */}
      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show" className="mt-6">
        <button
          type="button"
          onClick={() => setShowCredits(c => !c)}
          className="text-[11px] text-white/15 underline underline-offset-2"
        >
          {showCredits ? 'Hide credits' : 'Roll credits'}
        </button>
        <AnimatePresence>
          {showCredits && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden rounded-xl bg-white/[0.02] px-4 py-4 text-center space-y-2"
            >
              <p className="text-[12px] text-white/20">Starring: <span className="text-white/40">Stef</span></p>
              <p className="text-[12px] text-white/20">Directed by: <span className="text-white/40">The Universe</span></p>
              <p className="text-[12px] text-white/20">Written by: <span className="text-white/40">Every decision you made today</span></p>
              <p className="text-[12px] text-white/20">Produced by: <span className="text-white/40">The Limitless System</span></p>
              {episode?.todaysArc && (
                <p className="mt-2 text-[11px] italic text-white/15">"{episode.todaysArc}"</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Spacer */}
      <div className="flex-1 min-h-8" />

      {/* Close button */}
      <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show" className="pb-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleClose}
          disabled={saving}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-4 text-[15px] font-semibold text-white/70"
        >
          {saving ? 'Closing...' : 'End Episode'}
        </motion.button>
      </motion.div>
    </div>
  )
}
