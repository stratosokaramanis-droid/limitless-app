-- Limitless App — SQLite Schema (single source of truth)
-- All tables scoped by user_id for multi-user support.

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0
);

-- ─── API Call Logging ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_calls (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp       TEXT NOT NULL,
  user_id         TEXT NOT NULL REFERENCES users(id),
  method          TEXT NOT NULL,
  path            TEXT NOT NULL,
  source          TEXT,
  request_keys    TEXT,
  request_body    TEXT,
  response_status INTEGER NOT NULL,
  duration_ms     INTEGER NOT NULL,
  error           TEXT,
  agent_reasoning TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_calls_timestamp ON api_calls(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_calls_user ON api_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_source ON api_calls(source);

-- ─── Daily tables (one row per user+date) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS morning_block_log (
  user_id      TEXT NOT NULL REFERENCES users(id),
  date         TEXT NOT NULL,
  started_at   TEXT,
  completed_at TEXT,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS morning_block_items (
  id        TEXT NOT NULL,
  user_id   TEXT NOT NULL REFERENCES users(id),
  date      TEXT NOT NULL,
  status    TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  PRIMARY KEY (user_id, date, id)
);

CREATE INDEX IF NOT EXISTS idx_morning_block_items_date ON morning_block_items(user_id, date);

CREATE TABLE IF NOT EXISTS creative_block_log (
  user_id      TEXT NOT NULL REFERENCES users(id),
  date         TEXT NOT NULL,
  started_at   TEXT,
  completed_at TEXT,
  status       TEXT NOT NULL DEFAULT 'not_started',
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS sleep_data (
  user_id       TEXT NOT NULL REFERENCES users(id),
  date          TEXT NOT NULL,
  created_at    TEXT,
  source        TEXT,
  hours_slept   REAL,
  quality       TEXT,
  sleep_score   REAL,
  wake_up_mood  TEXT,
  notes         TEXT,
  raw_extracted TEXT,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS fitmind_data (
  user_id           TEXT NOT NULL REFERENCES users(id),
  date              TEXT NOT NULL,
  created_at        TEXT,
  source            TEXT,
  workout_completed INTEGER,
  duration          INTEGER,
  type              TEXT,
  score             REAL,
  notes             TEXT,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS morning_state (
  user_id                TEXT NOT NULL REFERENCES users(id),
  date                   TEXT NOT NULL,
  created_at             TEXT,
  updated_at             TEXT,
  energy_score           REAL,
  mental_clarity         REAL,
  emotional_state        TEXT,
  insights               TEXT,
  day_priority           TEXT,
  resistance_noted       INTEGER,
  resistance_description TEXT,
  overall_morning_score  REAL,
  raw_notes              TEXT,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS creative_state (
  user_id          TEXT NOT NULL REFERENCES users(id),
  date             TEXT NOT NULL,
  created_at       TEXT,
  updated_at       TEXT,
  activities       TEXT,
  energy_score     REAL,
  creative_output  TEXT,
  insights         TEXT,
  nutrition        TEXT,
  nutrition_score  REAL,
  dopamine_quality TEXT,
  mood_shift       TEXT,
  raw_notes        TEXT,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS work_sessions (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id),
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

CREATE INDEX IF NOT EXISTS idx_work_sessions_date ON work_sessions(user_id, date);

CREATE TABLE IF NOT EXISTS votes (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id),
  date      TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  action    TEXT NOT NULL,
  category  TEXT NOT NULL,
  polarity  TEXT NOT NULL,
  source    TEXT,
  weight    INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_votes_date ON votes(user_id, date);
CREATE INDEX IF NOT EXISTS idx_votes_category ON votes(category);

CREATE TABLE IF NOT EXISTS night_routine (
  user_id                        TEXT NOT NULL REFERENCES users(id),
  date                           TEXT NOT NULL,
  started_at                     TEXT,
  completed_at                   TEXT,
  letting_go_completed           INTEGER DEFAULT 0,
  letting_go_timestamp           TEXT,
  nervous_system_completed       INTEGER DEFAULT 0,
  nervous_system_timestamp       TEXT,
  body_scan_completed            INTEGER DEFAULT 0,
  body_scan_timestamp            TEXT,
  alter_memories_completed       INTEGER DEFAULT 0,
  alter_memories_timestamp       TEXT,
  day_review_completed           INTEGER DEFAULT 0,
  day_review_timestamp           TEXT,
  plan_completed                 INTEGER DEFAULT 0,
  plan_timestamp                 TEXT,
  plan_text                      TEXT,
  plan_finalized                 INTEGER DEFAULT 0,
  plan_finalized_timestamp       TEXT,
  prompts_reviewed               INTEGER DEFAULT 0,
  prompts_timestamp              TEXT,
  vf_game_completed              INTEGER DEFAULT 0,
  visualization_completed        INTEGER DEFAULT 0,
  lights_out                     INTEGER DEFAULT 0,
  lights_out_timestamp           TEXT,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS midday_checkin (
  user_id      TEXT NOT NULL REFERENCES users(id),
  date         TEXT NOT NULL,
  triggered_at TEXT,
  energy_score REAL,
  notes        TEXT,
  raw_notes    TEXT,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS nutrition (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  date            TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  meal            TEXT NOT NULL,
  time            TEXT,
  nutrition_score REAL,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_nutrition_date ON nutrition(user_id, date);

-- ─── Dopamine ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dopamine_daily (
  user_id        TEXT NOT NULL REFERENCES users(id),
  date           TEXT NOT NULL,
  screen_minutes REAL,
  screen_pickups INTEGER,
  screen_top_apps TEXT,
  screen_captured_at TEXT,
  net_score      REAL DEFAULT 5,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS dopamine_farming (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  date             TEXT NOT NULL,
  started_at       TEXT NOT NULL,
  ended_at         TEXT,
  duration_minutes INTEGER DEFAULT 0,
  points           INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dopamine_farming_date ON dopamine_farming(user_id, date);

CREATE TABLE IF NOT EXISTS dopamine_overstimulation (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id),
  date      TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  type      TEXT NOT NULL,
  notes     TEXT
);

CREATE INDEX IF NOT EXISTS idx_dopamine_overstim_date ON dopamine_overstimulation(user_id, date);

-- ─── Episode ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS episodes (
  user_id       TEXT NOT NULL REFERENCES users(id),
  date          TEXT NOT NULL,
  number        INTEGER,
  title         TEXT,
  previously_on TEXT,
  todays_arc    TEXT,
  rating        REAL,
  status        TEXT DEFAULT 'open',
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS plot_points (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  date        TEXT NOT NULL,
  timestamp   TEXT NOT NULL,
  description TEXT NOT NULL,
  type        TEXT DEFAULT 'moment'
);

CREATE INDEX IF NOT EXISTS idx_plot_points_date ON plot_points(user_id, date);

-- ─── VF Game ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vf_sessions (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id),
  date                 TEXT NOT NULL,
  timestamp            TEXT NOT NULL,
  presence_score       REAL,
  boss_encountered     TEXT,
  key_decisions_linked TEXT,
  closing              TEXT,
  notes                TEXT
);

CREATE INDEX IF NOT EXISTS idx_vf_sessions_date ON vf_sessions(user_id, date);

CREATE TABLE IF NOT EXISTS vf_affirmations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT NOT NULL REFERENCES users(id),
  session_id       TEXT NOT NULL REFERENCES vf_sessions(id),
  affirmation_index INTEGER NOT NULL,
  conviction_score REAL,
  resistance_score REAL,
  exploration      TEXT,
  resistance       TEXT
);

-- ─── Key Decisions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS key_decisions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  date              TEXT NOT NULL,
  timestamp         TEXT NOT NULL,
  description       TEXT NOT NULL,
  type              TEXT NOT NULL,
  multiplier        INTEGER DEFAULT 1,
  affirmation_index INTEGER,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_key_decisions_date ON key_decisions(user_id, date);

-- ─── Badge Progress (persistent, not daily) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS badge_progress (
  user_id             TEXT NOT NULL REFERENCES users(id),
  badge_slug          TEXT NOT NULL,
  tier                INTEGER DEFAULT 1,
  tier_name           TEXT DEFAULT 'Initiate',
  xp                  INTEGER DEFAULT 0,
  exercises_completed INTEGER DEFAULT 0,
  missions_completed  INTEGER DEFAULT 0,
  missions_failed     INTEGER DEFAULT 0,
  boss_encounters     INTEGER DEFAULT 0,
  current_streak      INTEGER DEFAULT 0,
  longest_streak      INTEGER DEFAULT 0,
  last_activity_date  TEXT,
  last_updated        TEXT,
  PRIMARY KEY (user_id, badge_slug)
);

-- ─── Badge Daily ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS badge_exercises (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id),
  date       TEXT NOT NULL,
  badge_slug TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  timestamp  TEXT NOT NULL,
  xp_gained  INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_badge_exercises_date ON badge_exercises(user_id, date);

CREATE TABLE IF NOT EXISTS badge_mission_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id),
  date       TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  badge_slug TEXT NOT NULL,
  success    INTEGER NOT NULL,
  xp_gained  INTEGER DEFAULT 0,
  timestamp  TEXT NOT NULL
);

-- ─── Badge Missions (persistent) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS badge_missions_active (
  user_id          TEXT NOT NULL REFERENCES users(id),
  mission_id       TEXT NOT NULL,
  badge_slug       TEXT NOT NULL,
  title            TEXT,
  description      TEXT,
  success_criteria TEXT,
  reward_xp        INTEGER,
  fail_xp          INTEGER,
  min_tier         INTEGER,
  assigned_at      TEXT,
  status           TEXT DEFAULT 'pending',
  PRIMARY KEY (user_id, mission_id)
);

CREATE TABLE IF NOT EXISTS badge_missions_completed (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL REFERENCES users(id),
  mission_id   TEXT NOT NULL,
  badge_slug   TEXT NOT NULL,
  title        TEXT,
  status       TEXT NOT NULL,
  assigned_at  TEXT,
  completed_at TEXT,
  xp_awarded   INTEGER DEFAULT 0,
  notes        TEXT
);

-- ─── Append-only logs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT NOT NULL REFERENCES users(id),
  timestamp TEXT NOT NULL,
  source    TEXT,
  type      TEXT,
  payload   TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

CREATE TABLE IF NOT EXISTS boss_encounters (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  timestamp        TEXT NOT NULL,
  badge_slug       TEXT,
  affirmation_index INTEGER,
  type             TEXT NOT NULL,
  title            TEXT,
  content          TEXT NOT NULL,
  faced            INTEGER DEFAULT 0,
  xp_awarded       INTEGER DEFAULT 0,
  source           TEXT
);

CREATE INDEX IF NOT EXISTS idx_boss_encounters_user_date ON boss_encounters(user_id, substr(timestamp, 1, 10));

CREATE TABLE IF NOT EXISTS vf_chapters (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  chapter            INTEGER NOT NULL,
  date               TEXT NOT NULL,
  timestamp          TEXT NOT NULL,
  title              TEXT,
  narrative          TEXT NOT NULL,
  vf_score           REAL,
  key_moments        TEXT,
  bosses_named       TEXT,
  affirmation_shifts TEXT,
  mood               TEXT
);

-- ─── Meta ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta (
  user_id TEXT NOT NULL REFERENCES users(id),
  key     TEXT NOT NULL,
  value   TEXT,
  PRIMARY KEY (user_id, key)
);
