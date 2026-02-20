# Limitless — Execution Plan

**Created:** 2026-02-20  
**Purpose:** Full task list with execution order. Read this at the start of any session working on Limitless.

---

## ⚠️ BEFORE TOUCHING CONFIG — READ THIS

`~/.openclaw/workspace/CONFIG_NOTES.md` — Critical rules for openclaw.json. Especially: **accounts.stratos must always exist** or Telegram inbound dies silently. Any config patch that touches `channels.telegram.accounts` or `bindings` must preserve it.

---

## ✅ Completed

- [x] Step 1–8: Data layer, all agents, app scaffold, file server
- [x] GitHub repo: github.com/stratosokaramanis-droid/limitless-app
- [x] All 4 Telegram bots wired (Stratos, Pulse, Dawn, Muse)
- [x] Full architecture documentation (DOCS.md)
- [x] Morning routine correct order (9 cards)
- [x] Security (chmod 600), daily backup cron, Vite proxy
- [x] Historical snapshots + /history endpoints
- [x] Integration tests (41/41)
- [x] State tab — 4 pillars (Sleep, Nutrition, Dopamine, Mood) + composite score
- [x] Dawn + Muse on opus, daily session reset at 3am
- [x] Vote categories defined, Muse emits nutritionScore + dopamineQuality

---

## 🔧 Current Phase — Backend Completion

### Priority order: data layer → agents → app → gateway restart

---

## Phase A — Data Architecture (No Restart)

**A.1 Add timestamps to all agent-written files**

Currently missing `createdAt`/`updatedAt` in Pulse, Dawn, Muse outputs.

Update SOUL.md for each agent to write:
```json
{ "date": "YYYY-MM-DD", "createdAt": "ISO-8601", "updatedAt": "ISO-8601", ... }
```
- Pulse: add to `sleep-data.json` and `fitmind-data.json`
- Dawn: add to `morning-state.json`
- Muse: add to `creative-state.json`
- Status: ⬜ TODO

**A.2 Create new data stub files**

New files in `~/.openclaw/data/shared/`:

`work-sessions.json`
```json
{
  "date": null,
  "sessions": [],
  "totalSessions": 3,
  "completedSessions": 0,
  "lunchBreakLogged": false,
  "lunchMeal": null,
  "lunchNutritionScore": null
}
```

Each session object:
```json
{
  "id": 1,
  "startedAt": "ISO-8601",
  "endedAt": "ISO-8601",
  "durationMinutes": 90,
  "focus": "what we're working on",
  "evaluationCriteria": "how to know if it went well",
  "outcomes": "what actually happened",
  "outcomeScore": null,
  "flowScore": null,
  "compositeScore": null,
  "meal": null,
  "nutritionScore": null,
  "notes": ""
}
```

`votes.json`
```json
{
  "date": null,
  "votes": []
}
```

Each vote object:
```json
{
  "id": "uuid-or-timestamp-based",
  "timestamp": "ISO-8601",
  "action": "human-readable description of what happened",
  "category": "nutrition | work | mental-power | personality | creativity | physical | relationships",
  "polarity": "positive | negative",
  "source": "agent-id that emitted this vote",
  "weight": 1
}
```

`night-routine.json`
```json
{
  "date": null,
  "startedAt": null,
  "completedAt": null,
  "letGoCompleted": false,
  "letGoTimestamp": null,
  "nervousSystemCompleted": false,
  "planCompleted": false,
  "planTimestamp": null,
  "tomorrowPlan": "",
  "promptsReviewed": false,
  "promptsTimestamp": null,
  "affirmationsReviewed": false,
  "affirmationsTimestamp": null,
  "alterMemoriesCompleted": false,
  "alterMemoriesTimestamp": null
}
```

`midday-checkin.json`
```json
{
  "date": null,
  "triggeredAt": null,
  "energyScore": null,
  "notes": "",
  "rawNotes": ""
}
```

- Status: ⬜ TODO

**A.3 Update file server with new endpoints**

New GET endpoints (same read-only pattern as existing):
- `GET /work-sessions`
- `GET /votes`
- `GET /night-routine`
- `GET /midday-checkin`

New POST endpoints:
- `POST /work-sessions/start` — body: `{ sessionId, focus, evaluationCriteria }` → starts session, sets startedAt
- `POST /work-sessions/end` — body: `{ sessionId, outcomes, outcomeScore, flowScore, compositeScore, meal?, nutritionScore? }` → completes session
- `POST /votes` — body: `{ votes: [...] }` → appends votes to today's list
- `POST /night-routine` — body: `{ field, value, timestamp? }` → updates a field
- `POST /midday-checkin` — body: full checkin object → writes file

All POST handlers: reset for new day, archive yesterday, write back.

- Status: ⬜ TODO

---

## Phase B — New Agents (No Restart)

**B.1 Forge — Work Session Agent (`work-session`)**

- **Personality:** Sharp, analytical, results-focused. No warmup. Gets straight to what matters.
- **Bot:** `@limitless_forge_bot` (new Telegram bot)
- **Role:** Manages all 3 work sessions. Start convo + end convo per session.

**Session START conversation:**
1. Read `work-sessions.json` to see which session is next (1, 2, or 3)
2. Open with: "Session [N]. What are we building?" or "Session [N]. What's the focus?"
3. Extract: focus area, specific goal, evaluation criteria ("how do we know it went well?")
4. Write session start to `work-sessions.json` with `startedAt`
5. Optional: scan `morning-state.json` and `creative-state.json` for context on the user's state
6. Fire user up with one line if appropriate: knows when to add fuel, knows when to stay quiet

**Session END conversation:**
1. Open with: "Session done. What happened?"
2. Extract outcomes (what actually got built/decided/moved), not just effort
3. Assess `flowScore` (1-10): was it deep focus or interrupted and scattered?
4. Assess `outcomeScore` (1-10): did the criteria get met? Honest read.
5. `compositeScore` = (outcomeScore * 0.6 + flowScore * 0.4)
6. If user mentions meal: extract and assess `nutritionScore`
7. Write completed session to `work-sessions.json`
8. Append votes to `votes.json`
9. Append event to `events.jsonl`

**Between sessions / mid-day optional check-in:**
- Same agent, same chat
- User triggers it whenever
- Same philosophy: extract what's real, store it, done

**B.2 Luna — Night Routine Agent (`night-routine`)**

- **Personality:** Calm, grounded, slightly philosophical. Matches the wind-down energy. Not intense. Present.
- **Bot:** `@limitless_luna_bot` (new Telegram bot)
- **Role:** Night routine, bed routine, next-day planning, vote review, alter memories support

**Night routine flow:**
1. Read everything from today — `morning-state.json`, `creative-state.json`, `work-sessions.json`, `votes.json`
2. Open with a brief reflection: one line on how the day looked from the data
3. Guide through what hasn't been done yet (meditation, nervous system, planning)
4. For next-day planning: engage in actual planning dialogue — what matters tomorrow, what to protect, what to prioritize
5. Write plan to `night-routine.json`

**Bed routine support:**
- User sends the next day's plan (pic or text) → Luna stores in `night-routine.tomorrowPlan`
- Prompts: Luna asks the prompt questions conversationally if user wants, or just marks as reviewed
- Affirmations: marks completed
- Alter Memories: on request, reads `votes.json` and returns all negative votes from today in a clean format for the meditation

**Vote summary:**
- Luna can surface a vote summary at end of day: "Here's the scoreboard."
- Shows positive vs negative by category
- Does not add votes herself (day is done), but reads and summarizes

---

## Phase C — Vote Casting System

**Every agent emits votes as part of their session close.**

Vote flow: agent conversation → agent writes `votes.json` via POST → Luna can read and surface at night.

**Agent vote responsibilities:**

| Agent | What they vote on |
|-------|------------------|
| Pulse | `sleep-quality` (positive if >7h + good score, negative if <6h), `mental-training` (positive if FitMind completed) |
| Dawn | `morning-block` (positive if 7+/9 done, negative if <5/9), `resistance-faced` (personality), `fire-level` (mental-power) |
| Muse | `nutrition` (from nutritionScore), `dopamine` (from dopamineQuality), `creative-output` (from creativeOutput quality) |
| Forge | `work-output` (from outcomeScore), `flow-access` (from flowScore), `nutrition` (from session meal) |
| Luna | Does NOT emit votes. Reads and surfaces them. |

**Vote schema validation rules:**
- `category` must be one of: `nutrition`, `work`, `mental-power`, `personality`, `creativity`, `physical`, `relationships`
- `polarity` must be `positive` or `negative` (neutral = skip, don't store)
- `action` is a human-readable sentence: "Completed FitMind — score 88"
- `weight` default 1. Future: some actions will have higher weight

**Example votes from a good day:**
```json
[
  {"timestamp":"...", "action":"Slept 7.5h, score 82", "category":"physical", "polarity":"positive", "source":"limitless-state"},
  {"timestamp":"...", "action":"Completed FitMind — score 88", "category":"mental-power", "polarity":"positive", "source":"limitless-state"},
  {"timestamp":"...", "action":"8/9 morning block completed", "category":"work", "polarity":"positive", "source":"morning-checkin"},
  {"timestamp":"...", "action":"Noticed resistance during visualization", "category":"mental-power", "polarity":"negative", "source":"morning-checkin"},
  {"timestamp":"...", "action":"Ate clean: eggs, fruit, coffee", "category":"nutrition", "polarity":"positive", "source":"creative-checkin"},
  {"timestamp":"...", "action":"YouTube rabbit hole — 1h passive consumption", "category":"mental-power", "polarity":"negative", "source":"creative-checkin"},
  {"timestamp":"...", "action":"Shipped HyperSpace logo concepts — outcomeScore 8", "category":"creativity", "polarity":"positive", "source":"work-session"},
  {"timestamp":"...", "action":"Deep flow state in session 2 — flowScore 9", "category":"mental-power", "polarity":"positive", "source":"work-session"}
]
```

---

## Phase D — App Updates (Frontend — Stef builds, I spec)

The Today tab needs to represent the FULL day, not just morning + creative.

**Day flow in the app:**

| Phase | Trigger | App shows | Agent deep-link |
|-------|---------|-----------|----------------|
| Morning Routine | Auto (start of day) | 9 cards, hold/skip | Pulse (screenshots) |
| Creative Block | After morning complete | Timer + check-in button | Muse |
| Deep Work | User taps "Start Session" | Session card (session #, focus, timer) | Forge (start + end) |
| Mid-day check-in | Optional, user triggers | Simple check-in button | Forge |
| Night Routine | User taps "Night Mode" | Checklist cards + planning | Luna |
| Bed Routine | After night routine | Checklist cards | Luna |

**Session card during Deep Work:**
```
┌──────────────────────────┐
│  Session 1 of 3          │
│                          │
│  90:00 ───────────────   │  ← countdown timer
│                          │
│  💬 START SESSION →      │  ← to Forge (pre-session)
│  💬 END SESSION →        │  ← to Forge (post-session, appears after start)
│                          │
│  Break: 10 min           │  ← between sessions
│  Lunch: 30 min           │  ← after session 2
└──────────────────────────┘
```

**State tab updates needed:**
- Add work session composite scores to dopamine/work inputs
- Add votes chart (positive vs negative by category) — future

---

## Phase E — Gateway Restart (Last)

**E.1 Add Forge + Luna to OpenClaw config**
- New bot tokens (Stef creates via BotFather)
- New agents with accountId bindings
- New agent entries in `agents.list`
- Requires restart

**E.2 Update Pulse SOUL.md to emit votes**
- Already writes sleep-data.json and fitmind-data.json
- Add: after writing, also POST votes to `votes.json`
- Requires restart (config change + SOUL.md update)

---

## Phase F — Needs Stef

**F.1 Cloudflare tunnel**
- Needs Cloudflare account auth
- Once set up: update any hardcoded URLs

**F.2 New bot creation (BotFather)**
- `@limitless_forge_bot` (Forge)
- `@limitless_luna_bot` (Luna)

---

## Full Day Data Flow Reference

```
Wake up
  └─ Sleep Cycle screenshot → Pulse → sleep-data.json + votes.json

Morning Block
  ├─ App card interactions → morning-block-log.json (via file server)
  ├─ FitMind screenshot → Pulse → fitmind-data.json + votes.json
  └─ Log Morning → Dawn → morning-state.json + votes.json + events.jsonl

Creative Block (3h)
  ├─ App timer → creative-block-log.json (via file server)
  └─ Check-in → Muse → creative-state.json + votes.json + events.jsonl

Deep Work Sessions (3 × 90min)
  ├─ Start → Forge → work-sessions.json (session started)
  ├─ [optional] Mid-session check-in → Forge
  └─ End → Forge → work-sessions.json (session completed) + votes.json + events.jsonl

[Optional mid-day check-in → Forge → midday-checkin.json]

Free Time
  └─ Nothing tracked unless user triggers Forge/Stratos

Night Routine
  └─ User triggers → Luna → night-routine.json + vote summary

Bed Routine
  ├─ Send plan → Luna → night-routine.tomorrowPlan
  ├─ Prompts/Affirmations → Luna marks complete
  └─ Alter Memories → Luna reads votes.json, returns negative votes
```

---

## State Metric — Four Pillars + Composite Score

**Four sub-metrics, one composed STATE score (0–10):**

| Metric | Weight | Sources |
|--------|--------|---------|
| Sleep | 30% | `sleep-data.json` → hoursSlept + sleepScore |
| Dopamine | 25% | FitMind completion/score + morning completion rate + `dopamineQuality` from Muse + work flowScore |
| Mood | 25% | Dawn's emotionalState tag + energyScore + Muse's energyScore |
| Nutrition | 20% | `nutritionScore` from Muse + Forge's session meal scoring |

STATE = weighted average of whichever sub-metrics have data.

**Future additions to state:** work compositeScore will feed dopamine, Luna's end-of-night state will be a final mood read.

---

## Morning Routine — Complete Reference

| # | ID | Title | Description | Pulse Button |
|---|-----|-------|-------------|:---:|
| 1 | `sleep-screenshot` | 📸 Sleep Cycle | Take a screenshot of Sleep Cycle and send to Pulse | ✅ |
| 2 | `morning-reading` | 📖 Morning Reading | A few pages of Power of Now or The Creative Act | — |
| 3 | `journaling` | ✍️ Journaling | One page, ~5 minutes. Write freely, no filter | — |
| 4 | `review-plan` | 📋 Review Plan | Review today's plan, affirmations, values, philosophies | — |
| 5 | `sunlight-walk` | ☀️ Sunlight Walk | Get outside, walk, think about the day | — |
| 6 | `fitmind` | 🧠 FitMind | Complete mental workout, screenshot and send to Pulse | ✅ |
| 7 | `shower` | 🚿 Cold Shower | End cold. 30 seconds minimum | — |
| 8 | `visualization` | 🎯 Visualization | Short-term visualization. See the day clearly | — |
| 9 | `write-values` | 🔥 Write Values | Write values, beliefs, affirmations by hand | — |

After card 9: Completion screen → "💬 Log Morning →" → Dawn bot

---

## Night Routine Reference

| # | ID | Title | Notes |
|---|-----|-------|-------|
| 1 | `vf-game` | 🎮 VF Game | Future — skip for now |
| 2 | `letting-go` | 🌊 Letting Go | Meditation to release the day's tension |
| 3 | `nervous-system` | 🧘 Regulate | Nervous system regulation exercise |
| 4 | `plan-tomorrow` | 📋 Plan Tomorrow | Write tomorrow's plan (send to Luna) |

## Bed Routine Reference

| # | ID | Title | Notes |
|---|-----|-------|-------|
| 1 | `finalize-plan` | ✅ Finalize Plan | Send pic or paste plan text to Luna |
| 2 | `read-prompts` | ❓ Read Prompts | Set of questions — can discuss with Luna |
| 3 | `affirmations` | 🔥 Affirmations | Read affirmations |
| 4 | `alter-memories` | 🧠 Alter Memories | Luna provides negative votes for the meditation |

---

## Open Questions

- [ ] Cloudflare account — which domain/subdomain?
- [ ] Forge + Luna bot names — confirm "Forge" and "Luna" or rename?
- [ ] Work session timer — in the app, does it count down or count up?
- [ ] Mid-day check-in — same Forge bot or separate?
- [ ] Night routine cards — same hold-to-confirm pattern as morning?
- [ ] Alter Memories meditation — what format does Luna return the negative votes? (full list? categorized? narrative?)
- [ ] Prompts — what are the "read prompts" exactly? Fixed questions or dynamic?

---

## Notes

- **Never commit bot tokens** — `openclaw.json` not in repo
- **Gateway restart kills current session** — config changes go last
- **File server (port 3001) never public** — always via Vite proxy
- **Daily reset at 3am** — app localStorage + agent sessions
- **Everything timestamped** — every agent-written file includes `createdAt`/`updatedAt`
- **Neutral votes = skip** — don't store them, they add noise
