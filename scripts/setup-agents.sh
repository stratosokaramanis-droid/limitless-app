#!/usr/bin/env bash
# =============================================================================
# Limitless System — Agent Setup Script
# =============================================================================
# Sets up all Limitless agent workspaces for OpenClaw.
#
# Usage:
#   ./scripts/setup-agents.sh
#
# What it does:
#   1. Creates workspace dirs for each agent under ~/.openclaw/agents/
#   2. Copies each agent's SOUL.md into its workspace
#   3. Prints the openclaw.json agent config block to add manually
#   4. Prints the Telegram accounts block to fill in with bot tokens
#
# What it does NOT do:
#   - Add bot tokens (those stay out of the repo, add them manually)
#   - Modify openclaw.json directly (do that yourself after reviewing)
# =============================================================================

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_DIR="$HOME/.openclaw"
AGENTS_DIR="$OPENCLAW_DIR/agents"

echo "=== Limitless Agent Setup ==="
echo "Repo: $REPO_DIR"
echo "OpenClaw agents dir: $AGENTS_DIR"
echo ""

# Agent definitions: "agent-id|name|soul-source|model"
AGENTS=(
  "limitless-state|Pulse|pulse|openai-codex/gpt-5.2"
  "faith|Faith|faith|anthropic/claude-opus-4-6"
  "ruby|Ruby|ruby|anthropic/claude-opus-4-6"
  "work-session|Forge|forge|openai-codex/gpt-5.2"
  "night-routine|Luna|luna|anthropic/claude-opus-4-6"
  "vf-game|Void|void|anthropic/claude-opus-4-6"
)

# Faith also needs her knowledge files
FAITH_KNOWLEDGE_SRC="$REPO_DIR/faith-knowledge"
FAITH_KNOWLEDGE_DST="$AGENTS_DIR/faith/workspace/knowledge"

echo "--- Setting up agent workspaces ---"
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r id name src_dir model <<< "$entry"
  workspace="$AGENTS_DIR/$id/workspace"
  soul_src="$REPO_DIR/agents/$src_dir/SOUL.md"

  mkdir -p "$workspace"
  if [ -f "$soul_src" ]; then
    cp "$soul_src" "$workspace/SOUL.md"
    echo "✓ $name ($id) — SOUL.md installed to $workspace"
  else
    echo "✗ $name ($id) — SOUL.md not found at $soul_src"
  fi
done

# Faith's knowledge files
if [ -d "$FAITH_KNOWLEDGE_SRC" ]; then
  mkdir -p "$FAITH_KNOWLEDGE_DST"
  cp -r "$FAITH_KNOWLEDGE_SRC/"* "$FAITH_KNOWLEDGE_DST/"
  echo "✓ Faith — knowledge files installed to $FAITH_KNOWLEDGE_DST"
else
  echo "✗ Faith — knowledge dir not found at $FAITH_KNOWLEDGE_SRC"
fi

echo ""
echo "--- Done. ---"
echo ""
echo "==================================================="
echo "Next step: add the following to your openclaw.json"
echo "==================================================="
echo ""
echo 'Add to "agents" > "list" array:'
echo ""
cat << 'EOF'
[
  {
    "id": "limitless-state",
    "name": "Pulse",
    "workspace": "~/.openclaw/agents/limitless-state/workspace",
    "model": "openai-codex/gpt-5.2",
    "identity": { "name": "Pulse", "theme": "state tracking sensor", "emoji": "📊" }
  },
  {
    "id": "faith",
    "name": "Faith",
    "workspace": "~/.openclaw/agents/faith/workspace",
    "model": "anthropic/claude-opus-4-6",
    "identity": { "name": "Faith", "theme": "Morning ritual and pre-creative check-in", "emoji": "🕊️" }
  },
  {
    "id": "ruby",
    "name": "Ruby",
    "workspace": "~/.openclaw/agents/ruby/workspace",
    "model": "anthropic/claude-opus-4-6",
    "identity": { "name": "Ruby", "theme": "Daytime conversational agent", "emoji": "💎" }
  },
  {
    "id": "work-session",
    "name": "Forge",
    "workspace": "~/.openclaw/agents/work-session/workspace",
    "model": "openai-codex/gpt-5.2",
    "identity": { "name": "Forge", "theme": "Work session coach", "emoji": "⚡" }
  },
  {
    "id": "night-routine",
    "name": "Luna",
    "workspace": "~/.openclaw/agents/night-routine/workspace",
    "model": "anthropic/claude-opus-4-6",
    "identity": { "name": "Luna", "theme": "Night routine and planning", "emoji": "🌙" }
  },
  {
    "id": "vf-game",
    "name": "Void",
    "workspace": "~/.openclaw/agents/vf-game/workspace",
    "model": "anthropic/claude-opus-4-6",
    "identity": { "name": "Void", "theme": "VF Game mirror and inner work exploration", "emoji": "🪞" }
  }
]
EOF

echo ""
echo 'Add to "channels" > "telegram" > "accounts" (fill in your bot tokens):'
echo ""
cat << 'EOF'
{
  "pulse":  { "dmPolicy": "allowlist", "botToken": "<PULSE_BOT_TOKEN>",  "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" },
  "faith":  { "dmPolicy": "allowlist", "botToken": "<FAITH_BOT_TOKEN>",  "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" },
  "ruby":   { "dmPolicy": "allowlist", "botToken": "<RUBY_BOT_TOKEN>",   "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" },
  "forge":  { "dmPolicy": "allowlist", "botToken": "<FORGE_BOT_TOKEN>",  "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" },
  "luna":   { "dmPolicy": "allowlist", "botToken": "<LUNA_BOT_TOKEN>",   "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" },
  "void":   { "dmPolicy": "allowlist", "botToken": "<VOID_BOT_TOKEN>",   "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" }
}
EOF

echo ""
echo "Each account in 'accounts' maps to an agent by account key → agentId."
echo "The account key must match the 'id' field in the agents list (or set accountId on the binding)."
echo ""
echo "=== Setup complete ==="
