# Limitless App

Personal daily operating system. Morning routine → AI agents → state tracking.

Built by Stratos for Stef.

## Architecture

React PWA (port 3000) + Express file server (port 3001) + OpenClaw AI agents on Telegram.

Full documentation: **[DOCS.md](./DOCS.md)**  
Execution plan: **[PLAN.md](./PLAN.md)**

## Quick Start

```bash
# Start everything
npm run dev:all

# App: http://localhost:3000
# File server: http://localhost:3001
```

## ⚠️ Security

**Never commit `~/.openclaw/openclaw.json`** — it contains Telegram bot tokens and API keys.  
It is not in this repo and must never be.

The file server (port 3001) has no authentication. It must never be exposed directly to the internet — always accessed via the Vite proxy through the Cloudflare tunnel.

## Stack

- Vite + React 18 + Tailwind CSS + Framer Motion
- Express (file server)
- OpenClaw (AI agent gateway)
- Telegram Bot API (4 bots: Stratos, Pulse, Dawn, Muse)

## Integration Tests

```bash
# Requires file server running (npm run server)
bash scripts/test-integrations.sh
```
