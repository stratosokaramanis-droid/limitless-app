import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const PHASES = [
  { key: 'morning', label: 'Morning Block' },
  { key: 'creative', label: 'Creative Block' },
  { key: 'work', label: 'Deep Work' },
  { key: 'night', label: 'Night Routine' },
  { key: 'bed', label: 'Bed Routine' },
]

function formatDate() {
  const d = new Date()
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function PhaseRow({ label, status, stat, index }) {
  const dotClass =
    status === 'done'
      ? 'bg-white'
      : status === 'active'
      ? 'bg-white/30 ring-2 ring-white/20'
      : 'bg-white/[0.06]'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + index * 0.06, duration: 0.35 }}
      className="flex items-center gap-4"
    >
      <div className="flex w-6 justify-center">
        <div className={`relative h-3 w-3 rounded-full ${dotClass}`}>
          {status === 'active' && (
            <div className="absolute inset-0 animate-ping rounded-full bg-white/20" />
          )}
        </div>
      </div>
      <span
        className={`flex-1 text-[15px] font-medium ${
          status === 'done'
            ? 'text-white/50'
            : status === 'active'
            ? 'text-white'
            : 'text-white/20'
        }`}
      >
        {label}
      </span>
      {stat && (
        <span className="text-[13px] font-medium tabular-nums text-white/25">{stat}</span>
      )}
    </motion.div>
  )
}

function MiniRing({ score }) {
  const hasScore = score != null
  const pct = hasScore ? score / 10 : 0
  const circumference = 2 * Math.PI * 38
  const offset = circumference * (1 - pct)

  return (
    <div className="relative flex items-center justify-center">
      <svg className="h-[96px] w-[96px] -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r="38" stroke="rgba(255,255,255,0.04)" strokeWidth="4" fill="none" />
        <motion.circle
          cx="44" cy="44" r="38"
          stroke="url(#dashGrad)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
        <defs>
          <linearGradient id="dashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5E9EFF" />
            <stop offset="50%" stopColor="#BF5AF2" />
            <stop offset="100%" stopColor="#FF9F0A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <span className="block text-[24px] font-bold tabular-nums tracking-tight text-white">
          {hasScore ? score.toFixed(1) : '--'}
        </span>
        <span className="block text-[9px] font-medium uppercase tracking-widest text-white/20">
          state
        </span>
      </div>
    </div>
  )
}

// Score calculations (same as StateTab)
function calcSleep(sleepData) {
  if (sleepData?.hoursSlept == null) return null
  const hoursScore = Math.min(sleepData.hoursSlept / 8, 1) * 10
  const qualityScore = sleepData.sleepScore != null ? sleepData.sleepScore / 10 : hoursScore
  return Math.min(Math.max(hoursScore * 0.6 + qualityScore * 0.4, 0), 10)
}

function calcNutrition(creativeState, workSessions) {
  const scores = []
  if (creativeState?.nutritionScore != null) scores.push(creativeState.nutritionScore)
  else if (creativeState?.nutrition?.logged) scores.push(6.5)
  const sessions = workSessions?.sessions || []
  for (const s of sessions) { if (s.nutritionScore != null) scores.push(s.nutritionScore) }
  if (workSessions?.lunchNutritionScore != null) scores.push(workSessions.lunchNutritionScore)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function calcDopamine(fitmindData, morningLog, creativeState, workSessions) {
  let score = 5.0, hasData = false
  if (fitmindData?.workoutCompleted != null) {
    hasData = true
    const fitBoost = fitmindData.workoutCompleted
      ? (fitmindData.score != null ? (fitmindData.score / 100) * 4 : 2.5) : -1
    score += fitBoost - 1.5
  }
  const total = (morningLog?.completedCount || 0) + (morningLog?.skippedCount || 0)
  if (total > 0) { hasData = true; score += ((morningLog.completedCount / total) - 0.5) * 2 }
  if (creativeState?.dopamineQuality != null) { hasData = true; score += (creativeState.dopamineQuality - 5) * 0.4 }
  else if (creativeState?.energyScore != null) { hasData = true; score += (creativeState.energyScore - 5) * 0.2 }
  const completedSessions = workSessions?.sessions?.filter(s => s.endedAt && s.flowScore != null) || []
  if (completedSessions.length > 0) { hasData = true; score += (completedSessions.reduce((sum, s) => sum + s.flowScore, 0) / completedSessions.length - 5) * 0.3 }
  if (!hasData) return null
  return Math.min(Math.max(score, 0), 10)
}

function calcMood(morningState, creativeState) {
  const MOOD_TAG_SCORES = {
    'fired-up': 9.5, 'energized': 9, 'grounded': 8, 'focused': 8,
    'calm': 7, 'neutral': 6, 'tired': 4.5, 'flat': 4,
    'foggy': 4, 'anxious': 4.5, 'stressed': 3.5, 'overwhelmed': 3
  }
  const values = []
  const tagScore = MOOD_TAG_SCORES[morningState?.emotionalState]
  if (tagScore != null) values.push(tagScore)
  if (morningState?.energyScore != null) values.push(morningState.energyScore)
  if (creativeState?.energyScore != null) values.push(creativeState.energyScore * 1.2)
  if (values.length === 0) return null
  return Math.min(Math.max(values.reduce((a, b) => a + b, 0) / values.length, 0), 10)
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

export default function DashboardTab({ onNavigateToFocus }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const endpoints = [
        '/api/sleep-data', '/api/fitmind-data', '/api/morning-block-log',
        '/api/morning-state', '/api/creative-state', '/api/work-sessions',
        '/api/night-routine'
      ]
      const results = await Promise.allSettled(endpoints.map(u => fetch(u).then(r => r.ok ? r.json() : null)))
      const [sleepData, fitmindData, morningLog, morningState, creativeState, workSessions, nightRoutine] =
        results.map(r => (r.status === 'fulfilled' ? r.value : null) ?? {})
      setData({ sleepData, fitmindData, morningLog, morningState, creativeState, workSessions, nightRoutine })
    } catch {
      setData({})
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

  const { sleepData, fitmindData, morningLog, morningState, creativeState, workSessions, nightRoutine } = data

  // Calculate state score
  const sleep = calcSleep(sleepData)
  const nutrition = calcNutrition(creativeState, workSessions)
  const dopamine = calcDopamine(fitmindData, morningLog, creativeState, workSessions)
  const mood = calcMood(morningState, creativeState)
  const state = calcState(sleep, nutrition, dopamine, mood)

  // Derive current view from localStorage
  const currentView = localStorage.getItem('limitless_current_view') || 'morning-routine'

  // Morning block status
  const morningStatuses = (() => {
    try {
      const raw = localStorage.getItem('limitless_morning_statuses')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })()
  const morningTotal = 9
  const morningDone = Object.values(morningStatuses).filter(s => s === 'done' || s === 'skipped').length

  // Creative block
  const creativeStart = localStorage.getItem('limitless_creative_block_start')

  // Work sessions
  const workLocal = (() => {
    try {
      const raw = localStorage.getItem('limitless_work_sessions')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })()
  const workDone = [workLocal.s1End, workLocal.s2End, workLocal.s3End].filter(Boolean).length

  // Night routine
  const nightStatuses = (() => {
    try {
      const raw = localStorage.getItem('limitless_night_routine')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })()
  const nightItems = ['letting-go', 'nervous-system', 'plan-tomorrow']
  const bedItems = ['finalize-plan', 'read-prompts', 'affirmations', 'alter-memories']
  const nightDoneCount = nightItems.filter(id => nightStatuses[id]).length
  const bedDoneCount = bedItems.filter(id => nightStatuses[id]).length

  // Phase statuses
  function getPhaseStatus(key) {
    if (key === 'morning') {
      if (morningDone >= morningTotal) return 'done'
      if (currentView === 'morning-routine') return 'active'
      if (morningDone > 0) return 'done'
      return 'upcoming'
    }
    if (key === 'creative') {
      if (['work-sessions', 'night-routine'].includes(currentView)) return 'done'
      if (currentView === 'creative-block') return 'active'
      return 'upcoming'
    }
    if (key === 'work') {
      if (currentView === 'night-routine') return workDone >= 3 ? 'done' : 'done'
      if (currentView === 'work-sessions') return 'active'
      if (workDone >= 3) return 'done'
      return 'upcoming'
    }
    if (key === 'night') {
      if (nightDoneCount >= 3) return 'done'
      if (currentView === 'night-routine' && nightDoneCount < 3) return 'active'
      if (currentView === 'night-routine' && nightDoneCount >= 3) return 'done'
      return 'upcoming'
    }
    if (key === 'bed') {
      if (bedDoneCount >= 4) return 'done'
      if (currentView === 'night-routine' && nightDoneCount >= 3) return 'active'
      return 'upcoming'
    }
    return 'upcoming'
  }

  function getPhaseStat(key) {
    if (key === 'morning') return `${morningDone}/${morningTotal}`
    if (key === 'creative') {
      if (!creativeStart) return null
      const elapsed = Date.now() - Number(creativeStart)
      const h = Math.floor(elapsed / 3600000)
      const m = Math.floor((elapsed % 3600000) / 60000)
      return `${h}:${String(m).padStart(2, '0')}`
    }
    if (key === 'work') return `${workDone}/3`
    if (key === 'night') return nightDoneCount >= 3 ? '3/3' : `${nightDoneCount}/3`
    if (key === 'bed') return bedDoneCount >= 4 ? '4/4' : `${bedDoneCount}/4`
    return null
  }

  return (
    <div className="flex flex-1 flex-col px-6 py-8">
      {/* Date */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-[13px] font-medium text-white/25"
      >
        {formatDate()}
      </motion.p>

      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        {/* State ring */}
        <MiniRing score={state} />

        {/* Timeline */}
        <div className="w-full space-y-5">
          {PHASES.map((phase, i) => (
            <PhaseRow
              key={phase.key}
              label={phase.label}
              status={getPhaseStatus(phase.key)}
              stat={getPhaseStat(phase.key)}
              index={i}
            />
          ))}
        </div>

        {/* Continue button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onNavigateToFocus}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full rounded-2xl bg-white/[0.08] px-5 py-[18px] text-[15px] font-semibold text-white"
        >
          Continue
        </motion.button>
      </div>
    </div>
  )
}
