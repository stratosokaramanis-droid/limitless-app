# CLAUDE.md — Limitless App

## What This Is

Personal daily operating system for Stef. Tracks the full day: morning ritual, creative blocks, deep work sessions, night routine, mental badges, VF inner game, votes, dopamine, nutrition, sleep. Built by Stratos.

## Architecture

```
React PWA (port 3002) → Vite proxy /api/* → Express server (port 3001) → SQLite (~/.openclaw/data/shared/limitless.db)
                                                                          ↑
                                                        6 Telegram AI agents (via OpenClaw) call curl to :3001
```

- **Frontend**: Vite + React 18 + Tailwind CSS + Framer Motion
- **Server**: Express (`server/index.js`, ~900 lines) — the SINGLE WRITE AUTHORITY for all data
- **Database**: SQLite via `better-sqlite3` in WAL mode. DB file: `~/.openclaw/data/shared/limitless.db`
- **DB layer**: `server/db.js` (~570 lines) — prepared statements, transactions, `rowToApi`/`apiToRow` helpers
- **Schema**: `server/schema.sql` — single source of truth for all 36 tables
- **Agents**: 6 Telegram bots via OpenClaw gateway. Each has a SOUL.md personality file in `agents/*/SOUL.md`

The server is the only thing that touches the database. The app goes through the Vite proxy. Agents use curl to localhost:3001. Nothing writes directly to the DB.

## Stack & Commands

```bash
npm run dev:all    # Start Vite (3002) + Express server (3001) concurrently
npm run dev        # Vite only
npm run server     # Express server only
npm run build      # Production build
npm run migrate    # One-time: migrate JSON/JSONL files → SQLite
```

Dependencies: react 18, framer-motion, express, cors, better-sqlite3, @radix-ui/react-slider, tailwindcss 3, vite 5.

## Repo Structure

```
src/                          # React app
  App.jsx                     # Root state, tab routing, server reconciliation
  components/                 # 14+ components (MorningRoutine, WorkSessions, NightRoutine, VFGame, etc.)
  data/                       # Morning/night routine item definitions
  utils/                      # Haptics, sounds
server/
  index.js                    # THE server — all routes, middleware, XP engine (~900 lines)
  db.js                       # DB init, prepared statements, transactions (~570 lines)
  schema.sql                  # Full SQLite schema (36 tables, single source of truth)
  migrate-to-sqlite.js        # One-time migration script: JSON/JSONL → SQLite
  DATA_SCHEMA.md              # JSON data shape reference (still valid — API shapes unchanged)
  SQLITE_MIGRATION.md         # Original migration plan (historical reference)
  SYSTEM_RESEARCH.md          # Analysis of data layer problems (historical reference)
  data/                       # Static config: badges.json, missions.json, affirmations.json
agents/
  agents.json                 # Agent config reference (no tokens)
  faith/SOUL.md               # Morning ritual + pre-creative agent
  ruby/SOUL.md                # Daytime: meals, decisions, dopamine, screenshots
  forge/SOUL.md               # Work session start/end
  luna/SOUL.md                # Night routine + anytime vote translation
  void/SOUL.md                # VF Game inner work mirror
  pulse/SOUL.md               # Screenshot extraction → data
faith-knowledge/              # Faith's knowledge files (Tolle, Rubin, Clarke, beliefs)
specs/                        # Feature specs (7 written)
scripts/
  setup-agents.sh             # Install agent workspaces + print openclaw.json config
  test-integrations.sh        # Integration test suite
```

## The 6 Agents

| Agent | Role | Reads | Writes |
|-------|------|-------|--------|
| Faith | Morning + pre-creative check-in | morning-state | morning-state, creative-state, sleep-data, votes, events |
| Ruby | Daytime: meals, decisions, dopamine, screenshots | — | nutrition, key-decisions, dopamine/*, boss-encounters, sleep-data, fitmind-data, events |
| Forge | Work session start/end | work-sessions, morning-state, creative-state | work-sessions/*, votes, events, midday-checkin |
| Luna | Night routine + anytime vote translation | morning-state, creative-state, work-sessions, votes, night-routine | night-routine, votes, events |
| Void | VF Game — inner work mirror, key decisions | vf-game, key-decisions, votes, boss-encounters | vf-game, key-decisions, boss-encounters, votes |
| Pulse | Screenshot extraction → data + votes | — | sleep-data, fitmind-data, votes, events |

## Server Data Layer

All runtime data in SQLite at `~/.openclaw/data/shared/limitless.db`. Three categories:

1. **Daily tables** (keyed by `user_id + date`): morning_state, creative_state, sleep_data, fitmind_data, work_sessions, votes, nutrition, dopamine_*, night_routine, midday_checkin, vf_sessions, badge_exercises, episodes, key_decisions, morning_block_log, creative_block_log
2. **Persistent tables** (keyed by `user_id + slug/id`): badge_progress, badge_missions_active, badge_missions_completed
3. **Append-only tables**: events, boss_encounters, vf_chapters

No day reset logic needed — daily data simply has a `date` column. History is just a query.

Every data type has a hardcoded stub in the STUBS object in server/index.js. GETs always return the stub shape, never 404.

## Multi-User Support

- `users` table with UUID primary key
- Default user `00000000-0000-0000-0000-000000000001` ("stef") seeded on boot
- Middleware reads `X-User-Id` header; falls back to default if absent
- Every table scoped by `user_id` — full data isolation between users
- **Nothing breaks if no header is sent** — agents and frontend work unchanged

## Agent API Call Logging

Every request is logged to the `api_calls` table:
- `timestamp`, `method`, `path`, `source` (agent name), `duration_ms`, `response_status`
- `request_keys`, `request_body` (POST only, truncated to 4KB)
- `agent_reasoning` — optional thinking/context from the agent

Agents can attach reasoning via:
- **Header**: `X-Agent-Reasoning: why I made this call`
- **Body field**: `"_reasoning": "why I made this call"` (stripped from stored request body/keys)

Query via `GET /api-calls?limit=100` or `GET /api-calls?user=USER_ID&limit=50`.

## Key Server Patterns

- `pick(req.body, ALLOWED_FIELDS)` — field whitelisting on every POST
- `db.*.upsert.run({...})` — INSERT ON CONFLICT UPDATE for daily tables
- `db.transactions.*()` — ACID transactions for multi-table writes (key-decisions, vf-game, boss-encounters, missions, nutrition, dopamine)
- `rowToApi(row)` — converts snake_case DB columns to camelCase API response (strips `user_id`)
- `parseJsonField(val, fallback)` — parses JSON stored as TEXT in SQLite (insights, activities, nutrition, topApps, etc.)
- XP engine: `getTierForXp`, `getStreakMultiplier` (unchanged)

## Frontend Patterns

- No API client layer — every component fetches directly from `/api/*`
- localStorage for instant UX, reconciled against server on mount (server wins)
- Daily reset at 3am clears localStorage
- Components expect specific nested JSON shapes from GETs (documented in DATA_SCHEMA.md)
- Tailwind for styling, Framer Motion for animations, Radix for sliders

## Vote System

Atomic unit of the system. Every agent emits votes. Categories: `mental-power`, `creative-vision`, `physical-mastery`, `social-influence`, `strategic-mind`, `emotional-sovereignty`, `relentless-drive`, `work`, `nutrition`. Polarity: `positive` or `negative` (never neutral). Luna reads all negative votes for the Alter Memories bedtime meditation.

## Mental Badges (7)

rdf, frame-control, fearlessness, aggression, carefreeness, presence, bias-to-action. Each has XP, tiers (Initiate → Master), exercises, missions. Static defs in server/data/badges.json and missions.json.

## Important Rules

- **Never commit tokens** — `~/.openclaw/openclaw.json` contains bot tokens and API keys, never in repo
- **Server is the single write authority** — nothing touches the DB directly
- **Field whitelisting** — every POST only accepts known camelCase fields via `pick()`
- **camelCase everywhere in API** — request bodies and responses use camelCase; DB uses snake_case internally
- **Stubs guarantee shape** — GETs always return valid objects even when empty
- **Port 3001 never public** — always accessed through Vite proxy or localhost curl from agents
- **Transactions for multi-table writes** — key-decisions, vf-game, boss-encounters, missions, nutrition, dopamine

## Documentation Map

| File | What |
|------|------|
| DOCS.md | Full system documentation (architecture, agents, day flow, all endpoints) |
| MANUAL.md | User-facing how-to guide |
| PLAN.md | Dev roadmap + open questions |
| DEPLOY.md | Zero-to-running deployment guide |
| server/DATA_SCHEMA.md | API response shapes (camelCase JSON — still accurate) |
| server/schema.sql | SQLite schema (snake_case, source of truth for DB structure) |
| server/SQLITE_MIGRATION.md | Original migration plan (historical reference) |
