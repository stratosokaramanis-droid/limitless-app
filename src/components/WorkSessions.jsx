import { useEffect, useMemo, useState } from 'react'

const SESSION_MS = 90 * 60 * 1000 // 90 min
const BREAK_MS = 10 * 60 * 1000   // 10 min
const LUNCH_MS = 30 * 60 * 1000   // 30 min
const LS_KEY = 'limitless_work_sessions'

const DEFAULT = {
  s1Start: null, s1End: null,
  s2Start: null, s2End: null,
  s3Start: null, s3End: null,
  breakStart: null, lunchStart: null,
}

function pad(n) { return String(n).padStart(2, '0') }

function fmtMs(ms) {
  const over = ms < 0
  const abs = Math.abs(ms)
  const m = Math.floor(abs / 60000)
  const s = Math.floor((abs % 60000) / 1000)
  return { str: `${pad(m)}:${pad(s)}`, over }
}

function derivePhase(l) {
  if (!l.s1Start)  return { phase: 'pre', session: 1 }
  if (!l.s1End)    return { phase: 'running', session: 1 }
  if (!l.s2Start)  return { phase: 'break', session: null }
  if (!l.s2End)    return { phase: 'running', session: 2 }
  if (!l.s3Start)  return { phase: 'lunch', session: null }
  if (!l.s3End)    return { phase: 'running', session: 3 }
  return { phase: 'done', session: null }
}

function SessionDots({ phase, session }) {
  const statuses = [1, 2, 3].map((n) => {
    if (phase === 'done') return 'done'
    if (n < session) return 'done'
    if (n === session) return phase === 'running' ? 'active' : 'next'
    return 'upcoming'
  })

  return (
    <div className="flex items-center gap-2">
      {statuses.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && <div className="h-px w-4 bg-white/10" />}
          <div
            className={`flex h-5 w-5 items-center justify-center text-xs
              ${s === 'done' ? 'text-white/60' : ''}
              ${s === 'active' ? 'text-white' : ''}
              ${s === 'next' ? 'text-white/40' : ''}
              ${s === 'upcoming' ? 'text-white/20' : ''}
            `}
          >
            {s === 'done' ? '✓' : `${i + 1}`}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function WorkSessions({ onEnterNightMode }) {
  const [local, setLocal] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT
    } catch {
      return DEFAULT
    }
  })
  const [now, setNow] = useState(Date.now())

  // Persist local state
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(local))
  }, [local])

  // Tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Reconcile with server
  useEffect(() => {
    fetch('/api/work-sessions')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return
        const today = new Date().toISOString().slice(0, 10)
        if (data.date !== today || !data.sessions?.length) return
        setLocal((prev) => {
          const next = { ...prev }
          for (const s of data.sessions) {
            if (!s.endedAt) continue
            if (s.id === 1) { next.s1Start = next.s1Start || s.startedAt; next.s1End = next.s1End || s.endedAt }
            if (s.id === 2) { next.s2Start = next.s2Start || s.startedAt; next.s2End = next.s2End || s.endedAt }
            if (s.id === 3) { next.s3Start = next.s3Start || s.startedAt; next.s3End = next.s3End || s.endedAt }
          }
          return next
        })
      })
      .catch(() => {})
  }, [])

  // Auto-start break/lunch timers
  useEffect(() => {
    const { phase } = derivePhase(local)
    if (phase === 'break' && !local.breakStart) {
      setLocal((prev) => ({ ...prev, breakStart: Date.now() }))
    }
    if (phase === 'lunch' && !local.lunchStart) {
      setLocal((prev) => ({ ...prev, lunchStart: Date.now() }))
    }
  }, [local])

  const { phase, session } = useMemo(() => derivePhase(local), [local])

  const startSession = (id) => {
    const ts = new Date().toISOString()
    if (id === 1) setLocal((prev) => ({ ...prev, s1Start: ts }))
    if (id === 2) setLocal((prev) => ({ ...prev, s2Start: ts }))
    if (id === 3) setLocal((prev) => ({ ...prev, s3Start: ts }))
  }

  const endSession = (id) => {
    const ts = new Date().toISOString()
    if (id === 1) setLocal((prev) => ({ ...prev, s1End: ts }))
    if (id === 2) setLocal((prev) => ({ ...prev, s2End: ts }))
    if (id === 3) setLocal((prev) => ({ ...prev, s3End: ts }))
  }

  const sessionTimer = useMemo(() => {
    const startKey = session === 1 ? local.s1Start : session === 2 ? local.s2Start : local.s3Start
    if (!startKey) return { str: '90:00', over: false }
    const elapsed = now - new Date(startKey).getTime()
    return fmtMs(SESSION_MS - elapsed)
  }, [session, local, now])

  const breakTimer = useMemo(() => {
    if (!local.breakStart) return { str: '10:00', over: false }
    return fmtMs(BREAK_MS - (now - local.breakStart))
  }, [local.breakStart, now])

  const lunchTimer = useMemo(() => {
    if (!local.lunchStart) return { str: '30:00', over: false }
    return fmtMs(LUNCH_MS - (now - local.lunchStart))
  }, [local.lunchStart, now])

  // ── DONE ──────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <SessionDots phase="done" session={null} />
        <div>
          <h2 className="text-2xl font-semibold">Work sessions complete.</h2>
          <p className="mt-2 text-sm text-gray-400">3 of 3 done. Go rest.</p>
        </div>
        <a
          href="https://t.me/limitless_forge_bot"
          target="_blank"
          rel="noreferrer"
          className="w-full border border-white/20 bg-white/10 px-4 py-3 text-center text-sm uppercase tracking-wider text-white"
        >
          💬 Review with Forge →
        </a>
        <button
          onClick={onEnterNightMode}
          className="text-xs uppercase tracking-[0.25em] text-gray-500"
        >
          Enter Night Mode
        </button>
      </div>
    )
  }

  // ── BREAK (between session 1 and 2) ───────────────
  if (phase === 'break') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <SessionDots phase="break" session={2} />
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Break</p>
          <h2 className="mt-1 text-2xl font-semibold">10 minutes</h2>
        </div>
        <div className={`font-mono text-5xl tracking-[0.15em] ${breakTimer.over ? 'text-red-400' : 'text-white'}`}>
          {breakTimer.str}
        </div>
        <button
          onClick={() => startSession(2)}
          className="w-full border border-white/20 bg-white/10 px-4 py-3 text-xs uppercase tracking-[0.3em] text-white"
        >
          Start Session 2 →
        </button>
      </div>
    )
  }

  // ── LUNCH (between session 2 and 3) ───────────────
  if (phase === 'lunch') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <SessionDots phase="lunch" session={3} />
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Lunch Break</p>
          <h2 className="mt-1 text-2xl font-semibold">30 minutes</h2>
        </div>
        <div className={`font-mono text-5xl tracking-[0.15em] ${lunchTimer.over ? 'text-red-400' : 'text-white'}`}>
          {lunchTimer.str}
        </div>
        <button
          onClick={() => startSession(3)}
          className="w-full border border-white/20 bg-white/10 px-4 py-3 text-xs uppercase tracking-[0.3em] text-white"
        >
          Start Session 3 →
        </button>
      </div>
    )
  }

  // ── PRE-SESSION ────────────────────────────────────
  if (phase === 'pre') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <SessionDots phase="pre" session={session} />
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
            Session {session} of 3
          </p>
          <h2 className="mt-1 text-2xl font-semibold">90 minutes</h2>
        </div>
        <div className="font-mono text-5xl tracking-[0.15em] text-white/20">
          90:00
        </div>
        <a
          href="https://t.me/limitless_forge_bot"
          target="_blank"
          rel="noreferrer"
          onClick={() => startSession(session)}
          className="w-full border border-white/20 bg-white/10 px-4 py-3 text-center text-sm uppercase tracking-wider text-white"
        >
          💬 Start Session →
        </a>
        <p className="text-xs text-gray-600">Tell Forge what you're building</p>
      </div>
    )
  }

  // ── RUNNING ────────────────────────────────────────
  if (phase === 'running') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <SessionDots phase="running" session={session} />
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
            Session {session} of 3
          </p>
          <h2 className="mt-1 text-2xl font-semibold">In Progress</h2>
        </div>
        <div className={`font-mono text-5xl tracking-[0.15em] ${sessionTimer.over ? 'text-red-400' : 'text-white'}`}>
          {sessionTimer.over ? `+${sessionTimer.str}` : sessionTimer.str}
        </div>
        <a
          href="https://t.me/limitless_forge_bot"
          target="_blank"
          rel="noreferrer"
          onClick={() => endSession(session)}
          className="w-full border border-white/20 bg-white/10 px-4 py-3 text-center text-sm uppercase tracking-wider text-white"
        >
          💬 End Session →
        </a>
        <p className="text-xs text-gray-600">Debrief with Forge · scores + votes</p>
      </div>
    )
  }

  return null
}
