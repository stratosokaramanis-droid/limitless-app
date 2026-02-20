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
  console.log(`  Data:    ${DATA_DIR}`)
  console.log(`  History: ${HISTORY_DIR}`)
  console.log(`  Files:   ${DAILY_FILES.join(', ')}`)
})
