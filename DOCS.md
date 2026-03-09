# Limitless System — Full Documentation

**Last updated:** 2026-03-09
**Built by:** Stratos
**Repo:** github.com/stratosokaramanis-droid/limitless-app

---

## 1. What This Is

Limitless is a personal daily operating system for Stef. It structures the entire day — morning ritual, pre-creative check-in, deep work sessions, night routine, bed routine — and tracks state across sleep, nutrition, dopamine, mood, mental development, and inner work.

The system has three layers:

1. **A React PWA** — accessed from Stef's phone via Cloudflare tunnel
2. **AI agents on Telegram** — 6 specialized agents, each with a distinct role and personality
3. **An Express server with SQLite** — the single write authority that bridges everything

---

## 2. Architecture

```
                      ┌─────────────────────────────────┐
                      │         STEF'S PHONE             │
                      │                                  │
                      │  ┌────────────────┐              │
                      │  │  Limitless App │              │
                      │  │  (React PWA)   │              │
                      │  └───────┬────────┘              │
                      │          │ Cloudflare tunnel      │
                      └──────────┼───────────────────────┘
                                 │
                    ┌────────────▼──────────────────┐
                    │   React Dev Server (Vite)      │
                    │   localhost:3002               │
                    │   Proxy: /api/* → :3001        │
                    └────────────┬──────────────────┘
                                 │
                    ┌────────────▼──────────────────┐
                    │   EXPRESS SERVER               │
                    │   localhost:3001               │
                    │   ★ SINGLE WRITE AUTHORITY ★   │
                    │   All reads and writes go here │
                    └────────────┬──────────────────┘
                                 │ reads/writes
                    ┌────────────▼──────────────────┐
                    │   SQLite (WAL mode)            │
                    │   ~/.openclaw/data/shared/     │
                    │   limitless.db                 │
                    └────────────┬──────────────────┘
                                 │ via curl to :3001
   ┌──────┬────────┬──────┬──────┼──────┬──────┐
   │      │        │      │      │      │      │
 Faith  Ruby   Forge   Luna   Void  Pulse  Stratos
  🕊️    💎     ⚡      🌙     🪞    📊     🤙
```

### The Golden Rule

**The server is the only thing that touches the database.**

- The app calls `POST /api/<endpoint>` through the Vite proxy → server writes to SQLite
- Agents call `curl -X POST http://localhost:3001/<endpoint>` → server writes to SQLite
- Agents call `curl http://localhost:3001/<endpoint>` to read
- Nothing touches `limitless.db` directly. Ever.

This prevents race conditions, provides ACID transactions on multi-table writes, validates all input through field whitelists, and logs every API call for agent evaluation.

### Server Components

| File | Purpose | Lines |
|------|---------|-------|
| `server/index.js` | Express routes, middleware, XP engine | ~900 |
| `server/db.js` | DB init, prepared statements, 9 transaction functions, `rowToApi`/`apiToRow` | ~570 |
| `server/schema.sql` | Full SQLite schema — 36 tables, all with `user_id` | ~340 |
| `server/migrate-to-sqlite.js` | One-time migration: JSON/JSONL files → SQLite | ~320 |

---

## 3. The Agents

All agents run inside **OpenClaw** (AI gateway daemon). Each has its own Telegram bot, workspace, and personality defined in `SOUL.md`.

### Agent Summary

| Agent | ID | Bot | Model | Role |
|-------|-----|-----|-------|------|
| 🕊️ Faith | `faith` | — | claude-opus-4-6 | Morning ritual + pre-creative block check-in (dual mode) |
| 💎 Ruby | `ruby` | — | claude-opus-4-6 | Daytime: meals, key decisions, dopamine, screenshots, general chat |
| ⚡ Forge | `work-session` | `@limitless_forge_bot` | gpt-5.2 | Work session start/end → scores + votes |
| 🌙 Luna | `night-routine` | `@limitless_luna_bot` | claude-opus-4-6 | Night routine + planning + anytime vote translation |
| 🪞 Void | `vf-game` | — | claude-opus-4-6 | VF Game — inner work mirror, key decisions |
| 📊 Pulse | `limitless-state` | `@limitless_pulse_bot` | gpt-5.2 | Screenshot extraction → data + votes |
| 🤙 Stratos | `stratos` | `@OStratosOKaramanisBot` | claude-sonnet-4-6 | Builder/engine. Not part of daily loop. |

### Agent Personalities

- **Faith** — calm, warm, present. A little playful when it calls for it. Meets you exactly where you are. Draws from Tolle, Rubin, Clarke, and Stef's own beliefs. Never therapy-speak.
- **Ruby** — casual, attentive friend. Listens more than she talks. Catches patterns. Logs things naturally without making it feel clinical. Your connective tissue between blocks.
- **Forge** — direct. No warmup. "Session 1. What are we building?" A training partner, not a cheerleader. Honest scores, no softening.
- **Luna** — calm, honest, unhurried. Reflects on the full day. Guides the close. Translates anything you tell her into votes, anytime.
- **Void** — the mirror. Minimal. Precise. One question at a time. Sits with discomfort. Makes the conviction scores meaningful by exploring first.
- **Pulse** — pure sensor. Extracts numbers from screenshots, stores them, moves on. No commentary.

### Agent Knowledge Files

**Faith:**
- `knowledge/power-of-now.md` — Tolle. For overthinking, anxiety, scatter.
- `knowledge/the-creative-act.md` — Rubin. For creative block, resistance.
- `knowledge/katie-clarke-40-minutes.md` — Clarke framework. For fear, self-doubt.
- `knowledge/katie-clarke-video-game.md` — Clarke levels. For feeling stuck.
- `knowledge/beliefs.md` — Stef's own beliefs. For reflection.

**Void:**
- `knowledge/life-is-a-video-game-summary.md` — Core Katie Clarke framework.
- `knowledge/life-is-a-video-game-full.md` — Full transcript reference.

### Agent Read/Write Matrix

| Agent | Reads | Writes |
|-------|-------|--------|
| Faith | `/morning-state` (to detect check-in type) | `/morning-state`, `/creative-state`, `/sleep-data`, `/votes`, `/events` |
| Ruby | — | `/nutrition`, `/key-decisions`, `/dopamine/*`, `/boss-encounters`, `/sleep-data`, `/fitmind-data`, `/events` |
| Forge | `/work-sessions`, `/morning-state`, `/creative-state` | `/work-sessions/start`, `/work-sessions/end`, `/votes`, `/events`, `/midday-checkin` |
| Luna | `/morning-state`, `/creative-state`, `/work-sessions`, `/votes`, `/night-routine` | `/night-routine`, `/votes`, `/events` |
| Void | `/vf-game`, `/key-decisions`, `/votes`, `/boss-encounters` | `/vf-game`, `/key-decisions`, `/boss-encounters`, `/votes` |
| Pulse | — | `/sleep-data`, `/fitmind-data`, `/votes`, `/events` |

### Agent API Call Logging & Reasoning

Every request to the server is logged to the `api_calls` table for agent evaluation:

```
timestamp | method | path | source | duration_ms | response_status | agent_reasoning
```

Agents can attach their thinking/reasoning to any API call:

**Via header (recommended for curl):**
```bash
curl -X POST localhost:3001/key-decisions \
  -H "Content-Type: application/json" \
  -H "X-Source: void" \
  -H "X-Agent-Reasoning: User described resisting phone urge during deep work. Logging as resist-type key decision with 3x multiplier." \
  -d '{"description":"resisted phone","type":"resist"}'
```

**Via body field:**
```bash
curl -X POST localhost:3001/votes \
  -H "Content-Type: application/json" \
  -d '{
    "votes": [{"action":"completed morning ritual","category":"mental-power","polarity":"positive","source":"faith"}],
    "_reasoning": "All 5 morning block items done. User showed strong presence during check-in."
  }'
```

The `_reasoning` field is stripped from stored request body/keys — it only appears in the `agent_reasoning` column of `api_calls`.

**Querying agent behavior:**
```bash
# Last 100 calls
curl localhost:3001/api-calls?limit=100

# Calls from a specific agent
curl "localhost:3001/api-calls?limit=50" | jq '.[] | select(.source == "faith")'

# SQL queries for deeper analysis (via better-sqlite3 or DB browser)
SELECT source, path, agent_reasoning, timestamp
FROM api_calls
WHERE source = 'void' AND agent_reasoning IS NOT NULL
ORDER BY timestamp DESC;
```

---

## 4. How a Full Day Works

### Morning — Faith (dual mode)

Faith detects what kind of check-in is needed by reading `GET /morning-state`:
- If `date` is NOT today → **Morning Check-In**
- If `date` IS today → **Pre-Creative Block Check-In**

**Morning Check-In:**
1. Greets warmly. Asks how he's feeling, how he slept.
2. Shares a quote calibrated to his mood (from knowledge files).
3. Sends him toward reading (The Creative Act or Power of Now).
4. Links to the app.
5. Writes: `/morning-state` (energy, clarity, emotional state, morning score) + `/sleep-data` (if sleep mentioned) + `/votes` + `/events`.

**Pre-Creative Block Check-In:**
1. Quick energy read after morning routine.
2. Sets intention for the creative block.
3. One line to send him in.
4. Writes: `/creative-state` + `/events`.

### Daytime — Ruby

Ruby is always available. No structured check-in — she's just there.

She logs:
- **Meals** → `/nutrition` (estimates nutrition score 1-10)
- **Key decisions** → `/key-decisions` (with type + multiplier: resist 3x, persist 2x, face-boss 5x, etc.)
- **Dopamine events** → `/dopamine/overstimulation` or `/dopamine/farm-start/end`
- **Screenshots** → extracts Sleep Cycle, FitMind, or screen time data via vision
- **Boss encounters** → `/boss-encounters`
- **Notable moments** → `/events`

She fills the space between all the structured agents. Pure connective tissue.

### Work Sessions — Forge

Three 90-minute deep work sessions.

**Session start** — DM Forge:
- "Session [N]. What are we building?"
- Extracts focus + evaluation criteria
- POSTs to `/work-sessions/start`

**Session end** — DM Forge:
- "Session done. What happened?"
- Extracts outcomes, scores flow and results
- `outcomeScore` (1-10) + `flowScore` (1-10) → `compositeScore = outcome × 0.6 + flow × 0.4`
- POSTs to `/work-sessions/end` + `/votes` + `/events`

### Anytime — Luna (Vote Translation)

Luna isn't just for the night routine. Message her any time of day — a win, a slip, a weird moment, whatever. She listens, acknowledges, and translates it into votes.

Vote categories: `mental-power`, `creative-vision`, `physical-mastery`, `social-influence`, `strategic-mind`, `emotional-sovereignty`, `relentless-drive`.

### Anytime — Void (Key Decisions + VF Game)

Void handles two things:

**Key decisions (anytime):**
When you face or overcome a resistance pattern — log it. Void acknowledges it with weight, logs via `/key-decisions`, moves on.

**VF Game (user-triggered only):**
End-of-day inner work exploration. For each affirmation, Void asks "sit with this — what comes up?" before asking for a conviction score. Makes the score mean something.

### Night Routine — Luna

Luna opens with one sentence reading the full day from API data. Then guides:
1. Letting Go meditation
2. Nervous system regulation
3. Next-day planning (real dialogue → written plan)
4. Bed: read prompts, affirmations, Alter Memories (negative votes from the day)

---

## 5. The VF Game

User-triggered conviction tracking centered on the 7 badge identity statements. The exploration comes before the score.

### Flow (via Void)

1. Void reads today's key decisions and votes for context.
2. For each affirmation: "Sit with this: *[statement]*. What comes up?"
3. Explores resistance, numbness, openness — asks one question at a time.
4. THEN: asks for conviction score (1-10). Now it means something.
5. Surfaces key decisions as evidence connected to each affirmation.
6. Optional: names and logs boss encounters that surfaced.
7. Brief close.
8. Submits via `POST /vf-game`.

### XP Impact

| Conviction | Effect |
|-----------|--------|
| ≥ 8 | +10 XP for that badge |
| 4-7 | No change |
| ≤ 3 | -5 XP (can't go below 0) |

### Key Decision Multipliers

| Type | Multiplier | When |
|------|-----------|------|
| `resist` | 3x | Resisted urge/addiction/habit |
| `persist` | 2x | Kept going when wanted to stop |
| `reframe` | 2x | Stepped back from negative loop |
| `ground` | 2x | Breathed through overwhelm |
| `face-boss` | 5x | Confronted a resistance pattern directly |
| `recenter` | 2x | Called energy back |

---

## 6. The Mental Badges System

A skill tree for 7 mental capabilities. Exercises, missions, XP progression, boss encounters.

### The 7 Badges

| Badge | Slug | Identity Statement |
|-------|------|--------------------|
| Reality Distortion Field | `rdf` | "I am someone whose conviction reshapes the environment around me." |
| Frame Control | `frame-control` | "My frame is mine. No one enters it without my permission." |
| Fearlessness | `fearlessness` | "I move toward what scares me. Fear is my compass, not my cage." |
| Aggression | `aggression` | "I refuse to be domesticated. My intensity comes from love for what could be." |
| Carefreeness | `carefreeness` | "I play full out and hold on to nothing. Life is a game I'm winning by enjoying." |
| Presence | `presence` | "I am here. Fully. The present moment is the only place where life actually happens." |
| Bias to Action | `bias-to-action` | "I move. While others plan, I act. Speed is my weapon. Momentum is my fuel." |

### Tier Progression

| Tier | Name | XP Required |
|------|------|-------------|
| 1 | Initiate | 0 |
| 2 | Apprentice | 750 |
| 3 | Practitioner | 3,000 |
| 4 | Adept | 10,000 |
| 5 | Master | 30,000 |

### XP Economy

| Source | XP |
|--------|-----|
| Exercise completed | +5 |
| Mission success | +15 to +100 (scales with tier) |
| Mission fail | +3 to +20 (you tried) |
| VF conviction ≥ 8 | +10 |
| VF conviction ≤ 3 | -5 |
| Boss encounter logged | +25 |

Streak multipliers: 7 days = 1.25x, 14 days = 1.5x, 30 days = 2.0x.

Static definitions: `server/data/badges.json` (35 exercises), `server/data/missions.json` (105 missions).

---

## 7. The Server

**Location:** `server/index.js` + `server/db.js` + `server/schema.sql`
**Port:** 3001
**Start:** `npm run server` or `npm run dev:all`

### Design Principles

1. **Single write authority** — the ONLY process that touches `limitless.db`
2. **SQLite with WAL mode** — fast concurrent reads, ACID transactions for multi-table writes
3. **Field whitelisting** — every POST endpoint only accepts known fields via `pick()`
4. **Multi-user isolation** — every table scoped by `user_id`, default user if no header sent
5. **API call logging** — every request logged with source, duration, and optional agent reasoning
6. **Crash protection** — `uncaughtException` and `unhandledRejection` handlers
7. **camelCase API / snake_case DB** — `rowToApi()` and `apiToRow()` handle conversion

### Middleware Stack

1. **CORS** — open (localhost only)
2. **JSON body parser** — `express.json()`
3. **User resolution** — reads `X-User-Id` header, validates against `users` table, falls back to default
4. **API call logger** — intercepts `res.json()`, measures duration, captures source + reasoning, writes to `api_calls`

### Multi-User Support

```
X-User-Id: 00000000-0000-0000-0000-000000000001  (default, "stef")
X-User-Id: <any-valid-uuid>                        (other users)
(no header)                                         (falls back to default)
```

- Default user seeded on boot
- Create users: `POST /users` with `{"name": "alice"}`
- List users: `GET /users`
- Data fully isolated — user A cannot see user B's votes, sessions, etc.
- Port 3001 is localhost-only so UUID-as-identity is sufficient (no auth)

### Database Schema Overview

All tables defined in `server/schema.sql`. Key design:

- **Daily tables** use `PRIMARY KEY (user_id, date)` — one row per user per day
- **Child tables** (morning_block_items, votes, work_sessions, nutrition, etc.) use separate PKs with `(user_id, date)` indexes
- **Persistent tables** (badge_progress, badge_missions_*) use `PRIMARY KEY (user_id, badge_slug)` or similar
- **Append-only tables** (events, boss_encounters, vf_chapters) use auto-increment or UUID PKs with `user_id` column
- JSON arrays/objects stored as TEXT, parsed on read with `parseJsonField()`
- Booleans stored as INTEGER (0/1), converted to true/false in API responses

### Transactions

Multi-table writes that were previously non-atomic are now wrapped in SQLite transactions:

| Transaction | Tables touched |
|-------------|---------------|
| `logKeyDecision` | key_decisions + votes + plot_points |
| `logVfSession` | vf_sessions + vf_affirmations + votes |
| `logBossEncounter` | boss_encounters + key_decisions + votes + plot_points + badge_progress |
| `logNutrition` | nutrition + votes |
| `logDopamineFarmEnd` | dopamine_farming + dopamine_daily + votes |
| `logDopamineOverstim` | dopamine_overstimulation + dopamine_daily + votes |
| `assignMissions` | badge_missions_active + badge_missions_completed + meta |
| `completeMission` | badge_missions_active + badge_missions_completed + badge_progress + badge_mission_attempts |
| `exerciseBadge` | badge_progress + badge_exercises |

### Work Session Actions

When Forge asks "What are we building?", the focus maps to one of 8 defined categories:

**HyperSpace Creative Work** — content, briefs, prototypes, designs, experiments
**Greatness Work** — Game of Greatness missions + development
**Caldera Work** — client work, LinkedIn outreach, onboarding, growth, UpWork
**Side-projects Work** — Limitless, Game of Greatness, UpWork Engine, White Mirror, etc.
**Business Work** — meetings, hiring, market research, pitch decks, investing
**Creative Exploration** — free design, references, mood boarding, intentional rabbit holes
**Admin Work** — email, scheduling, invoicing, systems (CRMs, AI, automations)
**Management Work** — strategy, financials, team syncs, delegation, project review

Full list: `server/data/work-session-actions.md`

### Key Endpoints

#### Read (GET)

| Endpoint | Returns |
|----------|---------|
| `GET /health` | Server status, uptime, storage type |
| `GET /morning-state` | Today's morning check-in (Faith) |
| `GET /creative-state` | Today's pre-creative check-in (Faith) |
| `GET /sleep-data` | Today's sleep data |
| `GET /fitmind-data` | Today's FitMind data |
| `GET /work-sessions` | Today's work sessions (Forge) |
| `GET /votes` | Today's all votes |
| `GET /night-routine` | Tonight's night routine progress |
| `GET /nutrition` | Today's meals (Ruby) |
| `GET /dopamine` | Today's dopamine tracking (Ruby) |
| `GET /key-decisions` | Today's key decisions (Ruby/Void) |
| `GET /boss-encounters` | All boss encounters (filterable by ?badge=) |
| `GET /vf-game` | Today's VF Game sessions (Void) |
| `GET /vf-score` | Computed VF score for today |
| `GET /vf-chapters` | All VF chapters (optionally ?limit=N) |
| `GET /badge-progress` | Cumulative badge XP and tiers |
| `GET /badge-missions` | Active + completed missions |
| `GET /badge-daily` | Today's badge exercises and attempts |
| `GET /badges` | All badge definitions + exercises |
| `GET /badges/missions` | All mission definitions |
| `GET /affirmations` | VF Game affirmation statements |
| `GET /episode` | Today's episode |
| `GET /episodes` | All episodes (optionally ?limit=N) |
| `GET /history` | List of dates that have data |
| `GET /history/:date` | Full day snapshot for a date |
| `GET /history/:date/:file` | Single data type for a date |
| `GET /users` | All registered users |
| `GET /api-calls` | Logged API calls (?limit=N, ?user=ID) |
| `GET /events` | All events |

#### Write (POST)

| Endpoint | Called by | Transaction? |
|----------|----------|-------------|
| `POST /morning-state` | Faith | No |
| `POST /creative-state` | Faith | No |
| `POST /sleep-data` | Faith, Ruby, Pulse | No |
| `POST /fitmind-data` | Ruby, Pulse | No |
| `POST /morning-block-log` | App | No |
| `POST /creative-block-log` | App | No |
| `POST /midday-checkin` | Forge | No |
| `POST /nutrition` | Ruby, Forge | Yes (nutrition + votes) |
| `POST /key-decisions` | Ruby, Void | Yes (key_decisions + votes + plot_points) |
| `POST /dopamine/farm-start` | Ruby | No |
| `POST /dopamine/farm-end` | Ruby | Yes (farming + daily + votes) |
| `POST /dopamine/overstimulation` | Ruby | Yes (overstim + daily + votes) |
| `POST /dopamine/screen-time` | Ruby, Pulse | No |
| `POST /boss-encounters` | Ruby, Void, Luna | Yes (encounters + decisions + votes + progress + plot_points) |
| `POST /vf-game` | Void | Yes (sessions + affirmations + votes) |
| `POST /vf-chapters` | Void | No |
| `POST /work-sessions/start` | Forge | No |
| `POST /work-sessions/end` | Forge | No |
| `POST /votes` | All agents | No (loop insert) |
| `POST /events` | All agents | No (loop insert) |
| `POST /night-routine` | Luna | No |
| `POST /episode` | App/Agent | No |
| `POST /episode/plot-point` | App/Agent | No |
| `POST /badge-progress/exercise` | Any agent | Yes (progress + exercises) |
| `POST /badge-missions/assign` | Any agent | Yes (expire old + insert new + meta) |
| `POST /badge-missions/complete` | Any agent | Yes (active + completed + progress + attempts) |
| `POST /users` | Admin | No |

---

## 8. The Data Layer

**Database:** `~/.openclaw/data/shared/limitless.db` (SQLite, WAL mode)
**Schema:** `server/schema.sql` (36 tables)

### How It Works Now vs Before

| Before (JSON files) | After (SQLite) |
|---------------------|----------------|
| `readJson('sleep-data')` | `db.sleepData.get.get(userId, today)` |
| `writeJson('sleep-data', data)` | `db.sleepData.upsert.run({...})` |
| `resetForNewDay(name, today)` | Not needed — date is just a column |
| `archiveDay(dateStr)` | Not needed — history is just a query |
| `fs.appendFileSync('events.jsonl')` | `db.events.insert.run({...})` |
| Multi-file write (no atomicity) | `db.transactions.logKeyDecision(...)` |
| `readPersistent('badge-progress')` | `db.badgeProgress.getAll.all(userId)` |

### API Response Shapes

**Unchanged.** All GET endpoints return the exact same camelCase JSON shapes as before. The `DATA_SCHEMA.md` file remains accurate for API consumers. Internally, the DB uses snake_case columns — `rowToApi()` handles the conversion.

### Day Boundaries

No explicit day reset logic. Daily data simply has a `date` column. When a GET is called, it queries for `WHERE date = today`. Historical data is queryable at any time via `GET /history/:date`.

### JSON Fields in SQLite

Some fields (arrays, nested objects) are stored as TEXT in SQLite and parsed on read:

| Field | Table | Stored as |
|-------|-------|-----------|
| `insights` | morning_state, creative_state | JSON array string |
| `activities` | creative_state | JSON array string |
| `nutrition` | creative_state | JSON object string |
| `rawExtracted` | sleep_data | JSON object string |
| `topApps` | dopamine_daily | JSON array string |
| `keyDecisionsLinked` | vf_sessions | JSON array string |
| `keyMoments`, `bossesNamed`, `affirmationShifts` | vf_chapters | JSON array strings |
| `payload` | events | JSON object string |

---

## 9. The Vote System

Every agent (except Void — votes auto-generated from key decisions) emits votes. Luna reads them for Alter Memories at bedtime.

### Vote Shape

```json
{
  "id": "uuid",
  "timestamp": "ISO-8601",
  "action": "Short description",
  "category": "mental-power",
  "polarity": "positive",
  "source": "forge",
  "weight": 1
}
```

### Vote Categories

`mental-power` | `creative-vision` | `physical-mastery` | `social-influence` | `strategic-mind` | `emotional-sovereignty` | `relentless-drive` | `work` | `nutrition`

### Rules

- Neutral = don't store. Only signal.
- Polarity is binary: `positive` or `negative`.
- Luna surfaces all negative votes for the Alter Memories meditation.

---

## 10. The React App

**Stack:** Vite + React 18 + Tailwind CSS + Framer Motion
**Port:** 3002
**Access:** https://the-limitless-system.work

### Tabs

| Tab | What it shows |
|-----|--------------|
| Home | Power Level (VF score ring), State ring, RPG attribute bars (sleep/nutrition/dopamine/mood), quest chain (day progress), episode arc, key decisions, affirmation grid |
| Flow | Morning routine -> creative -> work sessions -> night -> bed (sequential flow). Episode open/close screens for day start/end |
| State | 4-pillar energy bar (sleep, nutrition, dopamine, mood) |
| Mental | Rank seal (Initiate->Master), 7 discipline skill cards with SVG glyphs, active missions (quest board), training log |
| Dopamine | Balance beam (SVG), stats row, farming timer with milestones, overstim quick-log grid (SVG icons), session timeline, weekly dots |
| History | 14-day trend view + day drilldown (sleep/morning/work/votes) |

### App State

- **localStorage** for instant UX. Reconciled against server on mount (server wins on conflict).
- **Daily reset at 3am** — all localStorage state clears.

### Source Files

```
src/
├── App.jsx                   ← root state, tab routing, episode lifecycle, daily reset
├── components/
│   ├── BottomNav.jsx         ← 6-tab nav with SVG icons
│   ├── HomeScreen.jsx        ← Power ring, state ring, attribute bars, quest chain, decisions
│   ├── MorningRoutine.jsx    ← morning card flow, wires EpisodeOpen for day start
│   ├── HabitCard.jsx         ← hold-to-confirm, skip
│   ├── CompletionScreen.jsx  ← post-morning summary
│   ├── CreativeBlock.jsx     ← timer
│   ├── WorkSessions.jsx      ← 3x90min sessions, timers, Forge links
│   ├── NightRoutine.jsx      ← night + bed items, Luna links
│   ├── VFGame.jsx            ← VF Game UI (sliders, sessions)
│   ├── StateTab.jsx          ← 4-pillar energy bar
│   ├── MentalGame.jsx        ← rank seal, discipline grid (SVG glyphs), missions, training log
│   ├── BadgeDetailSheet.jsx  ← badge detail + exercises + missions (draggable sheet)
│   ├── DopamineTracker.jsx   ← balance beam, farming timer, overstim grid (SVG icons), timeline
│   ├── EpisodeBar.jsx        ← persistent top bar with shimmer, expandable arc + scenes
│   ├── EpisodeOpen.jsx       ← cinematic day-start screen (title/arc input, "Previously on...")
│   ├── EpisodeClose.jsx      ← end-of-day screen (key scenes, rating icons, credits)
│   ├── DayCountdownBar.jsx   ← 24h countdown + end day button
│   ├── HistoryTab.jsx        ← 14-day trend + day drilldown
│   ├── BadgesTab.jsx
│   ├── StatsTab.jsx
│   ├── DashboardTab.jsx
│   ├── DevPanel.jsx          ← dev tools panel
│   └── Confetti.jsx
├── data/
│   ├── morningRoutine.js     ← the 9 morning items
│   └── nightRoutine.js       ← the 7 night/bed items
├── utils/
│   ├── haptics.js            ← Taptic feedback wrapper
│   └── sounds.js             ← Audio feedback wrapper
```

### UI Design Principles

- **Game feel, not dashboard** — the app should feel like an RPG character screen, not analytics
- **No emojis** — all icons are inline SVGs (geometric, symbolic, monochrome)
- **Dark theme** — bg-black, text-white, glass surfaces (bg-white/[0.02-0.06])
- **Atmospheric depth** — radial gradients, glow effects, ambient animations via Framer Motion
- **Small text** — 9-15px range, uppercase tracking for labels, tabular-nums for data
- **SVG glyph system** — each discipline has a unique geometric icon (diamond, hexagon, sword, flame, waves, zen circle, lightning)
- **Color-coded disciplines** — 7 distinct colors mapped in DISCIPLINE_COLORS constant
- **Tier progression** — Initiate (gray) -> Apprentice (blue) -> Warrior (purple) -> Champion (amber) -> Master (red)
- **Score coloring** — green >= 7, amber >= 4, red < 4 (consistent across all score displays)

---

## 11. Infrastructure

### Running the System

```bash
# Start OpenClaw (all agents)
openclaw gateway start

# Start app + server
cd ~/limitless-app
npm run dev:all
# → App: http://localhost:3002
# → Server: http://localhost:3001
```

### First-Time Setup with Existing Data

If migrating from the old JSON-based server:
```bash
npm run migrate
# Reads all JSON/JSONL/history files → inserts into SQLite
# Safe to run multiple times (INSERT OR IGNORE)
# Keep JSON files as rollback safety net
```

### Cloudflare Tunnel

`the-limitless-system.work` → `localhost:3002`

Three things must be running:
1. `npm run dev:all` (app :3002 + server :3001)
2. `openclaw gateway start`
3. `cloudflared` systemd service

### OpenClaw Config

Config: `~/.openclaw/openclaw.json` (chmod 600, never in git)

Each agent has:
- Entry in `agents.list` with `id`, `name`, `workspace`, `model`, `identity`
- Entry in `channels.telegram.accounts` with bot token + allowFrom

Account key in `accounts` maps directly to the `agentId` it routes to.

See `agents/agents.json` for the config reference (tokens excluded).
See `DEPLOY.md` for full setup instructions.

---

## 12. Repo Structure

```
limitless-app/
├── README.md               ← brief intro
├── DOCS.md                 ← this file
├── CLAUDE.md               ← AI assistant instructions
├── MANUAL.md               ← user-facing how-to
├── DEPLOY.md               ← deployment guide (zero to running)
├── PLAN.md                 ← dev roadmap + open questions
├── agents/
│   ├── agents.json         ← agent config reference
│   ├── faith/SOUL.md
│   ├── ruby/SOUL.md
│   ├── forge/SOUL.md
│   ├── luna/SOUL.md
│   ├── pulse/SOUL.md
│   ├── void/SOUL.md
│   └── void/knowledge/     ← Katie Clarke framework files
├── faith-knowledge/        ← Faith's knowledge files (Tolle, Rubin, Clarke, beliefs)
├── specs/                  ← feature specs (7 written)
│   ├── daytime-agent-spec.md
│   ├── dopamine-tracking-spec.md
│   ├── episode-framing-spec.md
│   ├── home-screen-spec.md
│   ├── mental-game-spec.md
│   ├── night-routine-rebuild-spec.md
│   └── vf-game-spec.md
├── scripts/
│   ├── setup-agents.sh     ← installs agent workspaces + prints openclaw.json snippets
│   └── test-integrations.sh
├── server/
│   ├── index.js            ← Express routes + middleware (~900 lines)
│   ├── db.js               ← SQLite layer: prepared statements + transactions (~570 lines)
│   ├── schema.sql          ← Full schema (36 tables, source of truth)
│   ├── migrate-to-sqlite.js ← One-time JSON → SQLite migration
│   ├── DATA_SCHEMA.md      ← API response shapes (camelCase JSON)
│   ├── SQLITE_MIGRATION.md ← Original migration plan (historical)
│   ├── SYSTEM_RESEARCH.md  ← Data layer analysis (historical)
│   └── data/               ← static config (badges, missions, affirmations)
└── src/                    ← React app
```

---

## 13. Build Status

| Component | Status |
|-----------|--------|
| Express server (SQLite, all endpoints, validation, transactions) | ✅ |
| SQLite schema (36 tables, multi-user, WAL mode) | ✅ |
| API call logging + agent reasoning capture | ✅ |
| Multi-user support (user isolation, default user fallback) | ✅ |
| Migration script (JSON/JSONL → SQLite) | ✅ |
| Faith agent (dual-mode: morning + pre-creative) | ✅ |
| Ruby agent (daytime: meals, key decisions, dopamine, screenshots) | ✅ |
| Forge agent (work sessions → scores + votes) | ✅ |
| Luna agent (night routine + anytime vote translation) | ✅ |
| Void agent (VF Game mirror + key decisions) | ✅ |
| Pulse agent (screenshot extraction → data + votes) | ✅ |
| All 6 Telegram bots wired | ✅ |
| App: morning routine cards | ✅ |
| App: creative block view | ✅ |
| App: work sessions (3×90min, timers) | ✅ |
| App: night + bed routine (hold-to-confirm, Luna links) | ✅ |
| App: State tab (4 pillars + composite) | ✅ |
| App: Badges tab (7 badges, XP, tiers, streaks, missions) | ✅ |
| App: Stats tab (vote breakdown, timeline, source) | ✅ |
| App: VF Game UI (sliders, multi-session, resistance + conviction) | ✅ |
| Mental Badges: 7 badges, 35 exercises, 105 missions | ✅ |
| Mental Badges: XP engine (exercises, missions, streaks, multipliers) | ✅ |
| Mental Badges: Tier progression (5 tiers, 30K XP cap) | ✅ |
| VF Game: conviction tracking + vote generation | ✅ |
| VF Game: XP impact (bonus/penalty by conviction score) | ✅ |
| Key Decisions: type system + multipliers | ✅ |
| Boss encounters: logging + XP reward (+25) | ✅ |
| App: HomeScreen game UI (power ring, attributes, quest chain) | ✅ |
| App: MentalGame game UI (rank seal, discipline glyphs, quest board) | ✅ |
| App: DopamineTracker (balance beam, farming timer, overstim grid) | ✅ |
| App: Episode system (EpisodeOpen, EpisodeClose, EpisodeBar) | ✅ |
| UI: SVG icon system (no emojis), atmospheric dark theme | ✅ |
| Historical data queryable via /history endpoints | ✅ |
| Cloudflare tunnel (the-limitless-system.work) | ✅ |
| Agent SOUL.md files in repo | ✅ |
| Agent knowledge files in repo | ✅ |
| DATA_SCHEMA.md | ✅ |
| DEPLOY.md | ✅ |

---

## 14. Key File Reference

| File | Purpose |
|------|---------|
| `~/.openclaw/openclaw.json` | OpenClaw config — agents, bots, auth (never in git) |
| `~/.openclaw/data/shared/limitless.db` | SQLite database (all runtime data) |
| `~/.openclaw/agents/*/workspace/SOUL.md` | Agent personalities + operating instructions |
| `server/index.js` | Express routes + middleware |
| `server/db.js` | SQLite prepared statements + transactions |
| `server/schema.sql` | Full database schema (source of truth) |
| `server/migrate-to-sqlite.js` | One-time JSON → SQLite migration |
| `server/DATA_SCHEMA.md` | API response shape reference |
| `server/data/badges.json` | Badge definitions + exercises (static) |
| `server/data/missions.json` | 105 pre-written missions (static) |
| `server/data/affirmations.json` | VF Game affirmation statements (static) |
| `agents/agents.json` | Agent config reference (tokens excluded) |
| `DEPLOY.md` | Full deployment guide |
| `PLAN.md` | Dev roadmap |

---

## 15. Analytics Queries (New with SQLite)

Now that data lives in SQL, these are available:

```sql
-- Sleep trend over 30 days
SELECT date, hours_slept, sleep_score, quality
FROM sleep_data WHERE user_id = ? AND date > date('now', '-30 days')
ORDER BY date;

-- Vote score per category over time
SELECT date, category,
  SUM(CASE WHEN polarity = 'positive' THEN weight ELSE 0 END) AS positive,
  SUM(CASE WHEN polarity = 'negative' THEN weight ELSE 0 END) AS negative
FROM votes WHERE user_id = ?
GROUP BY date, category ORDER BY date;

-- Work session flow scores over time
SELECT date, AVG(flow_score) as avg_flow, COUNT(*) as sessions
FROM work_sessions WHERE user_id = ? AND ended_at IS NOT NULL
GROUP BY date;

-- Agent call patterns (which agents call what, how often)
SELECT source, path, COUNT(*) as calls, AVG(duration_ms) as avg_ms
FROM api_calls WHERE source IS NOT NULL
GROUP BY source, path ORDER BY calls DESC;

-- Agent reasoning log (for evaluation)
SELECT timestamp, source, path, agent_reasoning
FROM api_calls
WHERE agent_reasoning IS NOT NULL
ORDER BY timestamp DESC LIMIT 50;

-- Boss encounters faced vs avoided by month
SELECT substr(timestamp, 1, 7) AS month,
  SUM(CASE WHEN faced = 1 THEN 1 ELSE 0 END) AS faced,
  SUM(CASE WHEN faced = 0 THEN 1 ELSE 0 END) AS avoided
FROM boss_encounters WHERE user_id = ?
GROUP BY month;

-- XP progression per badge
SELECT be.date, be.badge_slug, SUM(be.xp_gained) AS daily_xp
FROM badge_exercises be WHERE be.user_id = ?
GROUP BY be.date, be.badge_slug ORDER BY be.date;
```
