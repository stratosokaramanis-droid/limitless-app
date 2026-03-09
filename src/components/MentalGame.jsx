import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { haptics } from '../utils/haptics.js'
import BadgeDetailSheet from './BadgeDetailSheet.jsx'

const TIER_NAMES = ['', 'Initiate', 'Apprentice', 'Warrior', 'Champion', 'Master']
const TIER_XP = [0, 0, 750, 3000, 10000, 30000]
const TIER_COLORS = ['', '#6B7280', '#60A5FA', '#A78BFA', '#F59E0B', '#EF4444']

const DISCIPLINE_COLORS = {
  'reality-distortion-field': '#FF6B6B',
  'frame-control': '#4ECDC4',
  'fearlessness': '#FF9F43',
  'aggression': '#EE5A24',
  'carefreeness': '#7ED6DF',
  'presence': '#B8E994',
  'bias-to-action': '#F8C291',
}

// SVG glyph icons — geometric martial-arts symbols
function DisciplineGlyph({ slug, size = 22, color }) {
  const c = color || DISCIPLINE_COLORS[slug] || '#888'
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (slug) {
    case 'reality-distortion-field': return <svg {...p}><path d="M12 5l7 7-7 7-7-7z" /><circle cx="12" cy="12" r="2.5" fill={c} fillOpacity="0.15" /></svg>
    case 'frame-control': return <svg {...p}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /></svg>
    case 'fearlessness': return <svg {...p}><path d="M12 2v16M8 6l4-4 4 4M7 22h10" /></svg>
    case 'aggression': return <svg {...p}><path d="M12 22c-2-3-8-7-8-13a8 8 0 0116 0c0 6-6 10-8 13z" /></svg>
    case 'carefreeness': return <svg {...p}><path d="M2 12c3-4 6-5 10-5s7 1 10 5" /><path d="M2 17c3-4 6-5 10-5s7 1 10 5" /></svg>
    case 'presence': return <svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>
    case 'bias-to-action': return <svg {...p}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>
  }
}

// ─── Rank Seal (Centerpiece) ────────────────────────────────────────────────

function RankSeal({ badges, progress, dailyXp }) {
  if (!badges?.length) return null
  const tiers = badges.map(b => progress?.[b.slug]?.tier || 1)
  const avgTier = tiers.reduce((a, b) => a + b, 0) / tiers.length
  const totalXp = badges.reduce((sum, b) => sum + (progress?.[b.slug]?.xp || 0), 0)
  const totalTiers = tiers.reduce((a, b) => a + b, 0)
  const maxTiers = badges.length * 5
  const rankPct = (totalTiers / maxTiers) * 100

  const rankName = avgTier >= 4.5 ? 'Master' : avgTier >= 3.5 ? 'Champion' : avgTier >= 2.5 ? 'Warrior' : avgTier >= 1.5 ? 'Apprentice' : 'Initiate'
  const rankColor = avgTier >= 4.5 ? '#EF4444' : avgTier >= 3.5 ? '#F59E0B' : avgTier >= 2.5 ? '#A78BFA' : avgTier >= 1.5 ? '#60A5FA' : '#6B7280'

  const r = 58
  const circ = 2 * Math.PI * r

  return (
    <div className="relative flex flex-col items-center py-2">
      {/* Ambient glow from rank color */}
      <div
        className="pointer-events-none absolute inset-0 -top-8 opacity-40"
        style={{ background: `radial-gradient(ellipse at center top, ${rankColor}15 0%, transparent 70%)` }}
      />

      {/* SVG Seal Ring */}
      <div className="relative" style={{ width: 148, height: 148 }}>
        <svg width="148" height="148" viewBox="0 0 148 148" className="absolute inset-0">
          {/* Outer dashed decorative ring */}
          <circle cx="74" cy="74" r="70" stroke={rankColor} strokeWidth="0.5" fill="none" strokeOpacity="0.1" strokeDasharray="3 8" />
          {/* Track */}
          <circle cx="74" cy="74" r={r} stroke="rgba(255,255,255,0.04)" strokeWidth="3.5" fill="none" />
          {/* Progress arc */}
          <motion.circle
            cx="74" cy="74" r={r}
            stroke={rankColor} strokeWidth="3.5" fill="none" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ * (1 - rankPct / 100) }}
            transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '74px 74px' }}
          />
          {/* Inner decorative ring */}
          <circle cx="74" cy="74" r="48" stroke={rankColor} strokeWidth="0.5" fill="none" strokeOpacity="0.06" />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] uppercase tracking-[0.3em] text-white/15">Rank</span>
          <motion.span
            key={rankName}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-[22px] font-bold leading-tight"
            style={{ color: rankColor }}
          >
            {rankName}
          </motion.span>
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[28px] font-black tabular-nums text-white/50">{totalXp.toLocaleString()}</span>
        <span className="text-[11px] text-white/15">XP</span>
      </div>

      {dailyXp > 0 && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 text-[12px] font-semibold text-emerald-400/50 tabular-nums"
        >
          +{dailyXp} today
        </motion.span>
      )}
    </div>
  )
}

// ─── Discipline Card (Skill Node) ───────────────────────────────────────────

function DisciplineCard({ badge, progress, hasMission, onSelect, fullWidth }) {
  const xp = progress?.xp || 0
  const tier = progress?.tier || 1
  const streak = progress?.currentStreak || 0
  const nextTier = tier < 5 ? tier + 1 : null
  const nextXp = nextTier ? TIER_XP[nextTier] : null
  const prevXp = TIER_XP[tier]
  const pct = nextXp ? Math.min(((xp - prevXp) / (nextXp - prevXp)) * 100, 100) : 100
  const color = DISCIPLINE_COLORS[badge.slug] || '#888'

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={() => { haptics.tap(); onSelect?.() }}
      className={`flex flex-col rounded-2xl p-4 text-left relative overflow-hidden ${fullWidth ? 'col-span-2' : ''}`}
      style={{
        background: `linear-gradient(160deg, ${color}0A 0%, rgba(0,0,0,0.4) 100%)`,
        border: `1px solid ${color}20`,
        boxShadow: hasMission ? `0 0 24px ${color}08` : 'none',
      }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-4 right-4 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />

      {/* Mission pulse */}
      {hasMission && (
        <motion.div
          className="absolute top-3 right-3 h-2 w-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="flex items-start justify-between mb-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: `${color}10`, border: `1px solid ${color}15` }}
        >
          <DisciplineGlyph slug={badge.slug} size={20} color={color} />
        </div>
        <div className="flex items-center gap-1.5">
          {streak > 0 && (
            <span className="text-[10px] font-medium text-amber-400/40 tabular-nums">{streak}d</span>
          )}
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: `${TIER_COLORS[tier]}12`, color: TIER_COLORS[tier] }}
          >
            {TIER_NAMES[tier]}
          </span>
        </div>
      </div>

      <span className="text-[13px] font-semibold text-white/75">{badge.name}</span>

      <div className="mt-auto pt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-white/20 tabular-nums">{xp.toLocaleString()} XP</span>
          {nextXp ? (
            <span className="text-[10px] text-white/12 tabular-nums">{nextXp.toLocaleString()}</span>
          ) : (
            <span className="text-[9px] font-bold" style={{ color }}>MAX</span>
          )}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${color}08` }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${color}60, ${color})`, boxShadow: `0 0 8px ${color}30` }}
          />
        </div>
      </div>
    </motion.button>
  )
}

// ─── Active Missions (Quest Board) ──────────────────────────────────────────

function ActiveMissions({ missions }) {
  const pending = missions?.active?.filter(m => m.status === 'pending') || []
  if (pending.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <motion.div
          className="h-1.5 w-1.5 rounded-full bg-amber-400"
          animate={{ opacity: [0.4, 1, 0.4], boxShadow: ['0 0 0px rgba(251,191,36,0)', '0 0 6px rgba(251,191,36,0.4)', '0 0 0px rgba(251,191,36,0)'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400/50">Active Missions</p>
      </div>
      <div className="space-y-2">
        {pending.slice(0, 3).map(m => {
          const color = DISCIPLINE_COLORS[m.badgeSlug] || '#888'
          return (
            <div
              key={m.missionId}
              className="rounded-xl px-4 py-3 relative overflow-hidden"
              style={{ background: `${color}06`, border: `1px solid ${color}12` }}
            >
              <div className="absolute top-0 left-0 w-[3px] h-full" style={{ background: color, opacity: 0.4 }} />
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-semibold text-white/55">{m.title}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${color}15`, color }}>
                  +{m.rewardXp} XP
                </span>
              </div>
              <p className="text-[11px] text-white/20">{m.successCriteria || m.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Training Log ───────────────────────────────────────────────────────────

function DailyTraining({ badgeDaily }) {
  const exercises = badgeDaily?.exercises || []
  const missions = badgeDaily?.missionsAttempted || []
  const totalXp = [...exercises, ...missions].reduce((sum, e) => sum + (e.xpGained || 0), 0)

  if (exercises.length === 0 && missions.length === 0) {
    return (
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.03] px-4 py-5 text-center">
        <p className="text-[13px] text-white/15">No training yet today</p>
        <p className="text-[11px] text-white/[0.08] mt-1">Select a discipline to begin</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/15">Training Log</span>
        <span className="text-[12px] font-bold text-emerald-400/50 tabular-nums">+{totalXp} XP</span>
      </div>
      <div className="space-y-1.5">
        {exercises.map((ex, i) => {
          const color = DISCIPLINE_COLORS[ex.badgeSlug] || '#888'
          const time = new Date(ex.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={i} className="flex items-center gap-2.5 text-[11px] rounded-lg px-3 py-1.5 bg-white/[0.02]">
              <span className="w-10 text-white/12 tabular-nums">{time}</span>
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-white/25 flex-1 truncate">{ex.exerciseId?.replace(/-/g, ' ')}</span>
              <span className="text-emerald-400/40 tabular-nums">+{ex.xpGained}</span>
            </div>
          )
        })}
        {missions.map((m, i) => {
          const color = DISCIPLINE_COLORS[m.badgeSlug] || '#888'
          const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={`m${i}`} className="flex items-center gap-2.5 text-[11px] rounded-lg px-3 py-1.5 bg-white/[0.02]">
              <span className="w-10 text-white/12 tabular-nums">{time}</span>
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-white/25 flex-1 truncate">Mission {m.success ? 'completed' : 'failed'}</span>
              <span className={`tabular-nums ${m.success ? 'text-emerald-400/40' : 'text-white/15'}`}>+{m.xpGained}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function MentalGame() {
  const [badges, setBadges] = useState([])
  const [progress, setProgress] = useState({})
  const [missions, setMissions] = useState({ active: [], completed: [] })
  const [badgeDaily, setBadgeDaily] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const [badgesR, progressR, missionsR, dailyR] = await Promise.all([
        fetch('/api/badges').then(r => r.json()),
        fetch('/api/badge-progress').then(r => r.json()),
        fetch('/api/badge-missions').then(r => r.json()),
        fetch('/api/badge-daily').then(r => r.json()).catch(() => null),
      ])
      setBadges(badgesR.badges || [])
      setProgress(progressR.badges || {})
      setMissions(missionsR)
      setBadgeDaily(dailyR)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    )
  }

  const selectedBadge = selected ? badges.find(b => b.slug === selected) : null
  const pendingMissions = missions.active?.filter(m => m.status === 'pending') || []
  const missionSlugs = new Set(pendingMissions.map(m => m.badgeSlug))
  const dailyXp = [...(badgeDaily?.exercises || []), ...(badgeDaily?.missionsAttempted || [])].reduce((s, e) => s + (e.xpGained || 0), 0)

  return (
    <div className="flex flex-1 flex-col px-6 py-5 gap-6 overflow-y-auto no-scrollbar">
      {/* Rank Seal — the centerpiece */}
      <RankSeal badges={badges} progress={progress} dailyXp={dailyXp} />

      {/* Decorative divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Active Missions */}
      <ActiveMissions missions={missions} />

      {/* Discipline Grid */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/15 mb-3">Disciplines</p>
        <div className="grid grid-cols-2 gap-3">
          {badges.map((badge, i) => (
            <DisciplineCard
              key={badge.slug}
              badge={badge}
              progress={progress[badge.slug]}
              hasMission={missionSlugs.has(badge.slug)}
              onSelect={() => setSelected(badge.slug)}
              fullWidth={i === badges.length - 1 && badges.length % 2 !== 0}
            />
          ))}
        </div>
      </div>

      {/* Training Log */}
      <DailyTraining badgeDaily={badgeDaily} />

      {/* Detail Sheet */}
      <AnimatePresence>
        {selectedBadge && (
          <BadgeDetailSheet
            badge={selectedBadge}
            progress={progress[selectedBadge.slug]}
            missions={missions}
            badgeDaily={badgeDaily}
            onClose={() => setSelected(null)}
            onExerciseDone={fetchAll}
            onMissionComplete={fetchAll}
            onMissionsAssigned={fetchAll}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
