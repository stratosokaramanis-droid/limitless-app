# System Research — Data Layer Analysis

Research notes on the current Limitless data layer: how it works, what breaks, and why SQLite is the right next step.

---

## Architecture Overview

The system is a personal life-tracking app built as:

- **Frontend**: React 18 + Vite + Tailwind + Framer Motion — 14 components making ~39 fetch calls to the server
- **Server**: Single Express file (`server/index.js`, ~1550 lines) on port 3001
- **Data**: Flat JSON files in `~/.openclaw/data/shared/`, one file per data type
- **Static config**: `server/data/` — badges.json, missions.json, affirmations.json (versioned in repo, loaded at boot)

There is no database. The server reads/writes JSON files directly via `fs.readFileSync` / `fs.writeFileSync`.

---

## How Data Currently Works

### Three categories of data files

1. **Daily files** (reset each calendar day): `morning-state.json`, `sleep-data.json`, `work-sessions.json`, `votes.json`, `night-routine.json`, `dopamine.json`, `nutrition.json`, `episode.json`, `midday-checkin.json`, `creative-state.json`, `creative-block-log.json`, `morning-block-log.json`, `fitmind-data.json`, `badge-daily.json`, `key-decisions.json`, `vf-game.json`

2. **Persistent files** (survive across days): `badge-progress.json`, `badge-missions.json`

3. **Append-only logs** (JSONL): `events.jsonl`, `boss-encounters.jsonl`, `vf-chapters.jsonl`

### The daily reset mechanism

Every write route follows the same pattern:

```js
const today = todayStr()
let data = resetForNewDay('sleep-data', today)
data.date = today
Object.assign(data, allowed)
writeJson('sleep-data', data)
```

`resetForNewDay()` checks if the file's `date` field matches today. If it doesn't:
1. It calls `archiveDay(oldDate)` which copies ALL daily files to `history/{date}/`
2. Returns a fresh stub (empty defaults)

This means the **first write of each new day triggers archival of all daily files**, not just the one being written.

### Stubs

Every data type has a hardcoded default shape defined in the `STUBS` object (~120 lines). These are cloned via `structuredClone()` whenever a fresh daily state is needed. The stubs serve as both the "empty state" and the implicit schema — there's no separate schema definition, the stub IS the schema.

### History system

`archiveDay(dateStr)` copies every daily JSON file into `history/{date}/`. `pruneHistory(90)` deletes directories older than 90 days. History is queried via:
- `GET /history` — lists date directories via `fs.readdirSync`
- `GET /history/:date` — reads all files from that date's directory
- `GET /history/:date/:file` — reads one specific file from history

### Persistent files

`badge-progress.json` and `badge-missions.json` use separate `readPersistent()` / `writePersistent()` helpers. They don't reset daily. `writePersistent` auto-stamps `lastUpdated`.

### Append-only logs

Events and boss encounters use `.jsonl` format — one JSON object per line, appended with `fs.appendFileSync`. Reading requires parsing every line:

```js
const raw = fs.readFileSync('events.jsonl', 'utf8')
const events = raw.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(Boolean)
```

---

## Helper Functions

The server has 7 core helper functions that handle all data I/O:

| Function | Purpose |
|----------|---------|
| `readJson(name)` | Read a daily JSON file, return stub on failure |
| `writeJson(name, data)` | Write JSON with pretty-print |
| `resetForNewDay(name, today)` | Check date, archive old day, return fresh stub or existing data |
| `freshStub(name)` | Clone the default stub for a data type |
| `readPersistent(name)` | Read a persistent file, return stub on failure |
| `writePersistent(name, data)` | Write persistent file with auto-timestamping |
| `archiveDay(dateStr)` | Copy all daily files to history directory |

Plus `pick(obj, keys)` for whitelisting request body fields, and XP engine helpers (`getTierForXp`, `getStreakMultiplier`, `applyXp`, `updateStreak`).

---

## Route Inventory

### Simple daily CRUD (read-modify-write pattern)
These routes all follow the same `resetForNewDay → pick fields → Object.assign → writeJson` pattern:

| Route | Data File | Notes |
|-------|-----------|-------|
| `POST /sleep-data` | sleep-data.json | Field whitelist: source, hoursSlept, quality, sleepScore, wakeUpMood, notes, rawExtracted |
| `POST /fitmind-data` | fitmind-data.json | Field whitelist: source, workoutCompleted, duration, type, score, notes |
| `POST /morning-state` | morning-state.json | Field whitelist: energyScore, mentalClarity, emotionalState, insights, dayPriority, etc. |
| `POST /creative-state` | creative-state.json | Field whitelist: activities, energyScore, creativeOutput, insights, nutrition, etc. |
| `POST /creative-block-log` | creative-block-log.json | Field whitelist: status, startedAt, completedAt |
| `POST /midday-checkin` | midday-checkin.json | Field whitelist: energyScore, notes, rawNotes |

### Array-push routes
These read a file, push items into an array, recompute aggregates, and write back:

| Route | Data File | Array Field |
|-------|-----------|-------------|
| `POST /morning-block-log` | morning-block-log.json | `items[]` — find-or-push by itemId |
| `POST /votes` | votes.json | `votes[]` — push each incoming vote with UUID |
| `POST /nutrition` | nutrition.json | `meals[]` — push meal, recompute averageScore |

### Session management routes
Work sessions have start/end lifecycle:

| Route | Operation |
|-------|-----------|
| `POST /work-sessions/start` | Find-or-push session by sessionId, set startedAt |
| `POST /work-sessions/end` | Find session, set endedAt + scores, recompute completedSessions |

### Multi-file write routes (cross-cutting)
These are the complex routes that touch 2-3 files atomically (but currently have no atomicity guarantee):

| Route | Files Written | What Happens |
|-------|--------------|--------------|
| `POST /key-decisions` | key-decisions + votes + episode | Create decision, generate weighted vote, auto-add plot point |
| `POST /vf-game` | vf-game + votes | Create VF session with affirmations, generate conviction votes |
| `POST /boss-encounters` | boss-encounters.jsonl + key-decisions + votes + badge-progress | Append encounter, create key decision, cast votes, award XP |
| `POST /badge-progress/exercise` | badge-progress + badge-daily | Update XP + streak, log to daily |
| `POST /badge-missions/complete` | badge-missions + badge-progress + badge-daily | Move mission to completed, award XP, log to daily |
| `POST /badge-missions/assign` | badge-missions | Expire old, assign new, trim history |
| `POST /dopamine/farming/start` | dopamine.json | Push farming session |
| `POST /dopamine/farming/end` | dopamine + votes | End session, compute points, cast vote |
| `POST /dopamine/overstimulation` | dopamine + votes | Log overstim event, cast negative vote |
| `POST /dopamine/screen-time` | dopamine.json | Set screen time data, recompute net score |
| `POST /nutrition` | nutrition + votes | Log meal, cast nutrition vote |
| `POST /episode` | episode.json | Upsert episode fields |
| `POST /episode/plot-point` | episode.json | Push plot point to episode |

### Night routine
The most complex single-file route. Has a migration layer (`migrateNightRoutine`) for old format → new nested format. Supports per-phase updates or bulk updates. Auto-computes completion status from phase flags.

### Read-only routes
| Route | Source |
|-------|--------|
| `GET /{daily-file}` | Direct `readJson()` for each of the 16 daily files |
| `GET /night-routine` | `readJson` + migration |
| `GET /events` | Parse entire events.jsonl line by line |
| `GET /history` | `fs.readdirSync` on history directory |
| `GET /history/:date` | Read all files from history date directory |
| `GET /history/:date/:file` | Read one file from history |
| `GET /badges` | Static badges.json from repo |
| `GET /badges/missions` | Static missions.json from repo |
| `GET /badge-progress` | Persistent file |
| `GET /badge-missions` | Persistent file |
| `GET /affirmations` | Static affirmations.json from repo |
| `GET /boss-encounters` | Parse boss-encounters.jsonl |
| `GET /vf-chapters` | Parse vf-chapters.jsonl |
| `GET /vf-score` | Compute from vf-game + key-decisions + boss-encounters + badge-progress |
| `GET /episodes` | Scan history dirs + read episode.json from each |
| `GET /dopamine/net-score` | Read dopamine.json, return netScore |

---

## What Works

- **Simplicity**: The read-modify-write pattern is dead simple. No ORM, no migrations, no connection pools. Just files.
- **Human-readable state**: You can `cat sleep-data.json` to see exactly what the system knows. Great for debugging.
- **Zero infrastructure**: No database process, no setup. Data lives in `~/.openclaw/data/shared/`.
- **Stubs as implicit schema**: The STUBS object means every GET always returns a valid shape, even if no data exists yet.

---

## What Breaks

### 1. No cross-day querying
The biggest limitation. To answer "what was my average sleep over the last 30 days?" you have to:
1. List all directories in `history/`
2. Read `sleep-data.json` from each one
3. Parse and aggregate in memory

The `GET /episodes` endpoint already does this — it scans every history directory to build the episode list. This pattern gets worse as history grows.

The `GET /vf-score` endpoint is the most extreme: it reads vf-game.json, key-decisions.json, boss-encounters.jsonl, badge-progress.json, AND iterates history directories to compute a composite VF score. It's O(n) in the number of history days.

### 2. No atomicity on multi-file writes
`POST /key-decisions` writes to three files sequentially:
1. `writeJson('votes', votesData)`
2. `writeJson('key-decisions', data)`
3. `addAutoPlotPoint(...)` → reads/writes `episode.json`

If the process crashes between step 1 and step 2, you get votes with no decision record. There's no transaction boundary. This affects 10+ routes.

### 3. Archive-on-first-write race condition
When the day rolls over, the **first** write to any daily file triggers `archiveDay()` for ALL files. If two requests arrive simultaneously at midnight (or the first request of a new day), you can get:
- Double-archiving (mitigated by the `fs.existsSync(dayDir)` check)
- One request reading stale data while another is resetting
- Files archived in inconsistent states (some updated, some not)

### 4. History grows linearly on disk
Each day creates a directory with ~16 JSON files. At 90 days (the prune limit), that's ~1,440 files in `history/`. `pruneHistory` does an `fs.readdirSync` + date comparison + `fs.rmSync` on every expired directory. Not catastrophic, but wasteful.

### 5. JSONL files don't scale for reads
`GET /events` parses the entire events.jsonl file on every request. No filtering by date, type, or source at the I/O level — it's all done in memory after full parse. Same for boss-encounters and vf-chapters. As these files grow, response time degrades linearly.

### 6. Computed aggregates are fragile
Several files store pre-computed values that must be kept in sync:
- `nutrition.json` has `averageScore` and `totalMeals` (recomputed on each write)
- `dopamine.json` has `netScore`, `totalPoints`, `totalMinutes`, `totalEvents`
- `work-sessions.json` has `completedSessions`
- `key-decisions.json` has `totalMultipliedWeight`

If any write fails mid-computation, these get out of sync. With SQL, these become `SELECT AVG(...)` queries — always correct by definition.

### 7. Field name mismatch risk
The server uses `pick(req.body, ALLOWED_FIELDS)` to whitelist fields. The frontend and AI agents must send exactly the right camelCase keys. There's no validation layer — if an agent sends `sleep_score` instead of `sleepScore`, it's silently dropped.

### 8. Night routine migration debt
The `migrateNightRoutine()` function handles an old flat format → new nested format conversion. This runs on every GET and POST. It's defensive code that should have been a one-time migration but can't be because there's no migration framework.

---

## Why SQLite (and not Postgres, etc.)

| Factor | SQLite | Postgres/MySQL |
|--------|--------|----------------|
| Zero infrastructure | Single file, no daemon | Requires running process |
| Deployment | Same as current (just files) | Need Docker/managed DB |
| Backup | Copy one `.db` file | pg_dump or similar |
| Concurrent reads | WAL mode handles this | Overkill for single-user |
| Transactions | Full ACID | Full ACID (overkill) |
| Cross-day queries | Native SQL | Native SQL |
| Migration from JSON | Straightforward | Extra network layer |
| `better-sqlite3` | Synchronous API, matches current sync code | Would need async rewrite |

The key factor: **`better-sqlite3` is synchronous**. The current server uses `fs.readFileSync` / `fs.writeFileSync` everywhere. A Postgres migration would require rewriting every route to async/await. SQLite via `better-sqlite3` is a drop-in replacement for the file I/O calls — same synchronous flow, same single-threaded execution model.

---

## What the Frontend Expects

The frontend makes direct fetch calls to `localhost:3001` from 14 components. It expects specific JSON response shapes. Key observations:

- **No API client layer**: Every component fetches directly. There's no shared API module.
- **Response shapes must stay identical**: The frontend destructures specific keys like `data.votes`, `data.sessions`, `data.farming.sessions`, etc.
- **Nested objects**: dopamine, night-routine, and work-sessions have deeply nested response shapes that need to be reconstructed from normalized DB tables.
- **GET endpoints return stubs**: Even when no data exists, GETs return the stub shape (not 404). The frontend relies on this.

This means the SQLite migration is **purely a server-side change**. The frontend doesn't need to change at all, as long as GET responses maintain the same JSON shapes.

---

## Data Volume Estimates

For a single user tracking daily for 1 year:
- ~365 rows in each daily table (sleep_data, morning_state, etc.)
- ~1,000-3,000 votes per year (5-10 per day)
- ~1,000 work sessions per year (~3 per day)
- ~1,000 nutrition entries
- ~1,000 events in the events log
- ~100-200 boss encounters
- ~50-100 badge exercises
- Badge progress: 7 rows (one per badge slug)

Total: well under 10,000 rows across all tables. SQLite handles millions of rows comfortably. This dataset will never be a performance concern.

---

## Risks and Edge Cases

### Data loss during migration
The migration script reads from JSON files and writes to SQLite. Original files are preserved. If migration fails mid-way, delete the `.db` file and retry. No data is destroyed.

### JSON array columns
Some fields store JSON arrays in a single column (e.g., `insights`, `activities`, `topApps`). This is a pragmatic trade-off — normalizing every array into a child table would triple the schema complexity for marginal benefit. These fields are never queried by individual element; they're always returned wholesale.

### The `freshStub` pattern
Currently, GET endpoints return stubs when no data exists. With SQLite, a `SELECT` returns null/no rows. The server must explicitly return the stub shape when no row exists for today. This is a one-line change per GET route: `db.prepare('SELECT...').get(today) || freshStub('sleep-data')`.

### camelCase ↔ snake_case
The DB schema uses snake_case. The API returns camelCase. A `rowToApi()` helper handles this, but it needs to be applied consistently on every GET response. Missing it on one route would break the frontend.

### Night routine format migration
The old flat → nested migration can be baked into the data migration script as a one-time transformation. After migration, `migrateNightRoutine()` can be deleted.

---

## Files Referenced

| File | Lines | Purpose |
|------|-------|---------|
| `server/index.js` | ~1,550 | Entire server (Express + all routes + helpers) |
| `server/DATA_SCHEMA.md` | ~460 | JSON schema documentation for all data types |
| `server/data/badges.json` | static | Badge definitions, tiers, exercises |
| `server/data/missions.json` | static | Mission definitions with XP values |
| `server/data/affirmations.json` | static | VF Game affirmation statements |
| `package.json` | — | Dependencies: express, cors (no DB dependency yet) |
| `src/App.jsx` | — | Main frontend, 5 fetch calls |
| `src/components/*.jsx` | 14 files | Each component fetches directly from the server |

---

## Conclusion

The file-based system was the right choice for bootstrapping — zero setup, human-readable, trivially debuggable. But it's now the bottleneck for two things: **cross-day analytics** (every trend query requires scanning the filesystem) and **data integrity** (multi-file writes have no atomicity). SQLite solves both while preserving the zero-infrastructure, single-file deployment model that makes this system easy to run.
