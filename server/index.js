import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import db, { rowToApi, DEFAULT_USER_ID } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = 3001

// ─── Static reference data ────────────────────────────────────────────────────

const BADGES_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/badges.json'), 'utf8'))
const MISSIONS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/missions.json'), 'utf8'))
const AFFIRMATIONS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/affirmations.json'), 'utf8'))

app.use(cors())
app.use(express.json())

// ─── User resolution middleware ───────────────────────────────────────────────

app.use((req, res, next) => {
  const headerUserId = req.headers['x-user-id']
  if (headerUserId) {
    const user = db.users.get.get(headerUserId)
    if (user) {
      req.userId = headerUserId
    } else {
      req.userId = DEFAULT_USER_ID
    }
  } else {
    req.userId = DEFAULT_USER_ID
  }
  next()
})

// ─── API call logging middleware ──────────────────────────────────────────────

app.use((req, res, next) => {
  const start = Date.now()

  // Log POST requests to console
  if (req.method === 'POST') {
    const summary = req.body ? Object.keys(req.body).join(',') : '(empty)'
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} keys=[${summary}]`)
  }

  // Intercept res.json to capture status and log
  const origJson = res.json.bind(res)
  res.json = (body) => {
    const duration = Date.now() - start
    const status = res.statusCode || 200

    try {
      const source = (req.body && req.body.source) || req.headers['x-source'] || null
      const agentReasoning = req.headers['x-agent-reasoning'] || req.body?._reasoning || null
      const requestKeys = req.body ? Object.keys(req.body).filter(k => k !== '_reasoning').join(',') : null
      let requestBody = null
      if (req.method === 'POST' && req.body) {
        const { _reasoning, ...bodyWithoutReasoning } = req.body
        requestBody = JSON.stringify(bodyWithoutReasoning)
        if (requestBody.length > 4096) requestBody = requestBody.slice(0, 4096)
      }

      db.apiCalls.insert.run({
        timestamp: new Date().toISOString(),
        user_id: req.userId,
        method: req.method,
        path: req.path,
        source,
        request_keys: requestKeys,
        request_body: requestBody,
        response_status: status,
        duration_ms: duration,
        error: status >= 400 && body && body.error ? body.error : null,
        agent_reasoning: agentReasoning
      })
    } catch (err) {
      // Don't let logging errors break the response
      console.error('API call logging error:', err.message)
    }

    return origJson(body)
  }

  next()
})

// ─── Stubs (still used for fallback shapes) ──────────────────────────────────

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
    date: null, meals: [], averageScore: null, totalMeals: 0
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
  },
  'key-decisions': {
    date: null, decisions: [], totalMultipliedWeight: 0
  },
  'vf-game': {
    date: null, sessions: []
  },
  'badge-daily': {
    date: null, exercises: [], missionsAttempted: [], xpGained: {}
  }
}

const freshStub = (name) => structuredClone(STUBS[name])

// ─── Helpers ─────────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString()
const todayStr = () => new Date().toISOString().slice(0, 10)

const pick = (obj, keys) => {
  const result = {}
  for (const k of keys) {
    if (obj[k] !== undefined) result[k] = obj[k]
  }
  return result
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

// Parse JSON fields that are stored as strings in SQLite
const parseJsonField = (val, fallback) => {
  if (val == null) return fallback
  if (typeof val === 'object') return val // already parsed
  try { return JSON.parse(val) } catch { return fallback }
}

// ─── Night routine: DB row → nested API shape ───────────────────────────────

const nightRoutineRowToApi = (row) => {
  if (!row) return null
  return {
    date: row.date,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    windDown: {
      lettingGoCompleted: !!row.letting_go_completed,
      lettingGoTimestamp: row.letting_go_timestamp,
      nervousSystemCompleted: !!row.nervous_system_completed,
      nervousSystemTimestamp: row.nervous_system_timestamp,
      bodyScanCompleted: !!row.body_scan_completed,
      bodyScanTimestamp: row.body_scan_timestamp
    },
    reflection: {
      alterMemoriesCompleted: !!row.alter_memories_completed,
      alterMemoriesTimestamp: row.alter_memories_timestamp,
      dayReviewCompleted: !!row.day_review_completed,
      dayReviewTimestamp: row.day_review_timestamp
    },
    planning: {
      planCompleted: !!row.plan_completed,
      planTimestamp: row.plan_timestamp,
      planText: row.plan_text || '',
      planFinalized: !!row.plan_finalized,
      planFinalizedTimestamp: row.plan_finalized_timestamp
    },
    bed: {
      promptsReviewed: !!row.prompts_reviewed,
      promptsTimestamp: row.prompts_timestamp,
      vfGameCompleted: !!row.vf_game_completed,
      visualizationCompleted: !!row.visualization_completed,
      lightsOut: !!row.lights_out,
      lightsOutTimestamp: row.lights_out_timestamp
    }
  }
}

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    storage: 'sqlite',
    timestamp: nowIso()
  })
})

// ─── Simple daily GET endpoints ──────────────────────────────────────────────

app.get('/sleep-data', (req, res) => {
  const row = db.sleepData.get.get(req.userId, todayStr())
  if (!row) return res.json(freshStub('sleep-data'))
  const api = rowToApi(row)
  api.rawExtracted = parseJsonField(api.rawExtracted, {})
  res.json(api)
})

app.get('/fitmind-data', (req, res) => {
  const row = db.fitmindData.get.get(req.userId, todayStr())
  if (!row) return res.json(freshStub('fitmind-data'))
  const api = rowToApi(row)
  api.workoutCompleted = !!api.workoutCompleted
  res.json(api)
})

app.get('/morning-state', (req, res) => {
  const row = db.morningState.get.get(req.userId, todayStr())
  if (!row) return res.json(freshStub('morning-state'))
  const api = rowToApi(row)
  api.insights = parseJsonField(api.insights, [])
  api.resistanceNoted = api.resistanceNoted != null ? !!api.resistanceNoted : null
  res.json(api)
})

app.get('/creative-state', (req, res) => {
  const row = db.creativeState.get.get(req.userId, todayStr())
  if (!row) return res.json(freshStub('creative-state'))
  const api = rowToApi(row)
  api.activities = parseJsonField(api.activities, [])
  api.insights = parseJsonField(api.insights, [])
  api.nutrition = parseJsonField(api.nutrition, { logged: false, meal: null, notes: '' })
  res.json(api)
})

app.get('/creative-block-log', (req, res) => {
  const row = db.creativeBlockLog.get.get(req.userId, todayStr())
  if (!row) return res.json(freshStub('creative-block-log'))
  res.json(rowToApi(row))
})

app.get('/morning-block-log', (req, res) => {
  const today = todayStr()
  const log = db.morningBlockLog.get.get(req.userId, today)
  const items = db.morningBlockItems.get.all(req.userId, today)

  if (!log && items.length === 0) return res.json(freshStub('morning-block-log'))

  const apiItems = items.map(rowToApi)
  res.json({
    date: today,
    startedAt: log?.started_at || null,
    completedAt: log?.completed_at || null,
    items: apiItems,
    completedCount: apiItems.filter((i) => i.status === 'done').length,
    skippedCount: apiItems.filter((i) => i.status === 'skipped').length
  })
})

app.get('/midday-checkin', (req, res) => {
  const row = db.middayCheckin.get.get(req.userId, todayStr())
  if (!row) return res.json(freshStub('midday-checkin'))
  res.json(rowToApi(row))
})

app.get('/votes', (req, res) => {
  const today = todayStr()
  const rows = db.votes.getByDate.all(req.userId, today)
  res.json({ date: today, votes: rows.map(rowToApi) })
})

app.get('/work-sessions', (req, res) => {
  const today = todayStr()
  const rows = db.workSessions.getByDate.all(req.userId, today)
  const sessions = rows.map(rowToApi)
  res.json({
    date: today,
    sessions,
    totalSessions: 3,
    completedSessions: sessions.filter((s) => s.endedAt).length,
    lunchBreakLogged: false,
    lunchMeal: null,
    lunchNutritionScore: null
  })
})

app.get('/night-routine', (req, res) => {
  const row = db.nightRoutine.get.get(req.userId, todayStr())
  if (!row) return res.json(freshStub('night-routine'))
  res.json(nightRoutineRowToApi(row))
})

app.get('/nutrition', (req, res) => {
  const today = todayStr()
  const rows = db.nutrition.getByDate.all(req.userId, today)
  const meals = rows.map(rowToApi)
  const scored = meals.filter((m) => m.nutritionScore != null)
  const averageScore = scored.length > 0
    ? Math.round((scored.reduce((s, m) => s + m.nutritionScore, 0) / scored.length) * 10) / 10
    : null
  res.json({ date: today, meals, averageScore, totalMeals: meals.length })
})

app.get('/dopamine', (req, res) => {
  const today = todayStr()
  const daily = db.dopamine.daily.get.get(req.userId, today)
  const farming = db.dopamine.farming.getByDate.all(req.userId, today).map(rowToApi)
  const overstim = db.dopamine.overstim.getByDate.all(req.userId, today).map(rowToApi)

  res.json({
    date: today,
    farming: {
      sessions: farming,
      totalPoints: farming.reduce((s, f) => s + (f.points || 0), 0),
      totalMinutes: farming.reduce((s, f) => s + (f.durationMinutes || 0), 0)
    },
    overstimulation: { events: overstim, totalEvents: overstim.length },
    screenTime: {
      totalMinutes: daily?.screen_minutes ?? null,
      pickups: daily?.screen_pickups ?? null,
      topApps: parseJsonField(daily?.screen_top_apps, []),
      capturedAt: daily?.screen_captured_at ?? null
    },
    netScore: daily?.net_score ?? 5
  })
})

app.get('/episode', (req, res) => {
  const today = todayStr()
  const row = db.episodes.get.get(req.userId, today)
  if (!row) return res.json(freshStub('episode'))
  const plotPoints = db.plotPoints.getByDate.all(req.userId, today).map(rowToApi)
  const api = rowToApi(row)
  api.plotPoints = plotPoints
  res.json(api)
})

app.get('/key-decisions', (req, res) => {
  const today = todayStr()
  const rows = db.keyDecisions.getByDate.all(req.userId, today)
  const decisions = rows.map(rowToApi)
  const totalMultipliedWeight = decisions.reduce((s, d) => s + (d.multiplier || 0), 0)
  res.json({ date: today, decisions, totalMultipliedWeight })
})

app.get('/vf-game', (req, res) => {
  const today = todayStr()
  const sessions = db.vfSessions.getByDate.all(req.userId, today).map((s) => {
    const api = rowToApi(s)
    const affs = db.vfAffirmations.getBySession.all(s.id).map((a) => ({
      index: a.affirmation_index,
      convictionScore: a.conviction_score,
      resistanceScore: a.resistance_score,
      exploration: a.exploration || '',
      resistance: a.resistance || ''
    }))
    api.affirmations = affs
    api.keyDecisionsLinked = parseJsonField(api.keyDecisionsLinked, [])
    return api
  })
  res.json({ date: today, sessions })
})

app.get('/badge-daily', (req, res) => {
  const today = todayStr()
  const exercises = db.badgeExercises.getByDate.all(req.userId, today).map(rowToApi)
  const missionsAttempted = db.badgeMissionAttempts.getByDate.all(req.userId, today).map((r) => ({
    missionId: r.mission_id,
    badgeSlug: r.badge_slug,
    success: !!r.success,
    xpGained: r.xp_gained,
    timestamp: r.timestamp
  }))
  const xpGained = {}
  for (const ex of exercises) {
    xpGained[ex.badgeSlug] = (xpGained[ex.badgeSlug] || 0) + (ex.xpGained || 0)
  }
  for (const ma of missionsAttempted) {
    xpGained[ma.badgeSlug] = (xpGained[ma.badgeSlug] || 0) + (ma.xpGained || 0)
  }
  res.json({ date: today, exercises, missionsAttempted, xpGained })
})

app.get('/events', (req, res) => {
  const rows = db.events.getAll.all(req.userId)
  res.json(rows.map((r) => ({
    timestamp: r.timestamp,
    source: r.source,
    type: r.type,
    payload: parseJsonField(r.payload, {})
  })))
})

// ─── GET /history ────────────────────────────────────────────────────────────

app.get('/history', (req, res) => {
  const rows = db.historyDates.all(req.userId, req.userId, req.userId, req.userId, req.userId)
  res.json(rows.map((r) => r.date))
})

app.get('/history/:date', (req, res) => {
  const { date } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date' })
  const uid = req.userId

  // Reconstruct the full day snapshot from DB
  const sleepRow = db.sleepData.get.get(uid, date)
  const morningStateRow = db.morningState.get.get(uid, date)
  const creativeStateRow = db.creativeState.get.get(uid, date)
  const creativeBlockRow = db.creativeBlockLog.get.get(uid, date)
  const morningBlockRow = db.morningBlockLog.get.get(uid, date)
  const morningBlockItems = db.morningBlockItems.get.all(uid, date)
  const middayRow = db.middayCheckin.get.get(uid, date)
  const fitmindRow = db.fitmindData.get.get(uid, date)
  const workRows = db.workSessions.getByDate.all(uid, date)
  const voteRows = db.votes.getByDate.all(uid, date)
  const nightRow = db.nightRoutine.get.get(uid, date)
  const nutritionRows = db.nutrition.getByDate.all(uid, date)
  const episodeRow = db.episodes.get.get(uid, date)
  const plotPointRows = db.plotPoints.getByDate.all(uid, date)
  const kdRows = db.keyDecisions.getByDate.all(uid, date)
  const vfRows = db.vfSessions.getByDate.all(uid, date)

  // Sleep data
  const sleepApi = sleepRow ? rowToApi(sleepRow) : freshStub('sleep-data')
  if (sleepApi.rawExtracted) sleepApi.rawExtracted = parseJsonField(sleepApi.rawExtracted, {})

  // Morning state
  const morningStateApi = morningStateRow ? rowToApi(morningStateRow) : freshStub('morning-state')
  if (morningStateApi.insights) morningStateApi.insights = parseJsonField(morningStateApi.insights, [])

  // Creative state
  const creativeStateApi = creativeStateRow ? rowToApi(creativeStateRow) : freshStub('creative-state')
  if (creativeStateApi.activities) creativeStateApi.activities = parseJsonField(creativeStateApi.activities, [])
  if (creativeStateApi.insights) creativeStateApi.insights = parseJsonField(creativeStateApi.insights, [])
  if (creativeStateApi.nutrition) creativeStateApi.nutrition = parseJsonField(creativeStateApi.nutrition, { logged: false, meal: null, notes: '' })

  // Morning block log
  const morningBlockApi = morningBlockRow ? {
    date, startedAt: morningBlockRow.started_at, completedAt: morningBlockRow.completed_at,
    items: morningBlockItems.map(rowToApi),
    completedCount: morningBlockItems.filter((i) => i.status === 'done').length,
    skippedCount: morningBlockItems.filter((i) => i.status === 'skipped').length
  } : freshStub('morning-block-log')

  // Work sessions
  const sessions = workRows.map(rowToApi)

  // Episode
  const episodeApi = episodeRow ? rowToApi(episodeRow) : freshStub('episode')
  episodeApi.plotPoints = plotPointRows.map(rowToApi)

  // VF sessions
  const vfSessions = vfRows.map((s) => {
    const api = rowToApi(s)
    api.affirmations = db.vfAffirmations.getBySession.all(s.id).map((a) => ({
      index: a.affirmation_index, convictionScore: a.conviction_score,
      resistanceScore: a.resistance_score, exploration: a.exploration || '', resistance: a.resistance || ''
    }))
    api.keyDecisionsLinked = parseJsonField(api.keyDecisionsLinked, [])
    return api
  })

  // Nutrition
  const meals = nutritionRows.map(rowToApi)
  const scored = meals.filter((m) => m.nutritionScore != null)

  // Dopamine
  const daily = db.dopamine.daily.get.get(uid, date)
  const farming = db.dopamine.farming.getByDate.all(uid, date).map(rowToApi)
  const overstim = db.dopamine.overstim.getByDate.all(uid, date).map(rowToApi)

  // Key decisions
  const decisions = kdRows.map(rowToApi)

  // Badge daily
  const badgeExercises = db.badgeExercises.getByDate.all(uid, date).map(rowToApi)
  const badgeMissionAttempts = db.badgeMissionAttempts.getByDate.all(uid, date).map((r) => ({
    missionId: r.mission_id, badgeSlug: r.badge_slug,
    success: !!r.success, xpGained: r.xp_gained, timestamp: r.timestamp
  }))

  res.json({
    'sleep-data': sleepApi,
    'fitmind-data': fitmindRow ? (() => { const a = rowToApi(fitmindRow); a.workoutCompleted = !!a.workoutCompleted; return a })() : freshStub('fitmind-data'),
    'morning-state': morningStateApi,
    'creative-state': creativeStateApi,
    'creative-block-log': creativeBlockRow ? rowToApi(creativeBlockRow) : freshStub('creative-block-log'),
    'morning-block-log': morningBlockApi,
    'midday-checkin': middayRow ? rowToApi(middayRow) : freshStub('midday-checkin'),
    'work-sessions': {
      date, sessions, totalSessions: 3,
      completedSessions: sessions.filter((s) => s.endedAt).length,
      lunchBreakLogged: false, lunchMeal: null, lunchNutritionScore: null
    },
    'votes': { date, votes: voteRows.map(rowToApi) },
    'night-routine': nightRow ? nightRoutineRowToApi(nightRow) : freshStub('night-routine'),
    'nutrition': {
      date, meals, totalMeals: meals.length,
      averageScore: scored.length > 0
        ? Math.round((scored.reduce((s, m) => s + m.nutritionScore, 0) / scored.length) * 10) / 10
        : null
    },
    'dopamine': {
      date,
      farming: {
        sessions: farming,
        totalPoints: farming.reduce((s, f) => s + (f.points || 0), 0),
        totalMinutes: farming.reduce((s, f) => s + (f.durationMinutes || 0), 0)
      },
      overstimulation: { events: overstim, totalEvents: overstim.length },
      screenTime: {
        totalMinutes: daily?.screen_minutes ?? null, pickups: daily?.screen_pickups ?? null,
        topApps: parseJsonField(daily?.screen_top_apps, []), capturedAt: daily?.screen_captured_at ?? null
      },
      netScore: daily?.net_score ?? 5
    },
    'episode': episodeApi,
    'key-decisions': { date, decisions, totalMultipliedWeight: decisions.reduce((s, d) => s + (d.multiplier || 0), 0) },
    'vf-game': { date, sessions: vfSessions },
    'badge-daily': {
      date, exercises: badgeExercises, missionsAttempted: badgeMissionAttempts,
      xpGained: (() => {
        const xp = {}
        for (const ex of badgeExercises) xp[ex.badgeSlug] = (xp[ex.badgeSlug] || 0) + (ex.xpGained || 0)
        for (const ma of badgeMissionAttempts) xp[ma.badgeSlug] = (xp[ma.badgeSlug] || 0) + (ma.xpGained || 0)
        return xp
      })()
    }
  })
})

app.get('/history/:date/:file', (req, res) => {
  const { date, file } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date' })
  // Redirect to the full history endpoint and extract the file
  // For simplicity, just construct a mini response
  const uid = req.userId

  const handlers = {
    'sleep-data': () => {
      const row = db.sleepData.get.get(uid, date)
      if (!row) return freshStub('sleep-data')
      const api = rowToApi(row)
      api.rawExtracted = parseJsonField(api.rawExtracted, {})
      return api
    },
    'morning-state': () => {
      const row = db.morningState.get.get(uid, date)
      if (!row) return freshStub('morning-state')
      const api = rowToApi(row)
      api.insights = parseJsonField(api.insights, [])
      return api
    },
    'votes': () => {
      const rows = db.votes.getByDate.all(uid, date)
      return { date, votes: rows.map(rowToApi) }
    },
    'episode': () => {
      const row = db.episodes.get.get(uid, date)
      if (!row) return freshStub('episode')
      const api = rowToApi(row)
      api.plotPoints = db.plotPoints.getByDate.all(uid, date).map(rowToApi)
      return api
    }
  }

  if (handlers[file]) {
    return res.json(handlers[file]())
  }
  // Fallback: return stub
  if (STUBS[file]) return res.json(freshStub(file))
  return res.status(400).json({ error: 'Unknown file' })
})

// ─── POST /morning-block-log ─────────────────────────────────────────────────

app.post('/morning-block-log', (req, res) => {
  const { itemId, status, timestamp } = req.body
  if (!itemId || !status) return res.status(400).json({ error: 'itemId and status required' })
  const today = todayStr()
  const uid = req.userId

  // Ensure parent log exists
  db.morningBlockLog.upsert.run({
    user_id: uid, date: today,
    started_at: nowIso(), completed_at: null
  })

  // Upsert item
  db.morningBlockItems.upsert.run({
    id: itemId, user_id: uid, date: today,
    status, timestamp: timestamp || nowIso()
  })

  res.json({ ok: true })
})

// ─── POST /creative-block-log ────────────────────────────────────────────────

const CREATIVE_BLOCK_FIELDS = ['status', 'startedAt', 'completedAt']

app.post('/creative-block-log', (req, res) => {
  const today = todayStr()
  const allowed = pick(req.body, CREATIVE_BLOCK_FIELDS)

  db.creativeBlockLog.upsert.run({
    user_id: req.userId, date: today,
    started_at: allowed.startedAt || null,
    completed_at: allowed.completedAt || null,
    status: allowed.status || 'not_started'
  })
  res.json({ ok: true })
})

// ─── POST /sleep-data ────────────────────────────────────────────────────────

const SLEEP_DATA_FIELDS = ['source', 'hoursSlept', 'quality', 'sleepScore', 'wakeUpMood', 'notes', 'rawExtracted', 'createdAt']

app.post('/sleep-data', (req, res) => {
  const today = todayStr()
  const allowed = pick(req.body, SLEEP_DATA_FIELDS)

  db.sleepData.upsert.run({
    user_id: req.userId, date: today,
    created_at: allowed.createdAt || nowIso(),
    source: allowed.source || null,
    hours_slept: allowed.hoursSlept ?? null,
    quality: allowed.quality || null,
    sleep_score: allowed.sleepScore ?? null,
    wake_up_mood: allowed.wakeUpMood || null,
    notes: allowed.notes || null,
    raw_extracted: allowed.rawExtracted ? JSON.stringify(allowed.rawExtracted) : null
  })
  res.json({ ok: true })
})

// ─── POST /fitmind-data ──────────────────────────────────────────────────────

const FITMIND_DATA_FIELDS = ['source', 'workoutCompleted', 'duration', 'type', 'score', 'notes', 'createdAt']

app.post('/fitmind-data', (req, res) => {
  const today = todayStr()
  const allowed = pick(req.body, FITMIND_DATA_FIELDS)

  db.fitmindData.upsert.run({
    user_id: req.userId, date: today,
    created_at: allowed.createdAt || nowIso(),
    source: allowed.source || null,
    workout_completed: allowed.workoutCompleted != null ? (allowed.workoutCompleted ? 1 : 0) : null,
    duration: allowed.duration ?? null,
    type: allowed.type || null,
    score: allowed.score ?? null,
    notes: allowed.notes || null
  })
  res.json({ ok: true })
})

// ─── POST /morning-state ─────────────────────────────────────────────────────

const MORNING_STATE_FIELDS = ['energyScore', 'mentalClarity', 'emotionalState', 'insights',
  'dayPriority', 'resistanceNoted', 'resistanceDescription', 'overallMorningScore', 'rawNotes',
  'createdAt', 'updatedAt']

app.post('/morning-state', (req, res) => {
  const today = todayStr()
  const allowed = pick(req.body, MORNING_STATE_FIELDS)

  db.morningState.upsert.run({
    user_id: req.userId, date: today,
    created_at: allowed.createdAt || nowIso(),
    updated_at: nowIso(),
    energy_score: allowed.energyScore ?? null,
    mental_clarity: allowed.mentalClarity ?? null,
    emotional_state: allowed.emotionalState || null,
    insights: allowed.insights ? JSON.stringify(allowed.insights) : null,
    day_priority: allowed.dayPriority || null,
    resistance_noted: allowed.resistanceNoted != null ? (allowed.resistanceNoted ? 1 : 0) : null,
    resistance_description: allowed.resistanceDescription || null,
    overall_morning_score: allowed.overallMorningScore ?? null,
    raw_notes: allowed.rawNotes || null
  })
  res.json({ ok: true })
})

// ─── POST /creative-state ────────────────────────────────────────────────────

const CREATIVE_STATE_FIELDS = ['activities', 'energyScore', 'creativeOutput', 'insights',
  'nutrition', 'nutritionScore', 'dopamineQuality', 'moodShift', 'rawNotes',
  'createdAt', 'updatedAt']

app.post('/creative-state', (req, res) => {
  const today = todayStr()
  const allowed = pick(req.body, CREATIVE_STATE_FIELDS)

  db.creativeState.upsert.run({
    user_id: req.userId, date: today,
    created_at: allowed.createdAt || nowIso(),
    updated_at: nowIso(),
    activities: allowed.activities ? JSON.stringify(allowed.activities) : null,
    energy_score: allowed.energyScore ?? null,
    creative_output: allowed.creativeOutput || null,
    insights: allowed.insights ? JSON.stringify(allowed.insights) : null,
    nutrition: allowed.nutrition ? JSON.stringify(allowed.nutrition) : null,
    nutrition_score: allowed.nutritionScore ?? null,
    dopamine_quality: allowed.dopamineQuality || null,
    mood_shift: allowed.moodShift || null,
    raw_notes: allowed.rawNotes || null
  })
  res.json({ ok: true })
})

// ─── POST /work-sessions/start ───────────────────────────────────────────────

app.post('/work-sessions/start', (req, res) => {
  const { sessionId, focus, evaluationCriteria } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
  const today = todayStr()

  db.workSessions.insert.run({
    id: String(sessionId), user_id: req.userId, date: today,
    started_at: nowIso(), ended_at: null,
    duration_minutes: 90, focus: focus || '', evaluation_criteria: evaluationCriteria || '',
    outcomes: null, outcome_score: null, flow_score: null, composite_score: null,
    meal: null, nutrition_score: null, notes: ''
  })

  res.json({ ok: true })
})

// ─── POST /work-sessions/end ─────────────────────────────────────────────────

app.post('/work-sessions/end', (req, res) => {
  const { sessionId, outcomes, outcomeScore, flowScore, compositeScore, meal, nutritionScore, notes } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  const existing = db.workSessions.get.get(String(sessionId), req.userId)
  if (!existing) {
    // Create a session if it doesn't exist (backwards compat)
    db.workSessions.insert.run({
      id: String(sessionId), user_id: req.userId, date: todayStr(),
      started_at: null, ended_at: nowIso(),
      duration_minutes: 90, focus: '', evaluation_criteria: '',
      outcomes: outcomes || null, outcome_score: outcomeScore ?? null,
      flow_score: flowScore ?? null, composite_score: compositeScore ?? null,
      meal: meal || null, nutrition_score: nutritionScore ?? null, notes: notes || ''
    })
  } else {
    db.workSessions.end.run({
      id: String(sessionId), user_id: req.userId,
      ended_at: nowIso(),
      outcomes: outcomes !== undefined ? outcomes : existing.outcomes,
      outcome_score: outcomeScore !== undefined ? outcomeScore : existing.outcome_score,
      flow_score: flowScore !== undefined ? flowScore : existing.flow_score,
      composite_score: compositeScore !== undefined ? compositeScore : existing.composite_score,
      meal: meal !== undefined ? meal : existing.meal,
      nutrition_score: nutritionScore !== undefined ? nutritionScore : existing.nutrition_score,
      notes: notes !== undefined ? notes : existing.notes
    })
  }

  res.json({ ok: true })
})

// ─── POST /votes ─────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set(['nutrition', 'work', 'mental-power', 'personality', 'creativity', 'physical', 'relationships'])
const VALID_POLARITIES = new Set(['positive', 'negative'])

app.post('/votes', (req, res) => {
  const { votes: incoming } = req.body
  if (!Array.isArray(incoming)) return res.status(400).json({ error: 'votes array required' })

  const today = todayStr()
  let added = 0
  for (const v of incoming) {
    if (!VALID_CATEGORIES.has(v.category)) continue
    if (!VALID_POLARITIES.has(v.polarity)) continue
    if (!v.action) continue

    db.votes.insert.run({
      id: randomUUID(),
      user_id: req.userId,
      date: today,
      timestamp: v.timestamp || nowIso(),
      action: v.action,
      category: v.category,
      polarity: v.polarity,
      source: v.source || 'unknown',
      weight: v.weight || 1
    })
    added++
  }

  res.json({ ok: true, added })
})

// ─── POST /events ────────────────────────────────────────────────────────────

app.post('/events', (req, res) => {
  const { events } = req.body
  if (!Array.isArray(events)) return res.status(400).json({ error: 'events array required' })

  let added = 0
  for (const e of events) {
    if (!e || typeof e !== 'object') continue
    db.events.insert.run({
      user_id: req.userId,
      timestamp: e.timestamp || nowIso(),
      source: e.source || null,
      type: e.type || null,
      payload: JSON.stringify(e.payload || e)
    })
    added++
  }

  res.json({ ok: true, added })
})

// ─── POST /night-routine ─────────────────────────────────────────────────────

const NIGHT_ROUTINE_PHASES = {
  windDown: ['lettingGoCompleted', 'lettingGoTimestamp', 'nervousSystemCompleted', 'nervousSystemTimestamp', 'bodyScanCompleted', 'bodyScanTimestamp'],
  reflection: ['alterMemoriesCompleted', 'alterMemoriesTimestamp', 'dayReviewCompleted', 'dayReviewTimestamp'],
  planning: ['planCompleted', 'planTimestamp', 'planText', 'planFinalized', 'planFinalizedTimestamp'],
  bed: ['promptsReviewed', 'promptsTimestamp', 'vfGameCompleted', 'visualizationCompleted', 'lightsOut', 'lightsOutTimestamp']
}

app.post('/night-routine', (req, res) => {
  const today = todayStr()
  const uid = req.userId

  // Read existing to merge
  const existing = db.nightRoutine.get.get(uid, today)

  // Start from existing or defaults
  const current = existing ? {
    started_at: existing.started_at,
    completed_at: existing.completed_at,
    letting_go_completed: existing.letting_go_completed,
    letting_go_timestamp: existing.letting_go_timestamp,
    nervous_system_completed: existing.nervous_system_completed,
    nervous_system_timestamp: existing.nervous_system_timestamp,
    body_scan_completed: existing.body_scan_completed,
    body_scan_timestamp: existing.body_scan_timestamp,
    alter_memories_completed: existing.alter_memories_completed,
    alter_memories_timestamp: existing.alter_memories_timestamp,
    day_review_completed: existing.day_review_completed,
    day_review_timestamp: existing.day_review_timestamp,
    plan_completed: existing.plan_completed,
    plan_timestamp: existing.plan_timestamp,
    plan_text: existing.plan_text,
    plan_finalized: existing.plan_finalized,
    plan_finalized_timestamp: existing.plan_finalized_timestamp,
    prompts_reviewed: existing.prompts_reviewed,
    prompts_timestamp: existing.prompts_timestamp,
    vf_game_completed: existing.vf_game_completed,
    visualization_completed: existing.visualization_completed,
    lights_out: existing.lights_out,
    lights_out_timestamp: existing.lights_out_timestamp
  } : {
    started_at: null, completed_at: null,
    letting_go_completed: 0, letting_go_timestamp: null,
    nervous_system_completed: 0, nervous_system_timestamp: null,
    body_scan_completed: 0, body_scan_timestamp: null,
    alter_memories_completed: 0, alter_memories_timestamp: null,
    day_review_completed: 0, day_review_timestamp: null,
    plan_completed: 0, plan_timestamp: null, plan_text: null,
    plan_finalized: 0, plan_finalized_timestamp: null,
    prompts_reviewed: 0, prompts_timestamp: null,
    vf_game_completed: 0, visualization_completed: 0,
    lights_out: 0, lights_out_timestamp: null
  }

  if (!current.started_at) current.started_at = nowIso()

  // Map camelCase field names to snake_case DB columns
  const fieldMap = {
    lettingGoCompleted: 'letting_go_completed',
    lettingGoTimestamp: 'letting_go_timestamp',
    nervousSystemCompleted: 'nervous_system_completed',
    nervousSystemTimestamp: 'nervous_system_timestamp',
    bodyScanCompleted: 'body_scan_completed',
    bodyScanTimestamp: 'body_scan_timestamp',
    alterMemoriesCompleted: 'alter_memories_completed',
    alterMemoriesTimestamp: 'alter_memories_timestamp',
    dayReviewCompleted: 'day_review_completed',
    dayReviewTimestamp: 'day_review_timestamp',
    planCompleted: 'plan_completed',
    planTimestamp: 'plan_timestamp',
    planText: 'plan_text',
    planFinalized: 'plan_finalized',
    planFinalizedTimestamp: 'plan_finalized_timestamp',
    promptsReviewed: 'prompts_reviewed',
    promptsTimestamp: 'prompts_timestamp',
    vfGameCompleted: 'vf_game_completed',
    visualizationCompleted: 'visualization_completed',
    lightsOut: 'lights_out',
    lightsOutTimestamp: 'lights_out_timestamp'
  }

  const { phase, ...fields } = req.body

  const applyFields = (src) => {
    for (const [camelKey, val] of Object.entries(src)) {
      const snakeKey = fieldMap[camelKey]
      if (snakeKey && val !== undefined) {
        // Convert booleans to integers for SQLite
        current[snakeKey] = typeof val === 'boolean' ? (val ? 1 : 0) : val
      }
    }
  }

  if (phase && NIGHT_ROUTINE_PHASES[phase]) {
    const allowed = pick(fields, NIGHT_ROUTINE_PHASES[phase])
    applyFields(allowed)
  } else {
    for (const [, phaseFields] of Object.entries(NIGHT_ROUTINE_PHASES)) {
      const allowed = pick(req.body, phaseFields)
      applyFields(allowed)
    }
  }

  // Check completion
  if (current.letting_go_completed && current.nervous_system_completed &&
      current.plan_completed && current.lights_out) {
    if (!current.completed_at) current.completed_at = nowIso()
  }

  db.nightRoutine.upsert.run({
    user_id: uid, date: today, ...current
  })

  res.json({ ok: true })
})

// ─── POST /midday-checkin ────────────────────────────────────────────────────

const MIDDAY_CHECKIN_FIELDS = ['energyScore', 'notes', 'rawNotes']

app.post('/midday-checkin', (req, res) => {
  const today = todayStr()
  const allowed = pick(req.body, MIDDAY_CHECKIN_FIELDS)

  db.middayCheckin.upsert.run({
    user_id: req.userId, date: today,
    triggered_at: nowIso(),
    energy_score: allowed.energyScore ?? null,
    notes: allowed.notes || null,
    raw_notes: allowed.rawNotes || null
  })
  res.json({ ok: true })
})

// ─── GET /badges (static reference) ─────────────────────────────────────────

app.get('/badges', (req, res) => res.json(BADGES_DATA))
app.get('/badges/missions', (req, res) => res.json(MISSIONS_DATA))

// ─── GET /badge-progress (persistent) ────────────────────────────────────────

app.get('/badge-progress', (req, res) => {
  const rows = db.badgeProgress.getAll.all(req.userId)
  const badges = {}
  for (const row of rows) {
    badges[row.badge_slug] = {
      tier: row.tier, tierName: row.tier_name, xp: row.xp,
      exercisesCompleted: row.exercises_completed, missionsCompleted: row.missions_completed,
      missionsFailed: row.missions_failed, bossEncounters: row.boss_encounters,
      currentStreak: row.current_streak, longestStreak: row.longest_streak,
      lastActivityDate: row.last_activity_date
    }
  }
  // Ensure all badges exist
  for (const b of BADGES_DATA.badges) {
    if (!badges[b.slug]) {
      badges[b.slug] = {
        tier: 1, tierName: 'Initiate', xp: 0,
        exercisesCompleted: 0, missionsCompleted: 0, missionsFailed: 0,
        bossEncounters: 0, currentStreak: 0, longestStreak: 0, lastActivityDate: null
      }
    }
  }
  res.json({ lastUpdated: rows.length > 0 ? rows[0].last_updated : null, badges })
})

// ─── GET /badge-missions (persistent) ────────────────────────────────────────

app.get('/badge-missions', (req, res) => {
  const active = db.badgeMissionsActive.getAll.all(req.userId).map((m) => ({
    missionId: m.mission_id, badgeSlug: m.badge_slug,
    title: m.title, description: m.description, successCriteria: m.success_criteria,
    rewardXp: m.reward_xp, failXp: m.fail_xp, minTier: m.min_tier,
    assignedAt: m.assigned_at, status: m.status, completedAt: null, xpAwarded: 0
  }))
  const completed = db.badgeMissionsCompleted.getAll.all(req.userId).map((m) => ({
    missionId: m.mission_id, badgeSlug: m.badge_slug,
    title: m.title, status: m.status, assignedAt: m.assigned_at,
    completedAt: m.completed_at, xpAwarded: m.xp_awarded, notes: m.notes
  }))
  const meta = db.meta.get.get(req.userId, 'missions_last_assigned')
  res.json({ lastAssigned: meta?.value || null, active, completed })
})

// ─── POST /badge-progress/exercise ───────────────────────────────────────────

app.post('/badge-progress/exercise', (req, res) => {
  const { badgeSlug, exerciseId } = req.body
  if (!badgeSlug || !exerciseId) return res.status(400).json({ error: 'badgeSlug and exerciseId required' })

  const badge = BADGES_DATA.badges.find((b) => b.slug === badgeSlug)
  if (!badge) return res.status(400).json({ error: 'Unknown badge' })
  const exercise = badge.exercises.find((e) => e.id === exerciseId)
  if (!exercise) return res.status(400).json({ error: 'Unknown exercise' })

  const today = todayStr()
  const uid = req.userId

  // Get or init badge progress
  let progress = db.badgeProgress.get.get(uid, badgeSlug)
  if (!progress) {
    progress = {
      user_id: uid, badge_slug: badgeSlug,
      tier: 1, tier_name: 'Initiate', xp: 0,
      exercises_completed: 0, missions_completed: 0, missions_failed: 0,
      boss_encounters: 0, current_streak: 0, longest_streak: 0,
      last_activity_date: null, last_updated: null
    }
  }

  // Update streak
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (progress.last_activity_date !== today) {
    if (progress.last_activity_date === yesterdayStr) {
      progress.current_streak += 1
    } else {
      progress.current_streak = 1
    }
    if (progress.current_streak > progress.longest_streak) {
      progress.longest_streak = progress.current_streak
    }
    progress.last_activity_date = today
  }

  // Apply XP
  const mult = getStreakMultiplier(progress.current_streak)
  const xpGained = Math.round(exercise.xp * mult)
  progress.xp = Math.max(0, progress.xp + xpGained)
  const tier = getTierForXp(progress.xp)
  progress.tier = tier.level
  progress.tier_name = tier.name
  progress.exercises_completed += 1
  progress.last_updated = nowIso()

  db.transactions.exerciseBadge(
    { ...progress, user_id: uid, badge_slug: badgeSlug },
    {
      user_id: uid, date: today, badge_slug: badgeSlug,
      exercise_id: exerciseId, timestamp: nowIso(), xp_gained: xpGained
    }
  )

  res.json({
    ok: true, xpGained,
    totalXp: progress.xp,
    tier: progress.tier,
    tierName: progress.tier_name,
    streak: progress.current_streak
  })
})

// ─── POST /badge-missions/assign ─────────────────────────────────────────────

app.post('/badge-missions/assign', (req, res) => {
  const { badgeSlugs } = req.body
  const today = todayStr()
  const uid = req.userId

  // Don't re-assign if already assigned today
  const lastAssigned = db.meta.get.get(uid, 'missions_last_assigned')
  if (lastAssigned?.value === today) {
    const active = db.badgeMissionsActive.getAll.all(uid).map((m) => ({
      missionId: m.mission_id, badgeSlug: m.badge_slug,
      title: m.title, description: m.description, successCriteria: m.success_criteria,
      rewardXp: m.reward_xp, failXp: m.fail_xp, minTier: m.min_tier,
      assignedAt: m.assigned_at, status: m.status
    }))
    return res.json({ ok: true, message: 'Already assigned today', active })
  }

  const slugs = badgeSlugs || BADGES_DATA.badges.map((b) => b.slug)
  const newMissions = []

  for (const slug of slugs) {
    const badgeProgress = db.badgeProgress.get.get(uid, slug)
    const tier = badgeProgress?.tier || 1

    const eligible = MISSIONS_DATA.missions.filter((m) =>
      m.badgeSlug === slug && m.minTier <= tier
    )
    if (eligible.length === 0) continue

    const mission = eligible[Math.floor(Math.random() * eligible.length)]
    newMissions.push({
      user_id: uid, mission_id: mission.id, badge_slug: slug,
      title: mission.title, description: mission.description,
      success_criteria: mission.successCriteria, reward_xp: mission.rewardXp,
      fail_xp: mission.failXp, min_tier: mission.minTier,
      assigned_at: nowIso(), status: 'pending'
    })
  }

  db.transactions.assignMissions(uid, nowIso(), null, newMissions)

  const active = newMissions.map((m) => ({
    missionId: m.mission_id, badgeSlug: m.badge_slug,
    title: m.title, description: m.description, successCriteria: m.success_criteria,
    rewardXp: m.reward_xp, failXp: m.fail_xp, minTier: m.min_tier,
    assignedAt: m.assigned_at, status: m.status
  }))

  res.json({ ok: true, active })
})

// ─── POST /badge-missions/complete ───────────────────────────────────────────

app.post('/badge-missions/complete', (req, res) => {
  const { missionId, success, notes } = req.body
  if (!missionId || success === undefined) return res.status(400).json({ error: 'missionId and success required' })

  const today = todayStr()
  const uid = req.userId

  const mission = db.badgeMissionsActive.get.get(uid, missionId, 'pending')
  if (!mission) return res.status(400).json({ error: 'Mission not found or already completed' })

  // Get badge progress
  let progress = db.badgeProgress.get.get(uid, mission.badge_slug)
  if (!progress) {
    progress = {
      user_id: uid, badge_slug: mission.badge_slug,
      tier: 1, tier_name: 'Initiate', xp: 0,
      exercises_completed: 0, missions_completed: 0, missions_failed: 0,
      boss_encounters: 0, current_streak: 0, longest_streak: 0,
      last_activity_date: null, last_updated: null
    }
  }

  // Update streak
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (progress.last_activity_date !== today) {
    if (progress.last_activity_date === yesterdayStr) {
      progress.current_streak += 1
    } else {
      progress.current_streak = 1
    }
    if (progress.current_streak > progress.longest_streak) {
      progress.longest_streak = progress.current_streak
    }
    progress.last_activity_date = today
  }

  // Apply XP
  const rawXp = success ? mission.reward_xp : mission.fail_xp
  const mult = getStreakMultiplier(progress.current_streak)
  const xpGained = Math.round(rawXp * mult)
  progress.xp = Math.max(0, progress.xp + xpGained)
  const tier = getTierForXp(progress.xp)
  progress.tier = tier.level
  progress.tier_name = tier.name

  if (success) {
    progress.missions_completed += 1
  } else {
    progress.missions_failed += 1
  }
  progress.last_updated = nowIso()

  const completedMission = {
    mission_id: missionId,
    badge_slug: mission.badge_slug,
    title: mission.title,
    status: success ? 'completed' : 'failed',
    assigned_at: mission.assigned_at,
    completed_at: nowIso(),
    xp_awarded: xpGained,
    notes: notes || null
  }

  db.transactions.completeMission(
    uid,
    completedMission,
    { ...progress, user_id: uid, badge_slug: mission.badge_slug },
    {
      user_id: uid, date: today, mission_id: missionId,
      badge_slug: mission.badge_slug, success: success ? 1 : 0,
      xp_gained: xpGained, timestamp: nowIso()
    }
  )

  res.json({
    ok: true, success, xpGained,
    totalXp: progress.xp,
    tier: progress.tier,
    tierName: progress.tier_name
  })
})

// ─── GET /affirmations (static reference) ────────────────────────────────────

app.get('/affirmations', (req, res) => res.json(AFFIRMATIONS_DATA))

// ─── POST /key-decisions ─────────────────────────────────────────────────────

const KEY_DECISION_TYPES = new Set(['resist', 'persist', 'reframe', 'ground', 'face-boss', 'recenter'])

app.post('/key-decisions', (req, res) => {
  const { description, type, multiplier, affirmationIndex, notes } = req.body
  if (!description || !type) return res.status(400).json({ error: 'description and type required' })
  if (!KEY_DECISION_TYPES.has(type)) return res.status(400).json({ error: `type must be one of: ${[...KEY_DECISION_TYPES].join(', ')}` })

  const today = todayStr()
  const uid = req.userId
  const mult = multiplier || (type === 'face-boss' ? 5 : type === 'resist' ? 3 : 2)

  const decision = {
    id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
    description, type, multiplier: mult,
    affirmation_index: affirmationIndex ?? null, notes: notes || ''
  }

  const vote = {
    id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
    action: description, category: 'mental-power', polarity: 'positive',
    source: 'key-decision', weight: mult
  }

  // Auto plot-point for active episode
  const episode = db.episodes.get.get(uid, today)
  let plotPoint = null
  if (episode && episode.number) {
    plotPoint = {
      id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
      description, type: 'key-decision'
    }
  }

  db.transactions.logKeyDecision(uid, decision, vote, plotPoint)

  // Re-read for response
  const allDecisions = db.keyDecisions.getByDate.all(uid, today)
  const totalMultipliedWeight = allDecisions.reduce((s, d) => s + d.multiplier, 0)

  res.json({
    ok: true,
    decision: rowToApi(decision),
    totalDecisions: allDecisions.length,
    totalMultipliedWeight
  })
})

// ─── POST /vf-game ───────────────────────────────────────────────────────────

const VF_GAME_FIELDS = ['presenceScore', 'affirmations', 'bossEncountered', 'keyDecisionsLinked', 'closing', 'notes']

app.post('/vf-game', (req, res) => {
  const today = todayStr()
  const uid = req.userId
  const allowed = pick(req.body, VF_GAME_FIELDS)

  const sessionId = randomUUID()
  const session = {
    id: sessionId, user_id: uid, date: today, timestamp: nowIso(),
    presence_score: allowed.presenceScore ?? null,
    boss_encountered: allowed.bossEncountered ?? null,
    key_decisions_linked: allowed.keyDecisionsLinked ? JSON.stringify(allowed.keyDecisionsLinked) : null,
    closing: allowed.closing || '', notes: allowed.notes || ''
  }

  const affirmationsToInsert = []
  const votesToAdd = []

  if (allowed.affirmations && Array.isArray(allowed.affirmations)) {
    for (const aff of allowed.affirmations) {
      if (aff.index === undefined) continue

      affirmationsToInsert.push({
        user_id: uid, session_id: sessionId,
        affirmation_index: aff.index,
        conviction_score: aff.convictionScore ?? null,
        resistance_score: aff.resistanceScore ?? null,
        exploration: aff.exploration || '',
        resistance: aff.resistance || ''
      })

      if (aff.convictionScore !== undefined) {
        const affDef = AFFIRMATIONS_DATA.affirmations.find((a) => a.index === aff.index)
        if (aff.convictionScore >= 8) {
          votesToAdd.push({
            id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
            action: `High conviction: ${affDef?.text?.slice(0, 60) || 'affirmation ' + aff.index}`,
            category: 'mental-power', polarity: 'positive', source: 'vf-game', weight: 2
          })
        } else if (aff.convictionScore <= 3) {
          votesToAdd.push({
            id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
            action: `Low conviction: ${affDef?.text?.slice(0, 60) || 'affirmation ' + aff.index}`,
            category: 'mental-power', polarity: 'negative', source: 'vf-game', weight: 1
          })
        }
      }

      if (aff.resistanceScore !== undefined && aff.resistanceScore >= 8) {
        const affDef = AFFIRMATIONS_DATA.affirmations.find((a) => a.index === aff.index)
        votesToAdd.push({
          id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
          action: `High resistance: ${affDef?.text?.slice(0, 60) || 'affirmation ' + aff.index}`,
          category: 'mental-power', polarity: 'negative', source: 'vf-game', weight: 1
        })
      }
    }
  }

  db.transactions.logVfSession(uid, session, affirmationsToInsert, votesToAdd)

  const sessionCount = db.vfSessions.getByDate.all(uid, today).length
  res.json({ ok: true, sessionId, sessionCount })
})

// ─── GET /vf-score ───────────────────────────────────────────────────────────

app.get('/vf-score', (req, res) => {
  const today = todayStr()
  const uid = req.userId

  const sessions = db.vfSessions.getByDate.all(uid, today)
  if (sessions.length === 0) {
    return res.json({ date: today, score: null, components: null, message: 'No VF sessions today' })
  }

  const latest = sessions[sessions.length - 1]
  const affs = db.vfAffirmations.getBySession.all(latest.id)

  const convScores = affs.filter((a) => a.conviction_score !== null).map((a) => a.conviction_score)
  const convAvg = convScores.length > 0 ? convScores.reduce((s, v) => s + v, 0) / convScores.length : 0

  const resScores = affs.filter((a) => a.resistance_score !== null).map((a) => a.resistance_score)
  const resAvg = resScores.length > 0 ? resScores.reduce((s, v) => s + v, 0) / resScores.length : 0
  const resInverted = 10 - resAvg

  const kdRows = db.keyDecisions.getByDate.all(uid, today)
  const kdWeight = kdRows.reduce((s, d) => s + d.multiplier, 0)
  const kdScore = Math.min(10, kdWeight / 3)

  const bossToday = db.bossEncounters.getTodayFaced.all(uid, today)
  const bossScore = Math.min(10, bossToday.length * 3.33)

  const presence = latest.presence_score ?? 0

  const composed = convAvg * 0.25 + resInverted * 0.25 + kdScore * 0.20 + bossScore * 0.15 + presence * 0.15
  const score = Math.round(composed * 10) / 10

  res.json({
    date: today, score,
    components: {
      conviction: { avg: Math.round(convAvg * 10) / 10, weight: '25%' },
      resistance: { avg: Math.round(resAvg * 10) / 10, inverted: Math.round(resInverted * 10) / 10, weight: '25%' },
      keyDecisions: { totalWeight: kdWeight, score: Math.round(kdScore * 10) / 10, weight: '20%' },
      bossEncounters: { score: Math.round(bossScore * 10) / 10, weight: '15%' },
      presence: { score: presence, weight: '15%' }
    },
    sessionCount: sessions.length,
    latestSession: latest.timestamp
  })
})

// ─── VF Chapters ─────────────────────────────────────────────────────────────

app.get('/vf-chapters', (req, res) => {
  const chapters = db.vfChapters.getAll.all(req.userId).map((r) => ({
    id: r.id, chapter: r.chapter, date: r.date, timestamp: r.timestamp,
    title: r.title, narrative: r.narrative, vfScore: r.vf_score,
    keyMoments: parseJsonField(r.key_moments, []),
    bossesNamed: parseJsonField(r.bosses_named, []),
    affirmationShifts: parseJsonField(r.affirmation_shifts, []),
    mood: r.mood
  }))

  const { limit } = req.query
  const result = limit ? chapters.slice(-parseInt(limit, 10)) : chapters
  res.json(result)
})

app.post('/vf-chapters', (req, res) => {
  const { title, narrative, vfScore, keyMoments, bossesNamed, affirmationShifts, mood } = req.body
  if (!narrative) return res.status(400).json({ error: 'narrative required' })

  const maxRow = db.vfChapters.maxNumber.get(req.userId)
  const chapterNumber = (maxRow?.max_ch || 0) + 1

  const entry = {
    id: randomUUID(), user_id: req.userId, chapter: chapterNumber,
    date: todayStr(), timestamp: nowIso(),
    title: title || `Chapter ${chapterNumber}`,
    narrative, vf_score: vfScore ?? null,
    key_moments: keyMoments ? JSON.stringify(keyMoments) : null,
    bosses_named: bossesNamed ? JSON.stringify(bossesNamed) : null,
    affirmation_shifts: affirmationShifts ? JSON.stringify(affirmationShifts) : null,
    mood: mood || null
  }

  db.vfChapters.insert.run(entry)
  res.json({ ok: true, chapter: chapterNumber, id: entry.id })
})

// ─── POST /boss-encounters ───────────────────────────────────────────────────

app.post('/boss-encounters', (req, res) => {
  const { badgeSlug, type, title, content, faced, affirmationIndex } = req.body
  if (!type || !content) return res.status(400).json({ error: 'type and content required' })
  if (!['text', 'image', 'conversation'].includes(type)) return res.status(400).json({ error: 'type must be text, image, or conversation' })

  const today = todayStr()
  const uid = req.userId
  let xpGained = 0

  let badgeUpdate = null
  if (badgeSlug) {
    const badge = BADGES_DATA.badges.find((b) => b.slug === badgeSlug)
    if (badge) {
      let progress = db.badgeProgress.get.get(uid, badgeSlug)
      if (!progress) {
        progress = {
          user_id: uid, badge_slug: badgeSlug,
          tier: 1, tier_name: 'Initiate', xp: 0,
          exercises_completed: 0, missions_completed: 0, missions_failed: 0,
          boss_encounters: 0, current_streak: 0, longest_streak: 0,
          last_activity_date: null, last_updated: null
        }
      }

      // Update streak
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const ys = yesterday.toISOString().slice(0, 10)
      if (progress.last_activity_date !== today) {
        if (progress.last_activity_date === ys) progress.current_streak += 1
        else progress.current_streak = 1
        if (progress.current_streak > progress.longest_streak) progress.longest_streak = progress.current_streak
        progress.last_activity_date = today
      }

      const mult = getStreakMultiplier(progress.current_streak)
      xpGained = Math.round(BADGES_DATA.xpRules.bossEncounterXp * mult)
      progress.xp = Math.max(0, progress.xp + xpGained)
      const tier = getTierForXp(progress.xp)
      progress.tier = tier.level
      progress.tier_name = tier.name
      progress.boss_encounters += 1
      progress.last_updated = nowIso()

      badgeUpdate = { ...progress, user_id: uid, badge_slug: badgeSlug }
    }
  }

  const encounter = {
    id: randomUUID(), user_id: uid, timestamp: nowIso(),
    badge_slug: badgeSlug || null, affirmation_index: affirmationIndex ?? null,
    type, title: title || '', content, faced: faced ? 1 : 0,
    xp_awarded: xpGained, source: req.body.source || 'user'
  }

  let keyDecision = null
  let vote = null
  let plotPoint = null

  if (faced) {
    keyDecision = {
      id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
      description: `Faced boss: ${title || content.slice(0, 60)}`,
      type: 'face-boss', multiplier: 5,
      affirmation_index: affirmationIndex ?? null, notes: content
    }
    vote = {
      id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
      action: keyDecision.description,
      category: 'mental-power', polarity: 'positive',
      source: 'key-decision', weight: 5
    }
    const episode = db.episodes.get.get(uid, today)
    if (episode && episode.number) {
      plotPoint = {
        id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
        description: `Boss faced: ${title || content.slice(0, 60)}`,
        type: 'boss-encounter'
      }
    }
  }

  db.transactions.logBossEncounter(uid, encounter, keyDecision, vote, plotPoint, badgeUpdate)

  res.json({ ok: true, faced: faced || false, xpAwarded: xpGained })
})

// ─── GET /boss-encounters ────────────────────────────────────────────────────

app.get('/boss-encounters', (req, res) => {
  const { badge, limit } = req.query
  let rows
  if (badge) {
    rows = db.bossEncounters.getByBadge.all(req.userId, badge)
  } else {
    rows = db.bossEncounters.getAll.all(req.userId)
  }

  const entries = rows.map((r) => ({
    id: r.id, timestamp: r.timestamp, badgeSlug: r.badge_slug,
    affirmationIndex: r.affirmation_index, type: r.type,
    title: r.title, content: r.content, faced: !!r.faced,
    xpAwarded: r.xp_awarded, source: r.source
  }))

  const result = limit ? entries.slice(-parseInt(limit, 10)) : entries
  res.json(result)
})

// ─── Nutrition Logging ───────────────────────────────────────────────────────

const MEAL_TIMES = new Set(['breakfast', 'lunch', 'dinner', 'snack'])

app.post('/nutrition', (req, res) => {
  const { meal, time, nutritionScore, notes } = req.body
  if (!meal) return res.status(400).json({ error: 'meal required' })

  const today = todayStr()
  const uid = req.userId

  const entry = {
    id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
    meal, time: MEAL_TIMES.has(time) ? time : 'snack',
    nutrition_score: nutritionScore ?? null, notes: notes || ''
  }

  let vote = null
  if (nutritionScore != null) {
    vote = {
      id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
      action: `Meal: ${meal}${nutritionScore >= 7 ? ' (clean)' : nutritionScore <= 3 ? ' (junk)' : ''}`,
      category: 'nutrition', polarity: nutritionScore >= 5 ? 'positive' : 'negative',
      source: 'nutrition-log', weight: 1
    }
  }

  db.transactions.logNutrition(entry, vote)

  // Recompute averages
  const allMeals = db.nutrition.getByDate.all(uid, today)
  const scored = allMeals.filter((m) => m.nutrition_score != null)
  const averageScore = scored.length > 0
    ? Math.round((scored.reduce((s, m) => s + m.nutrition_score, 0) / scored.length) * 10) / 10
    : null

  res.json({ ok: true, entry: rowToApi(entry), averageScore, totalMeals: allMeals.length })
})

// ─── Dopamine Tracking ──────────────────────────────────────────────────────

const DOPAMINE_OVERSTIM_TYPES = new Set(['sugar', 'alcohol', 'sr', 'social-media', 'gaming', 'streaming', 'caffeine'])
const FARMING_POINT_CURVE = [
  { min: 60, points: 15 }, { min: 30, points: 7 }, { min: 15, points: 3 }, { min: 5, points: 1 }
]

const calcDopamineNet = (farming, overstimCount, screenMinutes) => {
  let score = 5
  const totalPoints = farming.reduce((s, f) => s + (f.points || 0), 0)
  score += Math.floor(totalPoints / 15)
  score -= overstimCount
  if (screenMinutes !== null && screenMinutes !== undefined) {
    const threshold = 120
    if (screenMinutes > threshold) {
      score -= Math.floor((screenMinutes - threshold) / 60)
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
  const sessionId = randomUUID()

  db.dopamine.farming.insert.run({
    id: sessionId, user_id: req.userId, date: today,
    started_at: nowIso(), ended_at: null,
    duration_minutes: 0, points: 0
  })

  res.json({ ok: true, sessionId })
})

app.post('/dopamine/farm-end', (req, res) => {
  const { sessionId } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  const today = todayStr()
  const uid = req.userId
  const session = db.dopamine.farming.get.get(sessionId, uid)
  if (!session || session.ended_at) return res.status(400).json({ error: 'Active farming session not found' })

  const endedAt = nowIso()
  const startMs = new Date(session.started_at).getTime()
  const endMs = new Date(endedAt).getTime()
  const durationMinutes = Math.round((endMs - startMs) / 60000)
  const points = calcFarmingPoints(durationMinutes)

  // Get all farming sessions for recalc
  const allFarming = db.dopamine.farming.getByDate.all(uid, today)
  // Simulate the updated session
  const updatedFarming = allFarming.map((f) => f.id === sessionId ? { ...f, points, duration_minutes: durationMinutes } : f)

  const overstimCount = db.dopamine.overstim.getByDate.all(uid, today).length
  const daily = db.dopamine.daily.get.get(uid, today)
  const screenMinutes = daily?.screen_minutes ?? null
  const netScore = calcDopamineNet(updatedFarming, overstimCount, screenMinutes)

  let vote = null
  if (points > 0) {
    vote = {
      id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
      action: `Dopamine farming: ${durationMinutes}min unstimulated`,
      category: 'mental-power', polarity: 'positive',
      source: 'dopamine-farming', weight: Math.max(1, Math.round(points / 5))
    }
  }

  db.transactions.logDopamineFarmEnd(
    { id: sessionId, user_id: uid, ended_at: endedAt, duration_minutes: durationMinutes, points },
    { user_id: uid, date: today, screen_minutes: screenMinutes, screen_pickups: daily?.screen_pickups ?? null, screen_top_apps: daily?.screen_top_apps ?? null, screen_captured_at: daily?.screen_captured_at ?? null, net_score: netScore },
    vote
  )

  res.json({
    ok: true,
    session: { id: sessionId, startedAt: session.started_at, endedAt, durationMinutes, points },
    netScore
  })
})

app.post('/dopamine/overstimulation', (req, res) => {
  const { type, notes } = req.body
  if (!type) return res.status(400).json({ error: 'type required' })
  if (!DOPAMINE_OVERSTIM_TYPES.has(type)) return res.status(400).json({ error: `type must be one of: ${[...DOPAMINE_OVERSTIM_TYPES].join(', ')}` })

  const today = todayStr()
  const uid = req.userId

  const overstim = {
    id: randomUUID(), user_id: uid, date: today,
    timestamp: nowIso(), type, notes: notes || ''
  }

  // Recalc net score
  const farming = db.dopamine.farming.getByDate.all(uid, today)
  const existingOverstimCount = db.dopamine.overstim.getByDate.all(uid, today).length + 1
  const daily = db.dopamine.daily.get.get(uid, today)
  const screenMinutes = daily?.screen_minutes ?? null
  const netScore = calcDopamineNet(farming, existingOverstimCount, screenMinutes)

  const vote = {
    id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
    action: `Overstimulation: ${type}${notes ? ' — ' + notes : ''}`,
    category: 'mental-power', polarity: 'negative',
    source: 'dopamine-tracking', weight: 1
  }

  db.transactions.logDopamineOverstim(
    overstim,
    { user_id: uid, date: today, screen_minutes: screenMinutes, screen_pickups: daily?.screen_pickups ?? null, screen_top_apps: daily?.screen_top_apps ?? null, screen_captured_at: daily?.screen_captured_at ?? null, net_score: netScore },
    vote
  )

  res.json({ ok: true, totalEvents: existingOverstimCount, netScore })
})

app.post('/dopamine/screen-time', (req, res) => {
  const { totalMinutes, pickups, topApps } = req.body
  if (totalMinutes === undefined) return res.status(400).json({ error: 'totalMinutes required' })

  const today = todayStr()
  const uid = req.userId

  // Recalc net score
  const farming = db.dopamine.farming.getByDate.all(uid, today)
  const overstimCount = db.dopamine.overstim.getByDate.all(uid, today).length
  const netScore = calcDopamineNet(farming, overstimCount, totalMinutes)

  db.dopamine.daily.upsert.run({
    user_id: uid, date: today,
    screen_minutes: totalMinutes,
    screen_pickups: pickups ?? null,
    screen_top_apps: topApps ? JSON.stringify(topApps) : null,
    screen_captured_at: nowIso(),
    net_score: netScore
  })

  res.json({ ok: true, netScore })
})

// ─── Episode Framing ─────────────────────────────────────────────────────────

app.post('/episode', (req, res) => {
  const { title, previouslyOn, todaysArc, rating, status } = req.body
  const today = todayStr()
  const uid = req.userId

  // Get existing or determine next number
  const existing = db.episodes.get.get(uid, today)
  let number = existing?.number
  if (!number) {
    const maxRow = db.episodes.maxNumber.get(uid)
    number = (maxRow?.max_num || 0) + 1
  }

  db.episodes.upsert.run({
    user_id: uid, date: today, number,
    title: title !== undefined ? title : (existing?.title || null),
    previously_on: previouslyOn !== undefined ? previouslyOn : (existing?.previously_on || null),
    todays_arc: todaysArc !== undefined ? todaysArc : (existing?.todays_arc || null),
    rating: rating !== undefined ? rating : (existing?.rating ?? null),
    status: status !== undefined ? status : (existing?.status || 'open')
  })

  // Read back for response
  const row = db.episodes.get.get(uid, today)
  const plotPoints = db.plotPoints.getByDate.all(uid, today).map(rowToApi)
  const api = rowToApi(row)
  api.plotPoints = plotPoints
  res.json({ ok: true, episode: api })
})

app.post('/episode/plot-point', (req, res) => {
  const { description, type } = req.body
  if (!description) return res.status(400).json({ error: 'description required' })

  const today = todayStr()
  const uid = req.userId

  // Ensure episode exists
  const existing = db.episodes.get.get(uid, today)
  if (!existing) {
    const maxRow = db.episodes.maxNumber.get(uid)
    const number = (maxRow?.max_num || 0) + 1
    db.episodes.upsert.run({
      user_id: uid, date: today, number,
      title: null, previously_on: null, todays_arc: null,
      rating: null, status: 'open'
    })
  }

  db.plotPoints.insert.run({
    id: randomUUID(), user_id: uid, date: today, timestamp: nowIso(),
    description, type: type || 'moment'
  })

  const plotPoints = db.plotPoints.getByDate.all(uid, today)
  res.json({ ok: true, plotPoints: plotPoints.length })
})

app.get('/episodes', (req, res) => {
  const { limit } = req.query
  const rows = db.episodes.getAll.all(req.userId)
  const episodes = rows.map((r) => {
    const api = rowToApi(r)
    api.plotPoints = db.plotPoints.getByDate.all(req.userId, r.date).map(rowToApi)
    return api
  })

  const result = limit ? episodes.slice(0, parseInt(limit, 10)) : episodes
  res.json(result)
})

// ─── New endpoints: Users + API Calls ────────────────────────────────────────

app.get('/users', (req, res) => {
  const rows = db.users.getAll.all()
  res.json(rows.map((r) => ({
    id: r.id, name: r.name, createdAt: r.created_at, isDefault: !!r.is_default
  })))
})

app.post('/users', (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const id = randomUUID()
  db.users.insert.run(id, name, nowIso())
  res.json({ ok: true, id, name })
})

app.get('/api-calls', (req, res) => {
  const { limit, user } = req.query
  const n = parseInt(limit, 10) || 100
  let rows
  if (user) {
    rows = db.apiCalls.getByUser.all(user, n)
  } else {
    rows = db.apiCalls.get.all(n)
  }
  res.json(rows.map(rowToApi))
})

// ─── Error handler ───────────────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error(`[${nowIso()}] UNCAUGHT EXCEPTION:`, err)
})

process.on('unhandledRejection', (err) => {
  console.error(`[${nowIso()}] UNHANDLED REJECTION:`, err)
})

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[${nowIso()}] Limitless file server :${PORT}`)
  console.log(`  Storage:    SQLite (WAL mode)`)
  console.log(`  Badges:     ${BADGES_DATA.badges.length} badges, ${MISSIONS_DATA.missions.length} missions`)
  console.log(`  Users:      default user ${DEFAULT_USER_ID}`)
})
