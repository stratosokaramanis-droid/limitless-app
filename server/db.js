// server/db.js — SQLite database layer for Limitless App
// Single source of truth for all data access. Replaces JSON file I/O.

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Column naming helpers ──────────────────────────────────────────────────

const toSnake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

/** Convert a DB row (snake_case) to API response shape (camelCase) */
export const rowToApi = (row) => {
  if (!row) return null
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue // strip internal field
    out[toCamel(k)] = v
  }
  return out
}

/** Convert API body (camelCase) to DB columns (snake_case) */
export const apiToRow = (obj) => {
  if (!obj) return null
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[toSnake(k)] = v
  }
  return out
}

// ─── Default user ───────────────────────────────────────────────────────────

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'

// ─── Init ───────────────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw/data/shared')
const DB_PATH = path.join(DATA_DIR, 'limitless.db')

fs.mkdirSync(DATA_DIR, { recursive: true })

const database = new Database(DB_PATH)
database.pragma('journal_mode = WAL')
database.pragma('foreign_keys = ON')

// Run schema
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
database.exec(schemaSql)

// Seed default user
const seedUser = database.prepare(
  `INSERT OR IGNORE INTO users (id, name, created_at, is_default) VALUES (?, ?, ?, 1)`
)
seedUser.run(DEFAULT_USER_ID, 'stef', new Date().toISOString())

// ─── Prepared statements ────────────────────────────────────────────────────

// Sleep data
const sleepDataGet = database.prepare('SELECT * FROM sleep_data WHERE user_id = ? AND date = ?')
const sleepDataUpsert = database.prepare(`
  INSERT INTO sleep_data (user_id, date, created_at, source, hours_slept, quality, sleep_score, wake_up_mood, notes, raw_extracted)
  VALUES (@user_id, @date, @created_at, @source, @hours_slept, @quality, @sleep_score, @wake_up_mood, @notes, @raw_extracted)
  ON CONFLICT(user_id, date) DO UPDATE SET
    source=COALESCE(@source, source), hours_slept=COALESCE(@hours_slept, hours_slept),
    quality=COALESCE(@quality, quality), sleep_score=COALESCE(@sleep_score, sleep_score),
    wake_up_mood=COALESCE(@wake_up_mood, wake_up_mood), notes=COALESCE(@notes, notes),
    raw_extracted=COALESCE(@raw_extracted, raw_extracted)
`)

// Fitmind data
const fitmindDataGet = database.prepare('SELECT * FROM fitmind_data WHERE user_id = ? AND date = ?')
const fitmindDataUpsert = database.prepare(`
  INSERT INTO fitmind_data (user_id, date, created_at, source, workout_completed, duration, type, score, notes)
  VALUES (@user_id, @date, @created_at, @source, @workout_completed, @duration, @type, @score, @notes)
  ON CONFLICT(user_id, date) DO UPDATE SET
    source=COALESCE(@source, source), workout_completed=COALESCE(@workout_completed, workout_completed),
    duration=COALESCE(@duration, duration), type=COALESCE(@type, type),
    score=COALESCE(@score, score), notes=COALESCE(@notes, notes)
`)

// Morning state
const morningStateGet = database.prepare('SELECT * FROM morning_state WHERE user_id = ? AND date = ?')
const morningStateUpsert = database.prepare(`
  INSERT INTO morning_state (user_id, date, created_at, updated_at, energy_score, mental_clarity, emotional_state, insights, day_priority, resistance_noted, resistance_description, overall_morning_score, raw_notes)
  VALUES (@user_id, @date, @created_at, @updated_at, @energy_score, @mental_clarity, @emotional_state, @insights, @day_priority, @resistance_noted, @resistance_description, @overall_morning_score, @raw_notes)
  ON CONFLICT(user_id, date) DO UPDATE SET
    updated_at=@updated_at,
    energy_score=COALESCE(@energy_score, energy_score), mental_clarity=COALESCE(@mental_clarity, mental_clarity),
    emotional_state=COALESCE(@emotional_state, emotional_state), insights=COALESCE(@insights, insights),
    day_priority=COALESCE(@day_priority, day_priority), resistance_noted=COALESCE(@resistance_noted, resistance_noted),
    resistance_description=COALESCE(@resistance_description, resistance_description),
    overall_morning_score=COALESCE(@overall_morning_score, overall_morning_score), raw_notes=COALESCE(@raw_notes, raw_notes)
`)

// Creative state
const creativeStateGet = database.prepare('SELECT * FROM creative_state WHERE user_id = ? AND date = ?')
const creativeStateUpsert = database.prepare(`
  INSERT INTO creative_state (user_id, date, created_at, updated_at, activities, energy_score, creative_output, insights, nutrition, nutrition_score, dopamine_quality, mood_shift, raw_notes)
  VALUES (@user_id, @date, @created_at, @updated_at, @activities, @energy_score, @creative_output, @insights, @nutrition, @nutrition_score, @dopamine_quality, @mood_shift, @raw_notes)
  ON CONFLICT(user_id, date) DO UPDATE SET
    updated_at=@updated_at,
    activities=COALESCE(@activities, activities), energy_score=COALESCE(@energy_score, energy_score),
    creative_output=COALESCE(@creative_output, creative_output), insights=COALESCE(@insights, insights),
    nutrition=COALESCE(@nutrition, nutrition), nutrition_score=COALESCE(@nutrition_score, nutrition_score),
    dopamine_quality=COALESCE(@dopamine_quality, dopamine_quality), mood_shift=COALESCE(@mood_shift, mood_shift),
    raw_notes=COALESCE(@raw_notes, raw_notes)
`)

// Creative block log
const creativeBlockLogGet = database.prepare('SELECT * FROM creative_block_log WHERE user_id = ? AND date = ?')
const creativeBlockLogUpsert = database.prepare(`
  INSERT INTO creative_block_log (user_id, date, started_at, completed_at, status)
  VALUES (@user_id, @date, @started_at, @completed_at, @status)
  ON CONFLICT(user_id, date) DO UPDATE SET
    started_at=COALESCE(@started_at, started_at), completed_at=COALESCE(@completed_at, completed_at),
    status=COALESCE(@status, status)
`)

// Morning block log
const morningBlockLogGet = database.prepare('SELECT * FROM morning_block_log WHERE user_id = ? AND date = ?')
const morningBlockLogUpsert = database.prepare(`
  INSERT INTO morning_block_log (user_id, date, started_at, completed_at)
  VALUES (@user_id, @date, @started_at, @completed_at)
  ON CONFLICT(user_id, date) DO UPDATE SET
    started_at=COALESCE(@started_at, started_at), completed_at=COALESCE(@completed_at, completed_at)
`)
const morningBlockItemsGet = database.prepare('SELECT * FROM morning_block_items WHERE user_id = ? AND date = ?')
const morningBlockItemUpsert = database.prepare(`
  INSERT INTO morning_block_items (id, user_id, date, status, timestamp)
  VALUES (@id, @user_id, @date, @status, @timestamp)
  ON CONFLICT(user_id, date, id) DO UPDATE SET status=@status, timestamp=@timestamp
`)

// Midday checkin
const middayCheckinGet = database.prepare('SELECT * FROM midday_checkin WHERE user_id = ? AND date = ?')
const middayCheckinUpsert = database.prepare(`
  INSERT INTO midday_checkin (user_id, date, triggered_at, energy_score, notes, raw_notes)
  VALUES (@user_id, @date, @triggered_at, @energy_score, @notes, @raw_notes)
  ON CONFLICT(user_id, date) DO UPDATE SET
    triggered_at=COALESCE(@triggered_at, triggered_at),
    energy_score=COALESCE(@energy_score, energy_score), notes=COALESCE(@notes, notes),
    raw_notes=COALESCE(@raw_notes, raw_notes)
`)

// Votes
const votesGetByDate = database.prepare('SELECT * FROM votes WHERE user_id = ? AND date = ?')
const voteInsert = database.prepare(`
  INSERT INTO votes (id, user_id, date, timestamp, action, category, polarity, source, weight)
  VALUES (@id, @user_id, @date, @timestamp, @action, @category, @polarity, @source, @weight)
`)

// Events
const eventsGetAll = database.prepare('SELECT * FROM events WHERE user_id = ? ORDER BY timestamp')
const eventInsert = database.prepare(`
  INSERT INTO events (user_id, timestamp, source, type, payload)
  VALUES (@user_id, @timestamp, @source, @type, @payload)
`)

// Work sessions
const workSessionsGetByDate = database.prepare('SELECT * FROM work_sessions WHERE user_id = ? AND date = ?')
const workSessionGet = database.prepare('SELECT * FROM work_sessions WHERE id = ? AND user_id = ?')
const workSessionInsert = database.prepare(`
  INSERT INTO work_sessions (id, user_id, date, started_at, ended_at, duration_minutes, focus, evaluation_criteria, outcomes, outcome_score, flow_score, composite_score, meal, nutrition_score, notes)
  VALUES (@id, @user_id, @date, @started_at, @ended_at, @duration_minutes, @focus, @evaluation_criteria, @outcomes, @outcome_score, @flow_score, @composite_score, @meal, @nutrition_score, @notes)
  ON CONFLICT(id) DO UPDATE SET
    started_at=COALESCE(@started_at, started_at), focus=COALESCE(@focus, focus),
    evaluation_criteria=COALESCE(@evaluation_criteria, evaluation_criteria)
`)
const workSessionEnd = database.prepare(`
  UPDATE work_sessions SET ended_at=@ended_at, outcomes=@outcomes, outcome_score=@outcome_score,
    flow_score=@flow_score, composite_score=@composite_score, meal=@meal,
    nutrition_score=@nutrition_score, notes=@notes
  WHERE id=@id AND user_id=@user_id
`)

// Night routine
const nightRoutineGet = database.prepare('SELECT * FROM night_routine WHERE user_id = ? AND date = ?')
const nightRoutineUpsert = database.prepare(`
  INSERT INTO night_routine (user_id, date, started_at, completed_at,
    letting_go_completed, letting_go_timestamp, nervous_system_completed, nervous_system_timestamp,
    body_scan_completed, body_scan_timestamp, alter_memories_completed, alter_memories_timestamp,
    day_review_completed, day_review_timestamp, plan_completed, plan_timestamp, plan_text,
    plan_finalized, plan_finalized_timestamp, prompts_reviewed, prompts_timestamp,
    vf_game_completed, visualization_completed, lights_out, lights_out_timestamp)
  VALUES (@user_id, @date, @started_at, @completed_at,
    @letting_go_completed, @letting_go_timestamp, @nervous_system_completed, @nervous_system_timestamp,
    @body_scan_completed, @body_scan_timestamp, @alter_memories_completed, @alter_memories_timestamp,
    @day_review_completed, @day_review_timestamp, @plan_completed, @plan_timestamp, @plan_text,
    @plan_finalized, @plan_finalized_timestamp, @prompts_reviewed, @prompts_timestamp,
    @vf_game_completed, @visualization_completed, @lights_out, @lights_out_timestamp)
  ON CONFLICT(user_id, date) DO UPDATE SET
    started_at=COALESCE(@started_at, started_at), completed_at=COALESCE(@completed_at, completed_at),
    letting_go_completed=COALESCE(@letting_go_completed, letting_go_completed),
    letting_go_timestamp=COALESCE(@letting_go_timestamp, letting_go_timestamp),
    nervous_system_completed=COALESCE(@nervous_system_completed, nervous_system_completed),
    nervous_system_timestamp=COALESCE(@nervous_system_timestamp, nervous_system_timestamp),
    body_scan_completed=COALESCE(@body_scan_completed, body_scan_completed),
    body_scan_timestamp=COALESCE(@body_scan_timestamp, body_scan_timestamp),
    alter_memories_completed=COALESCE(@alter_memories_completed, alter_memories_completed),
    alter_memories_timestamp=COALESCE(@alter_memories_timestamp, alter_memories_timestamp),
    day_review_completed=COALESCE(@day_review_completed, day_review_completed),
    day_review_timestamp=COALESCE(@day_review_timestamp, day_review_timestamp),
    plan_completed=COALESCE(@plan_completed, plan_completed),
    plan_timestamp=COALESCE(@plan_timestamp, plan_timestamp),
    plan_text=COALESCE(@plan_text, plan_text),
    plan_finalized=COALESCE(@plan_finalized, plan_finalized),
    plan_finalized_timestamp=COALESCE(@plan_finalized_timestamp, plan_finalized_timestamp),
    prompts_reviewed=COALESCE(@prompts_reviewed, prompts_reviewed),
    prompts_timestamp=COALESCE(@prompts_timestamp, prompts_timestamp),
    vf_game_completed=COALESCE(@vf_game_completed, vf_game_completed),
    visualization_completed=COALESCE(@visualization_completed, visualization_completed),
    lights_out=COALESCE(@lights_out, lights_out),
    lights_out_timestamp=COALESCE(@lights_out_timestamp, lights_out_timestamp)
`)

// Nutrition
const nutritionGetByDate = database.prepare('SELECT * FROM nutrition WHERE user_id = ? AND date = ?')
const nutritionInsert = database.prepare(`
  INSERT INTO nutrition (id, user_id, date, timestamp, meal, time, nutrition_score, notes)
  VALUES (@id, @user_id, @date, @timestamp, @meal, @time, @nutrition_score, @notes)
`)

// Dopamine
const dopamineDailyGet = database.prepare('SELECT * FROM dopamine_daily WHERE user_id = ? AND date = ?')
const dopamineDailyUpsert = database.prepare(`
  INSERT INTO dopamine_daily (user_id, date, screen_minutes, screen_pickups, screen_top_apps, screen_captured_at, net_score)
  VALUES (@user_id, @date, @screen_minutes, @screen_pickups, @screen_top_apps, @screen_captured_at, @net_score)
  ON CONFLICT(user_id, date) DO UPDATE SET
    screen_minutes=COALESCE(@screen_minutes, screen_minutes),
    screen_pickups=COALESCE(@screen_pickups, screen_pickups),
    screen_top_apps=COALESCE(@screen_top_apps, screen_top_apps),
    screen_captured_at=COALESCE(@screen_captured_at, screen_captured_at),
    net_score=@net_score
`)
const dopamineFarmingGetByDate = database.prepare('SELECT * FROM dopamine_farming WHERE user_id = ? AND date = ?')
const dopamineFarmingGet = database.prepare('SELECT * FROM dopamine_farming WHERE id = ? AND user_id = ?')
const dopamineFarmingInsert = database.prepare(`
  INSERT INTO dopamine_farming (id, user_id, date, started_at, ended_at, duration_minutes, points)
  VALUES (@id, @user_id, @date, @started_at, @ended_at, @duration_minutes, @points)
`)
const dopamineFarmingEnd = database.prepare(`
  UPDATE dopamine_farming SET ended_at=@ended_at, duration_minutes=@duration_minutes, points=@points
  WHERE id=@id AND user_id=@user_id
`)
const dopamineOverstimGetByDate = database.prepare('SELECT * FROM dopamine_overstimulation WHERE user_id = ? AND date = ?')
const dopamineOverstimInsert = database.prepare(`
  INSERT INTO dopamine_overstimulation (id, user_id, date, timestamp, type, notes)
  VALUES (@id, @user_id, @date, @timestamp, @type, @notes)
`)

// Episode
const episodeGet = database.prepare('SELECT * FROM episodes WHERE user_id = ? AND date = ?')
const episodeUpsert = database.prepare(`
  INSERT INTO episodes (user_id, date, number, title, previously_on, todays_arc, rating, status)
  VALUES (@user_id, @date, @number, @title, @previously_on, @todays_arc, @rating, @status)
  ON CONFLICT(user_id, date) DO UPDATE SET
    number=COALESCE(@number, number), title=COALESCE(@title, title),
    previously_on=COALESCE(@previously_on, previously_on), todays_arc=COALESCE(@todays_arc, todays_arc),
    rating=COALESCE(@rating, rating), status=COALESCE(@status, status)
`)
const plotPointsGetByDate = database.prepare('SELECT * FROM plot_points WHERE user_id = ? AND date = ?')
const plotPointInsert = database.prepare(`
  INSERT INTO plot_points (id, user_id, date, timestamp, description, type)
  VALUES (@id, @user_id, @date, @timestamp, @description, @type)
`)
const episodesGetAll = database.prepare('SELECT * FROM episodes WHERE user_id = ? AND number IS NOT NULL ORDER BY number DESC')
const episodeMaxNumber = database.prepare('SELECT MAX(number) as max_num FROM episodes WHERE user_id = ?')

// VF Game
const vfSessionsGetByDate = database.prepare('SELECT * FROM vf_sessions WHERE user_id = ? AND date = ?')
const vfSessionInsert = database.prepare(`
  INSERT INTO vf_sessions (id, user_id, date, timestamp, presence_score, boss_encountered, key_decisions_linked, closing, notes)
  VALUES (@id, @user_id, @date, @timestamp, @presence_score, @boss_encountered, @key_decisions_linked, @closing, @notes)
`)
const vfAffirmationInsert = database.prepare(`
  INSERT INTO vf_affirmations (user_id, session_id, affirmation_index, conviction_score, resistance_score, exploration, resistance)
  VALUES (@user_id, @session_id, @affirmation_index, @conviction_score, @resistance_score, @exploration, @resistance)
`)
const vfAffirmationsGetBySession = database.prepare('SELECT * FROM vf_affirmations WHERE session_id = ?')

// Key decisions
const keyDecisionsGetByDate = database.prepare('SELECT * FROM key_decisions WHERE user_id = ? AND date = ?')
const keyDecisionInsert = database.prepare(`
  INSERT INTO key_decisions (id, user_id, date, timestamp, description, type, multiplier, affirmation_index, notes)
  VALUES (@id, @user_id, @date, @timestamp, @description, @type, @multiplier, @affirmation_index, @notes)
`)

// Badge progress
const badgeProgressGet = database.prepare('SELECT * FROM badge_progress WHERE user_id = ? AND badge_slug = ?')
const badgeProgressGetAll = database.prepare('SELECT * FROM badge_progress WHERE user_id = ?')
const badgeProgressUpsert = database.prepare(`
  INSERT INTO badge_progress (user_id, badge_slug, tier, tier_name, xp, exercises_completed, missions_completed, missions_failed, boss_encounters, current_streak, longest_streak, last_activity_date, last_updated)
  VALUES (@user_id, @badge_slug, @tier, @tier_name, @xp, @exercises_completed, @missions_completed, @missions_failed, @boss_encounters, @current_streak, @longest_streak, @last_activity_date, @last_updated)
  ON CONFLICT(user_id, badge_slug) DO UPDATE SET
    tier=@tier, tier_name=@tier_name, xp=@xp,
    exercises_completed=@exercises_completed, missions_completed=@missions_completed,
    missions_failed=@missions_failed, boss_encounters=@boss_encounters,
    current_streak=@current_streak, longest_streak=@longest_streak,
    last_activity_date=@last_activity_date, last_updated=@last_updated
`)

// Badge exercises
const badgeExercisesGetByDate = database.prepare('SELECT * FROM badge_exercises WHERE user_id = ? AND date = ?')
const badgeExerciseInsert = database.prepare(`
  INSERT INTO badge_exercises (user_id, date, badge_slug, exercise_id, timestamp, xp_gained)
  VALUES (@user_id, @date, @badge_slug, @exercise_id, @timestamp, @xp_gained)
`)

// Badge mission attempts
const badgeMissionAttemptsGetByDate = database.prepare('SELECT * FROM badge_mission_attempts WHERE user_id = ? AND date = ?')
const badgeMissionAttemptInsert = database.prepare(`
  INSERT INTO badge_mission_attempts (user_id, date, mission_id, badge_slug, success, xp_gained, timestamp)
  VALUES (@user_id, @date, @mission_id, @badge_slug, @success, @xp_gained, @timestamp)
`)

// Badge missions active
const badgeMissionsActiveGetAll = database.prepare('SELECT * FROM badge_missions_active WHERE user_id = ?')
const badgeMissionActiveGet = database.prepare('SELECT * FROM badge_missions_active WHERE user_id = ? AND mission_id = ? AND status = ?')
const badgeMissionActiveInsert = database.prepare(`
  INSERT INTO badge_missions_active (user_id, mission_id, badge_slug, title, description, success_criteria, reward_xp, fail_xp, min_tier, assigned_at, status)
  VALUES (@user_id, @mission_id, @badge_slug, @title, @description, @success_criteria, @reward_xp, @fail_xp, @min_tier, @assigned_at, @status)
`)
const badgeMissionActiveDelete = database.prepare('DELETE FROM badge_missions_active WHERE user_id = ? AND mission_id = ?')
const badgeMissionsActiveExpire = database.prepare(`
  UPDATE badge_missions_active SET status = 'expired' WHERE user_id = ? AND status = 'pending'
`)
const badgeMissionsActiveGetPending = database.prepare(`SELECT * FROM badge_missions_active WHERE user_id = ? AND status = 'pending'`)
const badgeMissionsActiveDeleteAll = database.prepare('DELETE FROM badge_missions_active WHERE user_id = ? AND status != \'pending\'')

// Badge missions completed
const badgeMissionsCompletedGetAll = database.prepare('SELECT * FROM badge_missions_completed WHERE user_id = ? ORDER BY completed_at DESC')
const badgeMissionCompletedInsert = database.prepare(`
  INSERT INTO badge_missions_completed (user_id, mission_id, badge_slug, title, status, assigned_at, completed_at, xp_awarded, notes)
  VALUES (@user_id, @mission_id, @badge_slug, @title, @status, @assigned_at, @completed_at, @xp_awarded, @notes)
`)

// Boss encounters
const bossEncounterInsert = database.prepare(`
  INSERT INTO boss_encounters (id, user_id, timestamp, badge_slug, affirmation_index, type, title, content, faced, xp_awarded, source)
  VALUES (@id, @user_id, @timestamp, @badge_slug, @affirmation_index, @type, @title, @content, @faced, @xp_awarded, @source)
`)
const bossEncountersGetAll = database.prepare('SELECT * FROM boss_encounters WHERE user_id = ? ORDER BY timestamp')
const bossEncountersGetByBadge = database.prepare('SELECT * FROM boss_encounters WHERE user_id = ? AND badge_slug = ? ORDER BY timestamp')
const bossEncountersGetTodayFaced = database.prepare(`
  SELECT * FROM boss_encounters WHERE user_id = ? AND substr(timestamp, 1, 10) = ? AND faced = 1
`)

// VF Chapters
const vfChaptersGetAll = database.prepare('SELECT * FROM vf_chapters WHERE user_id = ? ORDER BY chapter')
const vfChapterInsert = database.prepare(`
  INSERT INTO vf_chapters (id, user_id, chapter, date, timestamp, title, narrative, vf_score, key_moments, bosses_named, affirmation_shifts, mood)
  VALUES (@id, @user_id, @chapter, @date, @timestamp, @title, @narrative, @vf_score, @key_moments, @bosses_named, @affirmation_shifts, @mood)
`)
const vfChapterMaxNumber = database.prepare('SELECT MAX(chapter) as max_ch FROM vf_chapters WHERE user_id = ?')

// Meta
const metaGet = database.prepare('SELECT value FROM meta WHERE user_id = ? AND key = ?')
const metaUpsert = database.prepare(`
  INSERT INTO meta (user_id, key, value) VALUES (?, ?, ?)
  ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
`)

// Users
const usersGetAll = database.prepare('SELECT * FROM users ORDER BY created_at')
const userGet = database.prepare('SELECT * FROM users WHERE id = ?')
const userInsert = database.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)')

// API calls
const apiCallInsert = database.prepare(`
  INSERT INTO api_calls (timestamp, user_id, method, path, source, request_keys, request_body, response_status, duration_ms, error, agent_reasoning)
  VALUES (@timestamp, @user_id, @method, @path, @source, @request_keys, @request_body, @response_status, @duration_ms, @error, @agent_reasoning)
`)
const apiCallsGet = database.prepare(`
  SELECT * FROM api_calls ORDER BY timestamp DESC LIMIT ?
`)
const apiCallsGetByUser = database.prepare(`
  SELECT * FROM api_calls WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?
`)

// History: get distinct dates that have data
const historyDates = database.prepare(`
  SELECT DISTINCT date FROM (
    SELECT date FROM sleep_data WHERE user_id = ?
    UNION SELECT date FROM morning_state WHERE user_id = ?
    UNION SELECT date FROM votes WHERE user_id = ?
    UNION SELECT date FROM work_sessions WHERE user_id = ?
    UNION SELECT date FROM episodes WHERE user_id = ?
  ) ORDER BY date DESC
`)

// ─── Transactions ───────────────────────────────────────────────────────────

const logKeyDecisionTx = database.transaction((userId, decision, vote, plotPoint) => {
  keyDecisionInsert.run(decision)
  voteInsert.run(vote)
  if (plotPoint) plotPointInsert.run(plotPoint)
})

const logVfSessionTx = database.transaction((userId, session, affirmations, votesToAdd) => {
  vfSessionInsert.run(session)
  for (const aff of affirmations) {
    vfAffirmationInsert.run(aff)
  }
  for (const v of votesToAdd) {
    voteInsert.run(v)
  }
})

const logBossEncounterTx = database.transaction((userId, encounter, keyDecision, vote, plotPoint, badgeUpdate) => {
  bossEncounterInsert.run(encounter)
  if (keyDecision) keyDecisionInsert.run(keyDecision)
  if (vote) voteInsert.run(vote)
  if (plotPoint) plotPointInsert.run(plotPoint)
  if (badgeUpdate) badgeProgressUpsert.run(badgeUpdate)
})

const logNutritionTx = database.transaction((entry, vote) => {
  nutritionInsert.run(entry)
  if (vote) voteInsert.run(vote)
})

const logDopamineFarmEndTx = database.transaction((farmUpdate, dailyUpdate, vote) => {
  dopamineFarmingEnd.run(farmUpdate)
  dopamineDailyUpsert.run(dailyUpdate)
  if (vote) voteInsert.run(vote)
})

const logDopamineOverstimTx = database.transaction((overstim, dailyUpdate, vote) => {
  dopamineOverstimInsert.run(overstim)
  dopamineDailyUpsert.run(dailyUpdate)
  voteInsert.run(vote)
})

const assignMissionsTx = database.transaction((userId, nowIso, expiredMissions, newMissions) => {
  // Move pending to expired
  const pending = badgeMissionsActiveGetPending.all(userId)
  for (const m of pending) {
    badgeMissionCompletedInsert.run({
      user_id: userId, mission_id: m.mission_id, badge_slug: m.badge_slug,
      title: m.title, status: 'expired', assigned_at: m.assigned_at,
      completed_at: nowIso, xp_awarded: 0, notes: null
    })
  }
  // Delete all non-pending (already processed)
  database.prepare('DELETE FROM badge_missions_active WHERE user_id = ?').run(userId)

  // Insert new missions
  for (const m of newMissions) {
    badgeMissionActiveInsert.run(m)
  }

  // Update meta
  metaUpsert.run(userId, 'missions_last_assigned', nowIso.slice(0, 10))
})

const completeMissionTx = database.transaction((userId, mission, progressUpdate, dailyAttempt) => {
  // Remove from active
  badgeMissionActiveDelete.run(userId, mission.mission_id)

  // Add to completed
  badgeMissionCompletedInsert.run({
    user_id: userId,
    mission_id: mission.mission_id,
    badge_slug: mission.badge_slug,
    title: mission.title,
    status: mission.status,
    assigned_at: mission.assigned_at,
    completed_at: mission.completed_at,
    xp_awarded: mission.xp_awarded,
    notes: mission.notes
  })

  // Update badge progress
  badgeProgressUpsert.run(progressUpdate)

  // Log daily attempt
  badgeMissionAttemptInsert.run(dailyAttempt)
})

const exerciseBadgeTx = database.transaction((progressUpdate, dailyExercise) => {
  badgeProgressUpsert.run(progressUpdate)
  badgeExerciseInsert.run(dailyExercise)
})

// ─── Export ─────────────────────────────────────────────────────────────────

const db = {
  raw: database,

  sleepData: { get: sleepDataGet, upsert: sleepDataUpsert },
  fitmindData: { get: fitmindDataGet, upsert: fitmindDataUpsert },
  morningState: { get: morningStateGet, upsert: morningStateUpsert },
  creativeState: { get: creativeStateGet, upsert: creativeStateUpsert },
  creativeBlockLog: { get: creativeBlockLogGet, upsert: creativeBlockLogUpsert },
  morningBlockLog: { get: morningBlockLogGet, upsert: morningBlockLogUpsert },
  morningBlockItems: { get: morningBlockItemsGet, upsert: morningBlockItemUpsert },
  middayCheckin: { get: middayCheckinGet, upsert: middayCheckinUpsert },

  votes: { getByDate: votesGetByDate, insert: voteInsert },
  events: { getAll: eventsGetAll, insert: eventInsert },

  workSessions: {
    getByDate: workSessionsGetByDate, get: workSessionGet,
    insert: workSessionInsert, end: workSessionEnd
  },

  nightRoutine: { get: nightRoutineGet, upsert: nightRoutineUpsert },

  nutrition: { getByDate: nutritionGetByDate, insert: nutritionInsert },

  dopamine: {
    daily: { get: dopamineDailyGet, upsert: dopamineDailyUpsert },
    farming: { getByDate: dopamineFarmingGetByDate, get: dopamineFarmingGet, insert: dopamineFarmingInsert, end: dopamineFarmingEnd },
    overstim: { getByDate: dopamineOverstimGetByDate, insert: dopamineOverstimInsert }
  },

  episodes: { get: episodeGet, upsert: episodeUpsert, getAll: episodesGetAll, maxNumber: episodeMaxNumber },
  plotPoints: { getByDate: plotPointsGetByDate, insert: plotPointInsert },

  vfSessions: { getByDate: vfSessionsGetByDate, insert: vfSessionInsert },
  vfAffirmations: { insert: vfAffirmationInsert, getBySession: vfAffirmationsGetBySession },
  vfChapters: { getAll: vfChaptersGetAll, insert: vfChapterInsert, maxNumber: vfChapterMaxNumber },

  keyDecisions: { getByDate: keyDecisionsGetByDate, insert: keyDecisionInsert },

  badgeProgress: { get: badgeProgressGet, getAll: badgeProgressGetAll, upsert: badgeProgressUpsert },
  badgeExercises: { getByDate: badgeExercisesGetByDate, insert: badgeExerciseInsert },
  badgeMissionAttempts: { getByDate: badgeMissionAttemptsGetByDate, insert: badgeMissionAttemptInsert },

  badgeMissionsActive: {
    getAll: badgeMissionsActiveGetAll, get: badgeMissionActiveGet,
    insert: badgeMissionActiveInsert, delete: badgeMissionActiveDelete
  },
  badgeMissionsCompleted: { getAll: badgeMissionsCompletedGetAll, insert: badgeMissionCompletedInsert },

  bossEncounters: {
    insert: bossEncounterInsert, getAll: bossEncountersGetAll,
    getByBadge: bossEncountersGetByBadge, getTodayFaced: bossEncountersGetTodayFaced
  },

  meta: { get: metaGet, upsert: metaUpsert },
  users: { getAll: usersGetAll, get: userGet, insert: userInsert },
  apiCalls: { insert: apiCallInsert, get: apiCallsGet, getByUser: apiCallsGetByUser },

  historyDates,

  transactions: {
    logKeyDecision: logKeyDecisionTx,
    logVfSession: logVfSessionTx,
    logBossEncounter: logBossEncounterTx,
    logNutrition: logNutritionTx,
    logDopamineFarmEnd: logDopamineFarmEndTx,
    logDopamineOverstim: logDopamineOverstimTx,
    assignMissions: assignMissionsTx,
    completeMission: completeMissionTx,
    exerciseBadge: exerciseBadgeTx
  }
}

export default db
