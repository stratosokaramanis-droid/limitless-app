# Limitless System — Deployment Guide

Everything you need to go from zero to fully running.

---

## Prerequisites

- Node.js v18+
- [OpenClaw](https://github.com/openclaw/openclaw) installed and running
- A Telegram bot token for each agent (create via [@BotFather](https://t.me/BotFather))
- Anthropic API key (for Claude Opus/Sonnet agents)
- Optionally: OpenRouter or OpenAI API key (for Kimi/GPT agents)

---

## 1. Clone and install

```bash
git clone https://github.com/stratosokaramanis-droid/limitless-app.git
cd limitless-app
npm install
```

---

## 2. Create the data directory and initialize the database

```bash
mkdir -p ~/.openclaw/data/shared
```

The server stores all runtime state in a SQLite database at `~/.openclaw/data/shared/limitless.db`. The database is created automatically on first server start, with schema applied from `server/schema.sql`.

**If migrating from the old JSON file-based server:**
```bash
npm run migrate
```

This reads all existing JSON/JSONL files from `~/.openclaw/data/shared/` and inserts them into the SQLite database. The script is idempotent (safe to run multiple times). Keep the old JSON files as a rollback safety net for a week.

---

## 3. Set up agents

```bash
./scripts/setup-agents.sh
```

This will:
- Create workspace dirs for all 6 agents under `~/.openclaw/agents/`
- Copy each agent's `SOUL.md` into their workspace
- Copy Faith's knowledge files into `~/.openclaw/agents/faith/workspace/knowledge/`
- Print the config blocks you need to paste into `openclaw.json`

**Also copy Void's knowledge files manually:**
```bash
mkdir -p ~/.openclaw/agents/vf-game/workspace/knowledge
cp agents/void/knowledge/* ~/.openclaw/agents/vf-game/workspace/knowledge/
```

---

## 4. Configure OpenClaw

Open `~/.openclaw/openclaw.json` and:

**a) Add agents to the `agents.list` array** (printed by setup script)

**b) Add Telegram accounts** — one per agent bot. Fill in your actual bot tokens:

```json
"accounts": {
  "pulse":  { "dmPolicy": "allowlist", "botToken": "TOKEN", "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" },
  "faith":  { "dmPolicy": "allowlist", "botToken": "TOKEN", "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" },
  "ruby":   { "dmPolicy": "allowlist", "botToken": "TOKEN", "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" },
  "forge":  { "dmPolicy": "allowlist", "botToken": "TOKEN", "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" },
  "luna":   { "dmPolicy": "allowlist", "botToken": "TOKEN", "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" },
  "void":   { "dmPolicy": "allowlist", "botToken": "TOKEN", "allowFrom": ["YOUR_TG_ID"], "groupPolicy": "allowlist", "streaming": "partial" }
}
```

**c) Restart OpenClaw:**
```bash
openclaw gateway restart
```

---

## 5. Run the app

**Development (Vite + server with hot reload):**
```bash
npm run dev:all
```

**Production (built frontend + server):**
```bash
npm run build
npm run server
# Vite preview or serve the dist/ folder separately
```

- File server (API): `localhost:3001`
- Vite dev server: `localhost:3002`
- Vite proxies `/api/*` → `localhost:3001`

---

## 6. (Optional) Cloudflare Tunnel

To expose the app publicly via a custom domain:

```bash
# Install cloudflared
# Then create a tunnel via Cloudflare dashboard and get a token

# Run as a systemd service:
sudo tee /etc/systemd/system/cloudflared.service > /dev/null <<EOF
[Unit]
Description=cloudflared
After=network-online.target
Wants=network-online.target

[Service]
TimeoutStartSec=15
Type=notify
ExecStart=/usr/bin/cloudflared --no-autoupdate tunnel run --token YOUR_TUNNEL_TOKEN
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

The tunnel routes `your-domain.com` → `localhost:3002`.

Also update `vite.config.js` to allow your domain:
```js
server: {
  allowedHosts: ['your-domain.com']
}
```

---

## What's in the repo vs what stays local

| Thing | In repo? | Notes |
|---|---|---|
| React app (all UI) | ✅ | |
| Express server | ✅ | |
| Agent SOUL.md files | ✅ | `agents/*/SOUL.md` |
| Faith's knowledge files | ✅ | `faith-knowledge/` |
| Void's knowledge files | ✅ | `agents/void/knowledge/` |
| Data schema docs | ✅ | `server/DATA_SCHEMA.md` |
| Static config (badges, missions, affirmations) | ✅ | `server/data/` |
| Setup script | ✅ | `scripts/setup-agents.sh` |
| Bot tokens | ❌ | Add to `openclaw.json` manually |
| API keys | ❌ | Add to OpenClaw config manually |
| SQLite database | ❌ | `~/.openclaw/data/shared/limitless.db` — created on first start |
| Migration script | ✅ | `server/migrate-to-sqlite.js` — one-time JSON → SQLite |
| DB schema | ✅ | `server/schema.sql` — single source of truth |
| Cloudflare tunnel token | ❌ | Create via Cloudflare dashboard |

---

## Agent map

| Agent | Bot | Model | Role |
|---|---|---|---|
| Pulse | `limitless_pulse_bot` | gpt-5.2 | Screenshots, state tracking |
| Faith | — | claude-opus-4-6 | Morning ritual + pre-creative check-in |
| Ruby | — | claude-opus-4-6 | Daytime: meals, key decisions, dopamine, screenshots |
| Forge | `limitless_forge_bot` | gpt-5.2 | Work session start/end |
| Luna | `limitless_luna_bot` | claude-opus-4-6 | Night routine, vote translation (anytime) |
| Void | — | claude-opus-4-6 | VF Game — inner work mirror |
