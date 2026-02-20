# Limitless System — Full Documentation

**Last updated:** 2026-02-20  
**Built by:** Stratos  
**Repo:** github.com/stratosokaramanis-droid/limitless-app

---

## 1. What This Is

Limitless is a personal daily operating system for Stef. It structures the entire day — morning routine, creative block, deep work sessions, night routine, bed routine — and tracks state across four dimensions: Sleep, Nutrition, Dopamine, and Mood.

The system has three layers:

1. **A React PWA** — the app, accessed from Stef's phone via Cloudflare tunnel
2. **AI agents on Telegram** — 6 specialized agents (Pulse, Dawn, Muse, Forge, Luna + Stratos the builder)
3. **An Express file server** — the single write authority that bridges everything

There is no traditional database. The backend is a set of **shared JSON files** on the local machine. The file server is the only thing that reads from and writes to these files. Both the app and the agents go through the file server API.

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
                    │   localhost:3000                │
                    │   Proxy: /api/* → :3001         │
                    └────────────┬──────────────────┘
                                 │
                    ┌────────────▼──────────────────┐
                    │   EXPRESS FILE SERVER           │
                    │   localhost:3001                │
                    │   ★ SINGLE WRITE AUTHORITY ★    │
                    │   All reads and writes go here  │
                    └────────────┬──────────────────┘
                                 │ reads/writes
                    ┌────────────▼──────────────────┐
                    │   SHARED DATA LAYER            │
                    │   ~/.openclaw/data/shared/     │
                    │   11 JSON files + events.jsonl │
                    └────────────┬──────────────────┘
                                 │ via curl to :3001
        ┌──────────┬─────────┬──┼──────────┬─────────┐
        │          │         │  │          │         │
   ┌────▼───┐ ┌───▼───┐ ┌──▼──▼──┐ ┌─────▼───┐ ┌──▼──┐
   │ Pulse  │ │ Dawn  │ │ Muse   │ │ Forge   │ │Luna │
   │  📊    │ │  🌅   │ │  🎨    │ │  ⚡     │ │ 🌙  │
   └────────┘ └───────┘ └────────┘ └─────────┘ └─────┘
   Telegram    Telegram   Telegram   Telegram   Telegram
```

### The Golden Rule

**The file server is the only thing that touches the data files.**

- The app calls `POST /api/<endpoint>` through the Vite proxy → file server writes
- Agents call `curl -X POST http://localhost:3001/<endpoint>` → file server writes
- Agents call `curl http://localhost:3001/<endpoint>` to read
- Nothing writes to `~/.openclaw/data/shared/` directly. Ever.

This prevents race conditions, ensures day-reset logic always runs, preserves historical archives, and validates all input through field whitelists.

---

## 3. How a Full Day Works

### Morning Block

1. **Wake Up** — Stef opens the app. The Today tab shows the morning routine as a sequence of cards.

2. **Sleep Cycle Screenshot** — first card has a "📲 Open Pulse →" button. Stef taps it, Telegram opens the Pulse bot. He sends a screenshot of his Sleep Cycle data.
   - **Pulse** extracts hours slept, sleep score, quality via vision
   - Pulse POSTs to `http://localhost:3001/sleep-data`
   - Pulse POSTs sleep votes to `http://localhost:3001/votes`
   - Back in the app, Stef holds the DONE button (1 second) → app POSTs to `/api/morning-block-log`

3. **Reading → Journaling → Review Plan → Sunlight Walk** — cards 2-5. Hold to confirm, skip if not done. Each interaction POSTs to `/api/morning-block-log`.

4. **FitMind** — card 6 has a "📲 Open Pulse →" button. Same flow as Sleep Cycle but for the mental workout screenshot.
   - **Pulse** extracts workout data, POSTs to `http://localhost:3001/fitmind-data` + votes

5. **Shower → Visualization → Write Values** — cards 7-9. Same hold/skip pattern.

6. **Completion Screen** — shows completed/skipped counts. "💬 Log Morning →" button deep-links to the **Dawn** bot on Telegram.
   - **Dawn** reads today's data via API: `GET /morning-block-log`, `GET /sleep-data`, `GET /fitmind-data`
   - Dawn opens with one sentence summarizing what she knows, then runs a focused check-in conversation
   - Dawn POSTs to `http://localhost:3001/morning-state` (energy, clarity, emotional state, priority, resistance, overall score)
   - Dawn POSTs votes to `http://localhost:3001/votes`
   - Dawn POSTs event to `http://localhost:3001/events`

### Creative Block (3 hours)

7. After morning is complete, the app shows the creative block view. Stef taps "Start Block" — a timer starts. He has 3 hours of free creative time: design, read, build, eat, walk, whatever.

8. When done (or whenever), Stef taps "💬 Check In →" → opens the **Muse** bot.
   - **Muse** reads `GET /morning-state`, `GET /morning-block-log` for context
   - Muse runs a loose, curious conversation: what happened, what was the energy, any creative output, did you eat
   - Muse POSTs to `http://localhost:3001/creative-state` (activities, energyScore, nutritionScore, dopamineQuality, moodShift)
   - Muse POSTs votes + event

### Deep Work Sessions (3 × 90 minutes)

9. Three timed work sessions, separated by 10-minute breaks and a 30-minute lunch break (between sessions 2 and 3).

10. **Session start** — Stef DMs the **Forge** bot: "Session 1."
    - Forge reads `GET /work-sessions`, `GET /morning-state`, `GET /creative-state`
    - Forge: "Session 1. What are we building?" — extracts focus and evaluation criteria
    - Forge POSTs to `http://localhost:3001/work-sessions/start`

11. **Session end** — Stef DMs Forge: "Done."
    - Forge: "Session done. What happened?" — extracts outcomes, scores flow and results
    - `outcomeScore` (1-10): did the work actually move?
    - `flowScore` (1-10): quality of focus
    - `compositeScore` = outcomeScore × 0.6 + flowScore × 0.4
    - If meal mentioned: extracts nutritionScore
    - Forge POSTs to `http://localhost:3001/work-sessions/end` + votes + event

12. Repeat for sessions 2 and 3.

### Optional Mid-Day Check-In

13. Stef can DM Forge anytime between sessions. Forge extracts what's useful, POSTs to `http://localhost:3001/midday-checkin`.

### Free Time

14. Nothing tracked unless Stef initiates conversation with an agent.

### Night Routine

15. Stef DMs the **Luna** bot.
    - Luna reads ALL today's data: `GET /morning-state`, `GET /creative-state`, `GET /work-sessions`, `GET /votes`, `GET /night-routine`
    - Luna opens with one sentence reflecting on the day from data
    - Guides through: Letting Go meditation → nervous system regulation → next-day planning
    - Each item POSTed to `http://localhost:3001/night-routine` as completed

16. **Next-day planning** — Luna engages in real dialogue about tomorrow's priorities, then asks for the written plan (text or photo). Stores in `night-routine.tomorrowPlan`.

### Bed Routine

17. **Finalize plan** — send final plan to Luna (text or image)
18. **Read prompts** — discuss with Luna or mark as reviewed
19. **Read affirmations** — mark as reviewed
20. **Alter Memories meditation** — Luna reads `GET /votes`, filters negative votes, returns them grouped by category for the meditation

---

## 4. The Agents

All agents run inside **OpenClaw** (AI gateway daemon). Each has its own Telegram bot, workspace, and session.

### Agent Summary

| Agent | ID | Bot | Model | Role |
|-------|-----|-----|-------|------|
| 📊 Pulse | `limitless-state` | `@limitless_pulse_bot` | sonnet | Screenshot extraction → data + votes |
| 🌅 Dawn | `morning-checkin` | `@limitless_dawn_bot` | opus | Morning check-in → state + votes |
| 🎨 Muse | `creative-checkin` | `@limitless_muse_bot` | opus | Creative debrief → state + votes |
| ⚡ Forge | `work-session` | `@limitless_forge_bot` | sonnet | Work sessions → scores + votes |
| 🌙 Luna | `night-routine` | `@limitless_luna_bot` | opus | Night routine + planning + vote summary |
| 🤙 Stratos | `stratos` | main bot | sonnet | Builder. Does not participate in daily loop. |

### Agent Read/Write Matrix

Every agent reads and writes exclusively through the file server API (`http://localhost:3001`).

| Agent | Reads (GET) | Writes (POST) |
|-------|-------------|---------------|
| Pulse | — | `/sleep-data`, `/fitmind-data`, `/votes`, `/events` |
| Dawn | `/morning-block-log`, `/sleep-data`, `/fitmind-data` | `/morning-state`, `/votes`, `/events` |
| Muse | `/morning-state`, `/morning-block-log` | `/creative-state`, `/votes`, `/events` |
| Forge | `/work-sessions`, `/morning-state`, `/creative-state` | `/work-sessions/start`, `/work-sessions/end`, `/votes`, `/events`, `/midday-checkin` |
| Luna | `/morning-state`, `/creative-state`, `/work-sessions`, `/votes`, `/night-routine` | `/night-routine`, `/events` |

### Agent Workspaces

Each agent has a workspace with:
- `SOUL.md` — personality, conversation style, full operating instructions, API usage
- `AGENTS.md` — quick reference card

```
~/.openclaw/agents/
├── limitless-state/workspace/     (Pulse)
├── morning-checkin/workspace/     (Dawn)
├── creative-checkin/workspace/    (Muse)
├── work-session/workspace/        (Forge)
└── night-routine/workspace/       (Luna)
```

### Personality Summary

- **Pulse** — minimal sensor. One-line confirmations. Extracts and moves on.
- **Dawn** — warm coach. States what she knows, asks how it felt. Direct, no celebration.
- **Muse** — curious friend. "How was the creative block?" Loose, follows threads.
- **Forge** — sharp training partner. "Session 1. What are we building?" No warmup, no filler.
- **Luna** — calm presence. Reflects on the day, guides the wind-down. Warm but honest.

---

## 5. OpenClaw Configuration

**Config file:** `~/.openclaw/openclaw.json` (chmod 600, never committed to git)

### Multi-Bot Routing

OpenClaw supports multiple Telegram bots through named accounts under `channels.telegram.accounts`. Each account has its own bot token and DM policy. Bindings route messages from each account to the correct agent.

```json
{
  "channels": {
    "telegram": {
      "botToken": "<stratos-token>",
      "accounts": {
        "pulse": { "botToken": "<pulse-token>", "dmPolicy": "allowlist", "allowFrom": ["5345586297"] },
        "dawn":  { "botToken": "<dawn-token>",  "dmPolicy": "allowlist", "allowFrom": ["5345586297"] },
        "muse":  { "botToken": "<muse-token>",  "dmPolicy": "allowlist", "allowFrom": ["5345586297"] },
        "forge": { "botToken": "<forge-token>", "dmPolicy": "allowlist", "allowFrom": ["5345586297"] },
        "luna":  { "botToken": "<luna-token>",  "dmPolicy": "allowlist", "allowFrom": ["5345586297"] }
      }
    }
  },
  "bindings": [
    { "agentId": "stratos",          "match": { "channel": "telegram", "peer": { "kind": "direct", "id": "5345586297" } } },
    { "agentId": "stratos",          "match": { "channel": "telegram", "peer": { "kind": "direct", "id": "8539676437" } } },
    { "agentId": "limitless-state",  "match": { "channel": "telegram", "accountId": "pulse" } },
    { "agentId": "morning-checkin",  "match": { "channel": "telegram", "accountId": "dawn" } },
    { "agentId": "creative-checkin", "match": { "channel": "telegram", "accountId": "muse" } },
    { "agentId": "work-session",     "match": { "channel": "telegram", "accountId": "forge" } },
    { "agentId": "night-routine",    "match": { "channel": "telegram", "accountId": "luna" } }
  ]
}
```

### Session Management

- `session.dmScope: "per-channel-peer"` — each user gets their own session per agent
- `session.reset.mode: "daily", atHour: 3` — all sessions reset at 3am (matches Stef's night owl schedule)
- Agents are also instructed in SOUL.md to ignore old conversation history and treat today's API data as truth

---

## 6. The File Server

**Location:** `~/limitless-app/server/index.js`  
**Port:** 3001  
**Start:** `npm run server` or `npm run dev:all` (both app + server)

### Design Principles

1. **Single write authority** — the ONLY process that writes to `~/.openclaw/data/shared/`
2. **Field whitelisting** — every POST endpoint only accepts known fields (prevents injection)
3. **Deep copy stubs** — uses `structuredClone()` for all stub copies (prevents shared reference bugs)
4. **Idempotent archiving** — day transition archives yesterday's data exactly once
5. **Request logging** — all POST requests logged with timestamp and field keys
6. **Crash protection** — `uncaughtException` and `unhandledRejection` handlers prevent silent death

### All Endpoints

#### Read endpoints (GET)

| Endpoint | Returns |
|----------|---------|
| `GET /health` | `{ ok, uptime, dataDir, files, timestamp }` |
| `GET /morning-block-log` | Today's morning routine interactions |
| `GET /creative-block-log` | Today's creative block status |
| `GET /sleep-data` | Today's sleep data (from Pulse) |
| `GET /fitmind-data` | Today's FitMind data (from Pulse) |
| `GET /morning-state` | Today's morning state (from Dawn) |
| `GET /creative-state` | Today's creative state (from Muse) |
| `GET /work-sessions` | Today's work sessions (from Forge) |
| `GET /votes` | Today's votes (from all agents) |
| `GET /night-routine` | Today's night routine (from Luna) |
| `GET /midday-checkin` | Today's midday check-in (from Forge) |
| `GET /events` | All events (events.jsonl parsed as JSON array) |
| `GET /history` | List of available archive dates |
| `GET /history/:date` | All files for a specific date |
| `GET /history/:date/:file` | Specific file for a specific date |

All GET endpoints return the stub (default shape with nulls) if the file is missing or corrupt. They never crash.

#### Write endpoints (POST)

| Endpoint | Called by | Body | What it does |
|----------|----------|------|-------------|
| `POST /morning-block-log` | App | `{ itemId, status, timestamp }` | Logs card done/skip, recounts |
| `POST /creative-block-log` | App | `{ status, startedAt?, completedAt? }` | Updates creative block state |
| `POST /sleep-data` | Pulse | `{ source, hoursSlept, quality, sleepScore, ... }` | Stores sleep extraction |
| `POST /fitmind-data` | Pulse | `{ source, workoutCompleted, duration, type, score, ... }` | Stores FitMind extraction |
| `POST /morning-state` | Dawn | `{ energyScore, mentalClarity, emotionalState, ... }` | Stores morning check-in |
| `POST /creative-state` | Muse | `{ activities, energyScore, nutritionScore, dopamineQuality, ... }` | Stores creative check-in |
| `POST /work-sessions/start` | Forge | `{ sessionId, focus, evaluationCriteria }` | Starts a work session |
| `POST /work-sessions/end` | Forge | `{ sessionId, outcomes, outcomeScore, flowScore, compositeScore, meal?, nutritionScore? }` | Completes a work session |
| `POST /votes` | All agents | `{ votes: [{ action, category, polarity, source }] }` | Appends validated votes |
| `POST /events` | All agents | `{ events: [{ source, type, payload }] }` | Appends timestamped events |
| `POST /night-routine` | Luna | `{ letGoCompleted?, planCompleted?, tomorrowPlan?, ... }` | Updates night routine items |
| `POST /midday-checkin` | Forge | `{ energyScore, notes, rawNotes }` | Stores optional mid-day check-in |

#### Day Reset Logic

Every POST handler calls `resetForNewDay(fileName, today)`:
1. Read the current file
2. If `data.date !== today` and `data.date !== null`:
   - Call `archiveDay(data.date)` — copies ALL files to `history/YYYY-MM-DD/`
   - `archiveDay` is **idempotent**: skips if the history directory already exists
   - Returns a fresh stub with `date = today`
3. If `data.date === null`: returns a fresh stub
4. If `data.date === today`: returns the existing data (no reset needed)

#### Vote Validation

`POST /votes` validates each vote before storing:
- `category` must be one of: `nutrition`, `work`, `mental-power`, `personality`, `creativity`, `physical`, `relationships`
- `polarity` must be `positive` or `negative` (neutral = don't store)
- `action` must be non-empty
- Invalid votes are silently skipped (not rejected — the valid ones still get stored)
- Each vote gets a server-generated UUID and timestamp

---

## 7. The Shared Data Layer

**Directory:** `~/.openclaw/data/shared/`

### File Ownership

| File | Written by | Read by |
|------|-----------|---------|
| `morning-block-log.json` | App (via file server) | Dawn |
| `creative-block-log.json` | App (via file server) | — |
| `sleep-data.json` | Pulse (via file server) | Dawn, State tab |
| `fitmind-data.json` | Pulse (via file server) | Dawn, State tab |
| `morning-state.json` | Dawn (via file server) | Muse, Forge, Luna, State tab |
| `creative-state.json` | Muse (via file server) | Forge, Luna, State tab |
| `work-sessions.json` | Forge (via file server) | Luna, State tab |
| `votes.json` | Pulse, Dawn, Muse, Forge (via file server) | Luna, Stats tab (future) |
| `night-routine.json` | Luna (via file server) | Luna |
| `midday-checkin.json` | Forge (via file server) | — |
| `events.jsonl` | All agents (via file server) | Analytics (future) |

### Data Schemas

**morning-block-log.json**
```json
{
  "date": "2026-02-20",
  "startedAt": "2026-02-20T07:15:00.000Z",
  "completedAt": null,
  "items": [
    { "id": "sleep-screenshot", "status": "done", "timestamp": "2026-02-20T07:16:00.000Z" },
    { "id": "journaling", "status": "skipped", "timestamp": "2026-02-20T07:46:00.000Z" }
  ],
  "completedCount": 8,
  "skippedCount": 1
}
```

**sleep-data.json**
```json
{
  "date": "2026-02-20",
  "createdAt": "2026-02-20T07:20:00.000Z",
  "source": "sleep-cycle-screenshot",
  "hoursSlept": 7.5,
  "quality": "good",
  "sleepScore": 82,
  "wakeUpMood": "refreshed",
  "notes": "consistent deep sleep phases",
  "rawExtracted": { "deepSleep": "1h42m", "rem": "2h10m" }
}
```

**fitmind-data.json**
```json
{
  "date": "2026-02-20",
  "createdAt": "2026-02-20T08:45:00.000Z",
  "source": "fitmind-screenshot",
  "workoutCompleted": true,
  "duration": "20min",
  "type": "focus-training",
  "score": 88,
  "notes": ""
}
```

**morning-state.json**
```json
{
  "date": "2026-02-20",
  "createdAt": "2026-02-20T09:30:00.000Z",
  "updatedAt": "2026-02-20T09:30:00.000Z",
  "energyScore": 8,
  "mentalClarity": 7,
  "emotionalState": "grounded",
  "insights": ["Noticed resistance during visualization"],
  "dayPriority": "Creative block first, Caldera proposals later",
  "resistanceNoted": true,
  "resistanceDescription": "Visualization kept slipping into task-mode",
  "overallMorningScore": 7.5,
  "rawNotes": "Conversation summary"
}
```

**creative-state.json**
```json
{
  "date": "2026-02-20",
  "createdAt": "2026-02-20T13:00:00.000Z",
  "updatedAt": "2026-02-20T13:00:00.000Z",
  "activities": ["design exploration", "reading"],
  "energyScore": 7,
  "creativeOutput": "HyperSpace visual direction explored",
  "insights": ["Gravitate to monochrome when thinking about identity"],
  "nutrition": { "logged": true, "meal": "eggs, coffee, fruit", "notes": "light, felt good" },
  "nutritionScore": 8,
  "dopamineQuality": 8,
  "moodShift": "started flat, ended energized",
  "rawNotes": "Summary"
}
```

**work-sessions.json**
```json
{
  "date": "2026-02-20",
  "sessions": [
    {
      "id": 1,
      "startedAt": "2026-02-20T13:30:00.000Z",
      "endedAt": "2026-02-20T15:00:00.000Z",
      "durationMinutes": 90,
      "focus": "HyperSpace landing page",
      "evaluationCriteria": "Ship working hero section + test on mobile",
      "outcomes": "Hero section shipped, responsive on all breakpoints",
      "outcomeScore": 8,
      "flowScore": 7,
      "compositeScore": 7.6,
      "meal": null,
      "nutritionScore": null,
      "notes": ""
    }
  ],
  "totalSessions": 3,
  "completedSessions": 1,
  "lunchBreakLogged": false,
  "lunchMeal": null,
  "lunchNutritionScore": null
}
```

**votes.json**
```json
{
  "date": "2026-02-20",
  "votes": [
    {
      "id": "uuid",
      "timestamp": "2026-02-20T07:20:00.000Z",
      "action": "Slept 7.5h, score 82",
      "category": "physical",
      "polarity": "positive",
      "source": "limitless-state",
      "weight": 1
    },
    {
      "id": "uuid",
      "timestamp": "2026-02-20T09:30:00.000Z",
      "action": "8/9 morning block completed",
      "category": "work",
      "polarity": "positive",
      "source": "morning-checkin",
      "weight": 1
    }
  ]
}
```

**night-routine.json**
```json
{
  "date": "2026-02-20",
  "startedAt": "2026-02-20T22:00:00.000Z",
  "completedAt": "2026-02-20T23:30:00.000Z",
  "letGoCompleted": true,
  "letGoTimestamp": "2026-02-20T22:15:00.000Z",
  "nervousSystemCompleted": true,
  "nervousSystemTimestamp": "2026-02-20T22:30:00.000Z",
  "planCompleted": true,
  "planTimestamp": "2026-02-20T23:00:00.000Z",
  "tomorrowPlan": "Morning: creative block focus on HyperSpace branding. Sessions: 1) landing page, 2) client proposals, 3) LinkedIn outreach.",
  "promptsReviewed": true,
  "promptsTimestamp": "2026-02-20T23:15:00.000Z",
  "affirmationsReviewed": true,
  "affirmationsTimestamp": "2026-02-20T23:20:00.000Z",
  "alterMemoriesCompleted": true,
  "alterMemoriesTimestamp": "2026-02-20T23:30:00.000Z"
}
```

**midday-checkin.json**
```json
{
  "date": "2026-02-20",
  "triggeredAt": "2026-02-20T15:15:00.000Z",
  "energyScore": 6,
  "notes": "Lunch was heavy, feeling slow. Need to move before session 3.",
  "rawNotes": ""
}
```

**creative-block-log.json**
```json
{
  "date": "2026-02-20",
  "startedAt": "2026-02-20T10:00:00.000Z",
  "completedAt": "2026-02-20T13:00:00.000Z",
  "status": "completed"
}
```

**events.jsonl** (one JSON object per line, append-only)
```jsonl
{"timestamp":"2026-02-20T09:30:00Z","source":"morning-checkin","type":"morning_completed","payload":{"date":"2026-02-20","overallMorningScore":7.5}}
{"timestamp":"2026-02-20T13:00:00Z","source":"creative-checkin","type":"creative_block_completed","payload":{"date":"2026-02-20","energyScore":7}}
{"timestamp":"2026-02-20T15:00:00Z","source":"work-session","type":"session_completed","payload":{"sessionId":1,"compositeScore":7.6}}
```

---

## 8. The Vote System

Every agent (except Luna) emits votes after each session. Votes are the raw signal of the day — labeled actions with clear positive or negative polarity, organized by category.

### Vote Categories

| Category | What it tracks |
|----------|---------------|
| `nutrition` | Meal quality, eating habits |
| `work` | Task completion, output quality |
| `mental-power` | Focus, flow, mental training, dopamine quality |
| `personality` | Resistance faced, growth signals |
| `creativity` | Creative output, creative risk |
| `physical` | Sleep, exercise, physical state |
| `relationships` | Social interactions (future) |

### Who Emits What

| Agent | Vote Categories |
|-------|----------------|
| Pulse | `physical` (sleep quality, hours), `mental-power` (FitMind completion) |
| Dawn | `work` (morning block completion), `mental-power` (energy level), `personality` (resistance faced) |
| Muse | `nutrition` (meal quality), `mental-power` (dopamine quality), `creativity` (creative output) |
| Forge | `work` (outcome score), `mental-power` (flow score), `nutrition` (session meal) |
| Luna | **Does not emit votes** — reads and surfaces them |

### Vote Rules

- **Neutral = skip.** Don't store neutral votes. They add noise.
- Polarity is binary: `positive` or `negative`. No middle ground.
- `weight` defaults to 1. Future: some actions will have higher weight.
- Luna surfaces negative votes for the Alter Memories meditation at bedtime.

---

## 9. The State Metric

The State tab shows four sub-metrics and one composed STATE score.

### Four Pillars

| Metric | Weight | Data Sources |
|--------|--------|-------------|
| **Sleep** | 30% | `sleep-data.json` → hoursSlept (60%) + sleepScore (40%) |
| **Dopamine** | 25% | FitMind score + morning completion rate + `dopamineQuality` from Muse + work session flowScores |
| **Mood** | 25% | Dawn's emotionalState tag + energyScore + Muse's energyScore |
| **Nutrition** | 20% | `nutritionScore` from Muse + work session nutritionScores (averaged) |

**STATE = weighted average of available sub-metrics.** If a sub-metric has no data, its weight is redistributed among the others.

### Visual Layout

```
┌───────────────────────────┐
│  STATE                    │
│                           │
│  ┌───┐  Sleep     ████ 8.2│
│  │███│  Nutrition  ███ 7.0│
│  │███│  Dopamine  ████ 7.8│
│  │ 7.6│  Mood      ███ 7.5│
│  └───┘                    │
│                           │
│  😴 7.5h  🧠 88  ⚡ 8/9   │
│  🎯 7.5   grounded        │
│                           │
│  "Creative block first,   │
│   Caldera in afternoon"   │
└───────────────────────────┘
```

- Left: vertical STATE bar with composite score
- Right: 4 horizontal mini-bars for each pillar
- Bottom: stat pills + day priority from Dawn
- Color: blue (low) → green (mid) → warm (high)

---

## 10. The React App

**Location:** `~/limitless-app/`  
**Port:** 3000  
**Stack:** Vite + React 18 + Tailwind CSS + Framer Motion

### Navigation

4 tabs via bottom nav:
- 🌅 **Today** — morning cards → completion → creative block (→ work sessions, night routine: future)
- 📊 **State** — 4-pillar energy bar + stat pills
- 🏅 **Badges** — placeholder (future)
- ⚡ **Stats** — placeholder (future)

### Morning Routine Cards

| # | ID | Title | Pulse Button |
|---|-----|-------|:---:|
| 1 | `sleep-screenshot` | 📸 Sleep Cycle | ✅ |
| 2 | `morning-reading` | 📖 Morning Reading | — |
| 3 | `journaling` | ✍️ Journaling | — |
| 4 | `review-plan` | 📋 Review Plan | — |
| 5 | `sunlight-walk` | ☀️ Sunlight Walk | — |
| 6 | `fitmind` | 🧠 FitMind | ✅ |
| 7 | `shower` | 🚿 Cold Shower | — |
| 8 | `visualization` | 🎯 Visualization | — |
| 9 | `write-values` | 🔥 Write Values | — |

**Card mechanics:**
- Cards shown one at a time. Must complete in order.
- DONE: hold button 1 second → SVG circle fills → card slides out left, next slides in right
- Skip: instant, same animation
- Progress bar at top

### State Management

**localStorage** for instant UX (keys: `limitless_morning_statuses`, `limitless_current_view`, `limitless_creative_block_start`, `limitless_last_reset`).

**Reconciliation on mount:** app fetches `GET /api/morning-block-log` and merges server state into localStorage. Server is the source of truth.

**Daily reset at 3am:** if `hour >= 3` and `lastReset !== today`, clear all localStorage state.

### Source Files

```
src/
├── App.jsx                   ← root state, localStorage, tab routing, reconciliation
├── main.jsx                  ← React entry point
├── index.css                 ← Tailwind imports + base reset
├── components/
│   ├── BottomNav.jsx         ← 4-tab navigation
│   ├── MorningRoutine.jsx    ← card flow orchestrator + AnimatePresence
│   ├── HabitCard.jsx         ← single card: hold-to-confirm, skip, Pulse deep-link
│   ├── CompletionScreen.jsx  ← post-morning summary + Dawn deep-link
│   ├── CreativeBlock.jsx     ← timer + Muse deep-link
│   ├── StateTab.jsx          ← 4-pillar energy bar + score calculation
│   └── PlaceholderTab.jsx    ← Badges/Stats placeholder
└── data/
    └── morningRoutine.js     ← the 9 morning items config
```

---

## 11. Telegram Deep Links

| Button | URL | Location |
|--------|-----|----------|
| 📲 Open Pulse → | `t.me/limitless_pulse_bot` | Sleep Cycle card, FitMind card |
| 💬 Log Morning → | `t.me/limitless_dawn_bot` | Completion screen |
| 💬 Check In → | `t.me/limitless_muse_bot` | Creative block view |

Forge and Luna are opened by DM-ing them directly (no deep-link from app yet).

---

## 12. Infrastructure

### Running the System

```bash
# Start OpenClaw (agents)
openclaw gateway start

# Start app + file server
cd ~/limitless-app
npm run dev:all
# → App: http://localhost:3000
# → File server: http://localhost:3001

# Or individually:
npm run dev      # Vite only
npm run server   # File server only
```

### Integration Tests

```bash
# Requires file server running
cd ~/limitless-app
npm run server &
bash scripts/test-integrations.sh
# Currently: 68/68 passing
```

Tests cover: all GET/POST endpoints, field injection blocking, vote validation, data layer integrity, agent workspaces, bot tokens, config security, backup infrastructure.

### Historical Snapshots

When a new day triggers a reset, yesterday's data is archived:

```
~/.openclaw/data/shared/history/
├── 2026-02-19/
│   ├── morning-block-log.json
│   ├── sleep-data.json
│   ├── votes.json
│   └── ... (all 10 files)
├── 2026-02-20/
│   └── ...
```

- Archives are idempotent (only created once per date)
- Pruned after 90 days
- Queryable: `GET /history` (list dates), `GET /history/:date` (all files), `GET /history/:date/:file`

### Daily Backup Cron

OpenClaw cron job runs at 11pm EST: copies entire `~/.openclaw/data/shared/` to `~/.openclaw/data/backups/YYYY-MM-DD/`. Keeps last 30 days.

### Security

- `~/.openclaw/openclaw.json` is `chmod 600` — contains bot tokens and API keys
- File server has no authentication — only accessible locally (port 3001 never exposed)
- Cloudflare tunnel points at port 3000 only — file server is proxied via Vite (`/api/*`)
- Bot tokens are **never** in the git repo

---

## 13. Night / Bed Routine Reference

### Night Routine

| # | ID | Description |
|---|-----|-------------|
| 1 | `letting-go` | 🌊 Letting Go meditation |
| 2 | `nervous-system` | 🧘 Regulate nervous system |
| 3 | `plan-tomorrow` | 📋 Plan tomorrow (real dialogue with Luna) |

### Bed Routine

| # | ID | Description |
|---|-----|-------------|
| 1 | `finalize-plan` | ✅ Send final plan to Luna (text or image) |
| 2 | `read-prompts` | ❓ Read prompts (can discuss with Luna) |
| 3 | `affirmations` | 🔥 Read affirmations |
| 4 | `alter-memories` | 🧠 Alter Memories (Luna provides negative votes) |

---

## 14. Build Status

| Component | Status |
|-----------|--------|
| Shared data layer (11 files) | ✅ |
| File server (all endpoints, validation, archiving) | ✅ |
| Pulse agent (screenshot → data + votes via API) | ✅ |
| Dawn agent (morning check-in → state + votes via API) | ✅ |
| Muse agent (creative debrief → state + votes via API) | ✅ |
| Forge agent (work sessions → scores + votes via API) | ✅ |
| Luna agent (night routine + planning + vote summary via API) | ✅ |
| All 6 Telegram bots wired | ✅ |
| App: morning routine cards (correct order) | ✅ |
| App: creative block view | ✅ |
| App: State tab (4 pillars + composite) | ✅ |
| Vite proxy (/api/* → :3001) | ✅ |
| App state reconciliation on mount | ✅ |
| Integration tests (68/68) | ✅ |
| Historical snapshots + /history endpoints | ✅ |
| Daily backup cron (11pm EST) | ✅ |
| Security (chmod 600, field whitelisting) | ✅ |
| Request logging + crash protection | ✅ |
| Health endpoint | ✅ |
| Dawn + Muse + Luna on opus | ✅ |
| Daily session reset at 3am | ✅ |
| App: deep work session UI | ⬜ TODO |
| App: night/bed routine UI | ⬜ TODO |
| App: Stats tab (vote history) | ⬜ TODO |
| App: Badges tab | ⬜ TODO |
| Cloudflare tunnel (phone access) | ⬜ Needs Stef |

---

## 15. Key File Reference

| File | Purpose |
|------|---------|
| `~/.openclaw/openclaw.json` | OpenClaw config — agents, bots, bindings, auth |
| `~/.openclaw/data/shared/` | Shared data directory — the system's "database" |
| `~/.openclaw/data/shared/history/` | Daily archives |
| `~/.openclaw/data/backups/` | Nightly full backups |
| `~/.openclaw/agents/*/workspace/SOUL.md` | Agent instructions |
| `~/limitless-app/` | App + file server source |
| `~/limitless-app/server/index.js` | The file server (single write authority) |
| `~/limitless-app/src/data/morningRoutine.js` | The 9 morning items — edit to change routine |
| `~/limitless-app/scripts/test-integrations.sh` | Integration test suite |
| `~/limitless-app/DOCS.md` | This file |
| `~/limitless-app/PLAN.md` | Execution plan + open questions |
