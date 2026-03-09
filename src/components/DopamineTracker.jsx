import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { haptics } from '../utils/haptics.js'
import { sounds } from '../utils/sounds.js'

// SVG icons for overstimulation types
function OverstimIcon({ type, size = 20 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (type) {
    case 'sugar': return <svg {...p}><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M7 12h10" /></svg>
    case 'alcohol': return <svg {...p}><path d="M8 2h8l-1 8a3 3 0 01-6 0L8 2z" /><path d="M12 10v8M8 18h8" /></svg>
    case 'sr': return <svg {...p}><path d="M12 22c-2-3-8-7-8-13a8 8 0 0116 0c0 6-6 10-8 13z" /></svg>
    case 'social-media': return <svg {...p}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
    case 'gaming': return <svg {...p}><rect x="2" y="7" width="20" height="11" rx="3" /><path d="M8 11v3M6.5 12.5h3" /><circle cx="16" cy="11" r="0.5" fill="currentColor" /><circle cx="18" cy="13" r="0.5" fill="currentColor" /></svg>
    case 'streaming': return <svg {...p}><polygon points="6,4 20,12 6,20" /></svg>
    case 'caffeine': return <svg {...p}><path d="M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>
  }
}

const OVERSTIM_TYPES = [
  { type: 'sugar', label: 'Sugar' },
  { type: 'alcohol', label: 'Alcohol' },
  { type: 'sr', label: 'SR' },
  { type: 'social-media', label: 'Social' },
  { type: 'gaming', label: 'Gaming' },
  { type: 'streaming', label: 'Stream' },
  { type: 'caffeine', label: 'Caffeine' },
]

const FARM_THRESHOLDS = [
  { min: 0, pts: 0 },
  { min: 5, pts: 1 },
  { min: 15, pts: 3 },
  { min: 30, pts: 7 },
  { min: 60, pts: 15 },
]

function interpolateFarmPoints(elapsedSeconds) {
  const minutes = elapsedSeconds / 60
  for (let i = FARM_THRESHOLDS.length - 1; i >= 0; i--) {
    if (minutes >= FARM_THRESHOLDS[i].min) {
      if (i === FARM_THRESHOLDS.length - 1) {
        const rate = (FARM_THRESHOLDS[i].pts - FARM_THRESHOLDS[i - 1].pts) /
          (FARM_THRESHOLDS[i].min - FARM_THRESHOLDS[i - 1].min)
        return FARM_THRESHOLDS[i].pts + rate * (minutes - FARM_THRESHOLDS[i].min)
      }
      const next = FARM_THRESHOLDS[i + 1]
      const curr = FARM_THRESHOLDS[i]
      const progress = (minutes - curr.min) / (next.min - curr.min)
      return curr.pts + progress * (next.pts - curr.pts)
    }
  }
  return 0
}

const MILESTONES = [
  { min: 5, label: '5 min' },
  { min: 15, label: '15 min' },
  { min: 30, label: '30 min' },
  { min: 60, label: '60 min' },
]

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/* ── Balance Visualization ── */
function BalanceViz({ farmPoints, overstimEvents, netScore }) {
  const farmWeight = farmPoints || 0
  const overstimWeight = overstimEvents || 0
  const total = farmWeight + overstimWeight
  const ratio = total === 0 ? 0 : (farmWeight - overstimWeight) / Math.max(total, 1)
  const tiltAngle = Math.max(-12, Math.min(12, ratio * 12))

  const scoreColor = netScore >= 7 ? '#30D158' : netScore >= 4 ? '#FF9F0A' : '#FF453A'

  return (
    <div className="relative rounded-2xl bg-white/[0.03] p-5 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: 'linear-gradient(135deg, rgba(48,209,88,0.08) 0%, transparent 40%, transparent 60%, rgba(255,69,58,0.08) 100%)',
        }}
      />

      <div className="relative flex flex-col items-center gap-3">
        <motion.span
          key={netScore}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-[42px] font-black tabular-nums leading-none"
          style={{ color: scoreColor }}
        >
          {netScore.toFixed(1)}
        </motion.span>
        <span className="text-[11px] font-medium uppercase tracking-widest text-white/25">
          Dopamine Balance
        </span>

        <svg viewBox="0 0 240 80" className="w-full max-w-[260px] mt-1" style={{ overflow: 'visible' }}>
          <polygon points="120,78 112,66 128,66" fill="rgba(255,255,255,0.08)" />

          <motion.g
            animate={{ rotate: -tiltAngle }}
            transition={{ type: 'spring', stiffness: 80, damping: 14 }}
            style={{ transformOrigin: '120px 60px' }}
          >
            <line x1="30" y1="60" x2="210" y2="60" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" strokeLinecap="round" />

            <line x1="46" y1="60" x2="38" y2="72" stroke="rgba(48,209,88,0.3)" strokeWidth="1.5" />
            <line x1="46" y1="60" x2="54" y2="72" stroke="rgba(48,209,88,0.3)" strokeWidth="1.5" />
            <path d="M34,72 Q46,78 58,72" stroke="rgba(48,209,88,0.4)" strokeWidth="1.5" fill="none" />
            <circle cx="46" cy="60" r="8" fill="rgba(48,209,88,0.12)" />
            <text x="46" y="56" textAnchor="middle" fill="rgba(48,209,88,0.7)" fontSize="9" fontWeight="700">
              {farmWeight}
            </text>

            <line x1="194" y1="60" x2="186" y2="72" stroke="rgba(255,69,58,0.3)" strokeWidth="1.5" />
            <line x1="194" y1="60" x2="202" y2="72" stroke="rgba(255,69,58,0.3)" strokeWidth="1.5" />
            <path d="M182,72 Q194,78 206,72" stroke="rgba(255,69,58,0.4)" strokeWidth="1.5" fill="none" />
            <circle cx="194" cy="60" r="8" fill="rgba(255,69,58,0.12)" />
            <text x="194" y="56" textAnchor="middle" fill="rgba(255,69,58,0.7)" fontSize="9" fontWeight="700">
              {overstimWeight}
            </text>

            <circle cx="120" cy="60" r="3" fill="rgba(255,255,255,0.2)" />
          </motion.g>
        </svg>

        <div className="flex w-full justify-between px-2 -mt-1">
          <span className="text-[10px] font-medium text-green-400/50">Farming</span>
          <span className="text-[10px] font-medium text-red-400/50">Overstim</span>
        </div>
      </div>
    </div>
  )
}

/* ── Stats Row ── */
function StatsRow({ farmPoints, farmMinutes, overstimCount }) {
  return (
    <div className="flex gap-3">
      <div className="flex-1 rounded-xl bg-white/[0.04] border border-green-500/10 px-4 py-3 text-center">
        <span className="block text-[24px] font-black text-green-400 tabular-nums">{farmPoints}</span>
        <span className="block text-[10px] font-medium text-white/25 mt-0.5">Farm pts</span>
      </div>
      <div className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.04] px-4 py-3 text-center">
        <span className="block text-[24px] font-black text-white/60 tabular-nums">{farmMinutes}m</span>
        <span className="block text-[10px] font-medium text-white/25 mt-0.5">Unstimulated</span>
      </div>
      <div className="flex-1 rounded-xl bg-white/[0.04] border border-red-500/10 px-4 py-3 text-center">
        <span className="block text-[24px] font-black text-red-400 tabular-nums">{overstimCount}</span>
        <span className="block text-[10px] font-medium text-white/25 mt-0.5">Overstim</span>
      </div>
    </div>
  )
}

/* ── Farming Section ── */
function FarmingSection({ farming, farmElapsed, onStart, onEnd }) {
  const currentPoints = interpolateFarmPoints(farmElapsed)
  const elapsedMinutes = farmElapsed / 60

  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden"
      animate={{
        background: farming
          ? 'linear-gradient(145deg, rgba(88,28,135,0.15) 0%, rgba(30,27,75,0.2) 50%, rgba(17,24,39,0.15) 100%)'
          : 'rgba(255,255,255,0.04)',
      }}
      transition={{ duration: 0.6 }}
    >
      {farming && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.1) 0%, transparent 70%)',
          }}
        />
      )}

      <div className="relative p-5">
        <p className="text-[13px] font-medium text-white/40 mb-4">Dopamine Farming</p>

        <AnimatePresence mode="wait">
          {farming ? (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-5"
            >
              <motion.div
                className="flex flex-col items-center rounded-2xl px-8 py-6"
                animate={{
                  boxShadow: [
                    '0 0 30px rgba(139,92,246,0.05)',
                    '0 0 50px rgba(139,92,246,0.12)',
                    '0 0 30px rgba(139,92,246,0.05)',
                  ],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ background: 'rgba(139,92,246,0.06)' }}
              >
                <span className="text-[56px] font-bold tabular-nums text-purple-300/90 leading-none" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                  {formatTimer(farmElapsed)}
                </span>

                <motion.span
                  key={Math.floor(currentPoints * 10)}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="mt-2 text-[15px] font-semibold text-green-400/70 tabular-nums"
                >
                  +{currentPoints.toFixed(1)} pts
                </motion.span>
              </motion.div>

              <div className="flex gap-3 flex-wrap justify-center">
                {MILESTONES.map((ms) => {
                  const reached = elapsedMinutes >= ms.min
                  return (
                    <motion.span
                      key={ms.min}
                      initial={false}
                      animate={{ opacity: reached ? 1 : 0.3, scale: reached ? 1 : 0.95 }}
                      className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${
                        reached
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-white/[0.04] text-white/30'
                      }`}
                    >
                      {reached && <span className="mr-1">{'\u2713'}</span>}{ms.label}
                    </motion.span>
                  )
                })}
              </div>

              <p className="text-[12px] text-white/20">Unstimulated time accumulating...</p>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onEnd}
                className="w-full rounded-xl bg-purple-500/20 border border-purple-500/20 px-5 py-3.5 text-[15px] font-semibold text-purple-300"
              >
                End Farm
              </motion.button>
            </motion.div>
          ) : (
            <motion.button
              key="start"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              whileTap={{ scale: 0.97 }}
              onClick={onStart}
              className="w-full rounded-xl bg-white/[0.06] border border-white/[0.06] px-5 py-4 text-[15px] font-medium text-white/60"
            >
              Start Farming
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ── Overstimulation Grid ── */
function OverstimGrid({ onLog, todayCounts }) {
  const [flashType, setFlashType] = useState(null)

  const handleTap = (type) => {
    setFlashType(type)
    onLog(type)
    setTimeout(() => setFlashType(null), 300)
  }

  return (
    <div className="relative rounded-2xl overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(255,69,58,0.04) 100%)',
        }}
      />
      <div className="relative p-5">
        <p className="text-[13px] font-medium text-white/40 mb-3">Quick Log</p>
        <div className="grid grid-cols-4 gap-2">
          {OVERSTIM_TYPES.map(({ type, label }) => {
            const count = todayCounts[type] || 0
            const isFlashing = flashType === type

            return (
              <motion.button
                key={type}
                whileTap={{ scale: 0.9 }}
                animate={
                  isFlashing
                    ? { x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.3 } }
                    : {}
                }
                onClick={() => handleTap(type)}
                className="relative flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.03] px-2 py-3 active:bg-red-500/10 transition-colors"
              >
                <AnimatePresence>
                  {isFlashing && (
                    <motion.div
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 rounded-xl bg-red-500/20"
                    />
                  )}
                </AnimatePresence>

                {count > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500/80 px-1 text-[9px] font-bold text-white">
                    {count}
                  </span>
                )}

                <span className="text-white/40">
                  <OverstimIcon type={type} size={20} />
                </span>
                <span className="text-[10px] text-white/30">{label}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Session History Timeline ── */
function SessionHistory({ sessions, overstimEvents }) {
  const timeline = useMemo(() => {
    const entries = []

    if (sessions) {
      for (const s of sessions) {
        if (!s.startTime) continue
        entries.push({
          id: s.id || s.startTime,
          time: new Date(s.startTime),
          kind: 'farm',
          duration: s.durationMinutes || s.duration || 0,
          points: s.points || s.pointsEarned || 0,
        })
      }
    }

    if (overstimEvents) {
      for (const e of overstimEvents) {
        const def = OVERSTIM_TYPES.find((t) => t.type === e.type)
        entries.push({
          id: e.id || e.timestamp,
          time: new Date(e.timestamp),
          kind: 'overstim',
          label: def?.label || e.type,
        })
      }
    }

    entries.sort((a, b) => a.time - b.time)
    return entries
  }, [sessions, overstimEvents])

  if (timeline.length === 0) return null

  return (
    <div>
      <p className="text-[13px] font-medium text-white/25 mb-2">Today's Timeline</p>
      <div className="space-y-1">
        {timeline.map((entry) => {
          const timeStr = entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          if (entry.kind === 'farm') {
            return (
              <div key={entry.id} className="flex items-center gap-2.5 rounded-lg bg-green-500/[0.04] border border-green-500/[0.06] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-green-400/60 shrink-0" />
                <span className="text-[12px] font-medium text-green-400/70 tabular-nums">{timeStr}</span>
                <span className="text-[12px] text-white/15">&mdash;</span>
                <span className="text-[12px] text-white/40">{entry.duration} min farm</span>
                <span className="ml-auto text-[12px] font-semibold text-green-400/60 tabular-nums">+{entry.points} pts</span>
              </div>
            )
          }
          return (
            <div key={entry.id} className="flex items-center gap-2.5 rounded-lg bg-red-500/[0.04] border border-red-500/[0.06] px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-red-400/60 shrink-0" />
              <span className="text-[12px] font-medium text-red-400/70 tabular-nums">{timeStr}</span>
              <span className="text-[12px] text-white/15">&mdash;</span>
              <span className="text-[12px] text-white/40">{entry.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Weekly Placeholder Dots ── */
function WeeklyPlaceholder() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const todayIndex = (new Date().getDay() + 6) % 7

  return (
    <div>
      <p className="text-[13px] font-medium text-white/25 mb-3">This Week</p>
      <div className="flex justify-between px-2">
        {days.map((day, i) => {
          const isToday = i === todayIndex
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <motion.div
                className={`h-3 w-3 rounded-full ${
                  isToday
                    ? 'bg-purple-400 shadow-[0_0_8px_rgba(139,92,246,0.4)]'
                    : 'bg-white/[0.06]'
                }`}
                animate={isToday ? { scale: [1, 1.15, 1] } : {}}
                transition={isToday ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
              />
              <span className={`text-[10px] ${isToday ? 'text-purple-400 font-semibold' : 'text-white/20'}`}>
                {day}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main Component ── */
export default function DopamineTracker() {
  const [data, setData] = useState(null)
  const [farming, setFarming] = useState(false)
  const [farmSessionId, setFarmSessionId] = useState(null)
  const [farmElapsed, setFarmElapsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/dopamine')
      if (r.ok) setData(await r.json())
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!farming) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      setFarmElapsed((e) => e + 1)
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [farming])

  const startFarm = async () => {
    try {
      const r = await fetch('/api/dopamine/farm-start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await r.json()
      if (d.ok) {
        setFarmSessionId(d.sessionId)
        setFarming(true)
        setFarmElapsed(0)
        haptics.tap()
      }
    } catch {}
  }

  const endFarm = async () => {
    if (!farmSessionId) return
    try {
      const r = await fetch('/api/dopamine/farm-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: farmSessionId }),
      })
      const d = await r.json()
      if (d.ok) {
        setFarming(false)
        setFarmSessionId(null)
        haptics.success()
        sounds.complete()
        fetchData()
      }
    } catch {}
  }

  const logOverstim = async (type) => {
    haptics.tap()
    try {
      await fetch('/api/dopamine/overstimulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      fetchData()
    } catch {}
  }

  const todayOverstimCounts = useMemo(() => {
    const counts = {}
    if (data?.overstimulation?.events) {
      for (const e of data.overstimulation.events) {
        counts[e.type] = (counts[e.type] || 0) + 1
      }
    }
    return counts
  }, [data])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    )
  }

  const netScore = data?.netScore ?? 5
  const totalFarmMin = data?.farming?.totalMinutes ?? 0
  const totalFarmPts = data?.farming?.totalPoints ?? 0
  const totalOverstim = data?.overstimulation?.totalEvents ?? 0

  return (
    <div className="flex flex-1 flex-col px-6 py-6 gap-5 overflow-y-auto no-scrollbar">
      <p className="text-[13px] font-semibold uppercase tracking-widest text-white/20">
        Dopamine
      </p>

      <BalanceViz farmPoints={totalFarmPts} overstimEvents={totalOverstim} netScore={netScore} />
      <StatsRow farmPoints={totalFarmPts} farmMinutes={totalFarmMin} overstimCount={totalOverstim} />
      <FarmingSection farming={farming} farmElapsed={farmElapsed} onStart={startFarm} onEnd={endFarm} />
      <OverstimGrid onLog={logOverstim} todayCounts={todayOverstimCounts} />
      <WeeklyPlaceholder />
      <SessionHistory sessions={data?.farming?.sessions} overstimEvents={data?.overstimulation?.events} />
    </div>
  )
}
