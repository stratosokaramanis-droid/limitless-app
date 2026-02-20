# Limitless System — Full Documentation

**Last updated:** 2026-02-20  
**Status:** Steps 1–7 complete (data layer, agents, app scaffold)  
**Built by:** Stratos

---

## 0. What This Is

Limitless is a personal operating system for Stef's daily routine. It combines:

- A **React PWA** (the app) — morning routine card flow, creative block tracker, navigation shell
- **AI agents** on Telegram — Pulse (data extraction), Dawn (morning check-in), Muse (creative check-in), Stratos (builder)
- A **shared data layer** — JSON files read/written by both the app and agents
- An **Express file server** (Step 8, not yet built) — bridges app reads to the shared JSON files

The design principle: **UI handles binary decisions (done/skip/tap). Agents handle conversation and interpretation.**

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TELEGRAM BOTS                         │
│                                                          │
│  @Stratos bot ──────────────────── Stratos agent         │
│  (main bot, 5345586297 / 8539676437 DMs)                 │
│                                                          │
│  @limitless_pulse_bot ──────────── Pulse agent           │
│  (screenshots: Sleep Cycle + FitMind)                    │
│                                                          │
│  @limitless_dawn_bot ───────────── Dawn agent            │
│  (morning check-in conversation)                         │
│                                                          │
│  @limitless_muse_bot ───────────── Muse agent            │
│  (creative block check-in)                               │
└─────────────────────────────────────────────────────────┘
                          │ reads/writes
                          ▼
┌─────────────────────────────────────────────────────────┐
│              SHARED DATA LAYER                           │
│     ~/.openclaw/data/shared/                             │
│                                                          │
│  morning-block-log.json   ← app writes, Dawn reads      │
│  creative-block-log.json  ← app writes, Muse reads      │
│  sleep-data.json          ← Pulse writes, Dawn reads     │
│  fitmind-data.json        ← Pulse writes, Dawn reads     │
│  morning-state.json       ← Dawn writes                  │
│  creative-state.json      ← Muse writes                  │
│  events.jsonl             ← all agents append            │
└─────────────────────────────────────────────────────────┘
                          │ read via
                          ▼
┌─────────────────────────────────────────────────────────┐
│         EXPRESS FILE SERVER (Step 8 — TODO)              │
│         http://localhost:3001                            │
│         Read-only proxy to shared JSON files             │
└─────────────────────────────────────────────────────────┘
                          │ fetches from
                          ▼
┌─────────────────────────────────────────────────────────┐
│           REACT PWA (~/limitless-app)                    │
│           http://localhost:3000                          │
│           Vite + React + Tailwind + Framer Motion        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Agents

All agents run inside OpenClaw. Config lives at `~/.openclaw/openclaw.json`.

### 2.1 Stratos (`id: stratos`)
- **Bot:** Main Stratos bot (token in config)
- **Bound to:** Direct DMs from 5345586297 (Stef) and 8539676437 (Giannis)
- **Workspace:** `~/.openclaw/workspace`
- **Role:** Builder. Does not participate in the Limitless daily loop.

### 2.2 Pulse (`id: limitless-state`)
- **Bot:** `@limitless_pulse_bot`
- **Bound to:** All DMs via `accountId: "pulse"`
- **Workspace:** `~/.openclaw/agents/limitless-state/workspace`
- **Role:** Screenshot interpreter. User sends Sleep Cycle and FitMind screenshots here.
- **Writes:**
  - `~/.openclaw/data/shared/sleep-data.json`
  - `~/.openclaw/data/shared/fitmind-data.json`

### 2.3 Dawn (`id: morning-checkin`)
- **Bot:** `@limitless_dawn_bot`
- **Bound to:** All DMs via `accountId: "dawn"`
- **Workspace:** `~/.openclaw/agents/morning-checkin/workspace`
- **Role:** Morning check-in coach. Reads what was logged, runs conversation, extracts state.
- **Reads:**
  - `~/.openclaw/data/shared/morning-block-log.json`
  - `~/.openclaw/data/shared/sleep-data.json`
  - `~/.openclaw/data/shared/fitmind-data.json`
- **Writes:**
  - `~/.openclaw/data/shared/morning-state.json`
  - Appends to `~/.openclaw/data/shared/events.jsonl`

### 2.4 Muse (`id: creative-checkin`)
- **Bot:** `@limitless_muse_bot`
- **Bound to:** All DMs via `accountId: "muse"`
- **Workspace:** `~/.openclaw/agents/creative-checkin/workspace`
- **Role:** Creative block check-in. Loose, exploratory debrief conversation.
- **Reads:**
  - `~/.openclaw/data/shared/morning-state.json`
  - `~/.openclaw/data/shared/morning-block-log.json`
- **Writes:**
  - `~/.openclaw/data/shared/creative-state.json`
  - Appends to `~/.openclaw/data/shared/events.jsonl`

---

## 3. OpenClaw Config

**File:** `~/.openclaw/openclaw.json`

### Channels
The Telegram channel is configured with a **default account** (Stratos) plus three **named accounts** for the Limitless agents:

```json
"channels": {
  "telegram": {
    "botToken": "<stratos-token>",
    "dmPolicy": "allowlist",
    "allowFrom": ["5345586297", "8539676437"],
    "accounts": {
      "pulse": {
        "botToken": "<pulse-token>",
        "dmPolicy": "allowlist",
        "allowFrom": ["5345586297"]
      },
      "dawn": {
        "botToken": "<dawn-token>",
        "dmPolicy": "allowlist",
        "allowFrom": ["5345586297"]
      },
      "muse": {
        "botToken": "<muse-token>",
        "dmPolicy": "allowlist",
        "allowFrom": ["5345586297"]
      }
    }
  }
}
```

### Bindings
Routes inbound messages to the correct agent:

```json
"bindings": [
  { "agentId": "stratos", "match": { "channel": "telegram", "peer": { "kind": "direct", "id": "5345586297" } } },
  { "agentId": "stratos", "match": { "channel": "telegram", "peer": { "kind": "direct", "id": "8539676437" } } },
  { "agentId": "limitless-state", "match": { "channel": "telegram", "accountId": "pulse" } },
  { "agentId": "morning-checkin", "match": { "channel": "telegram", "accountId": "dawn" } },
  { "agentId": "creative-checkin", "match": { "channel": "telegram", "accountId": "muse" } }
]
```

### Archived Agents
Removed from config and moved to `~/.openclaw/archive/agents/`:
- `limitless-principal` (Nexus)
- `limitless-habits` (Forge)
- `limitless-votes` (Mirror)
- `limitless-vf` (Oracle)
- `limitless-work` (Engine)
- `limitless-badges` (Sensei)

---

## 4. Shared Data Layer

**Directory:** `~/.openclaw/data/shared/`

### 4.1 morning-block-log.json
Written by the app on each card interaction. Read by Dawn on session start.

```json
{
  "date": "YYYY-MM-DD",
  "startedAt": "ISO-8601",
  "completedAt": "ISO-8601",
  "items": [
    { "id": "sleep-screenshot", "status": "done", "timestamp": "ISO-8601" },
    { "id": "journaling", "status": "skipped", "timestamp": "ISO-8601" }
  ],
  "completedCount": 8,
  "skippedCount": 1
}
```

### 4.2 creative-block-log.json
Written by the app when creative block session ends. Read by Muse.

```json
{
  "date": "YYYY-MM-DD",
  "startedAt": "ISO-8601",
  "completedAt": "ISO-8601",
  "status": "completed"
}
```

### 4.3 sleep-data.json
Written by Pulse after analyzing Sleep Cycle screenshot.

```json
{
  "date": "YYYY-MM-DD",
  "source": "sleep-cycle-screenshot",
  "hoursSlept": 7.5,
  "quality": "good",
  "sleepScore": 82,
  "wakeUpMood": "refreshed",
  "notes": "consistent deep sleep phases",
  "rawExtracted": {}
}
```

### 4.4 fitmind-data.json
Written by Pulse after analyzing FitMind screenshot.

```json
{
  "date": "YYYY-MM-DD",
  "source": "fitmind-screenshot",
  "workoutCompleted": true,
  "duration": "20min",
  "type": "focus-training",
  "score": 88,
  "notes": ""
}
```

### 4.5 morning-state.json
Written by Dawn after morning check-in conversation.

```json
{
  "date": "YYYY-MM-DD",
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

### 4.6 creative-state.json
Written by Muse after creative check-in conversation.

```json
{
  "date": "YYYY-MM-DD",
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
  "rawNotes": "..."
}
```

### 4.7 events.jsonl
Append-only event log. Every agent writes events here.

```jsonl
{"timestamp": "ISO-8601", "source": "morning-checkin", "type": "morning_completed", "payload": {"date": "YYYY-MM-DD", "overallMorningScore": 7.5}}
{"timestamp": "ISO-8601", "source": "creative-checkin", "type": "creative_block_completed", "payload": {"date": "YYYY-MM-DD", "energyScore": 7}}
```

---

## 5. React App (`~/limitless-app`)

### 5.1 Tech Stack
- **Vite** (build tool + dev server, port 3000)
- **React 18** (no TypeScript — plain JS)
- **Tailwind CSS** (utility classes, custom theme)
- **Framer Motion** (card slide animations, hold-to-confirm arc)

### 5.2 Color System
Defined in `tailwind.config.js`:

| Token | Value | Use |
|-------|-------|-----|
| `bg-bg` | `#0A0A0A` | Page background |
| `bg-card` | `#141414` | Card and panel backgrounds |
| `accent` | `#E8E8E8` | Active elements, progress arcs |
| `shadow-glow` | rgba(232,232,232,0.08) | Card border glow |

### 5.3 File Structure
```
~/limitless-app/
├── src/
│   ├── main.jsx                  ← React entry point
│   ├── App.jsx                   ← Root state, localStorage, tab routing
│   ├── index.css                 ← Tailwind imports + base reset
│   ├── components/
│   │   ├── BottomNav.jsx         ← 4-tab nav (Today/State/Badges/Stats)
│   │   ├── MorningRoutine.jsx    ← Card flow orchestrator
│   │   ├── HabitCard.jsx         ← Individual card with hold-to-confirm
│   │   ├── CompletionScreen.jsx  ← Post-morning summary + Dawn deep-link
│   │   ├── CreativeBlock.jsx     ← Creative block timer + Muse deep-link
│   │   └── PlaceholderTab.jsx    ← State/Badges/Stats placeholder screens
│   └── data/
│       └── morningRoutine.js     ← The 9 morning items config array
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

### 5.4 State Management
All state lives in `App.jsx`. No external state library.

**localStorage keys:**
| Key | Value | Reset |
|-----|-------|-------|
| `limitless_morning_statuses` | `{ [itemId]: "done" | "skipped" }` | 3am daily |
| `limitless_current_view` | `"morning-routine" | "completed" | "creative-block"` | 3am daily |
| `limitless_creative_block_start` | Unix timestamp (ms) | 3am daily |
| `limitless_last_reset` | `"YYYY-MM-DD"` | Never (tracks last reset date) |

**Daily reset logic:** On app load, if `hour >= 3` and `lastReset !== today`, all state keys are cleared and reset to defaults. This means the day "starts fresh" at 3am — intentional for Stef's night owl schedule.

### 5.5 Morning Routine Flow

**Card navigation:** Only the next incomplete card is shown. Cannot jump ahead. Cards are determined by finding the first item in `morningRoutine.js` where `statuses[item.id]` is falsy.

**Card animation:** Framer Motion `AnimatePresence` with slide variants:
- Enter: slide in from right (`x: 120, opacity: 0`)
- Exit: slide out to left (`x: -120, opacity: 0`)
- Duration: 350ms, ease-out

**Hold-to-confirm (DONE button):**
- Uses `requestAnimationFrame` for smooth progress tracking
- Progress stored as `0–1` float
- SVG circle with `strokeDashoffset` driven by progress
- Threshold: 1000ms hold = `progress >= 1` → triggers `onDone()`
- If released before 1s: `progress` resets to 0

**Skip:** Instant — calls `onStatusChange(itemId, "skipped")` directly, no hold required.

**Pulse cards:** Items with `needsPulse: true` (`sleep-screenshot`, `fitmind`) show an additional "📲 Open Pulse →" button that deep-links to `t.me/limitless_pulse_bot`.

**Completion trigger:** `useEffect` in `App.jsx` watches `statuses`. When all 9 items have a status, `currentView` transitions to `"completed"`.

### 5.6 Completion Screen
Shows after all morning cards are done/skipped:
- Completed count
- Skipped count
- **"💬 Log Morning →"** button → `t.me/limitless_dawn_bot`
- **"Enter Creative Block"** text button → transitions view to `"creative-block"`

### 5.7 Creative Block View
- Title + subtitle ("3 hours. No agenda. Create freely.")
- **Start Block button** → sets `creativeBlockStartTime` in state + localStorage
- Once started: live elapsed timer (`HH:MM:SS`), ticks every second via `setInterval`
- **"💬 Check In →"** button → `t.me/limitless_muse_bot` (always visible)

### 5.8 App → File Server Communication
On each card interaction, the app POSTs to the Express file server:

```js
fetch('http://localhost:3001/morning-block-log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ itemId, status, timestamp })
})
```

Errors are caught silently (`console.log`) — app works offline from the file server. The file server (port 3001) is **not yet built** — this is Step 8.

---

## 6. Express File Server (Step 8 — ✅ Done)

**Port:** 3001  
**Location:** `~/limitless-app/server/index.js`  
**Start:** `npm run server`  
**Start with app:** `npm run dev:all` (runs Vite on 3000 + server on 3001 concurrently)

### What it does
- Serves the shared JSON files as read-only GET endpoints
- Accepts POST to update `morning-block-log.json` and `creative-block-log.json`
- CORS enabled (app on 3000 hits 3001 freely)
- Returns empty stubs (never crashes) when files are missing or corrupt

### Endpoints
```
GET  /morning-block-log    → ~/.openclaw/data/shared/morning-block-log.json
GET  /creative-block-log   → ~/.openclaw/data/shared/creative-block-log.json
GET  /sleep-data           → ~/.openclaw/data/shared/sleep-data.json
GET  /fitmind-data         → ~/.openclaw/data/shared/fitmind-data.json
GET  /morning-state        → ~/.openclaw/data/shared/morning-state.json
GET  /creative-state       → ~/.openclaw/data/shared/creative-state.json
GET  /events               → events.jsonl parsed as JSON array

POST /morning-block-log    → { itemId, status, timestamp }
                             Resets on new day, updates item, recounts done/skipped

POST /creative-block-log   → { status?, startedAt?, completedAt? }
                             Merges into file, resets on new day
```

### Error handling
Every read is wrapped in try/catch — missing file or bad JSON returns the stub silently. Server never crashes on bad data.

---

## 7. Telegram Deep Links

| Destination | URL | Used in |
|-------------|-----|---------|
| Pulse | `t.me/limitless_pulse_bot` | Sleep Cycle card, FitMind card |
| Dawn | `t.me/limitless_dawn_bot` | Completion screen |
| Muse | `t.me/limitless_muse_bot` | Creative block view |

---

## 8. Running the System

### Start the app (dev)
```bash
cd ~/limitless-app
npm run dev
# Runs on http://localhost:3000
```

### Build for production
```bash
cd ~/limitless-app
npm run build
# Output in ~/limitless-app/dist/
```

### Gateway (OpenClaw agents)
```bash
openclaw gateway status   # check if running
openclaw gateway start    # start if not running
openclaw gateway restart  # restart after config changes
```

### Check agent configs
```bash
openclaw agents list --bindings
```

---

## 9. Build Status

| Step | Description | Status |
|------|-------------|--------|
| 1 | Shared data directory + JSON stubs | ✅ Done |
| 2 | Pulse updates (screenshot → JSON) | ✅ Done (pre-existing) |
| 3 | Dawn agent + workspace | ✅ Done (pre-existing) |
| 4 | Muse agent + workspace | ✅ Done (pre-existing) |
| 5 | App scaffold (Vite + React + Tailwind + nav shell) | ✅ Done |
| 6 | Morning routine interactive cards | ✅ Done |
| 7 | Creative block view | ✅ Done |
| 8 | Express file server (port 3001) | ✅ Done |
| 9 | State tab — data dashboard | ⬜ TODO |
| 10 | Wire Telegram deep links | ✅ Done (bots confirmed) |
| 11 | Cloudflare tunnel for mobile access | ⬜ TODO |

---

## 10. What's Not In Scope Yet

- State tab content (energy/sleep/mood gauges, 7-day trend)
- Badges tab (skill tree, XP, missions)
- Stats tab (vote history, work sessions)
- Nightly summaries
- Vote casting system
- Afternoon / evening blocks
- Badge mission delivery

These get designed on top of the morning + creative block foundation once that's running in real life.

---

## 11. Key Files Reference

| File | Purpose |
|------|---------|
| `~/.openclaw/openclaw.json` | OpenClaw gateway config — agents, bots, bindings |
| `~/.openclaw/data/shared/` | Shared data directory — all JSON read/written by agents + app |
| `~/.openclaw/agents/limitless-state/workspace/SOUL.md` | Pulse personality + instructions |
| `~/.openclaw/agents/morning-checkin/workspace/SOUL.md` | Dawn personality + instructions |
| `~/.openclaw/agents/creative-checkin/workspace/SOUL.md` | Muse personality + instructions |
| `~/.openclaw/archive/agents/` | Archived old agents (Nexus, Forge, etc.) |
| `~/limitless-app/` | React app source |
| `~/limitless-app/src/data/morningRoutine.js` | The 9 morning items — edit here to change routine |
| `~/limitless-app/DOCS.md` | This file |
