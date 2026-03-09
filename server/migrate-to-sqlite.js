#!/usr/bin/env node
// server/migrate-to-sqlite.js — One-time migration: JSON/JSONL files → SQLite
// Usage: node server/migrate-to-sqlite.js

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw/data/shared')
const HISTORY_DIR = path.join(DATA_DIR, 'history')
const DB_PATH = path.join(DATA_DIR, 'limitless.db')
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'

console.log(`Migration: ${DATA_DIR} → ${DB_PATH}`)

// ─── Init DB ────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
db.exec(schemaSql)

// Seed default user
db.prepare('INSERT OR IGNORE INTO users (id, name, created_at, is_default) VALUES (?, ?, ?, 1)')
  .run(DEFAULT_USER_ID, 'stef', new Date().toISOString())

// ─── Helpers ────────────────────────────────────────────────────────────────

const readJsonSafe = (filePath) => {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) }
  catch { return null }
}

let counts = {}
const count = (table) => { counts[table] = (counts[table] || 0) + 1 }

// ─── Migrate a single day's data ────────────────────────────────────────────

const migrateDay = (date, dir) => {
  const uid = DEFAULT_USER_ID

  // Sleep data
  const sleep = readJsonSafe(path.join(dir, 'sleep-data.json'))
  if (sleep && (sleep.date || date)) {
    const d = sleep.date || date
    try {
      db.prepare(`INSERT OR IGNORE INTO sleep_data (user_id, date, created_at, source, hours_slept, quality, sleep_score, wake_up_mood, notes, raw_extracted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uid, d, sleep.createdAt || null, sleep.source || null, sleep.hoursSlept ?? null,
        sleep.quality || null, sleep.sleepScore ?? null, sleep.wakeUpMood || null,
        sleep.notes || null, sleep.rawExtracted ? JSON.stringify(sleep.rawExtracted) : null
      )
      count('sleep_data')
    } catch {}
  }

  // Fitmind data
  const fitmind = readJsonSafe(path.join(dir, 'fitmind-data.json'))
  if (fitmind && (fitmind.date || date)) {
    const d = fitmind.date || date
    try {
      db.prepare(`INSERT OR IGNORE INTO fitmind_data (user_id, date, created_at, source, workout_completed, duration, type, score, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uid, d, fitmind.createdAt || null, fitmind.source || null,
        fitmind.workoutCompleted ? 1 : 0, fitmind.duration ?? null,
        fitmind.type || null, fitmind.score ?? null, fitmind.notes || null
      )
      count('fitmind_data')
    } catch {}
  }

  // Morning state
  const ms = readJsonSafe(path.join(dir, 'morning-state.json'))
  if (ms && (ms.date || date)) {
    const d = ms.date || date
    try {
      db.prepare(`INSERT OR IGNORE INTO morning_state (user_id, date, created_at, updated_at, energy_score, mental_clarity, emotional_state, insights, day_priority, resistance_noted, resistance_description, overall_morning_score, raw_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uid, d, ms.createdAt || null, ms.updatedAt || null,
        ms.energyScore ?? null, ms.mentalClarity ?? null, ms.emotionalState || null,
        ms.insights ? JSON.stringify(ms.insights) : null, ms.dayPriority || null,
        ms.resistanceNoted != null ? (ms.resistanceNoted ? 1 : 0) : null,
        ms.resistanceDescription || null, ms.overallMorningScore ?? null, ms.rawNotes || null
      )
      count('morning_state')
    } catch {}
  }

  // Creative state
  const cs = readJsonSafe(path.join(dir, 'creative-state.json'))
  if (cs && (cs.date || date)) {
    const d = cs.date || date
    try {
      db.prepare(`INSERT OR IGNORE INTO creative_state (user_id, date, created_at, updated_at, activities, energy_score, creative_output, insights, nutrition, nutrition_score, dopamine_quality, mood_shift, raw_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uid, d, cs.createdAt || null, cs.updatedAt || null,
        cs.activities ? JSON.stringify(cs.activities) : null, cs.energyScore ?? null,
        cs.creativeOutput || null, cs.insights ? JSON.stringify(cs.insights) : null,
        cs.nutrition ? JSON.stringify(cs.nutrition) : null, cs.nutritionScore ?? null,
        cs.dopamineQuality || null, cs.moodShift || null, cs.rawNotes || null
      )
      count('creative_state')
    } catch {}
  }

  // Creative block log
  const cbl = readJsonSafe(path.join(dir, 'creative-block-log.json'))
  if (cbl && (cbl.date || date)) {
    const d = cbl.date || date
    try {
      db.prepare(`INSERT OR IGNORE INTO creative_block_log (user_id, date, started_at, completed_at, status)
        VALUES (?, ?, ?, ?, ?)`).run(uid, d, cbl.startedAt || null, cbl.completedAt || null, cbl.status || 'not_started')
      count('creative_block_log')
    } catch {}
  }

  // Morning block log + items
  const mbl = readJsonSafe(path.join(dir, 'morning-block-log.json'))
  if (mbl && (mbl.date || date)) {
    const d = mbl.date || date
    try {
      db.prepare(`INSERT OR IGNORE INTO morning_block_log (user_id, date, started_at, completed_at)
        VALUES (?, ?, ?, ?)`).run(uid, d, mbl.startedAt || null, mbl.completedAt || null)
      count('morning_block_log')
    } catch {}
    if (mbl.items && Array.isArray(mbl.items)) {
      for (const item of mbl.items) {
        try {
          db.prepare(`INSERT OR IGNORE INTO morning_block_items (id, user_id, date, status, timestamp)
            VALUES (?, ?, ?, ?, ?)`).run(item.id, uid, d, item.status, item.timestamp || new Date().toISOString())
          count('morning_block_items')
        } catch {}
      }
    }
  }

  // Midday checkin
  const mc = readJsonSafe(path.join(dir, 'midday-checkin.json'))
  if (mc && (mc.date || date)) {
    const d = mc.date || date
    try {
      db.prepare(`INSERT OR IGNORE INTO midday_checkin (user_id, date, triggered_at, energy_score, notes, raw_notes)
        VALUES (?, ?, ?, ?, ?, ?)`).run(uid, d, mc.triggeredAt || null, mc.energyScore ?? null, mc.notes || null, mc.rawNotes || null)
      count('midday_checkin')
    } catch {}
  }

  // Work sessions
  const ws = readJsonSafe(path.join(dir, 'work-sessions.json'))
  if (ws && ws.sessions && Array.isArray(ws.sessions)) {
    const d = ws.date || date
    for (const s of ws.sessions) {
      try {
        db.prepare(`INSERT OR IGNORE INTO work_sessions (id, user_id, date, started_at, ended_at, duration_minutes, focus, evaluation_criteria, outcomes, outcome_score, flow_score, composite_score, meal, nutrition_score, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          String(s.id), uid, d, s.startedAt || null, s.endedAt || null,
          s.durationMinutes ?? 90, s.focus || null, s.evaluationCriteria || null,
          s.outcomes || null, s.outcomeScore ?? null, s.flowScore ?? null,
          s.compositeScore ?? null, s.meal || null, s.nutritionScore ?? null, s.notes || null
        )
        count('work_sessions')
      } catch {}
    }
  }

  // Votes
  const votes = readJsonSafe(path.join(dir, 'votes.json'))
  if (votes && votes.votes && Array.isArray(votes.votes)) {
    const d = votes.date || date
    for (const v of votes.votes) {
      try {
        db.prepare(`INSERT OR IGNORE INTO votes (id, user_id, date, timestamp, action, category, polarity, source, weight)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          v.id || randomUUID(), uid, d, v.timestamp || new Date().toISOString(),
          v.action || '', v.category || '', v.polarity || 'positive',
          v.source || null, v.weight ?? 1
        )
        count('votes')
      } catch {}
    }
  }

  // Night routine
  const nr = readJsonSafe(path.join(dir, 'night-routine.json'))
  if (nr && (nr.date || date)) {
    const d = nr.date || date
    // Handle both old flat and new nested format
    const wd = nr.windDown || {}
    const ref = nr.reflection || {}
    const plan = nr.planning || {}
    const bed = nr.bed || {}
    try {
      db.prepare(`INSERT OR IGNORE INTO night_routine (user_id, date, started_at, completed_at,
        letting_go_completed, letting_go_timestamp, nervous_system_completed, nervous_system_timestamp,
        body_scan_completed, body_scan_timestamp, alter_memories_completed, alter_memories_timestamp,
        day_review_completed, day_review_timestamp, plan_completed, plan_timestamp, plan_text,
        plan_finalized, plan_finalized_timestamp, prompts_reviewed, prompts_timestamp,
        vf_game_completed, visualization_completed, lights_out, lights_out_timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uid, d, nr.startedAt || null, nr.completedAt || null,
        (wd.lettingGoCompleted || nr.letGoCompleted) ? 1 : 0, wd.lettingGoTimestamp || nr.letGoTimestamp || null,
        (wd.nervousSystemCompleted || nr.nervousSystemCompleted) ? 1 : 0, wd.nervousSystemTimestamp || nr.nervousSystemTimestamp || null,
        wd.bodyScanCompleted ? 1 : 0, wd.bodyScanTimestamp || null,
        (ref.alterMemoriesCompleted || nr.alterMemoriesCompleted) ? 1 : 0, ref.alterMemoriesTimestamp || nr.alterMemoriesTimestamp || null,
        ref.dayReviewCompleted ? 1 : 0, ref.dayReviewTimestamp || null,
        (plan.planCompleted || nr.planCompleted) ? 1 : 0, plan.planTimestamp || nr.planTimestamp || null,
        plan.planText || nr.tomorrowPlan || null,
        plan.planFinalized ? 1 : 0, plan.planFinalizedTimestamp || null,
        (bed.promptsReviewed || nr.promptsReviewed) ? 1 : 0, bed.promptsTimestamp || nr.promptsTimestamp || null,
        bed.vfGameCompleted ? 1 : 0, bed.visualizationCompleted ? 1 : 0,
        bed.lightsOut ? 1 : 0, bed.lightsOutTimestamp || null
      )
      count('night_routine')
    } catch {}
  }

  // Nutrition
  const nut = readJsonSafe(path.join(dir, 'nutrition.json'))
  if (nut && nut.meals && Array.isArray(nut.meals)) {
    const d = nut.date || date
    for (const m of nut.meals) {
      try {
        db.prepare(`INSERT OR IGNORE INTO nutrition (id, user_id, date, timestamp, meal, time, nutrition_score, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
          m.id || randomUUID(), uid, d, m.timestamp || new Date().toISOString(),
          m.meal || '', m.time || null, m.nutritionScore ?? null, m.notes || null
        )
        count('nutrition')
      } catch {}
    }
  }

  // Dopamine
  const dop = readJsonSafe(path.join(dir, 'dopamine.json'))
  if (dop && (dop.date || date)) {
    const d = dop.date || date
    // Daily record
    try {
      db.prepare(`INSERT OR IGNORE INTO dopamine_daily (user_id, date, screen_minutes, screen_pickups, screen_top_apps, screen_captured_at, net_score)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        uid, d, dop.screenTime?.totalMinutes ?? null, dop.screenTime?.pickups ?? null,
        dop.screenTime?.topApps ? JSON.stringify(dop.screenTime.topApps) : null,
        dop.screenTime?.capturedAt || null, dop.netScore ?? 5
      )
      count('dopamine_daily')
    } catch {}

    // Farming sessions
    if (dop.farming?.sessions) {
      for (const s of dop.farming.sessions) {
        try {
          db.prepare(`INSERT OR IGNORE INTO dopamine_farming (id, user_id, date, started_at, ended_at, duration_minutes, points)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
            s.id || randomUUID(), uid, d, s.startedAt, s.endedAt || null,
            s.durationMinutes ?? 0, s.points ?? 0
          )
          count('dopamine_farming')
        } catch {}
      }
    }

    // Overstimulation events
    if (dop.overstimulation?.events) {
      for (const e of dop.overstimulation.events) {
        try {
          db.prepare(`INSERT OR IGNORE INTO dopamine_overstimulation (id, user_id, date, timestamp, type, notes)
            VALUES (?, ?, ?, ?, ?, ?)`).run(
            e.id || randomUUID(), uid, d, e.timestamp, e.type, e.notes || null
          )
          count('dopamine_overstimulation')
        } catch {}
      }
    }
  }

  // Episode + plot points
  const ep = readJsonSafe(path.join(dir, 'episode.json'))
  if (ep && (ep.date || date)) {
    const d = ep.date || date
    try {
      db.prepare(`INSERT OR IGNORE INTO episodes (user_id, date, number, title, previously_on, todays_arc, rating, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uid, d, ep.number ?? null, ep.title || null, ep.previouslyOn || null,
        ep.todaysArc || null, ep.rating ?? null, ep.status || 'open'
      )
      count('episodes')
    } catch {}
    if (ep.plotPoints && Array.isArray(ep.plotPoints)) {
      for (const pp of ep.plotPoints) {
        try {
          db.prepare(`INSERT OR IGNORE INTO plot_points (id, user_id, date, timestamp, description, type)
            VALUES (?, ?, ?, ?, ?, ?)`).run(
            pp.id || randomUUID(), uid, d, pp.timestamp || new Date().toISOString(),
            pp.description || '', pp.type || 'moment'
          )
          count('plot_points')
        } catch {}
      }
    }
  }

  // VF Game
  const vf = readJsonSafe(path.join(dir, 'vf-game.json'))
  if (vf && vf.sessions && Array.isArray(vf.sessions)) {
    const d = vf.date || date
    for (const s of vf.sessions) {
      try {
        db.prepare(`INSERT OR IGNORE INTO vf_sessions (id, user_id, date, timestamp, presence_score, boss_encountered, key_decisions_linked, closing, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          s.id || randomUUID(), uid, d, s.timestamp || new Date().toISOString(),
          s.presenceScore ?? null, s.bossEncountered || null,
          s.keyDecisionsLinked ? JSON.stringify(s.keyDecisionsLinked) : null,
          s.closing || null, s.notes || null
        )
        count('vf_sessions')

        // Affirmations
        if (s.affirmations && Array.isArray(s.affirmations)) {
          for (const aff of s.affirmations) {
            try {
              db.prepare(`INSERT INTO vf_affirmations (user_id, session_id, affirmation_index, conviction_score, resistance_score, exploration, resistance)
                VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
                uid, s.id, aff.index ?? aff.affirmationIndex ?? 0,
                aff.convictionScore ?? null, aff.resistanceScore ?? null,
                aff.exploration || null, aff.resistance || null
              )
              count('vf_affirmations')
            } catch {}
          }
        }
      } catch {}
    }
  }

  // Key decisions
  const kd = readJsonSafe(path.join(dir, 'key-decisions.json'))
  if (kd && kd.decisions && Array.isArray(kd.decisions)) {
    const d = kd.date || date
    for (const dec of kd.decisions) {
      try {
        db.prepare(`INSERT OR IGNORE INTO key_decisions (id, user_id, date, timestamp, description, type, multiplier, affirmation_index, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          dec.id || randomUUID(), uid, d, dec.timestamp || new Date().toISOString(),
          dec.description || '', dec.type || 'resist', dec.multiplier ?? 1,
          dec.affirmationIndex ?? null, dec.notes || null
        )
        count('key_decisions')
      } catch {}
    }
  }

  // Badge daily
  const bd = readJsonSafe(path.join(dir, 'badge-daily.json'))
  if (bd && (bd.date || date)) {
    const d = bd.date || date
    if (bd.exercises && Array.isArray(bd.exercises)) {
      for (const ex of bd.exercises) {
        try {
          db.prepare(`INSERT INTO badge_exercises (user_id, date, badge_slug, exercise_id, timestamp, xp_gained)
            VALUES (?, ?, ?, ?, ?, ?)`).run(uid, d, ex.badgeSlug, ex.exerciseId, ex.timestamp || new Date().toISOString(), ex.xpGained ?? 0)
          count('badge_exercises')
        } catch {}
      }
    }
    if (bd.missionsAttempted && Array.isArray(bd.missionsAttempted)) {
      for (const ma of bd.missionsAttempted) {
        try {
          db.prepare(`INSERT INTO badge_mission_attempts (user_id, date, mission_id, badge_slug, success, xp_gained, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(uid, d, ma.missionId, ma.badgeSlug, ma.success ? 1 : 0, ma.xpGained ?? 0, ma.timestamp || new Date().toISOString())
          count('badge_mission_attempts')
        } catch {}
      }
    }
  }
}

// ─── Migrate history directories ────────────────────────────────────────────

const migrateTx = db.transaction(() => {
  // History directories
  if (fs.existsSync(HISTORY_DIR)) {
    const historyDates = fs.readdirSync(HISTORY_DIR)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()

    console.log(`Found ${historyDates.length} history dates`)
    for (const date of historyDates) {
      migrateDay(date, path.join(HISTORY_DIR, date))
    }
  }

  // Current day files
  console.log('Migrating current-day files...')
  migrateDay(new Date().toISOString().slice(0, 10), DATA_DIR)

  // ─── JSONL files ──────────────────────────────────────────────────────────

  // events.jsonl
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'events.jsonl'), 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const e = JSON.parse(line)
        db.prepare('INSERT INTO events (user_id, timestamp, source, type, payload) VALUES (?, ?, ?, ?, ?)')
          .run(DEFAULT_USER_ID, e.timestamp || new Date().toISOString(), e.source || null, e.type || null, JSON.stringify(e.payload || e))
        count('events')
      } catch {}
    }
    console.log(`  events.jsonl: ${counts.events || 0} entries`)
  } catch { console.log('  events.jsonl: not found, skipping') }

  // boss-encounters.jsonl
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'boss-encounters.jsonl'), 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const e = JSON.parse(line)
        db.prepare(`INSERT OR IGNORE INTO boss_encounters (id, user_id, timestamp, badge_slug, affirmation_index, type, title, content, faced, xp_awarded, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          e.id || randomUUID(), DEFAULT_USER_ID, e.timestamp, e.badgeSlug || null,
          e.affirmationIndex ?? null, e.type || 'text', e.title || null,
          e.content || '', e.faced ? 1 : 0, e.xpAwarded ?? 0, e.source || null
        )
        count('boss_encounters')
      } catch {}
    }
    console.log(`  boss-encounters.jsonl: ${counts.boss_encounters || 0} entries`)
  } catch { console.log('  boss-encounters.jsonl: not found, skipping') }

  // vf-chapters.jsonl
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'vf-chapters.jsonl'), 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const e = JSON.parse(line)
        db.prepare(`INSERT OR IGNORE INTO vf_chapters (id, user_id, chapter, date, timestamp, title, narrative, vf_score, key_moments, bosses_named, affirmation_shifts, mood)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          e.id || randomUUID(), DEFAULT_USER_ID, e.chapter, e.date, e.timestamp,
          e.title || null, e.narrative, e.vfScore ?? null,
          e.keyMoments ? JSON.stringify(e.keyMoments) : null,
          e.bossesNamed ? JSON.stringify(e.bossesNamed) : null,
          e.affirmationShifts ? JSON.stringify(e.affirmationShifts) : null,
          e.mood || null
        )
        count('vf_chapters')
      } catch {}
    }
    console.log(`  vf-chapters.jsonl: ${counts.vf_chapters || 0} entries`)
  } catch { console.log('  vf-chapters.jsonl: not found, skipping') }

  // ─── Persistent files ───────────────────────────────────────────────────────

  // badge-progress.json
  const bp = readJsonSafe(path.join(DATA_DIR, 'badge-progress.json'))
  if (bp?.badges) {
    for (const [slug, b] of Object.entries(bp.badges)) {
      try {
        db.prepare(`INSERT OR IGNORE INTO badge_progress (user_id, badge_slug, tier, tier_name, xp, exercises_completed, missions_completed, missions_failed, boss_encounters, current_streak, longest_streak, last_activity_date, last_updated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          DEFAULT_USER_ID, slug, b.tier ?? 1, b.tierName || 'Initiate', b.xp ?? 0,
          b.exercisesCompleted ?? 0, b.missionsCompleted ?? 0, b.missionsFailed ?? 0,
          b.bossEncounters ?? 0, b.currentStreak ?? 0, b.longestStreak ?? 0,
          b.lastActivityDate || null, bp.lastUpdated || new Date().toISOString()
        )
        count('badge_progress')
      } catch {}
    }
    console.log(`  badge-progress.json: ${counts.badge_progress || 0} badges`)
  }

  // badge-missions.json
  const bm = readJsonSafe(path.join(DATA_DIR, 'badge-missions.json'))
  if (bm) {
    if (bm.active && Array.isArray(bm.active)) {
      for (const m of bm.active) {
        try {
          db.prepare(`INSERT OR IGNORE INTO badge_missions_active (user_id, mission_id, badge_slug, title, description, success_criteria, reward_xp, fail_xp, min_tier, assigned_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            DEFAULT_USER_ID, m.missionId, m.badgeSlug, m.title || null,
            m.description || null, m.successCriteria || null, m.rewardXp ?? null,
            m.failXp ?? null, m.minTier ?? null, m.assignedAt || null, m.status || 'pending'
          )
          count('badge_missions_active')
        } catch {}
      }
    }
    if (bm.completed && Array.isArray(bm.completed)) {
      for (const m of bm.completed) {
        try {
          db.prepare(`INSERT INTO badge_missions_completed (user_id, mission_id, badge_slug, title, status, assigned_at, completed_at, xp_awarded, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            DEFAULT_USER_ID, m.missionId, m.badgeSlug, m.title || null,
            m.status || 'completed', m.assignedAt || null, m.completedAt || null,
            m.xpAwarded ?? 0, m.notes || null
          )
          count('badge_missions_completed')
        } catch {}
      }
    }
    if (bm.lastAssigned) {
      db.prepare('INSERT OR IGNORE INTO meta (user_id, key, value) VALUES (?, ?, ?)')
        .run(DEFAULT_USER_ID, 'missions_last_assigned', bm.lastAssigned)
    }
    console.log(`  badge-missions.json: ${counts.badge_missions_active || 0} active, ${counts.badge_missions_completed || 0} completed`)
  }
})

// ─── Run ────────────────────────────────────────────────────────────────────

try {
  migrateTx()
  console.log('\nMigration complete. Row counts:')
  for (const [table, n] of Object.entries(counts).sort()) {
    console.log(`  ${table}: ${n}`)
  }
} catch (err) {
  console.error('Migration failed:', err)
  process.exit(1)
}

db.close()
console.log(`\nDB written to: ${DB_PATH}`)
