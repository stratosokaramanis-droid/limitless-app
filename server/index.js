import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = 3001
const DATA_DIR = path.join(process.env.HOME, '.openclaw/data/shared')

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
    moodShift: null, rawNotes: ''
  }
}

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

// ─── GET endpoints ────────────────────────────────────────────────────────────

const JSON_FILES = [
  'morning-block-log',
  'creative-block-log',
  'sleep-data',
  'fitmind-data',
  'morning-state',
  'creative-state'
]

JSON_FILES.forEach((name) => {
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
      .map((line) => {
        try { return JSON.parse(line) } catch { return null }
      })
      .filter(Boolean)
    res.json(events)
  } catch {
    res.json([])
  }
})

// ─── POST /morning-block-log ──────────────────────────────────────────────────

app.post('/morning-block-log', (req, res) => {
  const { itemId, status, timestamp } = req.body
  if (!itemId || !status) return res.status(400).json({ error: 'itemId and status required' })

  const today = todayStr()
  let data = readJson('morning-block-log')

  // Reset if it's a new day
  if (data.date !== today) {
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

  if (data.date !== today) {
    data = { ...STUBS['creative-block-log'], date: today }
  }

  Object.assign(data, req.body)
  if (!data.date) data.date = today

  writeJson('creative-block-log', data)
  res.json({ ok: true })
})

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Limitless file server running on :${PORT}`)
  console.log(`Data dir: ${DATA_DIR}`)
})
