#!/usr/bin/env bash
# Limitless Integration Test Suite
# Run: bash scripts/test-integrations.sh
# Requires: file server running on :3001

set -uo pipefail

PASS=0
FAIL=0
DATA_DIR="$HOME/.openclaw/data/shared"
OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
API="http://localhost:3001"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} — $1"; ((PASS++)); }
fail() { echo -e "${RED}❌ FAIL${NC} — $1"; ((FAIL++)); }
section() { echo -e "\n${YELLOW}── $1 ──${NC}"; }

# ─── 1. System checks ────────────────────────────────────────────────────────

section "System"

# OpenClaw gateway running
if curl -sf http://localhost:18789/health &>/dev/null || pgrep -f "openclaw" &>/dev/null; then
  pass "OpenClaw gateway process running"
else
  fail "OpenClaw gateway not detected"
fi

# Config exists and has tokens
if [[ -f "$OPENCLAW_CONFIG" ]]; then
  pass "openclaw.json exists"
  if python3 -c "
import json, sys
d = json.load(open('$OPENCLAW_CONFIG'))
ch = d.get('channels', {}).get('telegram', {})
assert ch.get('botToken'), 'missing main botToken'
accts = ch.get('accounts', {})
for name in ['pulse', 'dawn', 'muse', 'forge', 'luna']:
    assert accts.get(name, {}).get('botToken'), f'missing {name} token'
print('ok')
" 2>/dev/null | grep -q ok; then
    pass "All 6 bot tokens present in config"
  else
    fail "Missing bot tokens in config"
  fi

  # Check config file permissions
  PERMS=$(stat -c '%a' "$OPENCLAW_CONFIG" 2>/dev/null || stat -f '%Lp' "$OPENCLAW_CONFIG" 2>/dev/null)
  if [[ "$PERMS" == "600" ]]; then
    pass "openclaw.json permissions are 600 (secure)"
  else
    fail "openclaw.json permissions are $PERMS (should be 600)"
  fi
else
  fail "openclaw.json not found at $OPENCLAW_CONFIG"
fi

# ─── 2. Shared data directory ────────────────────────────────────────────────

section "Shared Data Layer"

for file in morning-block-log creative-block-log sleep-data fitmind-data morning-state creative-state work-sessions votes night-routine midday-checkin badge-daily vf-game events; do
  if [[ "$file" == "events" ]]; then
    target="$DATA_DIR/events.jsonl"
  else
    target="$DATA_DIR/${file}.json"
  fi
  if [[ -f "$target" ]]; then
    pass "$file exists"
  else
    fail "$file missing at $target"
  fi
done

# Validate JSON files
for file in morning-block-log creative-block-log sleep-data fitmind-data morning-state creative-state work-sessions votes night-routine midday-checkin badge-daily vf-game; do
  if python3 -m json.tool "$DATA_DIR/${file}.json" &>/dev/null; then
    pass "$file.json is valid JSON"
  else
    fail "$file.json is invalid JSON"
  fi
done

# ─── 3. Agent workspaces ─────────────────────────────────────────────────────

section "Agent Workspaces"

for agent in limitless-state morning-checkin creative-checkin work-session night-routine; do
  workspace="$HOME/.openclaw/agents/$agent/workspace"
  if [[ -f "$workspace/SOUL.md" ]]; then
    pass "$agent has SOUL.md"
  else
    fail "$agent missing SOUL.md at $workspace"
  fi
  if [[ -f "$workspace/AGENTS.md" ]]; then
    pass "$agent has AGENTS.md"
  else
    fail "$agent missing AGENTS.md"
  fi
done

# Stratos workspace
if [[ -f "$HOME/.openclaw/workspace/SOUL.md" ]]; then
  pass "Stratos has SOUL.md"
else
  fail "Stratos missing SOUL.md"
fi

# ─── 4. File server ──────────────────────────────────────────────────────────

section "File Server (requires server on :3001)"

if curl -sf "$API/morning-block-log" &>/dev/null; then
  pass "File server reachable on :3001"

  # GET endpoints
  for endpoint in morning-block-log creative-block-log sleep-data fitmind-data morning-state creative-state work-sessions votes night-routine midday-checkin events history; do
    RESPONSE=$(curl -sf "$API/$endpoint" 2>/dev/null)
    if echo "$RESPONSE" | python3 -m json.tool &>/dev/null; then
      pass "GET /$endpoint returns valid JSON"
    else
      fail "GET /$endpoint failed or returned invalid JSON"
    fi
  done

  # POST /morning-block-log
  TEST_ITEM="test-integration-$(date +%s)"
  POST_RESULT=$(curl -sf -X POST "$API/morning-block-log" \
    -H "Content-Type: application/json" \
    -d "{\"itemId\":\"$TEST_ITEM\",\"status\":\"done\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" 2>/dev/null)
  if echo "$POST_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok')" 2>/dev/null; then
    pass "POST /morning-block-log returns {ok: true}"
    # Verify it was written to the file
    if python3 -c "
import json
d = json.load(open('$DATA_DIR/morning-block-log.json'))
ids = [i['id'] for i in d.get('items', [])]
assert '$TEST_ITEM' in ids, 'item not found in file'
" 2>/dev/null; then
      pass "POST /morning-block-log correctly writes to JSON file"
    else
      fail "POST /morning-block-log did not write to file"
    fi
  else
    fail "POST /morning-block-log failed"
  fi

  # POST /creative-block-log
  POST_RESULT=$(curl -sf -X POST "$API/creative-block-log" \
    -H "Content-Type: application/json" \
    -d '{"status":"in_progress","startedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' 2>/dev/null)
  if echo "$POST_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok')" 2>/dev/null; then
    pass "POST /creative-block-log returns {ok: true}"
  else
    fail "POST /creative-block-log failed"
  fi

  # History endpoint with a specific date (today)
  TODAY=$(date +%Y-%m-%d)
  HIST_RESPONSE=$(curl -sf "$API/history/$TODAY" 2>/dev/null)
  if echo "$HIST_RESPONSE" | python3 -m json.tool &>/dev/null; then
    pass "GET /history/:date returns valid JSON"
  else
    fail "GET /history/:date failed"
  fi

  # Health endpoint
  HEALTH=$(curl -sf "$API/health" 2>/dev/null)
  if echo "$HEALTH" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok')" 2>/dev/null; then
    pass "GET /health returns {ok: true}"
  else
    fail "GET /health failed"
  fi

  # New POST endpoints: sleep-data, fitmind-data, morning-state, creative-state, events
  for ep in sleep-data fitmind-data morning-state creative-state; do
    RESULT=$(curl -sf -X POST "$API/$ep" \
      -H "Content-Type: application/json" \
      -d '{"notes":"integration-test"}' 2>/dev/null)
    if echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok')" 2>/dev/null; then
      pass "POST /$ep returns {ok: true}"
    else
      fail "POST /$ep failed"
    fi
  done

  # POST /events
  EVENTS_RESULT=$(curl -sf -X POST "$API/events" \
    -H "Content-Type: application/json" \
    -d '{"events":[{"source":"test","type":"integration_test","payload":{}}]}' 2>/dev/null)
  if echo "$EVENTS_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok')" 2>/dev/null; then
    pass "POST /events returns {ok: true}"
  else
    fail "POST /events failed"
  fi

  # POST /work-sessions/start
  WS_START=$(curl -sf -X POST "$API/work-sessions/start" \
    -H "Content-Type: application/json" \
    -d '{"sessionId":99,"focus":"test","evaluationCriteria":"test"}' 2>/dev/null)
  if echo "$WS_START" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok')" 2>/dev/null; then
    pass "POST /work-sessions/start returns {ok: true}"
  else
    fail "POST /work-sessions/start failed"
  fi

  # POST /work-sessions/end
  WS_END=$(curl -sf -X POST "$API/work-sessions/end" \
    -H "Content-Type: application/json" \
    -d '{"sessionId":99,"outcomes":"test","outcomeScore":7,"flowScore":8,"compositeScore":7.4}' 2>/dev/null)
  if echo "$WS_END" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok')" 2>/dev/null; then
    pass "POST /work-sessions/end returns {ok: true}"
  else
    fail "POST /work-sessions/end failed"
  fi

  # POST /night-routine
  NR_RESULT=$(curl -sf -X POST "$API/night-routine" \
    -H "Content-Type: application/json" \
    -d '{"letGoCompleted":true,"letGoTimestamp":"2026-02-20T22:00:00Z"}' 2>/dev/null)
  if echo "$NR_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok')" 2>/dev/null; then
    pass "POST /night-routine returns {ok: true}"
  else
    fail "POST /night-routine failed"
  fi

  # Whitelist test: verify field injection is blocked
  curl -sf -X POST "$API/midday-checkin" \
    -H "Content-Type: application/json" \
    -d '{"energyScore":5,"badField":"INJECT","notes":"test"}' > /dev/null 2>&1
  if python3 -c "import json; d=json.load(open('$DATA_DIR/midday-checkin.json')); assert 'badField' not in d" 2>/dev/null; then
    pass "Field injection blocked (whitelist working)"
  else
    fail "Field injection NOT blocked — whitelist broken"
  fi

  # ── Badge system tests ──────────────────────────────────────────────────────

  # GET /badges
  BADGES_RESP=$(curl -sf "$API/badges" 2>/dev/null)
  BADGE_COUNT=$(echo "$BADGES_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('badges',[])))" 2>/dev/null)
  if [[ "$BADGE_COUNT" == "7" ]]; then
    pass "GET /badges returns 7 badges"
  else
    fail "GET /badges returned $BADGE_COUNT badges (expected 7)"
  fi

  # GET /badges/missions
  MISSIONS_RESP=$(curl -sf "$API/badges/missions" 2>/dev/null)
  MISSION_COUNT=$(echo "$MISSIONS_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('missions',[])))" 2>/dev/null)
  if [[ "$MISSION_COUNT" == "105" ]]; then
    pass "GET /badges/missions returns 105 missions"
  else
    fail "GET /badges/missions returned $MISSION_COUNT missions (expected 105)"
  fi

  # GET /badge-progress
  BP_RESP=$(curl -sf "$API/badge-progress" 2>/dev/null)
  if echo "$BP_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); assert len(d.get('badges',{})) == 7" 2>/dev/null; then
    pass "GET /badge-progress returns 7 badge progress entries"
  else
    fail "GET /badge-progress missing badges"
  fi

  # POST /badge-progress/exercise
  EX_RESULT=$(curl -sf -X POST "$API/badge-progress/exercise" \
    -H "Content-Type: application/json" \
    -d '{"badgeSlug":"rdf","exerciseId":"rdf-taste-training"}' 2>/dev/null)
  if echo "$EX_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok') and d.get('xpGained',0) > 0" 2>/dev/null; then
    pass "POST /badge-progress/exercise returns XP"
  else
    fail "POST /badge-progress/exercise failed"
  fi

  # POST /badge-progress/exercise — invalid badge rejected (returns 400)
  EX_BAD_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/badge-progress/exercise" \
    -H "Content-Type: application/json" \
    -d '{"badgeSlug":"fake","exerciseId":"fake"}' 2>/dev/null)
  if [[ "$EX_BAD_CODE" == "400" ]]; then
    pass "POST /badge-progress/exercise rejects invalid badge (400)"
  else
    fail "POST /badge-progress/exercise returned $EX_BAD_CODE (expected 400)"
  fi

  # POST /badge-missions/assign
  ASSIGN_RESULT=$(curl -sf -X POST "$API/badge-missions/assign" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null)
  ACTIVE_COUNT=$(echo "$ASSIGN_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('active',[])))" 2>/dev/null)
  if [[ "$ACTIVE_COUNT" == "7" ]]; then
    pass "POST /badge-missions/assign assigns 7 missions"
  else
    fail "POST /badge-missions/assign assigned $ACTIVE_COUNT missions (expected 7)"
  fi

  # POST /badge-missions/complete
  FIRST_MISSION=$(curl -sf "$API/badge-missions" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['active'][0]['missionId'] if d.get('active') else '')" 2>/dev/null)
  if [[ -n "$FIRST_MISSION" ]]; then
    MC_RESULT=$(curl -sf -X POST "$API/badge-missions/complete" \
      -H "Content-Type: application/json" \
      -d "{\"missionId\":\"$FIRST_MISSION\",\"success\":true}" 2>/dev/null)
    if echo "$MC_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok') and d.get('xpGained',0) > 0" 2>/dev/null; then
      pass "POST /badge-missions/complete returns XP"
    else
      fail "POST /badge-missions/complete failed"
    fi
  else
    fail "No active mission to complete"
  fi

  # GET /badge-daily
  BD_RESP=$(curl -sf "$API/badge-daily" 2>/dev/null)
  if echo "$BD_RESP" | python3 -m json.tool &>/dev/null; then
    pass "GET /badge-daily returns valid JSON"
  else
    fail "GET /badge-daily failed"
  fi

  # GET /badge-missions
  BM_RESP=$(curl -sf "$API/badge-missions" 2>/dev/null)
  if echo "$BM_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'active' in d and 'completed' in d" 2>/dev/null; then
    pass "GET /badge-missions has active + completed"
  else
    fail "GET /badge-missions missing structure"
  fi

  # ── VF Game tests ──────────────────────────────────────────────────────────

  # GET /vf-game (after POST to ensure server-generated stub)
  curl -sf -X POST "$API/vf-game" -H "Content-Type: application/json" -d '{"presenceScore":5}' > /dev/null 2>&1
  VF_RESP=$(curl -sf "$API/vf-game" 2>/dev/null)
  VF_AFF=$(echo "$VF_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('affirmations',[])))" 2>/dev/null)
  if [[ "$VF_AFF" == "7" ]]; then
    pass "GET /vf-game returns 7 affirmations"
  else
    fail "GET /vf-game returned $VF_AFF affirmations (expected 7)"
  fi

  # POST /vf-game
  VF_POST=$(curl -sf -X POST "$API/vf-game" \
    -H "Content-Type: application/json" \
    -d '{"presenceScore":8,"effortLevel":7,"affirmations":[{"badgeSlug":"rdf","convictionScore":9,"reinforcingActions":["test action"],"weakeningActions":[]}]}' 2>/dev/null)
  if echo "$VF_POST" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok')" 2>/dev/null; then
    pass "POST /vf-game returns {ok: true}"
  else
    fail "POST /vf-game failed"
  fi

  # VF Game generates votes
  VF_VOTES=$(curl -sf "$API/votes" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len([v for v in d.get('votes',[]) if v.get('source')=='vf-game']))" 2>/dev/null)
  if [[ "$VF_VOTES" -gt "0" ]]; then
    pass "VF Game generated votes in votes.json"
  else
    fail "VF Game did not generate votes"
  fi

  # ── Boss encounter tests ───────────────────────────────────────────────────

  # POST /boss-encounters
  BOSS_RESULT=$(curl -sf -X POST "$API/boss-encounters" \
    -H "Content-Type: application/json" \
    -d '{"badgeSlug":"frame-control","type":"text","title":"Test boss","content":"Integration test boss encounter"}' 2>/dev/null)
  if echo "$BOSS_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok') and d.get('xpGained',0) > 0" 2>/dev/null; then
    pass "POST /boss-encounters returns XP"
  else
    fail "POST /boss-encounters failed"
  fi

  # POST /boss-encounters — invalid type rejected (returns 400)
  BOSS_BAD_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/boss-encounters" \
    -H "Content-Type: application/json" \
    -d '{"badgeSlug":"rdf","type":"invalid","content":"test"}' 2>/dev/null)
  if [[ "$BOSS_BAD_CODE" == "400" ]]; then
    pass "POST /boss-encounters rejects invalid type (400)"
  else
    fail "POST /boss-encounters returned $BOSS_BAD_CODE (expected 400)"
  fi

  # GET /boss-encounters
  BOSS_LIST=$(curl -sf "$API/boss-encounters" 2>/dev/null)
  if echo "$BOSS_LIST" | python3 -c "import json,sys; d=json.load(sys.stdin); assert isinstance(d, list) and len(d) > 0" 2>/dev/null; then
    pass "GET /boss-encounters returns entries"
  else
    fail "GET /boss-encounters returned empty or invalid"
  fi

  # GET /boss-encounters?badge=frame-control
  BOSS_FILTERED=$(curl -sf "$API/boss-encounters?badge=frame-control" 2>/dev/null)
  if echo "$BOSS_FILTERED" | python3 -c "import json,sys; d=json.load(sys.stdin); assert all(e['badgeSlug']=='frame-control' for e in d)" 2>/dev/null; then
    pass "GET /boss-encounters?badge= filters correctly"
  else
    fail "GET /boss-encounters badge filter broken"
  fi

  # XP penalty test: conviction ≤ 3 should reduce XP
  PRE_XP=$(curl -sf "$API/badge-progress" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['badges']['fearlessness']['xp'])" 2>/dev/null)
  curl -sf -X POST "$API/vf-game" \
    -H "Content-Type: application/json" \
    -d '{"affirmations":[{"badgeSlug":"fearlessness","convictionScore":1,"reinforcingActions":[],"weakeningActions":[]}]}' > /dev/null 2>&1
  POST_XP=$(curl -sf "$API/badge-progress" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['badges']['fearlessness']['xp'])" 2>/dev/null)
  if [[ "$POST_XP" -le "$PRE_XP" ]]; then
    pass "VF Game conviction penalty works (XP: $PRE_XP → $POST_XP)"
  else
    fail "VF Game conviction penalty did not reduce XP ($PRE_XP → $POST_XP)"
  fi

  # Vote validation: invalid category rejected
  VOTE_RESULT=$(curl -sf -X POST "$API/votes" \
    -H "Content-Type: application/json" \
    -d '{"votes":[{"action":"test","category":"INVALID","polarity":"positive","source":"test"}]}' 2>/dev/null)
  ADDED=$(echo "$VOTE_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('added',0))" 2>/dev/null)
  if [[ "$ADDED" == "0" ]]; then
    pass "Invalid vote category rejected"
  else
    fail "Invalid vote category was accepted (should be rejected)"
  fi

else
  fail "File server not reachable on :3001 — start it with: npm run server"
  echo "  Skipping all file server tests."
fi

# ─── 5. App proxy config ─────────────────────────────────────────────────────

section "App Configuration"

if grep -q "'/api'" "$HOME/limitless-app/vite.config.js" 2>/dev/null; then
  pass "Vite proxy configured for /api"
else
  fail "Vite proxy not found in vite.config.js"
fi

if grep -q "'/api/morning-block-log'" "$HOME/limitless-app/src/App.jsx" 2>/dev/null; then
  pass "App uses /api/ prefix for file server calls"
else
  fail "App still using hardcoded localhost:3001"
fi

# ─── 6. Backup infrastructure ────────────────────────────────────────────────

section "Backup Infrastructure"

if [[ -d "$HOME/.openclaw/data/backups" ]]; then
  pass "Backup directory exists"
else
  fail "Backup directory missing at ~/.openclaw/data/backups"
fi

if [[ -d "$HOME/.openclaw/data/shared/history" ]]; then
  pass "History directory exists"
else
  fail "History directory missing (will be created on first day rollover)"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "─────────────────────────────"
TOTAL=$((PASS + FAIL))
echo -e "Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / $TOTAL total"

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}All systems go.${NC}"
  exit 0
else
  echo -e "${RED}$FAIL test(s) failed. Check above.${NC}"
  exit 1
fi
