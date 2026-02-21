import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { haptics } from '../utils/haptics.js'

const TIER_NAMES = ['', 'Initiate', 'Apprentice', 'Practitioner', 'Adept', 'Master']
const TIER_XP = [0, 0, 750, 3000, 10000, 30000]

function BadgeCard({ badge, progress, missions, expanded, onToggle }) {
  const xp = progress?.xp || 0
  const tier = progress?.tier || 1
  const streak = progress?.currentStreak || 0
  const nextTier = tier < 5 ? tier + 1 : null
  const nextXp = nextTier ? TIER_XP[nextTier] : null
  const prevXp = TIER_XP[tier]
  const progressPct = nextXp ? Math.min(((xp - prevXp) / (nextXp - prevXp)) * 100, 100) : 100

  const activeMission = missions?.find((m) => m.badgeSlug === badge.slug && m.status === 'pending')

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-2xl bg-white/[0.03]"
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
    >
      {/* Header */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          haptics.tap()
          onToggle()
        }}
        className="flex w-full items-center gap-3.5 px-5 py-4 text-left"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04]">
          <span className="text-[20px]">{badge.emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-white truncate">{badge.name}</span>
            {streak >= 7 && (
              <span className="text-[11px] font-medium text-amber-400/80">{streak}d</span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="text-[11px] font-medium text-white/25">{TIER_NAMES[tier]}</span>
            <div className="flex-1 h-[5px] rounded-full overflow-hidden bg-white/[0.04]">
              <motion.div
                className="h-full rounded-full bg-white/20"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[11px] font-medium tabular-nums text-white/20">{xp}</span>
          </div>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="text-[10px] text-white/15"
        >
          \u25BC
        </motion.span>
      </motion.button>

      {/* Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.04] px-5 py-4 space-y-4">
              {/* Identity statement */}
              <p className="text-[13px] italic leading-relaxed text-white/30">
                "{badge.identityStatement}"
              </p>

              {/* Stats */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/20">
                <span>Tier {tier}/5</span>
                <span>{progress?.exercisesCompleted || 0} exercises</span>
                <span>{progress?.missionsCompleted || 0} missions</span>
                <span>{progress?.bossEncounters || 0} bosses</span>
              </div>

              {nextXp && (
                <p className="text-[12px] text-white/15">
                  {nextXp - xp} XP to {TIER_NAMES[nextTier]}
                </p>
              )}

              {/* Active mission */}
              {activeMission && (
                <div className="rounded-xl bg-white/[0.03] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-white/20">Active Mission</p>
                  <p className="mt-1.5 text-[14px] font-medium text-white">{activeMission.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/35">{activeMission.description}</p>
                  <p className="mt-2 text-[12px] text-white/20">
                    {activeMission.successCriteria} · +{activeMission.rewardXp} XP
                  </p>
                </div>
              )}

              {/* Streak */}
              <div className="flex items-center gap-3 text-[12px] text-white/20">
                <span>Streak: {streak}d</span>
                <span>Best: {progress?.longestStreak || 0}d</span>
                {streak >= 7 && streak < 14 && <span className="text-amber-400/60">1.25x</span>}
                {streak >= 14 && streak < 30 && <span className="text-amber-400/60">1.5x</span>}
                {streak >= 30 && <span className="text-amber-400/70">2.0x</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function BadgesTab() {
  const [badges, setBadges] = useState(null)
  const [progress, setProgress] = useState(null)
  const [missions, setMissions] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/badges').then((r) => r.ok ? r.json() : null),
      fetch('/api/badge-progress').then((r) => r.ok ? r.json() : null),
      fetch('/api/badge-missions').then((r) => r.ok ? r.json() : null),
    ])
      .then(([b, p, m]) => {
        if (b) setBadges(b)
        if (p) setProgress(p)
        if (m) setMissions(m)
        if (!b) setError(true)
      })
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-[15px] text-white/25">
        Could not load badges.
      </div>
    )
  }

  if (!badges) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    )
  }

  const totalXp = badges.badges.reduce((sum, b) => sum + (progress?.badges?.[b.slug]?.xp || 0), 0)
  const avgTier = badges.badges.reduce((sum, b) => sum + (progress?.badges?.[b.slug]?.tier || 1), 0) / badges.badges.length
  const activeMissions = missions?.active?.filter((m) => m.status === 'pending').length || 0

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-[28px] font-bold tracking-tight">Badges</h1>
        <div className="mt-2 flex items-center gap-3 text-[13px] text-white/25">
          <span>{totalXp} XP</span>
          <span className="h-1 w-1 rounded-full bg-white/10" />
          <span>Tier {avgTier.toFixed(1)}</span>
          <span className="h-1 w-1 rounded-full bg-white/10" />
          <span>{activeMissions} active</span>
        </div>
      </div>

      {/* Badge list */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6 space-y-2">
        {badges.badges.map((badge) => (
          <BadgeCard
            key={badge.slug}
            badge={badge}
            progress={progress?.badges?.[badge.slug]}
            missions={missions?.active}
            expanded={expanded === badge.slug}
            onToggle={() => setExpanded(expanded === badge.slug ? null : badge.slug)}
          />
        ))}
      </div>
    </div>
  )
}
