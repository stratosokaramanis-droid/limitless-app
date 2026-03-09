import { motion } from 'framer-motion'
import { useState } from 'react'

const DECISION_TYPES = [
  { type: 'resist', multiplier: 3, label: 'Resist' },
  { type: 'persist', multiplier: 2, label: 'Persist' },
  { type: 'reframe', multiplier: 2, label: 'Reframe' },
  { type: 'ground', multiplier: 2, label: 'Ground' },
  { type: 'face-boss', multiplier: 5, label: 'Face Boss' },
  { type: 'recenter', multiplier: 2, label: 'Recenter' },
]

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
}

export default function EpisodeOpen({ onStartDay, episode }) {
  const [title, setTitle] = useState(episode?.title || '')
  const [arc, setArc] = useState(episode?.todaysArc || '')
  const [prevExpanded, setPrevExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleBegin = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (title || arc) {
        await fetch('/api/episode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title || undefined, todaysArc: arc || undefined }),
        })
      }
    } catch {}
    onStartDay?.()
    setSubmitting(false)
  }

  const epNumber = episode?.number || '?'
  const previouslyOn = episode?.previouslyOn

  return (
    <div className="flex flex-1 flex-col px-6 py-8">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex flex-1 flex-col"
      >
        {/* Episode number — cinematic */}
        <motion.div variants={fadeUp} className="text-center pt-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/15">
            Episode
          </p>
          <p className="mt-1 text-[56px] font-bold tabular-nums tracking-tight text-white/90">
            {epNumber}
          </p>
          <div className="mx-auto mt-3 h-px w-16 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </motion.div>

        {/* Previously on... */}
        {previouslyOn && (
          <motion.div variants={fadeUp} className="mt-8">
            <button
              type="button"
              onClick={() => setPrevExpanded(e => !e)}
              className="w-full text-left"
            >
              <p className="text-[11px] uppercase tracking-widest text-white/20">
                Previously on... {prevExpanded ? '▴' : '▾'}
              </p>
            </button>
            {prevExpanded && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 text-[13px] italic leading-relaxed text-white/25 border-l-2 border-white/[0.06] pl-4"
              >
                {previouslyOn}
              </motion.p>
            )}
          </motion.div>
        )}

        {/* Title input */}
        <motion.div variants={fadeUp} className="mt-8">
          <label className="block text-[10px] uppercase tracking-widest text-white/20 mb-2">
            Episode Title
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="The one where..."
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-[15px] text-white/80 placeholder-white/15 focus:outline-none focus:border-white/20 transition-colors"
          />
        </motion.div>

        {/* Arc textarea */}
        <motion.div variants={fadeUp} className="mt-5">
          <label className="block text-[10px] uppercase tracking-widest text-white/20 mb-2">
            Today's Arc
          </label>
          <textarea
            value={arc}
            onChange={e => setArc(e.target.value)}
            placeholder="What's the question today?"
            rows={3}
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-[14px] text-white/70 placeholder-white/15 focus:outline-none focus:border-white/20 resize-none transition-colors"
          />
        </motion.div>

        {/* Spacer */}
        <div className="flex-1 min-h-8" />

        {/* Begin Episode button */}
        <motion.div variants={fadeUp} className="pb-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleBegin}
            disabled={submitting}
            className="relative w-full overflow-hidden rounded-2xl border border-white/15 bg-white/10 px-6 py-5 text-[16px] font-semibold text-white"
          >
            <span className="relative z-10">
              {submitting ? 'Starting...' : 'Begin Episode'}
            </span>
            {/* Subtle gradient sweep */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
              }}
            />
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  )
}
