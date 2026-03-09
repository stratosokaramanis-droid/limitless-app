import { motion, AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { haptics } from '../utils/haptics.js'

// ─── SVG Attribute Icons ────────────────────────────────────────────────────

function MoonIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function LeafIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17 8c0 8-6 13-11 15a19 19 0 005-15C11 4 15 2 19 2c1 3 1 6-2 6z" />
    </svg>
  )
}

function ZapIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

function SunIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

// ─── Power Ring (VF Score — dominant display) ───────────────────────────────

function PowerRing({ score, size = 160 }) {
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const pct = score != null ? score / 10 : 0
  const offset = circ * (1 - pct)
  const color = score == null ? '#333' : score >= 7 ? '#30D158' : score >= 4 ? '#FF9F0A' : '#FF453A'

  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (score == null) return
    const start = performance.now()
    const step = (now) => {
      const p = Math.min((now - start) / 800, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(score * eased)
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [score])

  return (
    <div className="relative flex flex-col items-center">
      {/* Ambient glow when high */}
      {score >= 7 && (
        <motion.div
          className="pointer-events-none absolute -inset-6"
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: `radial-gradient(circle, ${color}20 0%, transparent 70%)` }}
        />
      )}

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* Outer decorative ring */}
          <circle cx={size/2} cy={size/2} r={r + 5} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" fill="none" strokeDasharray="2 8" />
          {/* Track */}
          <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.04)" strokeWidth="5" fill="none" />
          {/* Progress arc */}
          <motion.circle
            cx={size/2} cy={size/2} r={r}
            stroke={color} strokeWidth="5" fill="none" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] uppercase tracking-[0.3em] text-white/15">Power</span>
          <span
            className="text-[42px] font-black tabular-nums leading-none text-white"
            style={{ textShadow: score >= 7 ? `0 0 20px ${color}40` : 'none' }}
          >
            {score != null ? display.toFixed(1) : '--'}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-white/15 mt-0.5">VF Score</span>
        </div>
      </div>
    </div>
  )
}

// ─── State Ring (smaller) ───────────────────────────────────────────────────

function StateRing({ score, size = 72 }) {
  const r = (size / 2) - 4
  const circ = 2 * Math.PI * r
  const pct = score != null ? score / 10 : 0
  const offset = circ * (1 - pct)
  const color = score == null ? '#333' : score >= 7 ? '#30D158' : score >= 4 ? '#FF9F0A' : '#FF453A'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.04)" strokeWidth="3" fill="none" />
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          stroke={color} strokeWidth="3" fill="none" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] font-bold tabular-nums text-white/60">
          {score != null ? score.toFixed(1) : '--'}
        </span>
        <span className="text-[8px] uppercase tracking-widest text-white/15">State</span>
      </div>
    </div>
  )
}

// ─── Trend Arrow ────────────────────────────────────────────────────────────

function TrendArrow({ current, previous }) {
  if (current == null || previous == null) return null
  const delta = current - previous
  if (Math.abs(delta) < 0.05) return null
  const up = delta > 0
  return (
    <span className={`text-[12px] font-semibold tabular-nums ${up ? 'text-green-400/60' : 'text-red-400/60'}`}>
      {up ? '\u2191' : '\u2193'} {Math.abs(delta).toFixed(1)}
    </span>
  )
}

// ─── Attribute Bar ──────────────────────────────────────────────────────────

function AttributeBar({ label, score, color, icon: IconComponent }) {
  const pct = score != null ? (score / 10) * 100 : 0
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-6 w-6 items-center justify-center text-white/20">
        <IconComponent size={14} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-white/20">{label}</span>
          <span className="text-[11px] font-medium tabular-nums text-white/35">
            {score != null ? score.toFixed(1) : '--'}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${color}80, ${color})`,
              boxShadow: score >= 7 ? `0 0 8px ${color}30` : 'none',
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Quest Chain (Day Progress) ─────────────────────────────────────────────

function QuestChain({ morningState, creativeState, workSessions, nightRoutine }) {
  const phases = [
    { label: 'Morning', done: morningState?.overallMorningScore != null },
    { label: 'Creative', done: creativeState?.creativeOutput != null },
    { label: 'Work', done: (workSessions?.completedSessions || 0) > 0 },
    { label: 'Night', done: nightRoutine?.completedAt != null },
  ]
  const completed = phases.filter(p => p.done).length
  const current = phases.findIndex(p => !p.done)

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/15">Quest Chain</span>
        <span className="text-[10px] text-white/12 tabular-nums">{completed}/{phases.length}</span>
      </div>
      <div className="flex items-center">
        {phases.map((p, i) => (
          <div key={p.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <motion.div
                className={`h-3 w-3 rounded-full border-2 transition-colors ${
                  p.done
                    ? 'bg-emerald-400/80 border-emerald-400/60'
                    : i === current
                      ? 'bg-transparent border-white/30'
                      : 'bg-transparent border-white/[0.08]'
                }`}
                animate={i === current ? {
                  borderColor: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.15)']
                } : {}}
                transition={i === current ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
              />
              <span className={`text-[9px] ${p.done ? 'text-emerald-400/50' : i === current ? 'text-white/30' : 'text-white/10'}`}>
                {p.label}
              </span>
            </div>
            {i < phases.length - 1 && (
              <div className={`h-[1px] flex-1 -mx-1 ${p.done ? 'bg-emerald-400/30' : 'bg-white/[0.04]'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Affirmation Grid ───────────────────────────────────────────────────────

function AffirmationGrid({ vfGame, affirmations }) {
  if (!affirmations?.length) return null

  const sessions = vfGame?.sessions || []
  const latestSession = sessions[sessions.length - 1]
  const scoreMap = {}
  if (latestSession?.affirmations) {
    for (const a of latestSession.affirmations) scoreMap[a.index] = a
  }
  const hasData = Object.keys(scoreMap).length > 0

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/15">Inner Grid</span>
        {!hasData && <span className="text-[9px] text-white/[0.08]">No VF data</span>}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {affirmations.map((aff) => {
          const scores = scoreMap[aff.index]
          const r = scores?.resistanceScore ?? 0
          const c = scores?.convictionScore ?? 0
          const hue = hasData ? (r <= 3 ? 142 : r <= 6 ? 38 : 0) : 0
          const sat = hasData ? 70 : 0
          const light = hasData ? 50 : 15
          const opacity = hasData ? 0.2 + (c / 10) * 0.7 : 0.06

          return (
            <div
              key={aff.index}
              className="aspect-square rounded-md"
              style={{
                background: `hsla(${hue}, ${sat}%, ${light}%, ${opacity})`,
                border: `1px solid hsla(${hue}, ${sat}%, ${light}%, ${opacity * 0.4})`,
              }}
              title={`${aff.text?.slice(0, 40)}... R:${r} C:${c}`}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Key Decisions ──────────────────────────────────────────────────────────

const DECISION_TYPES = [
  { type: 'resist', multiplier: 3, label: 'Resist', color: '#FF6B6B' },
  { type: 'persist', multiplier: 2, label: 'Persist', color: '#4ECDC4' },
  { type: 'reframe', multiplier: 2, label: 'Reframe', color: '#A78BFA' },
  { type: 'ground', multiplier: 2, label: 'Ground', color: '#B8E994' },
  { type: 'face-boss', multiplier: 5, label: 'Face Boss', color: '#EE5A24' },
  { type: 'recenter', multiplier: 2, label: 'Recenter', color: '#7ED6DF' },
]

function KeyDecisionsCard({ kdData, onRefresh }) {
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState('')
  const [type, setType] = useState('resist')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!desc.trim() || saving) return
    setSaving(true)
    const dt = DECISION_TYPES.find(d => d.type === type)
    try {
      await fetch('/api/key-decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc.trim(), type, multiplier: dt?.multiplier || 1 })
      })
      setDesc('')
      setOpen(false)
      onRefresh?.()
    } catch {} finally { setSaving(false) }
  }

  const decisions = kdData?.decisions || []
  const latest = decisions[decisions.length - 1]

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/15">Decisions</span>
        <div className="flex items-center gap-2">
          {decisions.length > 0 && (
            <span className="text-[11px] font-bold tabular-nums text-amber-400/60">
              {decisions.length} logged
            </span>
          )}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { haptics.tap(); setOpen(o => !o) }}
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06] text-[13px] text-white/30"
          >
            {open ? '\u2212' : '+'}
          </motion.button>
        </div>
      </div>

      {latest && !open && (
        <p className="text-[11px] text-white/15 truncate">{latest.description}</p>
      )}

      {decisions.length === 0 && !open && (
        <p className="text-[11px] text-white/10">No decisions logged</p>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-3">
              <input
                type="text"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="What did you choose?"
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-[13px] text-white/70 placeholder-white/15 focus:outline-none focus:border-white/20"
              />
              <div className="flex flex-wrap gap-1.5">
                {DECISION_TYPES.map(dt => (
                  <button
                    key={dt.type}
                    onClick={() => setType(dt.type)}
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors"
                    style={{
                      background: type === dt.type ? `${dt.color}20` : 'rgba(255,255,255,0.04)',
                      color: type === dt.type ? dt.color : 'rgba(255,255,255,0.25)',
                      border: `1px solid ${type === dt.type ? `${dt.color}35` : 'transparent'}`,
                    }}
                  >
                    {dt.label} {dt.multiplier}x
                  </button>
                ))}
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={!desc.trim() || saving}
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-[13px] font-semibold text-white/60 disabled:opacity-30"
              >
                {saving ? 'Saving...' : 'Log Decision'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Chapter Preview ────────────────────────────────────────────────────────

function ChapterPreview({ chapter }) {
  if (!chapter) return null
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/12 mb-1">Latest Chapter</p>
      <p className="text-[13px] text-white/35">{chapter.title || `Chapter ${chapter.chapter}`}</p>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const endpoints = {
        vfScore: '/api/vf-score',
        sleepData: '/api/sleep-data',
        morningState: '/api/morning-state',
        creativeState: '/api/creative-state',
        workSessions: '/api/work-sessions',
        nightRoutine: '/api/night-routine',
        keyDecisions: '/api/key-decisions',
        dopamine: '/api/dopamine',
        episode: '/api/episode',
        chapters: '/api/vf-chapters?limit=1',
        vfGame: '/api/vf-game',
        affirmations: '/api/affirmations',
      }
      const results = {}
      await Promise.allSettled(
        Object.entries(endpoints).map(async ([key, url]) => {
          const r = await fetch(url)
          if (r.ok) results[key] = await r.json()
        })
      )
      setData(results)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 60000)
    return () => clearInterval(id)
  }, [fetchAll])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    )
  }

  const { vfScore, sleepData, morningState, creativeState, workSessions, nightRoutine, keyDecisions, dopamine, episode, chapters, vfGame, affirmations } = data

  const sleep = sleepData?.hoursSlept != null ? Math.min(Math.max((sleepData.hoursSlept / 8) * 10 * 0.6 + ((sleepData.sleepScore ?? (sleepData.hoursSlept / 8) * 10) / 10) * 0.4, 0), 10) : null
  const nutrition = creativeState?.nutritionScore ?? null
  const dopa = dopamine?.netScore ?? null
  const mood = morningState?.energyScore ?? null
  const vf = vfScore?.score ?? null
  const previousVf = vfScore?.previousScore ?? null
  const latestChapter = Array.isArray(chapters) ? chapters[chapters.length - 1] : null
  const affirmationList = affirmations?.affirmations || []
  const stateScore = [sleep, nutrition, dopa, mood].filter(s => s != null)
  const stateAvg = stateScore.length > 0 ? stateScore.reduce((a, b) => a + b, 0) / stateScore.length : null

  return (
    <div className="flex flex-1 flex-col px-6 py-5 gap-5 overflow-y-auto no-scrollbar">
      {/* Episode Arc — cinematic quest banner */}
      {episode?.todaysArc && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-xl overflow-hidden px-4 py-3"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.05) 100%)',
            border: '1px solid rgba(139,92,246,0.1)',
          }}
        >
          <p className="text-[9px] uppercase tracking-[0.3em] text-purple-300/30 mb-1">Today's Arc</p>
          <p className="text-[14px] italic leading-relaxed text-white/35">"{episode.todaysArc}"</p>
        </motion.div>
      )}

      {/* Power Level + State */}
      <div className="flex items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <PowerRing score={vf} />
          <TrendArrow current={vf} previous={previousVf} />
        </div>
        <StateRing score={stateAvg} />
      </div>

      {/* Attributes */}
      <div className="space-y-2.5">
        <AttributeBar label="Sleep" score={sleep} color="#5E9EFF" icon={MoonIcon} />
        <AttributeBar label="Nutrition" score={nutrition} color="#30D158" icon={LeafIcon} />
        <AttributeBar label="Dopamine" score={dopa} color="#BF5AF2" icon={ZapIcon} />
        <AttributeBar label="Mood" score={mood} color="#FF9F0A" icon={SunIcon} />
      </div>

      {/* Inner Grid */}
      <AffirmationGrid vfGame={vfGame} affirmations={affirmationList} />

      {/* Quest Chain */}
      <QuestChain
        morningState={morningState}
        creativeState={creativeState}
        workSessions={workSessions}
        nightRoutine={nightRoutine}
      />

      {/* Key Decisions */}
      <KeyDecisionsCard kdData={keyDecisions} onRefresh={fetchAll} />

      {/* Resource Meters */}
      {dopamine?.date && (
        <div className="flex gap-2">
          <div className="flex-1 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 text-center">
            <span className="block text-[16px] font-bold text-green-400/70 tabular-nums">{dopamine.farming?.totalPoints || 0}</span>
            <span className="block text-[9px] text-white/15">Farm pts</span>
          </div>
          <div className="flex-1 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 text-center">
            <span className="block text-[16px] font-bold text-red-400/70 tabular-nums">{dopamine.overstimulation?.totalEvents || 0}</span>
            <span className="block text-[9px] text-white/15">Overstim</span>
          </div>
          <div className="flex-1 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 text-center">
            <span className="block text-[16px] font-bold text-purple-300/70 tabular-nums">{dopamine.netScore ?? 5}</span>
            <span className="block text-[9px] text-white/15">Net</span>
          </div>
        </div>
      )}

      {/* Chapter */}
      <ChapterPreview chapter={latestChapter} />
    </div>
  )
}
