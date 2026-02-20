import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

const API_ENDPOINTS = [
  '/api/morning-block-log',
  '/api/sleep-data',
  '/api/fitmind-data',
  '/api/morning-state',
  '/api/creative-state'
]

const EMPTY = {
  morningLog: { completedCount: 0, skippedCount: 0 },
  sleepData: { hoursSlept: null, sleepScore: null },
  fitmindData: { workoutCompleted: null, score: null },
  morningState: { energyScore: null, mentalClarity: null, overallMorningScore: null, dayPriority: null },
  creativeState: { energyScore: null, nutrition: null }
}

function calcEnergyScore(sleepData, fitmindData, morningLog, morningState, creativeState) {
  let score = 0
  let hasAnyData = false

  if (sleepData.hoursSlept !== null) {
    hasAnyData = true
    const hoursScore = Math.min(sleepData.hoursSlept / 8, 1) * 10
    const qualityScore = sleepData.sleepScore !== null ? (sleepData.sleepScore / 100) * 10 : hoursScore
    score += ((hoursScore * 0.5) + (qualityScore * 0.5)) * 0.30
  }

  if (fitmindData.workoutCompleted !== null) {
    hasAnyData = true
    const fitScore = fitmindData.score !== null ? (fitmindData.score / 100) * 10 : (fitmindData.workoutCompleted ? 7 : 3)
    score += fitScore * 0.15
  }

  const total = (morningLog.completedCount || 0) + (morningLog.skippedCount || 0)
  if (total > 0) {
    hasAnyData = true
    score += (morningLog.completedCount / total) * 10 * 0.10
  }

  if (morningState.energyScore !== null) {
    hasAnyData = true
    const mScore = (morningState.energyScore * 0.5) + (morningState.mentalClarity * 0.3) + (morningState.overallMorningScore * 0.2)
    score += mScore * 0.35
  }

  if (creativeState.energyScore !== null) {
    hasAnyData = true
    const nutritionBonus = creativeState.nutrition?.logged ? 0.5 : 0
    score += (creativeState.energyScore * 0.8 + nutritionBonus) * 0.15
  }

  if (!hasAnyData) return null
  return Math.min(Math.max(score, 0), 10)
}

function getBarColor(pct) {
  if (pct < 0.4) return '#4A9EFF'
  if (pct < 0.7) return '#7ED4A5'
  return '#FFD166'
}

function Pill({ children }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-sm">
      {children}
    </div>
  )
}

export default function StateTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const results = await Promise.allSettled(API_ENDPOINTS.map(u => fetch(u).then(r => r.ok ? r.json() : null)))
      const [morningLog, sleepData, fitmindData, morningState, creativeState] = results.map(
        (r, i) => r.status === 'fulfilled' && r.value ? r.value : Object.values(EMPTY)[i]
      )
      setData({ morningLog, sleepData, fitmindData, morningState, creativeState })
    } catch {
      setData({ ...EMPTY })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 60000)
    return () => clearInterval(id)
  }, [fetchAll])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
      </div>
    )
  }

  const { sleepData, fitmindData, morningLog, morningState, creativeState } = data
  const score = calcEnergyScore(sleepData, fitmindData, morningLog, morningState, creativeState)
  const hasScore = score !== null
  const fillPct = hasScore ? score / 10 : 0
  const total = (morningLog.completedCount || 0) + (morningLog.skippedCount || 0)

  const BAR_H = 280
  const BAR_W = 48

  return (
    <div className="flex h-full flex-col items-center px-6 py-8">
      {/* Header */}
      <p className="mb-8 self-start text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
        State
      </p>

      {/* Bar + score */}
      <div className="mb-8 flex items-end gap-5">
        {/* Vertical bar */}
        <div
          className="relative overflow-hidden rounded-md"
          style={{ width: BAR_W, height: BAR_H, background: 'rgba(255,255,255,0.08)' }}
        >
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: fillPct * BAR_H }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute bottom-0 left-0 right-0"
            style={{
              borderRadius: hasScore ? '6px 6px 0 0' : 0,
              background: hasScore
                ? `linear-gradient(to top, #4A9EFF, ${getBarColor(fillPct)})`
                : 'transparent'
            }}
          />
        </div>

        {/* Score label */}
        <div
          className="flex flex-col"
          style={{ marginBottom: hasScore ? fillPct * BAR_H * 0.45 : BAR_H * 0.4 }}
        >
          {hasScore ? (
            <>
              <span className="text-4xl font-bold tabular-nums text-white">
                {score.toFixed(1)}
              </span>
              <span className="mt-1 text-sm text-white/40">Today's state</span>
            </>
          ) : (
            <span className="max-w-[140px] text-sm leading-relaxed text-white/30">
              Complete your morning to see your state.
            </span>
          )}
        </div>
      </div>

      {/* Stat pills */}
      <div className="grid w-full max-w-[280px] grid-cols-2 gap-2.5">
        <Pill>😴 {sleepData.hoursSlept !== null ? `${sleepData.hoursSlept}h` : '—'}</Pill>
        <Pill>🧠 {fitmindData.score !== null ? fitmindData.score : '—'}</Pill>
        <Pill>⚡ {total > 0 ? `${morningLog.completedCount}/${total}` : '—'}</Pill>
        <Pill>🎯 {morningState.overallMorningScore !== null ? morningState.overallMorningScore : '—'}</Pill>
      </div>

      {/* Day priority */}
      {morningState.dayPriority && (
        <p className="mt-6 max-w-[280px] text-center text-sm italic leading-relaxed text-white/50">
          "{morningState.dayPriority}"
        </p>
      )}
    </div>
  )
}
