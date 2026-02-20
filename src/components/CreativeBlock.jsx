import { useEffect, useMemo, useState } from 'react'

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export default function CreativeBlock({ startTime, onStart, onEnterWorkSessions }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!startTime) return undefined
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const elapsed = useMemo(() => {
    if (!startTime) return 0
    return now - startTime
  }, [now, startTime])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-card px-6 py-10 text-center">
      <div>
        <h2 className="text-2xl font-semibold text-white">Creative Block</h2>
        <p className="mt-2 text-sm text-gray-400">
          3 hours. No agenda. Create freely.
        </p>
      </div>

      {startTime ? (
        <div className="text-lg tracking-[0.3em] text-white">{formatDuration(elapsed)}</div>
      ) : (
        <button
          className="border border-white/20 bg-white/10 px-6 py-3 text-xs uppercase tracking-[0.3em] text-white"
          onClick={onStart}
        >
          Start Block
        </button>
      )}

      <a
        className="w-full border border-white/20 bg-white/10 px-4 py-3 text-center text-sm uppercase tracking-wider text-white"
        href="https://t.me/limitless_muse_bot"
        target="_blank"
        rel="noreferrer"
      >
        💬 Check In →
      </a>
      <button
        onClick={onEnterWorkSessions}
        className="text-xs uppercase tracking-[0.25em] text-gray-500"
      >
        Enter Work Sessions
      </button>
    </div>
  )
}
