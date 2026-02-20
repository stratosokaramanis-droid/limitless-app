# Limitless — Execution Plan

**Created:** 2026-02-20  
**Purpose:** Full task list with execution order. Read this at the start of any session working on Limitless.

---

## Execution Order (Important)

Tasks are ordered to avoid blocking. Gateway restart tasks go LAST because restarting OpenClaw kills the current agent session. Tasks requiring Stef's input go LAST for the same reason.

---

## ✅ Completed

- [x] Step 1–8: Data layer, all agents, app scaffold, file server
- [x] GitHub repo: github.com/stratosokaramanis-droid/limitless-app
- [x] All 4 Telegram bots wired (Stratos, Pulse, Dawn, Muse)
- [x] Full architecture documentation (DOCS.md)

---

## 🔧 In Progress / Next

### Phase 1 — No Restart Required (Do First)

**1.1 Fix morning routine order**
- Current `morningRoutine.js` has wrong card order
- Correct order per Stef:
  1. `sleep-screenshot` — Sleep Cycle screenshot → Pulse
  2. `morning-reading` — Reading (Power of Now / Creative Act)
  3. `journaling` — One page, ~5 minutes
  4. `review-plan` — Review plan, affirmations, values, philosophies
  5. `sunlight-walk` — Sunlight, walk, think about the day
  6. `fitmind` — FitMind training + screenshot → Pulse
  7. `shower` — Cold shower
  8. `visualization` — Short-term visualization
  9. `write-values` — Write values, beliefs, affirmations
  - (10) Badge training — future, skip for now
  - (11) Log Morning → Dawn conversation (already the completion screen flow)
- Update `morningRoutine.js`, update DOCS.md table
- Status: ⬜ TODO

**1.2 Security hardening**
- `chmod 600 ~/.openclaw/openclaw.json` — tokens in plaintext, restrict access
- Add `.openclaw/openclaw.json` to a "never commit" warning in README
- Status: ⬜ TODO

**1.3 Daily backup cron**
- OpenClaw cron job, runs at 11pm every night
- Archives `~/.openclaw/data/shared/` → `~/.openclaw/data/backups/YYYY-MM-DD/`
- Keeps last 30 days
- Status: ⬜ TODO

**1.4 Vite proxy for /api/*
- Problem: app calls `http://localhost:3001` which doesn't work on phone through tunnel
- Fix: Vite proxy in `vite.config.js` — `/api/*` → `http://localhost:3001`
- App updated to call `/api/morning-block-log` etc. instead of `http://localhost:3001/...`
- File server stays fully private (not exposed via tunnel)
- Status: ⬜ TODO

**1.5 Historical data snapshots in file server**
- Current issue: daily JSON files get overwritten — no history for charts/trends
- Add to file server: before resetting a file for a new day, archive to `~/.openclaw/data/shared/history/YYYY-MM-DD/`
- New endpoints:
  - `GET /history` — list of available dates
  - `GET /history/:date/:file` — specific day's data
- This powers the 7-day trend in the State tab
- Status: ⬜ TODO

**1.6 Integration test script**
- Bash script: `~/limitless-app/scripts/test-integrations.sh`
- Tests:
  - File server GET endpoints return valid JSON
  - POST /morning-block-log correctly updates the file
  - POST /creative-block-log works
  - Historical endpoint works
  - All shared JSON files exist and are valid
  - Each agent workspace has SOUL.md and AGENTS.md
  - OpenClaw gateway is running
  - All 4 bot tokens are present in config
- Outputs PASS/FAIL per test
- Status: ⬜ TODO

**1.7 State tab — vertical energy bar**
- Spawn coding sub-agent for UI work
- The State tab shows a single vertical energy bar (primary metric)
- Energy bar is a composite 1–10 score calculated from:
  - `sleep-data.json` → hoursSlept, sleepScore (weight: 25%)
  - `fitmind-data.json` → workoutCompleted, score (weight: 15%)
  - `morning-block-log.json` → completedCount/total (weight: 10%)
  - `morning-state.json` → energyScore, mentalClarity, overallMorningScore (weight: 35%)
  - `creative-state.json` → energyScore, nutrition.logged (weight: 15%)
- Visual: tall vertical bar, fills from bottom, color shifts from cool → warm as score rises
- Below the bar: key stats (hours slept, FitMind score, morning score, today's priority from Dawn)
- If no data yet (morning not done): bar shows at baseline, stats show dashes
- Reads from `/api/*` endpoints — falls back gracefully if server offline
- Status: ⬜ TODO

**1.8 Update documentation throughout**
- Keep DOCS.md current after every change
- Commit with every meaningful change
- Status: ongoing

---

### Phase 2 — Gateway Restart Required (Do Last)

**2.1 Upgrade Dawn + Muse to opus**
- Change model from `anthropic/claude-sonnet-4-6` to `anthropic/claude-opus-4-6` in openclaw.json
- Reason: check-in conversations require emotional nuance — opus noticeably better than sonnet
- Pulse stays on sonnet (vision extraction, doesn't need conversational depth)
- **Requires gateway restart → do after all other tasks**
- Status: ⬜ TODO

**2.2 Add daily session reset for Dawn + Muse**
- Dawn and Muse should start fresh each day — no bleed from yesterday's conversation
- Add session reset config to each agent: `session.reset.mode: "daily"`, `atHour: 3`
- Matches the app's 3am daily reset
- **Requires gateway restart → do after all other tasks**
- Status: ⬜ TODO

---

### Phase 3 — Needs Stef's Input (Do Last)

**3.1 Cloudflare tunnel**
- Install `cloudflared` on the machine
- Create a Cloudflare tunnel pointing at localhost:3000
- Needs: Cloudflare account login, tunnel name/domain decision
- Once tunnel URL is confirmed, update any hardcoded references
- Status: ⬜ TODO — needs Stef to auth with Cloudflare

---

## State Metric — Energy Bar Spec

The energy bar is the ONLY state metric in scope right now.

**Score calculation (0–10):**
```
base = 5.0

sleep_component:
  if sleep-data exists:
    hours_score = clamp(hoursSlept / 8, 0, 1) * 10   # 8h = perfect
    quality_score = sleepScore / 100 * 10             # direct if available
    sleep_contribution = (hours_score * 0.5 + quality_score * 0.5) * 2.5
  else: sleep_contribution = 0  (no data)

fitmind_component:
  if fitmind-data exists and workoutCompleted:
    fitmind_contribution = (score / 100 * 10) * 1.5
  else: fitmind_contribution = 0

morning_block_component:
  if morning-block-log exists:
    ratio = completedCount / (completedCount + skippedCount)
    morning_block_contribution = ratio * 1.0
  else: morning_block_contribution = 0

morning_state_component:
  if morning-state exists:
    morning_state_contribution = (energyScore * 0.5 + mentalClarity * 0.3 + overallMorningScore * 0.2) * 0.35
  else: morning_state_contribution = 0

creative_component:
  if creative-state exists:
    nutrition_bonus = nutrition.logged ? 0.5 : 0
    creative_contribution = (energyScore * 0.8 + nutrition_bonus) * 0.15
  else: creative_contribution = 0

final_score = clamp(
  sleep_contribution + fitmind_contribution + morning_block_contribution +
  morning_state_contribution + creative_contribution,
  0, 10
)
```

**Visual:**
- Tall vertical bar, left-center of the State tab
- Empty (gray) when no data
- Fills from bottom up
- Color: `#4A9EFF` (cool blue) at 0–4, `#7ED4A5` (green) at 5–7, `#FFD166` (warm) at 8–10
- Number label at the top of the fill
- Right side: stat cards (sleep hours, FitMind score, morning score, day priority, mood)

---

## Morning Routine — Complete Reference

Cards in order (stored in `morningRoutine.js`):

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
Badge training: future, not in scope yet

---

## Data Flow — Energy State Inputs

Only these things affect the energy bar:

| Input | Source | Extracted by | Stored in |
|-------|--------|-------------|-----------|
| Hours slept | Sleep Cycle screenshot | Pulse | `sleep-data.json` |
| Sleep quality/score | Sleep Cycle screenshot | Pulse | `sleep-data.json` |
| Mental workout completed | FitMind screenshot | Pulse | `fitmind-data.json` |
| FitMind score | FitMind screenshot | Pulse | `fitmind-data.json` |
| Morning completion rate | App card interactions | App | `morning-block-log.json` |
| Energy score | Dawn conversation | Dawn | `morning-state.json` |
| Mental clarity | Dawn conversation | Dawn | `morning-state.json` |
| Overall morning score | Dawn assessment | Dawn | `morning-state.json` |
| Creative energy score | Muse conversation | Muse | `creative-state.json` |
| Nutrition logged + meal | Muse conversation | Muse | `creative-state.json` |

Everything else (individual habit completions, journaling content, etc.) is logged but does NOT affect the energy bar.

---

## Agent Context — What Each Agent Needs to Know

### Pulse
- On screenshot: identify app (Sleep Cycle vs FitMind), extract all visible metrics
- Write to the correct file in `~/.openclaw/data/shared/`
- Handle edge cases: blurry screenshot, no data visible, wrong app
- Confirm to user with one line: "Got it. Sleep: 7.5h, score 82."

### Dawn
- Reads: `morning-block-log.json`, `sleep-data.json`, `fitmind-data.json`
- Opens with ONE sentence summarizing what she knows, then asks how it felt
- Conversation extracts: energy (1-10), mental clarity (1-10), emotional state tag, insights, resistance, day priority, fire level
- Stores `overallMorningScore` as HER assessment (not self-report) based on conversation
- Handles null data gracefully: if sleep-data is empty, skips that context
- Ends clean — doesn't drag the conversation past when she has what she needs

### Muse
- Reads: `morning-state.json`, `morning-block-log.json`
- Opens with "How was the creative block?" — nothing more
- Follows the conversation, extracts: activities, energy, meals (if mentioned), creative output, mood shift
- If user mentions food → extract meal and quality naturally, don't make it feel like a form
- Stores nutrition data which feeds the energy bar

---

## Open Questions (Resolve with Stef)

- [ ] Cloudflare account — which domain/subdomain for the tunnel?
- [ ] What does "short-term visualization" mean exactly? (for later card description)
- [ ] Badge training card — when does it appear? Conditional? (for later)
- [ ] Afternoon/evening blocks — design after morning + creative nailed

---

## Notes

- **Never commit bot tokens** — `openclaw.json` is not in the repo and should never be
- **Gateway restart kills current session** — always do config changes that require restart at the very end
- **The file server (port 3001) is never public** — always proxied through Vite or stays local
- **Daily reset at 3am** — matches Stef's night owl schedule. Both app localStorage and agent sessions reset at 3am
