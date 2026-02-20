import { useEffect, useState } from 'react'

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
    <div className="border border-white/10 bg-white/[0.03]">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-2xl">{badge.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{badge.name}</span>
            {streak >= 7 && (
              <span className="text-xs text-yellow-400">🔥{streak}d</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-500">{TIER_NAMES[tier]}</span>
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/30 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-gray-600">{xp}</span>
          </div>
        </div>
        <span className={`text-xs text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 space-y-3">
          {/* Identity statement */}
          <p className="text-xs italic text-gray-400">"{badge.identityStatement}"</p>

          {/* Stats row */}
          <div className="flex gap-4 text-xs text-gray-500">
            <span>Tier {tier}/5</span>
            <span>{progress?.exercisesCompleted || 0} exercises</span>
            <span>{progress?.missionsCompleted || 0} missions</span>
            <span>{progress?.bossEncounters || 0} bosses</span>
          </div>

          {/* XP to next tier */}
          {nextXp && (
            <div className="text-xs text-gray-600">
              {nextXp - xp} XP to {TIER_NAMES[nextTier]}
            </div>
          )}

          {/* Active mission */}
          {activeMission && (
            <div className="border border-white/10 bg-white/[0.02] p-3">
              <p className="text-xs uppercase tracking-wider text-gray-500">Active Mission</p>
              <p className="mt-1 text-sm text-white">{activeMission.title}</p>
              <p className="mt-1 text-xs text-gray-400">{activeMission.description}</p>
              <p className="mt-1 text-xs text-gray-600">
                ✓ {activeMission.successCriteria} · +{activeMission.rewardXp} XP
              </p>
            </div>
          )}

          {/* Streak info */}
          <div className="flex gap-4 text-xs text-gray-600">
            <span>Streak: {streak}d</span>
            <span>Best: {progress?.longestStreak || 0}d</span>
            {streak >= 7 && streak < 14 && <span className="text-yellow-500">1.25x XP</span>}
            {streak >= 14 && streak < 30 && <span className="text-yellow-500">1.5x XP</span>}
            {streak >= 30 && <span className="text-yellow-400">2.0x XP</span>}
          </div>
        </div>
      )}
    </div>
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
      <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
        Could not load badges. Is the file server running?
      </div>
    )
  }

  if (!badges) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-gray-600">
        Loading...
      </div>
    )
  }

  const totalXp = badges.badges.reduce((sum, b) => sum + (progress?.badges?.[b.slug]?.xp || 0), 0)
  const avgTier = badges.badges.reduce((sum, b) => sum + (progress?.badges?.[b.slug]?.tier || 1), 0) / badges.badges.length

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-lg font-semibold">Mental Badges</h2>
        <div className="mt-1 flex gap-4 text-xs text-gray-500">
          <span>{totalXp} total XP</span>
          <span>Avg tier: {avgTier.toFixed(1)}</span>
          <span>{missions?.active?.filter((m) => m.status === 'pending').length || 0} active missions</span>
        </div>
      </div>

      {/* Badge list */}
      <div className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
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
