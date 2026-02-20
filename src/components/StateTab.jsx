import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// ─── Score calculations ───────────────────────────────────────────────────────

const MOOD_TAG_SCORES = {
  'fired-up': 9.5, 'energized': 9, 'grounded': 8, 'focused': 8,
  'calm': 7, 'neutral': 6, 'tired': 4.5, 'flat': 4,
  'foggy': 4, 'anxious': 4.5, 'stressed': 3.5, 'overwhelmed': 3
}

function calcSleep(sleepData) {
  if (sleepData?.hoursSlept == null) return null
  const hoursScore = Math.min(sleepData.hoursSlept / 8, 1) * 10
  const qualityScore = sleepData.sleepScore != null
    ? sleepData.sleepScore / 10
    : hoursScore
  return Math.min(Math.max(hoursScore * 0.6 + qualityScore * 0.4, 0), 10)
}

function calcNutrition(creativeState) {
  if (!creativeState?.nutrition?.logged) return null
  if (creativeState.nutritionScore != null) return creativeState.nutritionScore
  return 6.5 // logged but no quality score yet — neutral positive
}

function calcDopamine(fitmindData, morningLog, creativeState) {
  let score = 5.0
  let hasData = false

  if (fitmindData?.workoutCompleted != null) {
    hasData = true
    const fitBoost = fitmindData.workoutCompleted
      ? (fitmindData.score != null ? (fitmindData.score / 100) * 4 : 2.5)
      : -1
    score += fitBoost - 1.5
  }

  const total = (morningLog?.completedCount || 0) + (morningLog?.skippedCount || 0)
  if (total > 0) {
    hasData = true
    const ratio = morningLog.completedCount / total
    score += (ratio - 0.5) * 2
  }

  if (creativeState?.dopamineQuality != null) {
    hasData = true
    score += (creativeState.dopamineQuality - 5) * 0.4
  } else if (creativeState?.energyScore != null) {
    hasData = true
    score += (creativeState.energyScore - 5) * 0.2
  }

  if (!hasData) return null
  return Math.min(Math.max(score, 0), 10)
}

function calcMood(morningState, creativeState) {
  const values = []

  const tagScore = MOOD_TAG_SCORES[morningState?.emotionalState]
  if (tagScore != null) values.push(tagScore)
  if (morningState?.energyScore != null) values.push(morningState.energyScore)
  if (creativeState?.energyScore != null) values.push(creativeState.energyScore * 1.2) // weight later-day read more

  if (values.length === 0) return null
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return Math.min(Math.max(avg, 0), 10)
}

function calcState(sleep, nutrition, dopamine, mood) {
  const weights = { sleep: 0.30, nutrition: 0.20, dopamine: 0.25, mood: 0.25 }
  const scores = { sleep, nutrition, dopamine, mood }
  let sum = 0, totalW = 0
  for (const [k, w] of Object.entries(weights)) {
    if (scores[k] != null) { sum += scores[k] * w; totalW += w }
  }
  if (totalW === 0) return null
  return Math.min(Math.max(sum / totalW, 0), 10)
}

// ─── Bar color ────────────────────────────────────────────────────────────────

function barColor(pct) {
  if (pct == null) return '#2a2a2a'
  if (pct < 0.4) return '#4A9EFF'
  if (pct < 0.7) return '#7ED4A5'
  return '#FFD166'
}

// ─── Components ───────────────────────────────────────────────────────────────

function MiniBar({ label, score, delay = 0 }) {
  const hasScore = score != null
  const pct = hasScore ? score / 10 : 0
  const color = barColor(hasScore ? pct : null)

  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-right text-xs uppercase tracking-[0.15em] text-white/40">
        {label}
      </span>
      <div className="relative h-1.5 flex-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.9, delay, ease: 'easeOut' }}
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="w-8 text-xs tabular-nums text-white/60">
        {hasScore ? score.toFixed(1) : '—'}
      </span>
    </div>
  )
}

function BigBar({ score, height = 260 }) {
  const hasScore = score != null
  const pct = hasScore ? score / 10 : 0
  const color = barColor(hasScore ? pct : null)

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: 44,
        height,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 6
      }}
    >
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: pct * height }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute bottom-0 left-0 right-0"
        style={{
          background: hasScore
            ? `linear-gradient(to top, ${barColor(0)}, ${color})`
            : 'transparent',
          borderRadius: '6px 6px 0 0'
        }}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StateTab() {
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const endpoints = [
        '/api/sleep-data',
        '/api/fitmind-data',
        '/api/morning-block-log',
        '/api/morning-state',
        '/api/creative-state'
      ]
      const results = await Promise.allSettled(endpoints.map(u => fetch(u).then(r => r.ok ? r.json() : null)))
      const [sleepData, fitmindData, morningLog, morningState, creativeState] = results.map(
        r => (r.status === 'fulfilled' ? r.value : null) ?? {}
      )
      setRaw({ sleepData, fitmindData, morningLog, morningState, creativeState })
    } catch {
      setRaw({})
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
      <div className="flex h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
      </div>
    )
  }

  const { sleepData, fitmindData, morningLog, morningState, creativeState } = raw

  const sleep = calcSleep(sleepData)
  const nutrition = calcNutrition(creativeState)
  const dopamine = calcDopamine(fitmindData, morningLog, creativeState)
  const mood = calcMood(morningState, creativeState)
  const state = calcState(sleep, nutrition, dopamine, mood)

  const hasAnyData = [sleep, nutrition, dopamine, mood].some(s => s != null)

  return (
    <div className="flex h-full flex-col px-6 py-8">
      {/* Header */}
      <p className="mb-8 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
        State
      </p>

      {/* Main layout: big bar + metrics */}
      <div className="flex flex-1 gap-6">
        {/* Left: big state bar */}
        <div className="flex flex-col items-center gap-3">
          <BigBar score={state} height={240} />
          <div className="text-center">
            <span className="block text-2xl font-bold tabular-nums text-white">
              {state != null ? state.toFixed(1) : '—'}
            </span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-white/30">
              state
            </span>
          </div>
        </div>

        {/* Right: 4 mini metrics */}
        <div className="flex flex-1 flex-col justify-center gap-5">
          {!hasAnyData ? (
            <p className="text-sm leading-relaxed text-white/30">
              Complete your morning to see your state.
            </p>
          ) : (
            <>
              <MiniBar label="Sleep" score={sleep} delay={0.1} />
              <MiniBar label="Nutrition" score={nutrition} delay={0.2} />
              <MiniBar label="Dopamine" score={dopamine} delay={0.3} />
              <MiniBar label="Mood" score={mood} delay={0.4} />
            </>
          )}

          {/* Day priority from Dawn */}
          {morningState?.dayPriority && (
            <p className="mt-4 text-sm italic leading-relaxed text-white/40">
              "{morningState.dayPriority}"
            </p>
          )}
        </div>
      </div>

      {/* Bottom stat pills */}
      {hasAnyData && (
        <div className="mt-6 flex flex-wrap gap-2">
          {sleepData?.hoursSlept != null && (
            <span className="rounded-md bg-white/[0.06] px-3 py-1.5 text-xs text-white/60">
              😴 {sleepData.hoursSlept}h
            </span>
          )}
          {fitmindData?.score != null && (
            <span className="rounded-md bg-white/[0.06] px-3 py-1.5 text-xs text-white/60">
              🧠 {fitmindData.score}
            </span>
          )}
          {morningLog?.completedCount != null && (
            <span className="rounded-md bg-white/[0.06] px-3 py-1.5 text-xs text-white/60">
              ⚡ {morningLog.completedCount}/{(morningLog.completedCount || 0) + (morningLog.skippedCount || 0)}
            </span>
          )}
          {morningState?.overallMorningScore != null && (
            <span className="rounded-md bg-white/[0.06] px-3 py-1.5 text-xs text-white/60">
              🎯 {morningState.overallMorningScore}
            </span>
          )}
          {morningState?.emotionalState && (
            <span className="rounded-md bg-white/[0.06] px-3 py-1.5 text-xs text-white/60">
              {morningState.emotionalState}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
