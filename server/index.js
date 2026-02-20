import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = 3001
const DATA_DIR = path.join(process.env.HOME, '.openclaw/data/shared')
const HISTORY_DIR = path.join(DATA_DIR, 'history')

app.use(cors())
app.use(express.json())

// ─── Stubs (returned when file is missing or corrupt) ────────────────────────

const STUBS = {
  'morning-block-log': {
    date: null, startedAt: null, completedAt: null,
    items: [], completedCount: 0, skippedCount: 0
  },
  'creative-block-log': {
    date: null, startedAt: null, completedAt: null, status: 'not_started'
  },
  'sleep-data': {
    date: null, source: null, hoursSlept: null, quality: null,
    sleepScore: null, wakeUpMood: null, notes: '', rawExtracted: {}
  },
  'fitmind-data': {
    date: null, source: null, workoutCompleted: null,
    duration: null, type: null, score: null, notes: ''
  },
  'morning-state': {
    date: null, energyScore: null, mentalClarity: null, emotionalState: null,
    insights: [], dayPriority: null, resistanceNoted: null,
    resistanceDescription: null, overallMorningScore: null, rawNotes: ''
  },
  'creative-state': {
    date: null, activities: [], energyScore: null, creativeOutput: null,
    insights: [], nutrition: { logged: false, meal: null, notes: '' },
    nutritionScore: null, dopamineQuality: null,
    moodShift: null, rawNotes: ''
  }
}

const DAILY_FILES = [
  'morning-block-log',
  'creative-block-log',
  'sleep-data',
  'fitmind-data',
  'morning-state',
  'creative-state'
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const filePath = (name) => path.join(DATA_DIR, `${name}.json`)

const readJson = (name) => {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf8')
    return JSON.parse(raw)
  } catch {
    return { ...STUBS[name] }
  }
}

const writeJson = (name, data) => {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8')
}

const todayStr = () => new Date().toISOString().slice(0, 10)

// ─── Historical snapshot ──────────────────────────────────────────────────────
// Before overwriting a file for a new day, archive yesterday's data

const archiveDay = (dateStr) => {
  try {
    const dayDir = path.join(HISTORY_DIR, dateStr)
    fs.mkdirSync(dayDir, { recursive: true })
    for (const name of DAILY_FILES) {
      const src = filePath(name)
      const dst = path.join(dayDir, `${name}.json`)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst)
      }
    }
    // Prune history older than 90 days
    pruneHistory(90)
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
      if (dir < cutoffStr) {
        fs.rmSync(path.join(HISTORY_DIR, dir), { recursive: true, force: true })
      }
    }
  } catch {
    // History dir may not exist yet
  }
}

// ─── GET endpoints ────────────────────────────────────────────────────────────

DAILY_FILES.forEach((name) => {
  app.get(`/${name}`, (req, res) => {
    res.json(readJson(name))
  })
})

app.get('/events', (req, res) => {
  try {
    const eventsPath = path.join(DATA_DIR, 'events.jsonl')
    const raw = fs.readFileSync(eventsPath, 'utf8')
    const events = raw
      .split('\n')
      .filter(Boolean)
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
      .sort()
      .reverse()
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
      const raw = fs.readFileSync(path.join(HISTORY_DIR, date, `${name}.json`), 'utf8')
      result[name] = JSON.parse(raw)
    } catch {
      result[name] = { ...STUBS[name] }
    }
  }
  res.json(result)
})

app.get('/history/:date/:file', (req, res) => {
  const { date, file } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date' })
  if (!DAILY_FILES.includes(file)) return res.status(400).json({ error: 'Unknown file' })

  try {
    const raw = fs.readFileSync(path.join(HISTORY_DIR, date, `${file}.json`), 'utf8')
    res.json(JSON.parse(raw))
  } catch {
    res.json({ ...STUBS[file] })
  }
})

// ─── POST /morning-block-log ──────────────────────────────────────────────────

app.post('/morning-block-log', (req, res) => {
  const { itemId, status, timestamp } = req.body
  if (!itemId || !status) return res.status(400).json({ error: 'itemId and status required' })

  const today = todayStr()
  let data = readJson('morning-block-log')

  // New day — archive yesterday, start fresh
  if (data.date && data.date !== today) {
    archiveDay(data.date)
    data = { ...STUBS['morning-block-log'], date: today, startedAt: new Date().toISOString() }
  } else if (!data.date) {
    data = { ...STUBS['morning-block-log'], date: today, startedAt: new Date().toISOString() }
  }

  // Update or insert item
  const idx = data.items.findIndex((i) => i.id === itemId)
  const item = { id: itemId, status, timestamp: timestamp || new Date().toISOString() }
  if (idx >= 0) {
    data.items[idx] = item
  } else {
    data.items.push(item)
  }

  // Recount
  data.completedCount = data.items.filter((i) => i.status === 'done').length
  data.skippedCount = data.items.filter((i) => i.status === 'skipped').length

  writeJson('morning-block-log', data)
  res.json({ ok: true })
})

// ─── POST /creative-block-log ─────────────────────────────────────────────────

app.post('/creative-block-log', (req, res) => {
  const today = todayStr()
  let data = readJson('creative-block-log')

  if (data.date && data.date !== today) {
    archiveDay(data.date)
    data = { ...STUBS['creative-block-log'], date: today }
  } else if (!data.date) {
    data = { ...STUBS['creative-block-log'], date: today }
  }

  Object.assign(data, req.body)
  writeJson('creative-block-log', data)
  res.json({ ok: true })
})

// ─── Start ────────────────────────────────────────────────────────────────────

fs.mkdirSync(HISTORY_DIR, { recursive: true })

app.listen(PORT, () => {
  console.log(`Limitless file server running on :${PORT}`)
  console.log(`Data dir:    ${DATA_DIR}`)
  console.log(`History dir: ${HISTORY_DIR}`)
})
