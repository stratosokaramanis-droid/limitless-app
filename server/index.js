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
const AFFIRMATIONS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/affirmations.json'), 'utf8'))

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
    windDown: {
      lettingGoCompleted: false, lettingGoTimestamp: null,
      nervousSystemCompleted: false, nervousSystemTimestamp: null,
      bodyScanCompleted: false, bodyScanTimestamp: null
    },
    reflection: {
      alterMemoriesCompleted: false, alterMemoriesTimestamp: null,
      dayReviewCompleted: false, dayReviewTimestamp: null
    },
    planning: {
      planCompleted: false, planTimestamp: null, planText: '',
      planFinalized: false, planFinalizedTimestamp: null
    },
    bed: {
      promptsReviewed: false, promptsTimestamp: null,
      vfGameCompleted: false, visualizationCompleted: false,
      lightsOut: false, lightsOutTimestamp: null
    }
  },
  'midday-checkin': {
    date: null, triggeredAt: null, energyScore: null, notes: '', rawNotes: ''
  },
  'nutrition': {
    date: null,
    meals: [],
    averageScore: null,
    totalMeals: 0
  },
  'dopamine': {
    date: null,
    farming: { sessions: [], totalPoints: 0, totalMinutes: 0 },
    overstimulation: { events: [], totalEvents: 0 },
    screenTime: { totalMinutes: null, pickups: null, topApps: [], capturedAt: null },
    netScore: 5
  },
  'episode': {
    date: null, number: null,
    title: '', previouslyOn: '', todaysArc: '',
    plotPoints: [], rating: null, status: 'open'
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
  'key-decisions': {
    date: null,
    decisions: [],
    totalMultipliedWeight: 0
  },
  'vf-game': {
    date: null,
    sessions: []
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

// Migrate old flat night-routine format to new nested format
const migrateNightRoutine = (data) => {
  if (data.windDown) return data // already new format
  const migrated = {
    date: data.date, startedAt: data.startedAt, completedAt: data.completedAt,
    windDown: {
      lettingGoCompleted: data.letGoCompleted || false, lettingGoTimestamp: data.letGoTimestamp || null,
      nervousSystemCompleted: data.nervousSystemCompleted || false, nervousSystemTimestamp: data.nervousSystemTimestamp || null,
      bodyScanCompleted: false, bodyScanTimestamp: null
    },
    reflection: {
      alterMemoriesCompleted: data.alterMemoriesCompleted || false, alterMemoriesTimestamp: data.alterMemoriesTimestamp || null,
      dayReviewCompleted: false, dayReviewTimestamp: null
    },
    planning: {
      planCompleted: data.planCompleted || false, planTimestamp: data.planTimestamp || null,
      planText: data.tomorrowPlan || '', planFinalized: false, planFinalizedTimestamp: null
    },
    bed: {
      promptsReviewed: data.promptsReviewed || false, promptsTimestamp: data.promptsTimestamp || null,
      vfGameCompleted: false, visualizationCompleted: false,
      lightsOut: false, lightsOutTimestamp: null
    }
  }
  return migrated
}

// Auto plot-point hook for key decisions + boss encounters
const addAutoPlotPoint = (description, type) => {
  const today = todayStr()
  let data = resetForNewDay('episode', today)
  if (!data.date || !data.number) return // no active episode today
  data.plotPoints.push({
    id: randomUUID(), timestamp: nowIso(), description, type
  })
  writeJson('episode', data)
}

DAILY_FILES.forEach((name) => {
  // night-routine has a custom GET handler with migration
  if (name === 'night-routine') return
  app.get(`/${name}`, (req, res) => res.json(readJson(name)))
})

// Custom GET for night-routine with old→new format migration
app.get('/night-routine', (req, res) => {
  let data = readJson('night-routine')
  data = migrateNightRoutine(data)
  res.json(data)
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

const NIGHT_ROUTINE_PHASES = {
  windDown: ['lettingGoCompleted', 'lettingGoTimestamp', 'nervousSystemCompleted', 'nervousSystemTimestamp', 'bodyScanCompleted', 'bodyScanTimestamp'],
  reflection: ['alterMemoriesCompleted', 'alterMemoriesTimestamp', 'dayReviewCompleted', 'dayReviewTimestamp'],
  planning: ['planCompleted', 'planTimestamp', 'planText', 'planFinalized', 'planFinalizedTimestamp'],
  bed: ['promptsReviewed', 'promptsTimestamp', 'vfGameCompleted', 'visualizationCompleted', 'lightsOut', 'lightsOutTimestamp']
}

app.post('/night-routine', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('night-routine', today)
  data.date = today
  data = migrateNightRoutine(data)
  if (!data.startedAt) data.startedAt = nowIso()

  const { phase, ...fields } = req.body

  if (phase && NIGHT_ROUTINE_PHASES[phase]) {
    // Update specific phase
    const allowed = pick(fields, NIGHT_ROUTINE_PHASES[phase])
    Object.assign(data[phase], allowed)
  } else {
    // Bulk update — try to match fields to phases
    for (const [phaseName, phaseFields] of Object.entries(NIGHT_ROUTINE_PHASES)) {
      const allowed = pick(req.body, phaseFields)
      if (Object.keys(allowed).length > 0) {
        Object.assign(data[phaseName], allowed)
      }
    }
  }

  // Check completion
  const allWindDown = data.windDown.lettingGoCompleted && data.windDown.nervousSystemCompleted
  const allPlanning = data.planning.planCompleted
  const allBed = data.bed.lightsOut
  if (allWindDown && allPlanning && allBed) {
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

// ─── GET /affirmations (static reference) ─────────────────────────────────────

app.get('/affirmations', (req, res) => res.json(AFFIRMATIONS_DATA))

// ─── POST /key-decisions ──────────────────────────────────────────────────────

const KEY_DECISION_TYPES = new Set(['resist', 'persist', 'reframe', 'ground', 'face-boss', 'recenter'])

app.post('/key-decisions', (req, res) => {
  const { description, type, multiplier, affirmationIndex, notes } = req.body
  if (!description || !type) return res.status(400).json({ error: 'description and type required' })
  if (!KEY_DECISION_TYPES.has(type)) return res.status(400).json({ error: `type must be one of: ${[...KEY_DECISION_TYPES].join(', ')}` })

  const today = todayStr()
  let data = resetForNewDay('key-decisions', today)
  data.date = today

  const mult = multiplier || (type === 'face-boss' ? 5 : type === 'resist' ? 3 : 2)

  const decision = {
    id: randomUUID(),
    timestamp: nowIso(),
    description,
    type,
    multiplier: mult,
    affirmationIndex: affirmationIndex ?? null,
    notes: notes || ''
  }

  data.decisions.push(decision)
  data.totalMultipliedWeight += mult

  // Generate multiplied vote
  const votesToAppend = [{
    action: description,
    category: 'mental-power',
    polarity: 'positive',
    source: 'key-decision',
    weight: mult
  }]

  let votesData = resetForNewDay('votes', today)
  votesData.date = today
  for (const v of votesToAppend) {
    votesData.votes.push({
      id: randomUUID(),
      timestamp: nowIso(),
      action: v.action,
      category: v.category,
      polarity: v.polarity,
      source: v.source,
      weight: v.weight
    })
  }
  writeJson('votes', votesData)

  writeJson('key-decisions', data)

  // Auto plot-point for active episode
  addAutoPlotPoint(description, 'key-decision')

  res.json({
    ok: true,
    decision,
    totalDecisions: data.decisions.length,
    totalMultipliedWeight: data.totalMultipliedWeight
  })
})

// ─── POST /vf-game ────────────────────────────────────────────────────────────

const VF_GAME_FIELDS = ['presenceScore', 'affirmations', 'bossEncountered', 'keyDecisionsLinked', 'closing', 'notes']

app.post('/vf-game', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('vf-game', today)
  data.date = today

  const allowed = pick(req.body, VF_GAME_FIELDS)

  // Build session entry
  const session = {
    id: randomUUID(),
    timestamp: nowIso(),
    presenceScore: allowed.presenceScore ?? null,
    bossEncountered: allowed.bossEncountered ?? null,
    keyDecisionsLinked: allowed.keyDecisionsLinked || [],
    closing: allowed.closing || '',
    notes: allowed.notes || '',
    affirmations: []
  }

  // Process affirmations
  if (allowed.affirmations && Array.isArray(allowed.affirmations)) {
    const votesToAppend = []

    for (const aff of allowed.affirmations) {
      if (aff.index === undefined) continue

      session.affirmations.push({
        index: aff.index,
        convictionScore: aff.convictionScore ?? null,
        resistanceScore: aff.resistanceScore ?? null,
        exploration: aff.exploration || '',
        resistance: aff.resistance || ''
      })

      // Generate conviction votes
      if (aff.convictionScore !== undefined) {
        const affDef = AFFIRMATIONS_DATA.affirmations.find((a) => a.index === aff.index)

        if (aff.convictionScore >= 8) {
          votesToAppend.push({
            action: `High conviction: ${affDef?.text?.slice(0, 60) || 'affirmation ' + aff.index}`,
            category: 'mental-power',
            polarity: 'positive',
            source: 'vf-game',
            weight: 2
          })
        } else if (aff.convictionScore <= 3) {
          votesToAppend.push({
            action: `Low conviction: ${affDef?.text?.slice(0, 60) || 'affirmation ' + aff.index}`,
            category: 'mental-power',
            polarity: 'negative',
            source: 'vf-game',
            weight: 1
          })
        }
      }

      // Generate resistance votes
      if (aff.resistanceScore !== undefined && aff.resistanceScore >= 8) {
        const affDef = AFFIRMATIONS_DATA.affirmations.find((a) => a.index === aff.index)
        votesToAppend.push({
          action: `High resistance: ${affDef?.text?.slice(0, 60) || 'affirmation ' + aff.index}`,
          category: 'mental-power',
          polarity: 'negative',
          source: 'vf-game',
          weight: 1
        })
      }
    }

    // Append votes
    if (votesToAppend.length > 0) {
      let votesData = resetForNewDay('votes', today)
      votesData.date = today
      for (const v of votesToAppend) {
        votesData.votes.push({
          id: randomUUID(),
          timestamp: nowIso(),
          action: v.action,
          category: v.category,
          polarity: v.polarity,
          source: v.source,
          weight: v.weight
        })
      }
      writeJson('votes', votesData)
    }
  }

  // Append session (multiple per day)
  data.sessions.push(session)

  writeJson('vf-game', data)
  res.json({ ok: true, sessionId: session.id, sessionCount: data.sessions.length })
})

// ─── GET /vf-score ────────────────────────────────────────────────────────────

app.get('/vf-score', (req, res) => {
  const today = todayStr()
  const vfData = readJson('vf-game')
  const kdData = readJson('key-decisions')

  // No sessions today
  if (!vfData.sessions || vfData.sessions.length === 0) {
    return res.json({
      date: today,
      score: null,
      components: null,
      message: 'No VF sessions today'
    })
  }

  // Use the LATEST session for scoring
  const latest = vfData.sessions[vfData.sessions.length - 1]
  const affs = latest.affirmations || []

  // 1. Conviction average (0-10)
  const convScores = affs.filter(a => a.convictionScore !== null).map(a => a.convictionScore)
  const convAvg = convScores.length > 0 ? convScores.reduce((s, v) => s + v, 0) / convScores.length : 0

  // 2. Resistance average INVERTED (0-10, lower resistance = higher score)
  const resScores = affs.filter(a => a.resistanceScore !== null).map(a => a.resistanceScore)
  const resAvg = resScores.length > 0 ? resScores.reduce((s, v) => s + v, 0) / resScores.length : 0
  const resInverted = 10 - resAvg

  // 3. Key decisions contribution (capped at 10)
  const kdWeight = kdData.totalMultipliedWeight || 0
  const kdScore = Math.min(10, kdWeight / 3) // 30 total weight = max 10

  // 4. Boss encounters faced today
  let bossScore = 0
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'boss-encounters.jsonl'), 'utf8')
    const entries = raw.split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(e => e && e.timestamp && e.timestamp.startsWith(today) && e.faced)
    bossScore = Math.min(10, entries.length * 3.33) // 3 faced bosses = max 10
  } catch {}

  // 5. Presence score from latest session (0-10)
  const presence = latest.presenceScore ?? 0

  // Composed score: weighted average
  // Conviction 25%, Resistance(inv) 25%, Key Decisions 20%, Boss 15%, Presence 15%
  const composed = (
    convAvg * 0.25 +
    resInverted * 0.25 +
    kdScore * 0.20 +
    bossScore * 0.15 +
    presence * 0.15
  )

  const score = Math.round(composed * 10) / 10

  res.json({
    date: today,
    score,
    components: {
      conviction: { avg: Math.round(convAvg * 10) / 10, weight: '25%' },
      resistance: { avg: Math.round(resAvg * 10) / 10, inverted: Math.round(resInverted * 10) / 10, weight: '25%' },
      keyDecisions: { totalWeight: kdWeight, score: Math.round(kdScore * 10) / 10, weight: '20%' },
      bossEncounters: { score: Math.round(bossScore * 10) / 10, weight: '15%' },
      presence: { score: presence, weight: '15%' }
    },
    sessionCount: vfData.sessions.length,
    latestSession: latest.timestamp
  })
})

// ─── VF Chapters ──────────────────────────────────────────────────────────────

app.get('/vf-chapters', (req, res) => {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'vf-chapters.jsonl'), 'utf8')
    const chapters = raw.split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)

    const { limit } = req.query
    const result = limit ? chapters.slice(-parseInt(limit, 10)) : chapters

    res.json(result)
  } catch {
    res.json([])
  }
})

app.post('/vf-chapters', (req, res) => {
  const { title, narrative, vfScore, keyMoments, bossesNamed, affirmationShifts, mood } = req.body
  if (!narrative) return res.status(400).json({ error: 'narrative required' })

  // Count existing chapters
  let chapterNumber = 1
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'vf-chapters.jsonl'), 'utf8')
    chapterNumber = raw.split('\n').filter(Boolean).length + 1
  } catch {}

  const entry = {
    id: randomUUID(),
    chapter: chapterNumber,
    date: todayStr(),
    timestamp: nowIso(),
    title: title || `Chapter ${chapterNumber}`,
    narrative,
    vfScore: vfScore ?? null,
    keyMoments: keyMoments || [],
    bossesNamed: bossesNamed || [],
    affirmationShifts: affirmationShifts || [],
    mood: mood || null
  }

  fs.appendFileSync(path.join(DATA_DIR, 'vf-chapters.jsonl'), JSON.stringify(entry) + '\n', 'utf8')

  res.json({ ok: true, chapter: chapterNumber, id: entry.id })
})

// ─── POST /boss-encounters ────────────────────────────────────────────────────

app.post('/boss-encounters', (req, res) => {
  const { badgeSlug, type, title, content, faced, affirmationIndex } = req.body
  if (!type || !content) return res.status(400).json({ error: 'type and content required' })
  if (!['text', 'image', 'conversation'].includes(type)) return res.status(400).json({ error: 'type must be text, image, or conversation' })

  const today = todayStr()
  let xpGained = 0

  // If badgeSlug provided, still do XP (backwards compat)
  if (badgeSlug) {
    const badge = BADGES_DATA.badges.find((b) => b.slug === badgeSlug)
    if (badge) {
      const progress = readPersistent('badge-progress')
      updateStreak(progress, badgeSlug, today)
      xpGained = applyXp(progress, badgeSlug, BADGES_DATA.xpRules.bossEncounterXp)
      progress.badges[badgeSlug].bossEncounters += 1
      writePersistent('badge-progress', progress)
    }
  }

  // If boss was faced, log as a key decision with 5x multiplier
  if (faced) {
    let kdData = resetForNewDay('key-decisions', today)
    kdData.date = today
    const decision = {
      id: randomUUID(),
      timestamp: nowIso(),
      description: `Faced boss: ${title || content.slice(0, 60)}`,
      type: 'face-boss',
      multiplier: 5,
      affirmationIndex: affirmationIndex ?? null,
      notes: content
    }
    kdData.decisions.push(decision)
    kdData.totalMultipliedWeight += 5

    // Generate 5x vote
    let votesData = resetForNewDay('votes', today)
    votesData.date = today
    votesData.votes.push({
      id: randomUUID(),
      timestamp: nowIso(),
      action: decision.description,
      category: 'mental-power',
      polarity: 'positive',
      source: 'key-decision',
      weight: 5
    })
    writeJson('votes', votesData)
    writeJson('key-decisions', kdData)
  }

  // Append to boss-encounters.jsonl
  const entry = {
    id: randomUUID(),
    timestamp: nowIso(),
    badgeSlug: badgeSlug || null,
    affirmationIndex: affirmationIndex ?? null,
    type,
    title: title || '',
    content,
    faced: faced || false,
    xpAwarded: xpGained,
    source: req.body.source || 'user'
  }
  fs.appendFileSync(path.join(DATA_DIR, 'boss-encounters.jsonl'), JSON.stringify(entry) + '\n', 'utf8')

  // Auto plot-point for active episode
  if (faced) {
    addAutoPlotPoint(`Boss faced: ${title || content.slice(0, 60)}`, 'boss-encounter')
  }

  res.json({ ok: true, faced: faced || false, xpAwarded: xpGained })
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

// ─── Nutrition Logging ────────────────────────────────────────────────────────

const MEAL_TIMES = new Set(['breakfast', 'lunch', 'dinner', 'snack'])

app.post('/nutrition', (req, res) => {
  const { meal, time, nutritionScore, notes } = req.body
  if (!meal) return res.status(400).json({ error: 'meal required' })

  const today = todayStr()
  let data = resetForNewDay('nutrition', today)
  data.date = today

  const entry = {
    id: randomUUID(),
    timestamp: nowIso(),
    meal,
    time: MEAL_TIMES.has(time) ? time : 'snack',
    nutritionScore: nutritionScore ?? null,
    notes: notes || ''
  }
  data.meals.push(entry)
  data.totalMeals = data.meals.length

  const scored = data.meals.filter(m => m.nutritionScore != null)
  data.averageScore = scored.length > 0
    ? Math.round((scored.reduce((s, m) => s + m.nutritionScore, 0) / scored.length) * 10) / 10
    : null

  writeJson('nutrition', data)

  // Generate vote if scored
  if (nutritionScore != null) {
    let votesData = resetForNewDay('votes', today)
    votesData.date = today
    votesData.votes.push({
      id: randomUUID(), timestamp: nowIso(),
      action: `Meal: ${meal}${nutritionScore >= 7 ? ' (clean)' : nutritionScore <= 3 ? ' (junk)' : ''}`,
      category: 'nutrition',
      polarity: nutritionScore >= 5 ? 'positive' : 'negative',
      source: 'nutrition-log',
      weight: 1
    })
    writeJson('votes', votesData)
  }

  res.json({ ok: true, entry, averageScore: data.averageScore, totalMeals: data.totalMeals })
})

// ─── Dopamine Tracking ────────────────────────────────────────────────────────

const DOPAMINE_OVERSTIM_TYPES = new Set(['sugar', 'alcohol', 'sr', 'social-media', 'gaming', 'streaming', 'caffeine'])
const FARMING_POINT_CURVE = [
  { min: 60, points: 15 }, { min: 30, points: 7 }, { min: 15, points: 3 }, { min: 5, points: 1 }
]

const calcDopamineNet = (data) => {
  let score = 5
  score += Math.floor(data.farming.totalPoints / 15)
  score -= data.overstimulation.totalEvents
  if (data.screenTime.totalMinutes !== null) {
    const threshold = 120
    if (data.screenTime.totalMinutes > threshold) {
      score -= Math.floor((data.screenTime.totalMinutes - threshold) / 60)
    } else {
      score += 1
    }
  }
  return Math.max(0, Math.min(10, score))
}

const calcFarmingPoints = (durationMinutes) => {
  for (const tier of FARMING_POINT_CURVE) {
    if (durationMinutes >= tier.min) return tier.points
  }
  return 0
}

app.post('/dopamine/farm-start', (req, res) => {
  const today = todayStr()
  let data = resetForNewDay('dopamine', today)
  data.date = today

  const session = {
    id: randomUUID(),
    startedAt: nowIso(),
    endedAt: null,
    durationMinutes: 0,
    points: 0
  }
  data.farming.sessions.push(session)
  writeJson('dopamine', data)
  res.json({ ok: true, sessionId: session.id })
})

app.post('/dopamine/farm-end', (req, res) => {
  const { sessionId } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  const today = todayStr()
  let data = resetForNewDay('dopamine', today)
  data.date = today

  const session = data.farming.sessions.find(s => s.id === sessionId && !s.endedAt)
  if (!session) return res.status(400).json({ error: 'Active farming session not found' })

  session.endedAt = nowIso()
  const startMs = new Date(session.startedAt).getTime()
  const endMs = new Date(session.endedAt).getTime()
  session.durationMinutes = Math.round((endMs - startMs) / 60000)
  session.points = calcFarmingPoints(session.durationMinutes)

  data.farming.totalPoints = data.farming.sessions.reduce((s, sess) => s + sess.points, 0)
  data.farming.totalMinutes = data.farming.sessions.reduce((s, sess) => s + sess.durationMinutes, 0)
  data.netScore = calcDopamineNet(data)
  writeJson('dopamine', data)

  // Generate positive vote
  if (session.points > 0) {
    let votesData = resetForNewDay('votes', today)
    votesData.date = today
    votesData.votes.push({
      id: randomUUID(), timestamp: nowIso(),
      action: `Dopamine farming: ${session.durationMinutes}min unstimulated`,
      category: 'mental-power', polarity: 'positive',
      source: 'dopamine-farming', weight: Math.max(1, Math.round(session.points / 5))
    })
    writeJson('votes', votesData)
  }

  res.json({ ok: true, session, netScore: data.netScore })
})

app.post('/dopamine/overstimulation', (req, res) => {
  const { type, notes } = req.body
  if (!type) return res.status(400).json({ error: 'type required' })
  if (!DOPAMINE_OVERSTIM_TYPES.has(type)) return res.status(400).json({ error: `type must be one of: ${[...DOPAMINE_OVERSTIM_TYPES].join(', ')}` })

  const today = todayStr()
  let data = resetForNewDay('dopamine', today)
  data.date = today

  data.overstimulation.events.push({
    id: randomUUID(), timestamp: nowIso(), type, notes: notes || ''
  })
  data.overstimulation.totalEvents = data.overstimulation.events.length
  data.netScore = calcDopamineNet(data)
  writeJson('dopamine', data)

  // Generate negative vote
  let votesData = resetForNewDay('votes', today)
  votesData.date = today
  votesData.votes.push({
    id: randomUUID(), timestamp: nowIso(),
    action: `Overstimulation: ${type}${notes ? ' — ' + notes : ''}`,
    category: 'mental-power', polarity: 'negative',
    source: 'dopamine-tracking', weight: 1
  })
  writeJson('votes', votesData)

  res.json({ ok: true, totalEvents: data.overstimulation.totalEvents, netScore: data.netScore })
})

app.post('/dopamine/screen-time', (req, res) => {
  const { totalMinutes, pickups, topApps } = req.body
  if (totalMinutes === undefined) return res.status(400).json({ error: 'totalMinutes required' })

  const today = todayStr()
  let data = resetForNewDay('dopamine', today)
  data.date = today

  data.screenTime.totalMinutes = totalMinutes
  data.screenTime.pickups = pickups ?? null
  data.screenTime.topApps = topApps || []
  data.screenTime.capturedAt = nowIso()
  data.netScore = calcDopamineNet(data)
  writeJson('dopamine', data)
  res.json({ ok: true, netScore: data.netScore })
})

// ─── Episode Framing ──────────────────────────────────────────────────────────

const getNextEpisodeNumber = () => {
  try {
    const historyDirs = fs.readdirSync(HISTORY_DIR)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
    let maxNum = 0
    for (const dir of historyDirs) {
      try {
        const ep = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, dir, 'episode.json'), 'utf8'))
        if (ep.number && ep.number > maxNum) maxNum = ep.number
      } catch {}
    }
    // Also check current
    const current = readJson('episode')
    if (current.number && current.number > maxNum) maxNum = current.number
    return maxNum + 1
  } catch {
    return 1
  }
}

app.post('/episode', (req, res) => {
  const { title, previouslyOn, todaysArc, rating, status } = req.body
  const today = todayStr()
  let data = resetForNewDay('episode', today)
  data.date = today

  // Auto-assign episode number on first creation
  if (!data.number) data.number = getNextEpisodeNumber()

  if (title !== undefined) data.title = title
  if (previouslyOn !== undefined) data.previouslyOn = previouslyOn
  if (todaysArc !== undefined) data.todaysArc = todaysArc
  if (rating !== undefined) data.rating = rating
  if (status !== undefined) data.status = status

  writeJson('episode', data)
  res.json({ ok: true, episode: data })
})

app.post('/episode/plot-point', (req, res) => {
  const { description, type } = req.body
  if (!description) return res.status(400).json({ error: 'description required' })

  const today = todayStr()
  let data = resetForNewDay('episode', today)
  data.date = today
  if (!data.number) data.number = getNextEpisodeNumber()

  data.plotPoints.push({
    id: randomUUID(),
    timestamp: nowIso(),
    description,
    type: type || 'moment'
  })

  writeJson('episode', data)
  res.json({ ok: true, plotPoints: data.plotPoints.length })
})

app.get('/episodes', (req, res) => {
  const { limit } = req.query
  const episodes = []

  // Get from history
  try {
    const dirs = fs.readdirSync(HISTORY_DIR)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
    for (const dir of dirs) {
      try {
        const ep = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, dir, 'episode.json'), 'utf8'))
        if (ep.number) episodes.push(ep)
      } catch {}
    }
  } catch {}

  // Add today's episode
  const current = readJson('episode')
  if (current.number) episodes.push(current)

  // Sort by number descending
  episodes.sort((a, b) => (b.number || 0) - (a.number || 0))

  const result = limit ? episodes.slice(0, parseInt(limit, 10)) : episodes
  res.json(result)
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
