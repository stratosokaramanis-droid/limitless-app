# SQLite Migration Guide

Migrate from file-based JSON storage to SQLite using `better-sqlite3`.

## Why

- Cross-day analytics with real SQL queries
- ACID transactions (no corrupt writes)
- No more file scanning for history/trends
- `.jsonl` files become proper queryable tables
- `archiveDay()` / `pruneHistory()` disappear entirely — data just has a `date` column

## Install

```bash
npm install better-sqlite3
```

## Database Location

```
~/.openclaw/data/shared/limitless.db
```

Same directory as current JSON files. Both can coexist during migration.

---

## Schema

```sql
-- ─── Daily tables (one row per date) ────────────────────────────────────────

CREATE TABLE morning_block_log (
  date        TEXT PRIMARY KEY,  -- YYYY-MM-DD
  started_at  TEXT,
  completed_at TEXT
);

CREATE TABLE morning_block_items (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL REFERENCES morning_block_log(date),
  status      TEXT NOT NULL,  -- 'done' | 'skipped'
  timestamp   TEXT NOT NULL
);

CREATE TABLE creative_block_log (
  date         TEXT PRIMARY KEY,
  started_at   TEXT,
  completed_at TEXT,
  status       TEXT NOT NULL DEFAULT 'not_started'  -- 'not_started' | 'active' | 'completed'
);

CREATE TABLE sleep_data (
  date          TEXT PRIMARY KEY,
  created_at    TEXT,
  source        TEXT,       -- 'manual' | 'sleep-cycle'
  hours_slept   REAL,
  quality       TEXT,       -- 'good' | 'great' | 'decent' | 'poor'
  sleep_score   REAL,
  wake_up_mood  TEXT,
  notes         TEXT,
  raw_extracted TEXT        -- JSON blob for screenshot data
);

CREATE TABLE fitmind_data (
  date              TEXT PRIMARY KEY,
  created_at        TEXT,
  source            TEXT,
  workout_completed INTEGER,  -- 0/1
  duration          INTEGER,  -- minutes
  type              TEXT,
  score             REAL,
  notes             TEXT
);

CREATE TABLE morning_state (
  date                   TEXT PRIMARY KEY,
  created_at             TEXT,
  updated_at             TEXT,
  energy_score           REAL,
  mental_clarity         REAL,
  emotional_state        TEXT,
  insights               TEXT,  -- JSON array
  day_priority           TEXT,
  resistance_noted       INTEGER,
  resistance_description TEXT,
  overall_morning_score  REAL,
  raw_notes              TEXT
);

CREATE TABLE creative_state (
  date             TEXT PRIMARY KEY,
  created_at       TEXT,
  updated_at       TEXT,
  activities       TEXT,  -- JSON array
  energy_score     REAL,
  creative_output  TEXT,
  insights         TEXT,  -- JSON array
  nutrition        TEXT,  -- JSON object { logged, meal, notes }
  nutrition_score  REAL,
  dopamine_quality TEXT,
  mood_shift       TEXT,
  raw_notes        TEXT
);

CREATE TABLE work_sessions (
  id                  TEXT PRIMARY KEY,
  date                TEXT NOT NULL,
  started_at          TEXT,
  ended_at            TEXT,
  duration_minutes    INTEGER DEFAULT 90,
  focus               TEXT,
  evaluation_criteria TEXT,
  outcomes            TEXT,
  outcome_score       REAL,
  flow_score          REAL,
  composite_score     REAL,
  meal                TEXT,
  nutrition_score     REAL,
  notes               TEXT
);

CREATE INDEX idx_work_sessions_date ON work_sessions(date);

CREATE TABLE votes (
  id        TEXT PRIMARY KEY,
  date      TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  action    TEXT NOT NULL,
  category  TEXT NOT NULL,
  polarity  TEXT NOT NULL,  -- 'positive' | 'negative'
  source    TEXT,
  weight    INTEGER DEFAULT 1
);

CREATE INDEX idx_votes_date ON votes(date);
CREATE INDEX idx_votes_category ON votes(category);

CREATE TABLE night_routine (
  date       TEXT PRIMARY KEY,
  started_at TEXT,
  completed_at TEXT,
  -- wind down
  letting_go_completed       INTEGER DEFAULT 0,
  letting_go_timestamp       TEXT,
  nervous_system_completed   INTEGER DEFAULT 0,
  nervous_system_timestamp   TEXT,
  body_scan_completed        INTEGER DEFAULT 0,
  body_scan_timestamp        TEXT,
  -- reflection
  alter_memories_completed   INTEGER DEFAULT 0,
  alter_memories_timestamp   TEXT,
  day_review_completed       INTEGER DEFAULT 0,
  day_review_timestamp       TEXT,
  -- planning
  plan_completed             INTEGER DEFAULT 0,
  plan_timestamp             TEXT,
  plan_text                  TEXT,
  plan_finalized             INTEGER DEFAULT 0,
  plan_finalized_timestamp   TEXT,
  -- bed
  prompts_reviewed           INTEGER DEFAULT 0,
  prompts_timestamp          TEXT,
  vf_game_completed          INTEGER DEFAULT 0,
  visualization_completed    INTEGER DEFAULT 0,
  lights_out                 INTEGER DEFAULT 0,
  lights_out_timestamp       TEXT
);

CREATE TABLE midday_checkin (
  date         TEXT PRIMARY KEY,
  triggered_at TEXT,
  energy_score REAL,
  notes        TEXT,
  raw_notes    TEXT
);

CREATE TABLE nutrition (
  id              TEXT PRIMARY KEY,
  date            TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  meal            TEXT NOT NULL,
  time            TEXT,  -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
  nutrition_score REAL,
  notes           TEXT
);

CREATE INDEX idx_nutrition_date ON nutrition(date);

-- ─── Dopamine (one row per date + child tables) ────────────────────────────

CREATE TABLE dopamine_daily (
  date           TEXT PRIMARY KEY,
  screen_minutes REAL,
  screen_pickups INTEGER,
  screen_top_apps TEXT,    -- JSON array
  screen_captured_at TEXT,
  net_score      REAL DEFAULT 5
);

CREATE TABLE dopamine_farming (
  id               TEXT PRIMARY KEY,
  date             TEXT NOT NULL,
  started_at       TEXT NOT NULL,
  ended_at         TEXT,
  duration_minutes INTEGER DEFAULT 0,
  points           INTEGER DEFAULT 0
);

CREATE INDEX idx_dopamine_farming_date ON dopamine_farming(date);

CREATE TABLE dopamine_overstimulation (
  id        TEXT PRIMARY KEY,
  date      TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  type      TEXT NOT NULL,
  notes     TEXT
);

CREATE INDEX idx_dopamine_overstim_date ON dopamine_overstimulation(date);

-- ─── Episode ────────────────────────────────────────────────────────────────

CREATE TABLE episodes (
  date          TEXT PRIMARY KEY,
  number        INTEGER,
  title         TEXT,
  previously_on TEXT,
  todays_arc    TEXT,
  rating        REAL,
  status        TEXT DEFAULT 'open'  -- 'open' | 'closed'
);

CREATE TABLE plot_points (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL REFERENCES episodes(date),
  timestamp   TEXT NOT NULL,
  description TEXT NOT NULL,
  type        TEXT DEFAULT 'moment'
);

CREATE INDEX idx_plot_points_date ON plot_points(date);

-- ─── VF Game ────────────────────────────────────────────────────────────────

CREATE TABLE vf_sessions (
  id                   TEXT PRIMARY KEY,
  date                 TEXT NOT NULL,
  timestamp            TEXT NOT NULL,
  presence_score       REAL,
  boss_encountered     TEXT,
  key_decisions_linked TEXT,  -- JSON array
  closing              TEXT,
  notes                TEXT
);

CREATE INDEX idx_vf_sessions_date ON vf_sessions(date);

CREATE TABLE vf_affirmations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       TEXT NOT NULL REFERENCES vf_sessions(id),
  affirmation_index INTEGER NOT NULL,
  conviction_score REAL,
  resistance_score REAL,
  exploration      TEXT,
  resistance       TEXT
);

-- ─── Key Decisions ──────────────────────────────────────────────────────────

CREATE TABLE key_decisions (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL,
  timestamp         TEXT NOT NULL,
  description       TEXT NOT NULL,
  type              TEXT NOT NULL,
  multiplier        INTEGER DEFAULT 1,
  affirmation_index INTEGER,
  notes             TEXT
);

CREATE INDEX idx_key_decisions_date ON key_decisions(date);

-- ─── Badge Progress (persistent, not daily) ─────────────────────────────────

CREATE TABLE badge_progress (
  badge_slug        TEXT PRIMARY KEY,
  tier              INTEGER DEFAULT 1,
  tier_name         TEXT DEFAULT 'Initiate',
  xp                INTEGER DEFAULT 0,
  exercises_completed INTEGER DEFAULT 0,
  missions_completed  INTEGER DEFAULT 0,
  missions_failed     INTEGER DEFAULT 0,
  boss_encounters     INTEGER DEFAULT 0,
  current_streak      INTEGER DEFAULT 0,
  longest_streak      INTEGER DEFAULT 0,
  last_activity_date  TEXT,
  last_updated        TEXT
);

-- ─── Badge Daily (daily exercises log) ──────────────────────────────────────

CREATE TABLE badge_exercises (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL,
  badge_slug TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  timestamp  TEXT NOT NULL,
  xp_gained  INTEGER DEFAULT 0
);

CREATE INDEX idx_badge_exercises_date ON badge_exercises(date);

CREATE TABLE badge_mission_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  badge_slug TEXT NOT NULL,
  success    INTEGER NOT NULL,
  xp_gained  INTEGER DEFAULT 0,
  timestamp  TEXT NOT NULL
);

-- ─── Badge Missions (persistent) ────────────────────────────────────────────

CREATE TABLE badge_missions_active (
  mission_id       TEXT PRIMARY KEY,
  badge_slug       TEXT NOT NULL,
  title            TEXT,
  description      TEXT,
  success_criteria TEXT,
  reward_xp        INTEGER,
  fail_xp          INTEGER,
  min_tier         INTEGER,
  assigned_at      TEXT,
  status           TEXT DEFAULT 'pending'  -- 'pending'
);

CREATE TABLE badge_missions_completed (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id   TEXT NOT NULL,
  badge_slug   TEXT NOT NULL,
  title        TEXT,
  status       TEXT NOT NULL,  -- 'completed' | 'failed' | 'expired'
  assigned_at  TEXT,
  completed_at TEXT,
  xp_awarded   INTEGER DEFAULT 0,
  notes        TEXT
);

-- ─── Append-only logs (replace .jsonl files) ────────────────────────────────

CREATE TABLE events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  source    TEXT,
  type      TEXT,
  payload   TEXT  -- JSON blob
);

CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_type ON events(type);

CREATE TABLE boss_encounters (
  id               TEXT PRIMARY KEY,
  timestamp        TEXT NOT NULL,
  badge_slug       TEXT,
  affirmation_index INTEGER,
  type             TEXT NOT NULL,  -- 'text' | 'image' | 'conversation'
  title            TEXT,
  content          TEXT NOT NULL,
  faced            INTEGER DEFAULT 0,
  xp_awarded       INTEGER DEFAULT 0,
  source           TEXT
);

CREATE INDEX idx_boss_encounters_date ON boss_encounters(substr(timestamp, 1, 10));

CREATE TABLE vf_chapters (
  id                 TEXT PRIMARY KEY,
  chapter            INTEGER NOT NULL,
  date               TEXT NOT NULL,
  timestamp          TEXT NOT NULL,
  title              TEXT,
  narrative          TEXT NOT NULL,
  vf_score           REAL,
  key_moments        TEXT,  -- JSON array
  bosses_named       TEXT,  -- JSON array
  affirmation_shifts TEXT,  -- JSON array
  mood               TEXT
);

-- ─── Missions last-assigned tracker ─────────────────────────────────────────

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- Store: INSERT INTO meta VALUES ('missions_last_assigned', '2026-03-05');
```

---

## Server Helper Replacements

### Initialize DB (top of `index.js`)

```js
import Database from 'better-sqlite3'

const DB_PATH = path.join(DATA_DIR, 'limitless.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')    // faster concurrent reads
db.pragma('foreign_keys = ON')

// Run schema creation (idempotent with IF NOT EXISTS on all tables)
```

### Replace `readJson` / `writeJson`

The old pattern:
```js
let data = resetForNewDay('sleep-data', today)
data.date = today
Object.assign(data, allowed)
writeJson('sleep-data', data)
```

Becomes:
```js
const upsertSleep = db.prepare(`
  INSERT INTO sleep_data (date, source, hours_slept, quality, sleep_score, wake_up_mood, notes, raw_extracted, created_at)
  VALUES (@date, @source, @hours_slept, @quality, @sleep_score, @wake_up_mood, @notes, @raw_extracted, @created_at)
  ON CONFLICT(date) DO UPDATE SET
    source=@source, hours_slept=@hours_slept, quality=@quality,
    sleep_score=@sleep_score, wake_up_mood=@wake_up_mood,
    notes=@notes, raw_extracted=@raw_extracted
`)
```

### Replace `resetForNewDay`

No longer needed. Every query just filters by date:
```js
// Old: resetForNewDay('votes', today) then mutate array
// New: INSERT INTO votes (...) VALUES (...)
```

For GET endpoints that return the "current day" document shape, reconstruct from queries:
```js
app.get('/votes', (req, res) => {
  const today = todayStr()
  const votes = db.prepare('SELECT * FROM votes WHERE date = ?').all(today)
  res.json({ date: today, votes })
})
```

### Replace `archiveDay` / `pruneHistory`

**Delete both functions entirely.** Data persists in tables with date columns. History is just a query:

```js
// Old: archiveDay copies files to history/ dir
// New: data is already there — just query it

app.get('/history/:date', (req, res) => {
  const { date } = req.params
  res.json({
    'sleep-data': db.prepare('SELECT * FROM sleep_data WHERE date = ?').get(date) || freshStub('sleep-data'),
    'morning-state': db.prepare('SELECT * FROM morning_state WHERE date = ?').get(date) || freshStub('morning-state'),
    // ... etc for each daily type
  })
})
```

### Replace `.jsonl` append operations

```js
// Old:
fs.appendFileSync(path.join(DATA_DIR, 'events.jsonl'), JSON.stringify(entry) + '\n')

// New:
const insertEvent = db.prepare(
  'INSERT INTO events (timestamp, source, type, payload) VALUES (?, ?, ?, ?)'
)
insertEvent.run(entry.timestamp, entry.source, entry.type, JSON.stringify(entry.payload))
```

### Transactions for multi-table writes

Several routes write to multiple files (e.g., `POST /key-decisions` writes to key-decisions AND votes AND episode). Wrap in a transaction:

```js
const logKeyDecision = db.transaction((decision, vote, plotPoint) => {
  insertKeyDecision.run(decision)
  insertVote.run(vote)
  if (plotPoint) insertPlotPoint.run(plotPoint)
})
```

Routes that need transactions:
- `POST /key-decisions` — key_decisions + votes + plot_points
- `POST /boss-encounters` — boss_encounters + key_decisions + votes
- `POST /vf-game` — vf_sessions + vf_affirmations + votes
- `POST /badge-progress/exercise` — badge_progress + badge_exercises
- `POST /badge-missions/complete` — badge_missions_active + badge_missions_completed + badge_progress + badge_mission_attempts
- `POST /badge-missions/assign` — badge_missions_active + badge_missions_completed + meta
- `POST /nutrition` — nutrition + votes
- `POST /dopamine/farm-end` — dopamine_farming + dopamine_daily + votes
- `POST /dopamine/overstimulation` — dopamine_overstimulation + dopamine_daily + votes

---

## Route-by-Route Transformation Cheatsheet

| Route | Current | SQLite |
|-------|---------|--------|
| `GET /:daily-file` | `readJson(name)` | `SELECT * FROM table WHERE date = today` |
| `POST /morning-block-log` | read, find/push item, write | `INSERT OR REPLACE INTO morning_block_items` |
| `POST /creative-block-log` | read, assign, write | `INSERT ... ON CONFLICT(date) DO UPDATE` |
| `POST /sleep-data` | read, assign, write | `INSERT ... ON CONFLICT(date) DO UPDATE` |
| `POST /fitmind-data` | read, assign, write | `INSERT ... ON CONFLICT(date) DO UPDATE` |
| `POST /morning-state` | read, assign, write | `INSERT ... ON CONFLICT(date) DO UPDATE` |
| `POST /creative-state` | read, assign, write | `INSERT ... ON CONFLICT(date) DO UPDATE` |
| `POST /work-sessions/start` | read, find/push session, write | `INSERT OR REPLACE INTO work_sessions` |
| `POST /work-sessions/end` | read, find session, update, write | `UPDATE work_sessions SET ... WHERE id = ?` |
| `POST /votes` | read, push each, write | `INSERT INTO votes` (loop) |
| `POST /events` | appendFileSync | `INSERT INTO events` (loop) |
| `POST /night-routine` | read, migrate, assign phases, write | `INSERT ... ON CONFLICT(date) DO UPDATE` |
| `POST /midday-checkin` | read, assign, write | `INSERT ... ON CONFLICT(date) DO UPDATE` |
| `POST /nutrition` | read, push meal, recalc avg, write | `INSERT INTO nutrition` + compute avg in query |
| `POST /dopamine/*` | read, push/update, recalc net, write | INSERT into child tables + UPDATE dopamine_daily |
| `POST /episode` | read, assign, write | `INSERT ... ON CONFLICT(date) DO UPDATE` |
| `POST /episode/plot-point` | read, push, write | `INSERT INTO plot_points` |
| `GET /episodes` | scan history dirs + read files | `SELECT * FROM episodes ORDER BY number DESC` |
| `GET /events` | read + parse .jsonl | `SELECT * FROM events` |
| `GET /history` | readdir history/ | `SELECT DISTINCT date FROM sleep_data UNION ...` or just `SELECT DISTINCT date FROM votes ORDER BY date DESC` |
| `GET /history/:date` | read from history dir | `SELECT * FROM each_table WHERE date = ?` |
| `GET /boss-encounters` | read + parse .jsonl | `SELECT * FROM boss_encounters` with optional WHERE |
| `GET /vf-score` | read multiple files + compute | Query from vf_sessions + key_decisions + boss_encounters |
| `POST /badge-progress/exercise` | read persistent, mutate, write | `UPDATE badge_progress SET xp = xp + ? WHERE badge_slug = ?` |
| `POST /badge-missions/assign` | read, expire old, assign new, write | Transaction: UPDATE active -> INSERT completed, INSERT new active |
| `POST /badge-missions/complete` | read, find, update xp, move to completed | Transaction: DELETE from active, INSERT completed, UPDATE progress |

---

## GET Response Shape Compatibility

The frontend expects specific JSON shapes. For simple daily tables (sleep_data, morning_state, etc.) the row maps directly. For tables with child rows, reconstruct the expected shape:

```js
// votes — frontend expects { date, votes: [...] }
app.get('/votes', (req, res) => {
  const today = todayStr()
  const votes = db.prepare('SELECT * FROM votes WHERE date = ?').all(today)
  res.json({ date: today, votes })
})

// work-sessions — frontend expects { date, sessions: [...], completedSessions }
app.get('/work-sessions', (req, res) => {
  const today = todayStr()
  const sessions = db.prepare('SELECT * FROM work_sessions WHERE date = ?').all(today)
  res.json({
    date: today,
    sessions,
    totalSessions: 3,
    completedSessions: sessions.filter(s => s.ended_at).length
  })
})

// dopamine — reconstruct the nested object from 3 tables
app.get('/dopamine', (req, res) => {
  const today = todayStr()
  const daily = db.prepare('SELECT * FROM dopamine_daily WHERE date = ?').get(today)
  const farming = db.prepare('SELECT * FROM dopamine_farming WHERE date = ?').all(today)
  const overstim = db.prepare('SELECT * FROM dopamine_overstimulation WHERE date = ?').all(today)
  res.json({
    date: today,
    farming: {
      sessions: farming,
      totalPoints: farming.reduce((s, f) => s + f.points, 0),
      totalMinutes: farming.reduce((s, f) => s + f.duration_minutes, 0)
    },
    overstimulation: { events: overstim, totalEvents: overstim.length },
    screenTime: {
      totalMinutes: daily?.screen_minutes ?? null,
      pickups: daily?.screen_pickups ?? null,
      topApps: daily?.screen_top_apps ? JSON.parse(daily.screen_top_apps) : [],
      capturedAt: daily?.screen_captured_at ?? null
    },
    netScore: daily?.net_score ?? 5
  })
})
```

---

## Analytics Queries (the whole point)

Once migrated, you get these for free:

```sql
-- Sleep trend over 30 days
SELECT date, hours_slept, sleep_score, quality
FROM sleep_data
WHERE date > date('now', '-30 days')
ORDER BY date;

-- Average energy by day of week
SELECT
  CASE strftime('%w', date)
    WHEN '0' THEN 'Sun' WHEN '1' THEN 'Mon' WHEN '2' THEN 'Tue'
    WHEN '3' THEN 'Wed' WHEN '4' THEN 'Thu' WHEN '5' THEN 'Fri'
    WHEN '6' THEN 'Sat'
  END AS day_of_week,
  AVG(energy_score) AS avg_energy
FROM morning_state
GROUP BY strftime('%w', date);

-- Vote score per category over time
SELECT date, category,
  SUM(CASE WHEN polarity = 'positive' THEN weight ELSE 0 END) AS positive,
  SUM(CASE WHEN polarity = 'negative' THEN weight ELSE 0 END) AS negative
FROM votes
GROUP BY date, category
ORDER BY date;

-- Work session flow scores over time
SELECT date, AVG(flow_score) as avg_flow, COUNT(*) as sessions
FROM work_sessions
WHERE ended_at IS NOT NULL
GROUP BY date;

-- Dopamine net score correlation with sleep quality
SELECT s.date, s.hours_slept, s.sleep_score, d.net_score as dopamine_net
FROM sleep_data s
JOIN dopamine_daily d ON s.date = d.date
ORDER BY s.date;

-- Boss encounters faced vs avoided
SELECT
  substr(timestamp, 1, 7) AS month,
  SUM(CASE WHEN faced = 1 THEN 1 ELSE 0 END) AS faced,
  SUM(CASE WHEN faced = 0 THEN 1 ELSE 0 END) AS avoided
FROM boss_encounters
GROUP BY month;

-- XP progression per badge over time
SELECT be.date, be.badge_slug, SUM(be.xp_gained) AS daily_xp
FROM badge_exercises be
GROUP BY be.date, be.badge_slug
ORDER BY be.date;

-- Nutrition score vs work performance
SELECT n.date,
  AVG(n.nutrition_score) AS avg_nutrition,
  AVG(ws.composite_score) AS avg_work_score
FROM nutrition n
JOIN work_sessions ws ON n.date = ws.date
WHERE n.nutrition_score IS NOT NULL AND ws.composite_score IS NOT NULL
GROUP BY n.date;
```

---

## Data Migration Script

One-time script to move existing JSON/JSONL data into SQLite. Run once, then switch the server.

```js
// server/migrate-to-sqlite.js
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.env.HOME, '.openclaw/data/shared')
const HISTORY_DIR = path.join(DATA_DIR, 'history')
const DB_PATH = path.join(DATA_DIR, 'limitless.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// 1. Create all tables (paste schema SQL here)
// db.exec(SCHEMA_SQL)

// 2. Migrate current-day JSON files
const readJsonSafe = (filePath) => {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) }
  catch { return null }
}

// 3. Migrate history directories
const historyDates = fs.readdirSync(HISTORY_DIR)
  .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
  .sort()

const allDates = [...historyDates]

// Also include current day files
const currentSleep = readJsonSafe(path.join(DATA_DIR, 'sleep-data.json'))
if (currentSleep?.date) allDates.push(currentSleep.date) // will process current files too

const migrateDailyFile = (date, dir) => {
  // For each daily file type, read JSON and INSERT into SQLite
  // Example for sleep_data:
  const sleep = readJsonSafe(path.join(dir, 'sleep-data.json'))
  if (sleep?.date) {
    db.prepare(`INSERT OR IGNORE INTO sleep_data
      (date, created_at, source, hours_slept, quality, sleep_score, wake_up_mood, notes, raw_extracted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sleep.date, sleep.createdAt, sleep.source, sleep.hoursSlept,
           sleep.quality, sleep.sleepScore, sleep.wakeUpMood, sleep.notes,
           JSON.stringify(sleep.rawExtracted))
  }

  // Repeat pattern for each table...
  // votes: iterate sleep.votes array, INSERT each row
  // work_sessions: iterate sessions array, INSERT each row
  // nutrition: iterate meals array, INSERT each row
  // etc.
}

// Process all history dates
for (const date of historyDates) {
  migrateDailyFile(date, path.join(HISTORY_DIR, date))
}

// Process current-day files
migrateDailyFile(currentSleep?.date || 'current', DATA_DIR)

// 4. Migrate JSONL files
const migrateJsonl = (filename, insertFn) => {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, filename), 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        insertFn(entry)
      } catch {}
    }
  } catch {}
}

migrateJsonl('events.jsonl', (e) => {
  db.prepare('INSERT INTO events (timestamp, source, type, payload) VALUES (?, ?, ?, ?)')
    .run(e.timestamp, e.source, e.type, JSON.stringify(e.payload || e))
})

migrateJsonl('boss-encounters.jsonl', (e) => {
  db.prepare(`INSERT OR IGNORE INTO boss_encounters
    (id, timestamp, badge_slug, affirmation_index, type, title, content, faced, xp_awarded, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e.id, e.timestamp, e.badgeSlug, e.affirmationIndex, e.type,
         e.title, e.content, e.faced ? 1 : 0, e.xpAwarded || 0, e.source)
})

migrateJsonl('vf-chapters.jsonl', (e) => {
  db.prepare(`INSERT OR IGNORE INTO vf_chapters
    (id, chapter, date, timestamp, title, narrative, vf_score, key_moments, bosses_named, affirmation_shifts, mood)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e.id, e.chapter, e.date, e.timestamp, e.title, e.narrative, e.vfScore,
         JSON.stringify(e.keyMoments), JSON.stringify(e.bossesNamed),
         JSON.stringify(e.affirmationShifts), e.mood)
})

// 5. Migrate persistent files
const badgeProgress = readJsonSafe(path.join(DATA_DIR, 'badge-progress.json'))
if (badgeProgress?.badges) {
  for (const [slug, b] of Object.entries(badgeProgress.badges)) {
    db.prepare(`INSERT OR IGNORE INTO badge_progress
      (badge_slug, tier, tier_name, xp, exercises_completed, missions_completed,
       missions_failed, boss_encounters, current_streak, longest_streak,
       last_activity_date, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slug, b.tier, b.tierName, b.xp, b.exercisesCompleted,
           b.missionsCompleted, b.missionsFailed, b.bossEncounters,
           b.currentStreak, b.longestStreak, b.lastActivityDate,
           badgeProgress.lastUpdated)
  }
}

console.log('Migration complete.')
db.close()
```

---

## Column Naming Convention

The schema uses `snake_case` for all column names. The server will need to map between `camelCase` (API responses) and `snake_case` (DB columns). Simple helper:

```js
const toSnake = (s) => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

// Convert a DB row to API response shape
const rowToApi = (row) => {
  if (!row) return null
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[toCamel(k)] = v
  }
  return out
}
```

---

## Rollback Plan

Keep JSON files in place during migration. The migration script reads from files, writes to SQLite. If anything goes wrong, just delete `limitless.db` and you're back to files.

Once confident, you can delete the `history/` directory and daily JSON files. The `.jsonl` files can also go.

---

## Checklist

- [ ] `npm install better-sqlite3`
- [ ] Create `server/db.js` with schema init + prepared statements
- [ ] Run migration script against existing data
- [ ] Rewrite server helpers (`readJson` -> DB queries)
- [ ] Rewrite each route (follow cheatsheet above)
- [ ] Delete `archiveDay()`, `pruneHistory()`, `resetForNewDay()`
- [ ] Verify all GET endpoints return same JSON shapes
- [ ] Test frontend — no changes needed
- [ ] Add analytics endpoints once stable
- [ ] Delete old JSON/JSONL files when confident
