# Limitless System — Architecture Documentation

**Last updated:** 2026-02-20  
**Built by:** Stratos  
**Repo:** github.com/stratosokaramanis-droid/limitless-app

---

## The Big Picture

Limitless is a personal daily operating system. It tracks Stef's morning routine, creative block, and mental state — combining a mobile web app with AI agents on Telegram.

The core architecture is unusual: **there is no traditional backend database**. Instead, the system uses a set of **shared JSON files** on the local machine as its single source of truth. Every component — the React app, the AI agents, and the file server — reads from and writes to these files.

```
                      ┌─────────────────────────────────┐
                      │         STEF'S PHONE             │
                      │                                  │
                      │  ┌────────────────┐              │
                      │  │  Limitless App │              │
                      │  │  (PWA, mobile) │              │
                      │  └───────┬────────┘              │
                      │          │ via Cloudflare tunnel  │
                      └──────────┼──────────────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │   Express File Server      │
                    │   localhost:3001           │
                    │   (read/write bridge)      │
                    └────────────┬──────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │   SHARED DATA LAYER        │
                    │   ~/.openclaw/data/shared/ │
                    │                            │
                    │   *.json + events.jsonl    │
                    └────┬───────────────────────┘
                         │
        ┌────────────────┼──────────────────┐
        │                │                  │
   ┌────▼────┐     ┌─────▼─────┐     ┌─────▼─────┐
   │  Pulse  │     │   Dawn    │     │   Muse    │
   │Telegram │     │ Telegram  │     │ Telegram  │
   │  agent  │     │  agent    │     │  agent    │
   └─────────┘     └───────────┘     └───────────┘
```

The three Telegram agents and the React app never talk to each other directly. They communicate exclusively through the shared JSON files — the agents write state data, the app reads it; the app writes interaction data, the agents read it.

---

## How a Typical Day Works

Understanding the **flow** is the fastest way to understand the architecture.

### 1. Morning Routine (App)
Stef opens the Limitless app on his phone. The **Today tab** shows his morning routine as a sequence of cards — one at a time. He holds each card to mark it done, or taps skip.

- On each interaction, the app **POSTs to the file server** (localhost:3001)
- The file server **writes to** `morning-block-log.json`

### 2. Screenshots (App → Pulse)
Two of the morning cards — Sleep Cycle and FitMind — have a "📲 Open Pulse →" button. Stef taps it, Telegram opens, and he's in the **Pulse bot** chat. He takes a screenshot of each app and sends it there.

- **Pulse** receives the screenshot, uses vision to extract the data
- Pulse **writes to** `sleep-data.json` or `fitmind-data.json`

### 3. Morning Check-In (App → Dawn)
When all 9 morning cards are done/skipped, the app shows a completion screen with a "💬 Log Morning →" button. This deep-links directly to the **Dawn bot** on Telegram.

- **Dawn** reads `morning-block-log.json`, `sleep-data.json`, `fitmind-data.json`
- Dawn opens with a single-line summary: *"8/9 done, skipped journaling. Sleep looked solid. How did it feel?"*
- Dawn runs a short, focused conversation (energy, mental clarity, insights, resistance, day priority)
- Dawn **writes to** `morning-state.json`
- Dawn appends a `morning_completed` event to `events.jsonl`

### 4. Creative Block (App)
After the morning routine, Stef enters the creative block view. He taps "Start Block" — a timer starts. He has 3 hours of free creative time.

- The app writes the start time to `creative-block-log.json` (via file server)

### 5. Creative Check-In (App → Muse)
When the creative block ends (or whenever he feels like it), Stef taps "💬 Check In →". This opens the **Muse bot** on Telegram.

- **Muse** reads `morning-state.json` and `morning-block-log.json` for context
- Muse opens loose: *"How was the creative block?"*
- Muse extracts: activities, energy, meals, creative output, mood shift
- Muse **writes to** `creative-state.json`
- Muse appends a `creative_block_completed` event to `events.jsonl`

### End of day
All state from the day is stored in the shared JSON files. The app's **State tab** (Step 9, TODO) will read this data and display gauges, scores, and trends.

---

## Components

### 1. The App (`~/limitless-app`)

React PWA served locally on port 3000. Accessed from Stef's phone via Cloudflare tunnel.

**Tech stack:** Vite + React 18 + Tailwind CSS + Framer Motion  
**No TypeScript.** Plain JavaScript throughout.

**Key characteristics:**
- Mobile-first (max-width 430px, centered on desktop)
- Dark theme: `#0A0A0A` background, `#141414` cards, `#E8E8E8` accent
- No backend of its own — all data reads/writes go through the file server on port 3001
- State persists in `localStorage` between sessions
- Auto-resets at 3am daily (for Stef's night owl schedule)

**Navigation:** 4 tabs via bottom nav
- 🌅 **Today** — active daily flow (morning cards → creative block)
- 📊 **State** — data dashboard (Step 9, TODO)
- 🏅 **Badges** — skill tree (future)
- ⚡ **Stats** — vote history (future)

**Morning routine card mechanics:**
- Cards shown one at a time, must complete in order
- DONE: hold button for 1 second → SVG circle fills → card slides out left, next slides in right
- Skip: instant, same animation
- Progress bar at top of each card

**localStorage state:**

| Key | Value | Reset |
|-----|-------|-------|
| `limitless_morning_statuses` | `{ [itemId]: "done" \| "skipped" }` | 3am |
| `limitless_current_view` | `"morning-routine" \| "completed" \| "creative-block"` | 3am |
| `limitless_creative_block_start` | Unix timestamp (ms) | 3am |
| `limitless_last_reset` | `"YYYY-MM-DD"` | Never |

**Source files:**

```
src/
├── App.jsx                   ← root state + localStorage + tab routing
├── main.jsx                  ← React entry point
├── index.css                 ← Tailwind + base reset
├── components/
│   ├── BottomNav.jsx         ← 4-tab nav
│   ├── MorningRoutine.jsx    ← card flow orchestrator + AnimatePresence
│   ├── HabitCard.jsx         ← single card: hold-to-confirm, skip, Pulse button
│   ├── CompletionScreen.jsx  ← post-morning: counts + Dawn deep-link
│   ├── CreativeBlock.jsx     ← timer + Muse deep-link
│   └── PlaceholderTab.jsx    ← State/Badges/Stats placeholder
└── data/
    └── morningRoutine.js     ← the 9 morning items (edit here to change routine)
```

**Morning routine items** (defined in `morningRoutine.js`):

| # | ID | Title | Has Pulse Button |
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

---

### 2. The File Server (`~/limitless-app/server/index.js`)

Express server on port 3001. **This is the only bridge between the app and the shared data layer.**

The React app (port 3000) cannot directly read/write files on the host machine — browsers can't do filesystem access. The file server solves this: it exposes the shared JSON files as HTTP endpoints that the app can fetch.

**CORS is open** (any origin can hit port 3001). This is fine — the machine is not public-facing, and all traffic comes through the Cloudflare tunnel which is authenticated.

**Endpoints:**

| Method | Path | File | Notes |
|--------|------|------|-------|
| GET | `/morning-block-log` | `morning-block-log.json` | Returns stub if missing |
| GET | `/creative-block-log` | `creative-block-log.json` | Returns stub if missing |
| GET | `/sleep-data` | `sleep-data.json` | Returns stub if missing |
| GET | `/fitmind-data` | `fitmind-data.json` | Returns stub if missing |
| GET | `/morning-state` | `morning-state.json` | Returns stub if missing |
| GET | `/creative-state` | `creative-state.json` | Returns stub if missing |
| GET | `/events` | `events.jsonl` | Parsed as JSON array |
| POST | `/morning-block-log` | `morning-block-log.json` | Updates item, recounts |
| POST | `/creative-block-log` | `creative-block-log.json` | Merges body into file |

**POST /morning-block-log logic:**
1. Read current file (or stub if missing)
2. If `data.date !== today`: reset to fresh stub with `date = today`, `startedAt = now`
3. Find item by `itemId` — update if exists, push if new
4. Recount `completedCount` and `skippedCount`
5. Write back to file, return `{ ok: true }`

**Error handling:** Every file read is wrapped in try/catch. Missing file or bad JSON returns the stub shape — the server never crashes on bad data.

---

### 3. The Shared Data Layer (`~/.openclaw/data/shared/`)

This directory is the system's database. It is the single source of truth for all state. Both the agents (via direct file access) and the app (via the file server) read and write here.

**Files and ownership:**

| File | Written by | Read by | Resets |
|------|-----------|---------|--------|
| `morning-block-log.json` | App (via file server) | Dawn | Daily (file server logic) |
| `creative-block-log.json` | App (via file server) | Muse | Daily |
| `sleep-data.json` | Pulse | Dawn | On new screenshot |
| `fitmind-data.json` | Pulse | Dawn | On new screenshot |
| `morning-state.json` | Dawn | Muse, State tab | Daily |
| `creative-state.json` | Muse | State tab | Daily |
| `events.jsonl` | Dawn, Muse | Analytics | Never (append-only) |

**Data schemas:**

**morning-block-log.json**
```json
{
  "date": "2026-02-20",
  "startedAt": "2026-02-20T07:15:00.000Z",
  "completedAt": "2026-02-20T09:00:00.000Z",
  "items": [
    { "id": "sleep-screenshot", "status": "done", "timestamp": "2026-02-20T07:16:00.000Z" },
    { "id": "journaling", "status": "skipped", "timestamp": "2026-02-20T07:46:00.000Z" }
  ],
  "completedCount": 8,
  "skippedCount": 1
}
```

**sleep-data.json** (written by Pulse from Sleep Cycle screenshot)
```json
{
  "date": "2026-02-20",
  "source": "sleep-cycle-screenshot",
  "hoursSlept": 7.5,
  "quality": "good",
  "sleepScore": 82,
  "wakeUpMood": "refreshed",
  "notes": "consistent deep sleep phases",
  "rawExtracted": {}
}
```

**fitmind-data.json** (written by Pulse from FitMind screenshot)
```json
{
  "date": "2026-02-20",
  "source": "fitmind-screenshot",
  "workoutCompleted": true,
  "duration": "20min",
  "type": "focus-training",
  "score": 88,
  "notes": ""
}
```

**morning-state.json** (written by Dawn after check-in conversation)
```json
{
  "date": "2026-02-20",
  "energyScore": 8,
  "mentalClarity": 7,
  "emotionalState": "grounded",
  "insights": ["Noticed resistance during visualization"],
  "dayPriority": "Creative block first, Caldera proposals later",
  "resistanceNoted": true,
  "resistanceDescription": "Visualization kept slipping into task-mode",
  "overallMorningScore": 7.5,
  "rawNotes": "free-form conversation summary"
}
```

**creative-state.json** (written by Muse after check-in conversation)
```json
{
  "date": "2026-02-20",
  "activities": ["design exploration", "reading"],
  "energyScore": 7,
  "creativeOutput": "Explored HyperSpace visual direction",
  "insights": ["Gravitate to monochrome when thinking about identity"],
  "nutrition": {
    "logged": true,
    "meal": "eggs, coffee, fruit",
    "notes": "light, felt good"
  },
  "moodShift": "started flat, ended energized",
  "rawNotes": "conversation summary"
}
```

**creative-block-log.json**
```json
{
  "date": "2026-02-20",
  "startedAt": "2026-02-20T10:00:00.000Z",
  "completedAt": null,
  "status": "in_progress"
}
```

**events.jsonl** (append-only, one JSON object per line)
```jsonl
{"timestamp":"2026-02-20T09:05:00.000Z","source":"morning-checkin","type":"morning_completed","payload":{"date":"2026-02-20","overallMorningScore":7.5,"resistanceNoted":true}}
{"timestamp":"2026-02-20T13:15:00.000Z","source":"creative-checkin","type":"creative_block_completed","payload":{"date":"2026-02-20","energyScore":7,"nutritionLogged":true}}
```

---

### 4. The Agents (OpenClaw + Telegram)

All agents run inside **OpenClaw** — an AI gateway running as a daemon on the local machine. OpenClaw manages Telegram connections, routing, and agent sessions.

Each agent has:
- Its own **Telegram bot** (separate bot token, separate chat)
- Its own **workspace** with `SOUL.md` (personality) and `AGENTS.md` (operating instructions)
- Its own **session history** (per-agent, isolated)

**OpenClaw config:** `~/.openclaw/openclaw.json`

---

#### Pulse (`limitless-state`)
- **Telegram:** `@limitless_pulse_bot`
- **Workspace:** `~/.openclaw/agents/limitless-state/workspace/`
- **Trigger:** User sends a screenshot (Sleep Cycle or FitMind) to the bot
- **Reads:** The screenshot image (via Telegram media)
- **Writes:** `sleep-data.json` or `fitmind-data.json`
- **Personality:** Minimal. Pulse is a sensor, not a conversationalist. It extracts, confirms, done.

**What Pulse does on a screenshot:**
1. Identifies which app the screenshot is from
2. Extracts the relevant metrics using vision
3. Writes structured JSON to the correct file in `~/.openclaw/data/shared/`
4. Sends a brief confirmation to the user

---

#### Dawn (`morning-checkin`)
- **Telegram:** `@limitless_dawn_bot`
- **Workspace:** `~/.openclaw/agents/morning-checkin/workspace/`
- **Trigger:** User taps "💬 Log Morning →" from the app completion screen
- **Reads:** `morning-block-log.json`, `sleep-data.json`, `fitmind-data.json`
- **Writes:** `morning-state.json`, appends to `events.jsonl`
- **Personality:** Warm coach. Direct, no fluff. Knows what you did, wants to know how it landed.

**What Dawn does on session start:**
1. Reads all three input files
2. Opens with one sentence: context summary + invitation (*"8/9 done, skipped journaling. How did it feel?"*)
3. Runs targeted conversation — energy, mental clarity, visualization, resistance, day priority, fire level
4. Writes structured `morning-state.json`
5. Appends event to `events.jsonl`

**Dawn's conversation areas (used as judgment guide, not a script):**
1. Energy read (1-10 + what's behind it)
2. Mental quality (sharp vs foggy)
3. Visualization (landed or flat)
4. What surfaced (insights, recurring thoughts)
5. Resistance (anything avoided or pushed through)
6. Day priority (the one thing that matters)
7. State of the fire (high / low / warming up)

---

#### Muse (`creative-checkin`)
- **Telegram:** `@limitless_muse_bot`
- **Workspace:** `~/.openclaw/agents/creative-checkin/workspace/`
- **Trigger:** User taps "💬 Check In →" from the creative block view
- **Reads:** `morning-state.json`, `morning-block-log.json`
- **Writes:** `creative-state.json`, appends to `events.jsonl`
- **Personality:** Relaxed, curious, slightly playful. Matches creative block energy. No agenda.

**What Muse does on session start:**
1. Reads context files
2. Opens loose: *"How was the creative block?"* — nothing more
3. Follows the thread, probes when interesting
4. Extracts: activities, energy, meals (if mentioned), creative output, mood shift
5. Writes `creative-state.json`
6. Appends event to `events.jsonl`

---

#### Stratos (main agent)
- **Telegram:** Main bot (separate from Limitless bots)
- **Workspace:** `~/.openclaw/workspace/`
- **Bound to:** Direct DMs from Stef (5345586297) and Giannis (8539676437)
- **Role:** Builder. Does **not** participate in the Limitless daily loop. Builds and maintains the system.

---

### 5. OpenClaw Routing

OpenClaw uses a **binding** system to route inbound Telegram messages to the correct agent.

**How routing works:**
- Each Telegram bot has a unique token → registered as a separate `accountId` in config
- Bindings match on `channel + accountId` (or `channel + peer.id` for direct DMs)
- Most-specific match wins

**Current bindings:**

| Inbound | Routes to | Match type |
|---------|-----------|------------|
| DM to Stratos bot from Stef | `stratos` | `peer.id: 5345586297` |
| DM to Stratos bot from Giannis | `stratos` | `peer.id: 8539676437` |
| Any DM to Pulse bot | `limitless-state` | `accountId: "pulse"` |
| Any DM to Dawn bot | `morning-checkin` | `accountId: "dawn"` |
| Any DM to Muse bot | `creative-checkin` | `accountId: "muse"` |

**Config structure (simplified):**
```json
{
  "agents": {
    "list": [
      { "id": "stratos", "workspace": "~/.openclaw/workspace" },
      { "id": "limitless-state", "workspace": "~/.openclaw/agents/limitless-state/workspace" },
      { "id": "morning-checkin", "workspace": "~/.openclaw/agents/morning-checkin/workspace" },
      { "id": "creative-checkin", "workspace": "~/.openclaw/agents/creative-checkin/workspace" }
    ]
  },
  "channels": {
    "telegram": {
      "botToken": "<stratos-token>",
      "accounts": {
        "pulse": { "botToken": "<pulse-token>" },
        "dawn":  { "botToken": "<dawn-token>" },
        "muse":  { "botToken": "<muse-token>" }
      }
    }
  },
  "bindings": [
    { "agentId": "stratos", "match": { "channel": "telegram", "peer": { "kind": "direct", "id": "5345586297" } } },
    { "agentId": "stratos", "match": { "channel": "telegram", "peer": { "kind": "direct", "id": "8539676437" } } },
    { "agentId": "limitless-state", "match": { "channel": "telegram", "accountId": "pulse" } },
    { "agentId": "morning-checkin",  "match": { "channel": "telegram", "accountId": "dawn" } },
    { "agentId": "creative-checkin", "match": { "channel": "telegram", "accountId": "muse" } }
  ]
}
```

---

## Telegram Deep Links

The app uses Telegram deep links to drop the user directly into the right bot chat. No copying usernames, no searching — one tap.

| Button | URL | In app |
|--------|-----|--------|
| 📲 Open Pulse → | `https://t.me/limitless_pulse_bot` | Sleep Cycle card, FitMind card |
| 💬 Log Morning → | `https://t.me/limitless_dawn_bot` | Completion screen |
| 💬 Check In → | `https://t.me/limitless_muse_bot` | Creative block view |

---

## Running the System

### Start everything
```bash
# Terminal 1: OpenClaw agents (if not already running as service)
openclaw gateway start

# Terminal 2: App + file server
cd ~/limitless-app
npm run dev:all
# → App: http://localhost:3000
# → File server: http://localhost:3001
```

### Start individually
```bash
npm run dev      # Vite dev server only (port 3000)
npm run server   # File server only (port 3001)
```

### Check OpenClaw status
```bash
openclaw gateway status
openclaw agents list --bindings
```

### Build app for production
```bash
cd ~/limitless-app
npm run build
# Output in dist/ — point Cloudflare tunnel at the built files
```

---

## Build Status

| Step | Description | Status |
|------|-------------|--------|
| 1 | Shared data directory + JSON stubs | ✅ Done |
| 2 | Pulse agent (screenshot → JSON) | ✅ Done |
| 3 | Dawn agent (morning check-in) | ✅ Done |
| 4 | Muse agent (creative check-in) | ✅ Done |
| 5 | App scaffold (Vite + React + Tailwind + nav) | ✅ Done |
| 6 | Morning routine interactive cards (correct order) | ✅ Done |
| 7 | Creative block view | ✅ Done |
| 8 | Express file server (port 3001) + historical snapshots | ✅ Done |
| 9 | State tab — vertical energy bar | 🔄 Building |
| 10 | Telegram deep links | ✅ Done |
| 11 | Cloudflare tunnel (mobile access) | ⬜ Needs Stef |
| — | Vite proxy (/api/* → localhost:3001) | ✅ Done |
| — | Integration test suite (41/41 passing) | ✅ Done |
| — | Daily backup cron (11pm EST) | ✅ Done |
| — | Security: openclaw.json chmod 600 | ✅ Done |
| — | Dawn + Muse → opus model | ⬜ Pending restart |
| — | Dawn + Muse daily session reset | ⬜ Pending restart |

---

## What's NOT in Scope Yet

- **State tab content** — energy/sleep/mood gauges, 7-day trend (Step 9)
- **Badges tab** — skill tree, XP, active missions
- **Stats tab** — vote history, work sessions, streaks
- **Nightly summaries** — end-of-day agent run
- **Vote casting** — connecting morning routine completions to the broader game system
- **Afternoon/evening blocks** — additional daily phases
- **Badge mission delivery** — the agent-delivered challenge system

These all get designed on top of the morning + creative block foundation once that's running in real life.

---

## Key File Reference

| File | What it is |
|------|-----------|
| `~/.openclaw/openclaw.json` | OpenClaw config — agents, bots, bindings, auth |
| `~/.openclaw/data/shared/` | The shared data directory — system's database |
| `~/.openclaw/agents/limitless-state/workspace/SOUL.md` | Pulse instructions |
| `~/.openclaw/agents/morning-checkin/workspace/SOUL.md` | Dawn instructions |
| `~/.openclaw/agents/creative-checkin/workspace/SOUL.md` | Muse instructions |
| `~/.openclaw/archive/agents/` | Archived old agents (Nexus, Forge, Mirror, Oracle, Engine, Sensei) |
| `~/limitless-app/` | React app + file server source |
| `~/limitless-app/src/data/morningRoutine.js` | The 9 morning items — edit here to change routine |
| `~/limitless-app/server/index.js` | Express file server |
| `~/limitless-app/DOCS.md` | This file |
