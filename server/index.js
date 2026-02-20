import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = 3001
const DATA_DIR = path.join(process.env.HOME, '.openclaw/data/shared')
const HISTORY_DIR = path.join(DATA_DIR, 'history')

// ─── Static reference data ────────────────────────────────────────────────────

const BADGES_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/badges.json'), 'utf8'))
const MISSIONS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/missions.json'), 'utf8'))

app.use(cors())
app.use(express.json())

// ─── Request logging ──────────────────────────────────────────────────────────

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path === '/health') {
    // skip noisy GET logs, but log health checks and all writes
  }
  if (req.method === 'POST') {
    const summary = req.body ? Object.keys(req.body).join(',') : '(empty)'
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} keys=[${summary}]`)
  }
  next()
})

// ─── Stubs ────────────────────────────────────────────────────────────────────

const STUBS = {
  'morning-block-log': {
    date: null, startedAt: null, completedAt: null,
    items: [], completedCount: 0, skippedCount: 0
  },
  'creative-block-log': {
    date: null, startedAt: null, completedAt: null, status: 'not_started'
  },
  'sleep-data': {
    date: null, createdAt: null, source: null, hoursSlept: null, quality: null,
    sleepScore: null, wakeUpMood: null, notes: '', rawExtracted: {}
  },
  'fitmind-data': {
    date: null, createdAt: null, source: null, workoutCompleted: null,
    duration: null, type: null, score: null, notes: ''
  },
  'morning-state': {
    date: null, createdAt: null, updatedAt: null,
    energyScore: null, mentalClarity: null, emotionalState: null,
    insights: [], dayPriority: null, resistanceNoted: null,
    resistanceDescription: null, overallMorningScore: null, rawNotes: ''
  },
  'creative-state': {
    date: null, createdAt: null, updatedAt: null,
    activities: [], energyScore: null, creativeOutput: null,
    insights: [], nutrition: { logged: false, meal: null, notes: '' },
    nutritionScore: null, dopamineQuality: null,
    moodShift: null, rawNotes: ''
  },
  'work-sessions': {
    date: null, sessions: [], totalSessions: 3,
    completedSessions: 0, lunchBreakLogged: false,
    lunchMeal: null, lunchNutritionScore: null
  },
  'votes': {
    date: null, votes: []
  },
  'night-routine': {
    date: null, startedAt: null, completedAt: null,
    letGoCompleted: false, letGoTimestamp: null,
    nervousSystemCompleted: false, nervousSystemTimestamp: null,
    planCompleted: false, planTimestamp: null, tomorrowPlan: '',
    promptsReviewed: false, promptsTimestamp: null,
    affirmationsReviewed: false, affirmationsTimestamp: null,
    alterMemoriesCompleted: false, alterMemoriesTimestamp: null
  },
  'midday-checkin': {
    date: null, triggeredAt: null, energyScore: null, notes: '', rawNotes: ''
  }
}

const DAILY_FILES = Object.keys(STUBS)

// ─── Persistent file stubs (no daily reset) ───────────────────────────────────

const PERSISTENT_STUBS = {
  'badge-progress': {
    lastUpdated: null,
    badges: Object.fromEntries(BADGES_DATA.badges.map((b) => [b.slug, {
      tier: 1, tierName: 'Initiate', xp: 0,
      exercisesCompleted: 0, missionsCompleted: 0, missionsFailed: 0,
      bossEncounters: 0, currentStreak: 0, longestStreak: 0, lastActivityDate: null
    }]))
  },
  'badge-missions': {
    lastAssigned: null,
    active: [],
    completed: []
  }
}

const DAILY_STUBS_EXTRA = {
  'badge-daily': {
    date: null,
    exercises: [],
    missionsAttempted: [],
    xpGained: {}
  },
  'vf-game': {
    date: null,
    triggeredAt: null,
    completedAt: null,
    presenceScore: null,
    effortLevel: null,
    affirmations: BADGES_DATA.badges.map((b) => ({
      badgeSlug: b.slug,
      statement: b.identityStatement,
      convictionScore: null,
      reinforcingActions: [],
      weakeningActions: [],
      votes: []
    })),
    beliefs: [],
    guidedQuestions: [],
    notes: ''
  }
}

// Add extra daily stubs to main stubs + daily files list
Object.assign(STUBS, DAILY_STUBS_EXTRA)
DAILY_FILES.push(...Object.keys(DAILY_STUBS_EXTRA))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const filePath = (name) => path.join(DATA_DIR, `${name}.json`)

const freshStub = (name) => structuredClone(STUBS[name])

const readJson = (name) => {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf8')
    return JSON.parse(raw)
  } catch {
    return freshStub(name)
  }
}

const writeJson = (name, data) => {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8')
}

const nowIso = () => new Date().toISOString()
const todayStr = () => new Date().toISOString().slice(0, 10)

// Persistent file helpers (no day reset)
const readPersistent = (name) => {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf8')
    return JSON.parse(raw)
  } catch {
    return structuredClone(PERSISTENT_STUBS[name])
  }
}

const writePersistent = (name, data) => {
  data.lastUpdated = nowIso()
  writeJson(name, data)
}

// XP engine helpers
const getTierForXp = (xp) => {
  const tiers = BADGES_DATA.tiers
  let tier = tiers[0]
  for (const t of tiers) {
    if (xp >= t.xpRequired) tier = t
    else break
  }
  return tier
}

const getStreakMultiplier = (streak) => {
  const bonuses = BADGES_DATA.xpRules.streakBonuses
  let mult = 1.0
  for (const b of bonuses) {
    if (streak >= b.days) mult = b.multiplier
  }
  return mult
}

const applyXp = (progress, badgeSlug, rawXp) => {
  const badge = progress.badges[badgeSlug]
  if (!badge) return 0
  const mult = getStreakMultiplier(badge.currentStreak)
  const xp = Math.round(rawXp * mult)
  badge.xp = Math.max(0, badge.xp + xp)
  const tier = getTierForXp(badge.xp)
  badge.tier = tier.level
  badge.tierName = tier.name
  return xp
}

const updateStreak = (progress, badgeSlug, today) => {
  const badge = progress.badges[badgeSlug]
  if (!badge) return
  if (badge.lastActivityDate === today) return // already counted today

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (badge.lastActivityDate === yesterdayStr) {
    badge.currentStreak += 1
  } else if (badge.lastActivityDate && badge.lastActivityDate < yesterdayStr) {
    badge.currentStreak = 1 // streak broken
  } else {
    badge.currentStreak = 1 // first activity
  }

  if (badge.currentStreak > badge.longestStreak) {
    badge.longestStreak = badge.currentStreak
  }
  badge.lastActivityDate = today
}

// Pick only allowed keys from an object
const pick = (obj, keys) => {
  const result = {}
  for (const k of keys) {
    if (obj[k] !== undefined) result[k] = obj[k]
  }
  return result
}

// ─── Historical snapshot (idempotent) ─────────────────────────────────────────

const archiveDay = (dateStr) => {
  try {
    const dayDir = path.join(HISTORY_DIR, dateStr)
    // Idempotent: skip if already archived
    if (fs.existsSync(dayDir)) return
    fs.mkdirSync(dayDir, { recursive: true })
    for (const name of DAILY_FILES) {
      const src = filePath(name)
      const dst = path.join(dayDir, `${name}.json`)
      if (fs.existsSync(src)) fs.copyFileSync(src, dst)
    }
    pruneHistory(90)
    console.log(`[${nowIso()}] Archived day: ${dateStr}`)
  } catch (err) {
    console.error('Archive failed:', err.message)
  }
}

const pruneHistory = (keepDays) => {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - keepDays)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const dirs = fs.readdirSync(HISTORY_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    for (const dir of dirs) {
      if (dir < cutoffStr) fs.rmSync(path.join(HISTORY_DIR, dir), { recursive: true, force: true })
    }
  } catch {}
}

const resetForNewDay = (name, today) => {
  const data = readJson(name)
  if (data.date && data.date !== today) {
    archiveDay(data.date)
    return freshStub(name)
  }
  if (!data.date) return freshStub(name)
  return data
}

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    dataDir: DATA_DIR,
    files: DAILY_FILES.length,
    timestamp: nowIso()
  })
})

// ─── GET endpoints ────────────────────────────────────────────────────────────

DAILY_FILES.forEach((name) => {
  app.get(`/${name}`, (req, res) => res.json(readJson(name)))
})

app.get('/events', (req, res) => {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'events.jsonl'), 'utf8')
    const events = raw.split('\n').filter(Boolean)
      .map((line) => { try { return JSON.parse(line) } catch { return null } })
      .filter(Boolean)
    res.json(events)
  } catch {
    res.json([])
  }
})

// ─── GET /history ─────────────────────────────────────────────────────────────

app.get('/history', (req, res) => {
  try {
    fs.mkdirSync(HISTORY_DIR, { recursive: true })
    const dirs = fs.readdirSync(HISTORY_DIR)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort().reverse()
    res.json(dirs)
  } catch {
    res.json([])
  }
})

app.get('/history/:date', (req, res) => {
  const { date } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date' })
  const result = {}
  for (const name of DAILY_FILES) {
    try {
      result[name] = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, date, `${name}.json`), 'utf8'))
    } catch {
      result[name] = freshStub(name)
    }
  }
  res.json(result)
})

app.get('/history/:date/:file', (req, res) => {
  const { date, file } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date' })
  if (!DAILY_FILES.includes(file)) return res.status(400).json({ error: 'Unknown file' })
  try {
    res.json(JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, date, `${file}.json`), 'utf8')))
  } catch {
    res.json(freshStub(file))
  }
})

// ─── POST /morning-block-log ──────────────────────────────────────────────────

app.post('/morning-block-log', (req, res) => {
  const { itemId, status, timestamp } = req.body
  if (!itemId || !status) return res.status(400).json({ error: 'itemId and status required' })
  const today = todayStr()
  let data = resetForNewDay('morning-block-log', today)
  data.date = today
  if (!data.startedAt) data.startedAt = nowIso()

  const idx = data.items.findIndex((i) => i.id === itemId)
  const item = { id: itemId, status, timestamp: timestamp || nowIso() }
  if (idx >= 0) data.items[idx] = item
  else data.items.push(item)

  data.completedCount = data.items.filter((i) => i.status === 'done').length
  data.skippedCount = data.items.filter((i) => i.status === 'skipped').length

  writeJson('morning-block-log', data)
  res.json({ ok: true })
})

// ─── POST /creative-block-log ─────────────────────────────────────────────────

const CREATIVE_BLOCK_FIELDS = ['status', 'startedAt', 'completedAt']

app.post('/creative-block-log', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('creative-block-log', today)
  data.date = today
  const allowed = pick(req.body, CREATIVE_BLOCK_FIELDS)
  Object.assign(data, allowed)
  writeJson('creative-block-log', data)
  res.json({ ok: true })
})

// ─── POST /sleep-data (Pulse) ─────────────────────────────────────────────────

const SLEEP_DATA_FIELDS = ['source', 'hoursSlept', 'quality', 'sleepScore', 'wakeUpMood', 'notes', 'rawExtracted', 'createdAt']

app.post('/sleep-data', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('sleep-data', today)
  data.date = today
  const allowed = pick(req.body, SLEEP_DATA_FIELDS)
  Object.assign(data, allowed)
  if (!data.createdAt) data.createdAt = nowIso()
  writeJson('sleep-data', data)
  res.json({ ok: true })
})

// ─── POST /fitmind-data (Pulse) ───────────────────────────────────────────────

const FITMIND_DATA_FIELDS = ['source', 'workoutCompleted', 'duration', 'type', 'score', 'notes', 'createdAt']

app.post('/fitmind-data', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('fitmind-data', today)
  data.date = today
  const allowed = pick(req.body, FITMIND_DATA_FIELDS)
  Object.assign(data, allowed)
  if (!data.createdAt) data.createdAt = nowIso()
  writeJson('fitmind-data', data)
  res.json({ ok: true })
})

// ─── POST /morning-state (Dawn) ──────────────────────────────────────────────

const MORNING_STATE_FIELDS = ['energyScore', 'mentalClarity', 'emotionalState', 'insights',
  'dayPriority', 'resistanceNoted', 'resistanceDescription', 'overallMorningScore', 'rawNotes',
  'createdAt', 'updatedAt']

app.post('/morning-state', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('morning-state', today)
  data.date = today
  const allowed = pick(req.body, MORNING_STATE_FIELDS)
  Object.assign(data, allowed)
  if (!data.createdAt) data.createdAt = nowIso()
  data.updatedAt = nowIso()
  writeJson('morning-state', data)
  res.json({ ok: true })
})

// ─── POST /creative-state (Muse) ─────────────────────────────────────────────

const CREATIVE_STATE_FIELDS = ['activities', 'energyScore', 'creativeOutput', 'insights',
  'nutrition', 'nutritionScore', 'dopamineQuality', 'moodShift', 'rawNotes',
  'createdAt', 'updatedAt']

app.post('/creative-state', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('creative-state', today)
  data.date = today
  const allowed = pick(req.body, CREATIVE_STATE_FIELDS)
  Object.assign(data, allowed)
  if (!data.createdAt) data.createdAt = nowIso()
  data.updatedAt = nowIso()
  writeJson('creative-state', data)
  res.json({ ok: true })
})

// ─── POST /work-sessions/start ────────────────────────────────────────────────

app.post('/work-sessions/start', (req, res) => {
  const { sessionId, focus, evaluationCriteria } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
  const today = todayStr()
  let data = resetForNewDay('work-sessions', today)
  data.date = today

  const existing = data.sessions.find((s) => s.id === sessionId)
  if (existing) {
    existing.startedAt = nowIso()
    existing.focus = focus || existing.focus
    existing.evaluationCriteria = evaluationCriteria || existing.evaluationCriteria
  } else {
    data.sessions.push({
      id: sessionId, startedAt: nowIso(), endedAt: null,
      durationMinutes: 90, focus: focus || '', evaluationCriteria: evaluationCriteria || '',
      outcomes: null, outcomeScore: null, flowScore: null, compositeScore: null,
      meal: null, nutritionScore: null, notes: ''
    })
  }

  writeJson('work-sessions', data)
  res.json({ ok: true })
})

// ─── POST /work-sessions/end ──────────────────────────────────────────────────

app.post('/work-sessions/end', (req, res) => {
  const { sessionId, outcomes, outcomeScore, flowScore, compositeScore, meal, nutritionScore, notes } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
  const today = todayStr()
  let data = resetForNewDay('work-sessions', today)
  data.date = today

  let session = data.sessions.find((s) => s.id === sessionId)
  if (!session) {
    session = { id: sessionId, startedAt: null, durationMinutes: 90, focus: '', evaluationCriteria: '' }
    data.sessions.push(session)
  }

  session.endedAt = nowIso()
  if (outcomes !== undefined) session.outcomes = outcomes
  if (outcomeScore !== undefined) session.outcomeScore = outcomeScore
  if (flowScore !== undefined) session.flowScore = flowScore
  if (compositeScore !== undefined) session.compositeScore = compositeScore
  if (meal !== undefined) session.meal = meal
  if (nutritionScore !== undefined) session.nutritionScore = nutritionScore
  if (notes !== undefined) session.notes = notes

  data.completedSessions = data.sessions.filter((s) => s.endedAt).length
  writeJson('work-sessions', data)
  res.json({ ok: true })
})

// ─── POST /votes ──────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set(['nutrition', 'work', 'mental-power', 'personality', 'creativity', 'physical', 'relationships'])
const VALID_POLARITIES = new Set(['positive', 'negative'])

app.post('/votes', (req, res) => {
  const { votes: incoming } = req.body
  if (!Array.isArray(incoming)) return res.status(400).json({ error: 'votes array required' })

  const today = todayStr()
  let data = resetForNewDay('votes', today)
  data.date = today

  let added = 0
  for (const v of incoming) {
    if (!VALID_CATEGORIES.has(v.category)) continue
    if (!VALID_POLARITIES.has(v.polarity)) continue
    if (!v.action) continue

    data.votes.push({
      id: randomUUID(),
      timestamp: v.timestamp || nowIso(),
      action: v.action,
      category: v.category,
      polarity: v.polarity,
      source: v.source || 'unknown',
      weight: v.weight || 1
    })
    added++
  }

  writeJson('votes', data)
  res.json({ ok: true, added })
})

// ─── POST /events ─────────────────────────────────────────────────────────────

app.post('/events', (req, res) => {
  const { events } = req.body
  if (!Array.isArray(events)) return res.status(400).json({ error: 'events array required' })

  const eventsPath = path.join(DATA_DIR, 'events.jsonl')
  const lines = events
    .filter((e) => e && typeof e === 'object')
    .map((e) => {
      if (!e.timestamp) e.timestamp = nowIso()
      return JSON.stringify(e)
    })

  if (lines.length > 0) {
    fs.appendFileSync(eventsPath, lines.join('\n') + '\n', 'utf8')
  }

  res.json({ ok: true, added: lines.length })
})

// ─── POST /night-routine ──────────────────────────────────────────────────────

const NIGHT_ROUTINE_FIELDS = ['letGoCompleted', 'letGoTimestamp', 'nervousSystemCompleted', 'nervousSystemTimestamp',
  'planCompleted', 'planTimestamp', 'tomorrowPlan', 'promptsReviewed', 'promptsTimestamp',
  'affirmationsReviewed', 'affirmationsTimestamp', 'alterMemoriesCompleted', 'alterMemoriesTimestamp']

app.post('/night-routine', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('night-routine', today)
  data.date = today
  if (!data.startedAt) data.startedAt = nowIso()

  const allowed = pick(req.body, NIGHT_ROUTINE_FIELDS)
  Object.assign(data, allowed)

  if (data.letGoCompleted && data.nervousSystemCompleted && data.planCompleted) {
    data.completedAt = data.completedAt || nowIso()
  }

  writeJson('night-routine', data)
  res.json({ ok: true })
})

// ─── POST /midday-checkin ─────────────────────────────────────────────────────

const MIDDAY_CHECKIN_FIELDS = ['energyScore', 'notes', 'rawNotes']

app.post('/midday-checkin', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('midday-checkin', today)
  data.date = today
  data.triggeredAt = data.triggeredAt || nowIso()
  const allowed = pick(req.body, MIDDAY_CHECKIN_FIELDS)
  Object.assign(data, allowed)
  writeJson('midday-checkin', data)
  res.json({ ok: true })
})

// ─── GET /badges (static reference) ───────────────────────────────────────────

app.get('/badges', (req, res) => res.json(BADGES_DATA))
app.get('/badges/missions', (req, res) => res.json(MISSIONS_DATA))

// ─── GET /badge-progress (persistent) ─────────────────────────────────────────

app.get('/badge-progress', (req, res) => res.json(readPersistent('badge-progress')))

// ─── GET /badge-missions (persistent) ─────────────────────────────────────────

app.get('/badge-missions', (req, res) => res.json(readPersistent('badge-missions')))

// ─── POST /badge-progress/exercise ────────────────────────────────────────────

app.post('/badge-progress/exercise', (req, res) => {
  const { badgeSlug, exerciseId } = req.body
  if (!badgeSlug || !exerciseId) return res.status(400).json({ error: 'badgeSlug and exerciseId required' })

  const badge = BADGES_DATA.badges.find((b) => b.slug === badgeSlug)
  if (!badge) return res.status(400).json({ error: 'Unknown badge' })
  const exercise = badge.exercises.find((e) => e.id === exerciseId)
  if (!exercise) return res.status(400).json({ error: 'Unknown exercise' })

  const today = todayStr()
  const progress = readPersistent('badge-progress')

  // Ensure badge exists in progress
  if (!progress.badges[badgeSlug]) {
    progress.badges[badgeSlug] = structuredClone(PERSISTENT_STUBS['badge-progress'].badges[badgeSlug])
  }

  // Update streak
  updateStreak(progress, badgeSlug, today)

  // Apply XP
  const xpGained = applyXp(progress, badgeSlug, exercise.xp)
  progress.badges[badgeSlug].exercisesCompleted += 1
  writePersistent('badge-progress', progress)

  // Log to badge-daily
  let daily = resetForNewDay('badge-daily', today)
  daily.date = today
  daily.exercises.push({
    badgeSlug, exerciseId,
    timestamp: nowIso(),
    xpGained
  })
  if (!daily.xpGained[badgeSlug]) daily.xpGained[badgeSlug] = 0
  daily.xpGained[badgeSlug] += xpGained
  writeJson('badge-daily', daily)

  res.json({
    ok: true, xpGained,
    totalXp: progress.badges[badgeSlug].xp,
    tier: progress.badges[badgeSlug].tier,
    tierName: progress.badges[badgeSlug].tierName,
    streak: progress.badges[badgeSlug].currentStreak
  })
})

// ─── POST /badge-missions/assign ──────────────────────────────────────────────

app.post('/badge-missions/assign', (req, res) => {
  const { badgeSlugs } = req.body // optional: assign for specific badges, default all
  const today = todayStr()
  const progress = readPersistent('badge-progress')
  const missions = readPersistent('badge-missions')

  // Don't re-assign if already assigned today
  if (missions.lastAssigned === today) {
    return res.json({ ok: true, message: 'Already assigned today', active: missions.active })
  }

  // Move yesterday's pending missions to completed as expired
  for (const m of missions.active) {
    if (m.status === 'pending') {
      m.status = 'expired'
      m.completedAt = nowIso()
      missions.completed.push(m)
    }
  }
  missions.active = []

  const slugs = badgeSlugs || BADGES_DATA.badges.map((b) => b.slug)

  for (const slug of slugs) {
    const badgeProgress = progress.badges[slug]
    if (!badgeProgress) continue
    const tier = badgeProgress.tier

    // Get eligible missions (minTier <= current tier)
    const eligible = MISSIONS_DATA.missions.filter((m) =>
      m.badgeSlug === slug && m.minTier <= tier
    )
    if (eligible.length === 0) continue

    // Pick one random mission
    const mission = eligible[Math.floor(Math.random() * eligible.length)]
    missions.active.push({
      missionId: mission.id,
      badgeSlug: slug,
      title: mission.title,
      description: mission.description,
      successCriteria: mission.successCriteria,
      rewardXp: mission.rewardXp,
      failXp: mission.failXp,
      minTier: mission.minTier,
      assignedAt: nowIso(),
      status: 'pending',
      completedAt: null,
      xpAwarded: 0
    })
  }

  missions.lastAssigned = today
  writePersistent('badge-missions', missions)

  // Trim completed history (keep last 500)
  if (missions.completed.length > 500) {
    missions.completed = missions.completed.slice(-500)
    writePersistent('badge-missions', missions)
  }

  res.json({ ok: true, active: missions.active })
})

// ─── POST /badge-missions/complete ────────────────────────────────────────────

app.post('/badge-missions/complete', (req, res) => {
  const { missionId, success, notes } = req.body
  if (!missionId || success === undefined) return res.status(400).json({ error: 'missionId and success required' })

  const today = todayStr()
  const missions = readPersistent('badge-missions')
  const idx = missions.active.findIndex((m) => m.missionId === missionId && m.status === 'pending')
  if (idx === -1) return res.status(400).json({ error: 'Mission not found or already completed' })

  const mission = missions.active[idx]
  const progress = readPersistent('badge-progress')

  // Update streak
  updateStreak(progress, mission.badgeSlug, today)

  const rawXp = success ? mission.rewardXp : mission.failXp
  const xpGained = applyXp(progress, mission.badgeSlug, rawXp)

  if (success) {
    progress.badges[mission.badgeSlug].missionsCompleted += 1
  } else {
    progress.badges[mission.badgeSlug].missionsFailed += 1
  }
  writePersistent('badge-progress', progress)

  mission.status = success ? 'completed' : 'failed'
  mission.completedAt = nowIso()
  mission.xpAwarded = xpGained
  if (notes) mission.notes = notes
  missions.completed.push(mission)
  missions.active.splice(idx, 1)
  writePersistent('badge-missions', missions)

  // Log to badge-daily
  let daily = resetForNewDay('badge-daily', today)
  daily.date = today
  daily.missionsAttempted.push({
    missionId, badgeSlug: mission.badgeSlug,
    success, xpGained, timestamp: nowIso()
  })
  if (!daily.xpGained[mission.badgeSlug]) daily.xpGained[mission.badgeSlug] = 0
  daily.xpGained[mission.badgeSlug] += xpGained
  writeJson('badge-daily', daily)

  res.json({
    ok: true, success, xpGained,
    totalXp: progress.badges[mission.badgeSlug].xp,
    tier: progress.badges[mission.badgeSlug].tier,
    tierName: progress.badges[mission.badgeSlug].tierName
  })
})

// ─── POST /vf-game ────────────────────────────────────────────────────────────

const VF_GAME_FIELDS = ['presenceScore', 'effortLevel', 'affirmations', 'beliefs', 'guidedQuestions', 'notes']

app.post('/vf-game', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('vf-game', today)
  data.date = today
  if (!data.triggeredAt) data.triggeredAt = nowIso()

  const allowed = pick(req.body, VF_GAME_FIELDS)

  // Process affirmations and generate votes + XP
  if (allowed.affirmations && Array.isArray(allowed.affirmations)) {
    const progress = readPersistent('badge-progress')
    const rules = BADGES_DATA.xpRules
    const votesToAppend = []

    for (const aff of allowed.affirmations) {
      if (!aff.badgeSlug) continue

      // Find existing affirmation slot
      const slot = data.affirmations.find((a) => a.badgeSlug === aff.badgeSlug)
      if (slot) {
        if (aff.convictionScore !== undefined) slot.convictionScore = aff.convictionScore
        if (aff.reinforcingActions) slot.reinforcingActions = aff.reinforcingActions
        if (aff.weakeningActions) slot.weakeningActions = aff.weakeningActions
      }

      // Apply XP based on conviction score
      if (aff.convictionScore !== undefined) {
        updateStreak(progress, aff.badgeSlug, today)
        if (aff.convictionScore >= rules.vfBonusThreshold) {
          applyXp(progress, aff.badgeSlug, rules.vfBonusXp)
        } else if (aff.convictionScore <= rules.vfPenaltyThreshold) {
          applyXp(progress, aff.badgeSlug, rules.vfPenaltyXp)
        }
      }

      // Generate votes from reinforcing/weakening actions
      if (aff.reinforcingActions) {
        for (const action of aff.reinforcingActions) {
          votesToAppend.push({
            action: action,
            category: BADGES_DATA.badges.find((b) => b.slug === aff.badgeSlug)?.voteCategory || 'personality',
            polarity: 'positive',
            source: 'vf-game',
            weight: 1
          })
          if (slot) slot.votes.push({ action, polarity: 'positive', weight: 1 })
        }
      }
      if (aff.weakeningActions) {
        for (const action of aff.weakeningActions) {
          votesToAppend.push({
            action: action,
            category: BADGES_DATA.badges.find((b) => b.slug === aff.badgeSlug)?.voteCategory || 'personality',
            polarity: 'negative',
            source: 'vf-game',
            weight: 1
          })
          if (slot) slot.votes.push({ action, polarity: 'negative', weight: 1 })
        }
      }
      // No action on either → -0.5 vote
      if ((!aff.reinforcingActions || aff.reinforcingActions.length === 0) &&
          (!aff.weakeningActions || aff.weakeningActions.length === 0) &&
          aff.convictionScore !== undefined) {
        votesToAppend.push({
          action: `No action taken for: ${BADGES_DATA.badges.find((b) => b.slug === aff.badgeSlug)?.name || aff.badgeSlug}`,
          category: BADGES_DATA.badges.find((b) => b.slug === aff.badgeSlug)?.voteCategory || 'personality',
          polarity: 'negative',
          source: 'vf-game',
          weight: 0.5
        })
        if (slot) slot.votes.push({ action: 'No action taken', polarity: 'negative', weight: 0.5 })
      }
    }

    writePersistent('badge-progress', progress)

    // Append VF Game votes to daily votes.json
    if (votesToAppend.length > 0) {
      let votesData = resetForNewDay('votes', today)
      votesData.date = today
      for (const v of votesToAppend) {
        if (!VALID_CATEGORIES.has(v.category)) continue
        votesData.votes.push({
          id: randomUUID(),
          timestamp: nowIso(),
          action: v.action,
          category: v.category,
          polarity: v.polarity,
          source: 'vf-game',
          weight: v.weight
        })
      }
      writeJson('votes', votesData)
    }
  }

  // Apply non-affirmation fields
  if (allowed.presenceScore !== undefined) data.presenceScore = allowed.presenceScore
  if (allowed.effortLevel !== undefined) data.effortLevel = allowed.effortLevel
  if (allowed.beliefs) data.beliefs = allowed.beliefs
  if (allowed.guidedQuestions) data.guidedQuestions = allowed.guidedQuestions
  if (allowed.notes !== undefined) data.notes = allowed.notes
  data.completedAt = nowIso()

  writeJson('vf-game', data)
  res.json({ ok: true })
})

// ─── POST /boss-encounters ────────────────────────────────────────────────────

app.post('/boss-encounters', (req, res) => {
  const { badgeSlug, type, title, content } = req.body
  if (!badgeSlug || !type || !content) return res.status(400).json({ error: 'badgeSlug, type, and content required' })
  if (!['text', 'image', 'conversation'].includes(type)) return res.status(400).json({ error: 'type must be text, image, or conversation' })

  const badge = BADGES_DATA.badges.find((b) => b.slug === badgeSlug)
  if (!badge) return res.status(400).json({ error: 'Unknown badge' })

  const today = todayStr()
  const progress = readPersistent('badge-progress')

  // Update streak and apply XP
  updateStreak(progress, badgeSlug, today)
  const xpGained = applyXp(progress, badgeSlug, BADGES_DATA.xpRules.bossEncounterXp)
  progress.badges[badgeSlug].bossEncounters += 1
  writePersistent('badge-progress', progress)

  // Append to boss-encounters.jsonl
  const entry = {
    id: randomUUID(),
    timestamp: nowIso(),
    badgeSlug,
    type,
    title: title || '',
    content,
    xpAwarded: xpGained,
    source: req.body.source || 'user'
  }
  fs.appendFileSync(path.join(DATA_DIR, 'boss-encounters.jsonl'), JSON.stringify(entry) + '\n', 'utf8')

  res.json({
    ok: true, xpGained,
    totalXp: progress.badges[badgeSlug].xp,
    tier: progress.badges[badgeSlug].tier,
    tierName: progress.badges[badgeSlug].tierName
  })
})

// ─── GET /boss-encounters ─────────────────────────────────────────────────────

app.get('/boss-encounters', (req, res) => {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'boss-encounters.jsonl'), 'utf8')
    const entries = raw.split('\n').filter(Boolean)
      .map((line) => { try { return JSON.parse(line) } catch { return null } })
      .filter(Boolean)

    // Optional filter by badge
    const { badge, limit } = req.query
    let result = badge ? entries.filter((e) => e.badgeSlug === badge) : entries
    if (limit) result = result.slice(-parseInt(limit, 10))

    res.json(result)
  } catch {
    res.json([])
  }
})

// ─── Error handler ────────────────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error(`[${nowIso()}] UNCAUGHT EXCEPTION:`, err)
})

process.on('unhandledRejection', (err) => {
  console.error(`[${nowIso()}] UNHANDLED REJECTION:`, err)
})

// ─── Start ────────────────────────────────────────────────────────────────────

fs.mkdirSync(HISTORY_DIR, { recursive: true })

app.listen(PORT, () => {
  console.log(`[${nowIso()}] Limitless file server :${PORT}`)
  console.log(`  Data:       ${DATA_DIR}`)
  console.log(`  History:    ${HISTORY_DIR}`)
  console.log(`  Daily:      ${DAILY_FILES.join(', ')}`)
  console.log(`  Persistent: ${Object.keys(PERSISTENT_STUBS).join(', ')}`)
  console.log(`  Badges:     ${BADGES_DATA.badges.length} badges, ${MISSIONS_DATA.missions.length} missions`)
})
