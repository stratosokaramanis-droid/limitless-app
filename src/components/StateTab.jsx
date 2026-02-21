import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

// ─── Score calculations (unchanged) ──────────────────────────────────────────

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

function calcNutrition(creativeState, workSessions) {
  const scores = []
  if (creativeState?.nutritionScore != null) {
    scores.push(creativeState.nutritionScore)
  } else if (creativeState?.nutrition?.logged) {
    scores.push(6.5)
  }
  const sessions = workSessions?.sessions || []
  for (const s of sessions) {
    if (s.nutritionScore != null) scores.push(s.nutritionScore)
  }
  if (workSessions?.lunchNutritionScore != null) scores.push(workSessions.lunchNutritionScore)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function calcDopamine(fitmindData, morningLog, creativeState, workSessions) {
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
  const completedSessions = workSessions?.sessions?.filter(s => s.endedAt && s.flowScore != null) || []
  if (completedSessions.length > 0) {
    hasData = true
    const avgFlow = completedSessions.reduce((sum, s) => sum + s.flowScore, 0) / completedSessions.length
    score += (avgFlow - 5) * 0.3
  }
  if (!hasData) return null
  return Math.min(Math.max(score, 0), 10)
}

function calcMood(morningState, creativeState) {
  const values = []
  const tagScore = MOOD_TAG_SCORES[morningState?.emotionalState]
  if (tagScore != null) values.push(tagScore)
  if (morningState?.energyScore != null) values.push(morningState.energyScore)
  if (creativeState?.energyScore != null) values.push(creativeState.energyScore * 1.2)
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

// ─── Pillar config ───────────────────────────────────────────────────────────

const PILLARS = [
  { key: 'sleep', label: 'Sleep', color: '#5E9EFF' },
  { key: 'nutrition', label: 'Nutrition', color: '#30D158' },
  { key: 'dopamine', label: 'Dopamine', color: '#BF5AF2' },
  { key: 'mood', label: 'Mood', color: '#FF9F0A' },
]

// ─── Animated counter ────────────────────────────────────────────────────────

function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (value == null) return
    const start = performance.now()
    const from = 0

    const step = (now) => {
      const elapsed = now - start
      const pct = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - pct, 3) // ease-out cubic
      setDisplay(from + (value - from) * eased)
      if (pct < 1) rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  if (value == null) return '--'
  return display.toFixed(1)
}

// ─── Components ──────────────────────────────────────────────────────────────

function PillarRow({ label, score, color, delay = 0 }) {
  const hasScore = score != null
  const pct = hasScore ? score / 10 : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-[72px] text-right text-[13px] font-medium text-white/30">
        {label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.9, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ background: hasScore ? color : 'transparent' }}
        />
      </div>
      <span className="w-9 text-right text-[13px] font-medium tabular-nums text-white/50">
        {hasScore ? score.toFixed(1) : '--'}
      </span>
    </div>
  )
}

function StateRing({ score }) {
  const hasScore = score != null
  const pct = hasScore ? score / 10 : 0
  const circumference = 2 * Math.PI * 58
  const offset = circumference * (1 - pct)

  return (
    <div className="relative flex items-center justify-center">
      <svg className="h-[148px] w-[148px] -rotate-90" viewBox="0 0 128 128">
        {/* Track */}
        <circle cx="64" cy="64" r="58" stroke="rgba(255,255,255,0.04)" strokeWidth="5" fill="none" />
        {/* Progress */}
        <motion.circle
          cx="64" cy="64" r="58"
          stroke="url(#stateGradient)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
        <defs>
          <linearGradient id="stateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5E9EFF" />
            <stop offset="50%" stopColor="#BF5AF2" />
            <stop offset="100%" stopColor="#FF9F0A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <span className="block text-[36px] font-bold tabular-nums tracking-tight text-white">
          <AnimatedNumber value={score} />
        </span>
        <span className="block text-[11px] font-medium uppercase tracking-widest text-white/20">
          state
        </span>
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

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
        '/api/creative-state',
        '/api/work-sessions'
      ]
      const results = await Promise.allSettled(endpoints.map(u => fetch(u).then(r => r.ok ? r.json() : null)))
      const [sleepData, fitmindData, morningLog, morningState, creativeState, workSessions] = results.map(
        r => (r.status === 'fulfilled' ? r.value : null) ?? {}
      )
      setRaw({ sleepData, fitmindData, morningLog, morningState, creativeState, workSessions })
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
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    )
  }

  const { sleepData, fitmindData, morningLog, morningState, creativeState, workSessions } = raw

  const sleep = calcSleep(sleepData)
  const nutrition = calcNutrition(creativeState, workSessions)
  const dopamine = calcDopamine(fitmindData, morningLog, creativeState, workSessions)
  const mood = calcMood(morningState, creativeState)
  const state = calcState(sleep, nutrition, dopamine, mood)
  const scores = { sleep, nutrition, dopamine, mood }

  const hasAnyData = [sleep, nutrition, dopamine, mood].some(s => s != null)

  return (
    <div className="flex flex-1 flex-col px-6 py-8">
      {/* Header */}
      <p className="text-[13px] font-semibold uppercase tracking-widest text-white/20">
        State
      </p>

      {/* Ring + pillars */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <StateRing score={state} />

        {!hasAnyData ? (
          <p className="text-center text-[15px] leading-relaxed text-white/25">
            Complete your morning to see your state.
          </p>
        ) : (
          <div className="w-full space-y-4">
            {PILLARS.map((p, i) => (
              <PillarRow
                key={p.key}
                label={p.label}
                score={scores[p.key]}
                color={p.color}
                delay={0.1 + i * 0.08}
              />
            ))}
          </div>
        )}

        {/* Day priority */}
        {morningState?.dayPriority && (
          <p className="text-center text-[14px] italic leading-relaxed text-white/25">
            "{morningState.dayPriority}"
          </p>
        )}
      </div>

      {/* Stat pills */}
      {hasAnyData && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {sleepData?.hoursSlept != null && (
            <span className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-white/40">
              {sleepData.hoursSlept}h sleep
            </span>
          )}
          {fitmindData?.score != null && (
            <span className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-white/40">
              FitMind {fitmindData.score}
            </span>
          )}
          {morningLog?.completedCount != null && (
            <span className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-white/40">
              {morningLog.completedCount}/{(morningLog.completedCount || 0) + (morningLog.skippedCount || 0)} morning
            </span>
          )}
          {morningState?.overallMorningScore != null && (
            <span className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-white/40">
              Score {morningState.overallMorningScore}
            </span>
          )}
          {morningState?.emotionalState && (
            <span className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-white/40">
              {morningState.emotionalState}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
