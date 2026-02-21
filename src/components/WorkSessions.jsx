import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { haptics } from '../utils/haptics.js'
import { sounds } from '../utils/sounds.js'
import Confetti from './Confetti.jsx'

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
  return (
    <div className="flex items-center gap-2.5">
      {[1, 2, 3].map((n, i) => {
        let state = 'upcoming'
        if (phase === 'done') state = 'done'
        else if (session && n < session) state = 'done'
        else if (session && n === session) state = phase === 'running' ? 'active' : 'next'
        else if (!session && phase === 'break') state = n === 1 ? 'done' : n === 2 ? 'next' : 'upcoming'
        else if (!session && phase === 'lunch') state = n <= 2 ? 'done' : 'next'

        return (
          <div key={n} className="flex items-center gap-2.5">
            {i > 0 && (
              <div className={`h-[1px] w-6 transition-colors duration-300 ${
                state === 'done' || state === 'active' ? 'bg-white/20' : 'bg-white/[0.06]'
              }`} />
            )}
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold transition-all duration-300
              ${state === 'done' ? 'bg-white text-black' : ''}
              ${state === 'active' ? 'bg-white/[0.12] text-white ring-2 ring-white/10' : ''}
              ${state === 'next' ? 'bg-white/[0.06] text-white/40' : ''}
              ${state === 'upcoming' ? 'bg-white/[0.03] text-white/15' : ''}
            `}>
              {state === 'done' ? '\u2713' : n}
            </div>
          </div>
        )
      })}
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
  const [showConfetti, setShowConfetti] = useState(false)

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
    haptics.heavy()
    sounds.tap()
    const ts = new Date().toISOString()
    if (id === 1) setLocal((prev) => ({ ...prev, s1Start: ts }))
    if (id === 2) setLocal((prev) => ({ ...prev, s2Start: ts }))
    if (id === 3) setLocal((prev) => ({ ...prev, s3Start: ts }))
  }

  const endSession = (id) => {
    haptics.success()
    sounds.complete()
    const ts = new Date().toISOString()
    if (id === 1) setLocal((prev) => ({ ...prev, s1End: ts }))
    if (id === 2) setLocal((prev) => ({ ...prev, s2End: ts }))
    if (id === 3) {
      setLocal((prev) => ({ ...prev, s3End: ts }))
      setShowConfetti(true)
      sounds.success()
      setTimeout(() => setShowConfetti(false), 2500)
    }
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
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <Confetti active={showConfetti} />
        <SessionDots phase="done" session={null} />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-[28px] font-bold tracking-tight">Sessions complete.</h1>
          <p className="mt-2 text-[15px] text-white/35">3 of 3 done. Go rest.</p>
        </motion.div>
        <div className="w-full space-y-3">
          <motion.a
            whileTap={{ scale: 0.97 }}
            href="https://t.me/limitless_forge_bot"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-2xl bg-white/[0.06] px-5 py-3.5 text-[15px] font-medium text-white/50"
          >
            Review with Forge
          </motion.a>
          <button
            onClick={() => {
              haptics.tap()
              onEnterNightMode()
            }}
            className="mx-auto block py-2 text-[13px] font-medium text-white/20"
          >
            Night Mode
          </button>
        </div>
      </div>
    )
  }

  // ── BREAK (between session 1 and 2) ───────────────
  if (phase === 'break') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <SessionDots phase="break" session={2} />
        <div>
          <p className="text-[13px] font-medium uppercase tracking-widest text-white/25">Break</p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight">10 minutes</h1>
        </div>
        <div className={`font-mono text-[56px] font-extralight tracking-[0.04em] tabular-nums ${breakTimer.over ? 'text-red-400/80' : 'text-white'}`}>
          {breakTimer.over ? `+${breakTimer.str}` : breakTimer.str}
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => startSession(2)}
          className="w-full rounded-2xl bg-white/[0.08] px-5 py-[18px] text-[15px] font-semibold text-white"
        >
          Start Session 2
        </motion.button>
      </div>
    )
  }

  // ── LUNCH (between session 2 and 3) ───────────────
  if (phase === 'lunch') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <SessionDots phase="lunch" session={3} />
        <div>
          <p className="text-[13px] font-medium uppercase tracking-widest text-white/25">Lunch</p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight">30 minutes</h1>
        </div>
        <div className={`font-mono text-[56px] font-extralight tracking-[0.04em] tabular-nums ${lunchTimer.over ? 'text-red-400/80' : 'text-white'}`}>
          {lunchTimer.over ? `+${lunchTimer.str}` : lunchTimer.str}
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => startSession(3)}
          className="w-full rounded-2xl bg-white/[0.08] px-5 py-[18px] text-[15px] font-semibold text-white"
        >
          Start Session 3
        </motion.button>
      </div>
    )
  }

  // ── PRE-SESSION ────────────────────────────────────
  if (phase === 'pre') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <SessionDots phase="pre" session={session} />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-[13px] font-medium uppercase tracking-widest text-white/25">
            Session {session} of 3
          </p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight">90 minutes</h1>
        </motion.div>
        <div className="font-mono text-[56px] font-extralight tracking-[0.04em] tabular-nums text-white/15">
          90:00
        </div>
        <div className="w-full space-y-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => startSession(session)}
            className="w-full rounded-2xl bg-white/[0.08] px-5 py-[18px] text-[15px] font-semibold text-white"
          >
            Start Timer
          </motion.button>
          <motion.a
            whileTap={{ scale: 0.97 }}
            href="https://t.me/limitless_forge_bot"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center py-2 text-[13px] font-medium text-white/25"
          >
            Talk to Forge
          </motion.a>
        </div>
      </div>
    )
  }

  // ── RUNNING ────────────────────────────────────────
  if (phase === 'running') {
    const startKey = session === 1 ? local.s1Start : session === 2 ? local.s2Start : local.s3Start
    const elapsedMs = startKey ? now - new Date(startKey).getTime() : 0
    const pct = Math.min(elapsedMs / SESSION_MS, 1)
    const circumference = 2 * Math.PI * 54
    const offset = circumference * (1 - pct)

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <SessionDots phase="running" session={session} />
        <div>
          <p className="text-[13px] font-medium uppercase tracking-widest text-white/25">
            Session {session} of 3
          </p>
        </div>

        {/* Timer with progress ring */}
        <div className="relative flex items-center justify-center">
          <svg className="h-40 w-40 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,0.04)" strokeWidth="3" fill="none" />
            <motion.circle
              cx="60" cy="60" r="54"
              stroke={sessionTimer.over ? 'rgba(255,69,58,0.5)' : 'rgba(255,255,255,0.15)'}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <div className={`absolute font-mono text-[36px] font-extralight tracking-[0.04em] tabular-nums ${sessionTimer.over ? 'text-red-400/80' : 'text-white'}`}>
            {sessionTimer.over ? `+${sessionTimer.str}` : sessionTimer.str}
          </div>
        </div>

        <div className="w-full space-y-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => endSession(session)}
            className="w-full rounded-2xl bg-white/[0.08] px-5 py-[18px] text-[15px] font-semibold text-white"
          >
            End Timer
          </motion.button>
          <motion.a
            whileTap={{ scale: 0.97 }}
            href="https://t.me/limitless_forge_bot"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center py-2 text-[13px] font-medium text-white/25"
          >
            Talk to Forge
          </motion.a>
        </div>
      </div>
    )
  }

  return null
}
