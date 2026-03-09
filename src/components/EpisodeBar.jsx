import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { haptics } from '../utils/haptics.js'

function StatusDot({ status }) {
  const color = status === 'open' ? '#30D158' : status === 'closed' ? '#FF9F0A' : 'rgba(255,255,255,0.15)'
  return (
    <span className="relative flex h-2 w-2">
      {status === 'open' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ background: color }} />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  )
}

export default function EpisodeBar({ episode }) {
  const [expanded, setExpanded] = useState(false)

  if (!episode?.number) return null

  const plotCount = episode.plotPoints?.length || 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-white/[0.02] border-b border-white/[0.04]"
    >
      {/* Shimmer overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'episodeShimmer 6s ease-in-out infinite',
        }}
      />

      {/* Main bar — tappable */}
      <button
        type="button"
        onClick={() => { haptics.tap(); setExpanded(e => !e) }}
        className="flex w-full items-center justify-center gap-2.5 px-4 py-2"
      >
        <StatusDot status={episode.status} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-white/20">
          Ep. {episode.number}
        </span>
        {episode.title && (
          <>
            <span className="text-white/10">—</span>
            <span className="text-[11px] text-white/25 truncate max-w-[180px]">
              {episode.title}
            </span>
          </>
        )}
        {plotCount > 0 && (
          <>
            <span className="text-white/[0.06]">·</span>
            <span className="text-[10px] text-white/15 tabular-nums">{plotCount} scene{plotCount !== 1 ? 's' : ''}</span>
          </>
        )}
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-auto text-[10px] text-white/15"
        >
          ▾
        </motion.span>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-1 space-y-3">
              {episode.todaysArc && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/15 mb-1">Today's Arc</p>
                  <p className="text-[12px] italic text-white/30">"{episode.todaysArc}"</p>
                </div>
              )}
              {plotCount > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/15 mb-1.5">Scenes</p>
                  <div className="space-y-1.5">
                    {episode.plotPoints.slice(-5).map((pt, i) => (
                      <div key={pt.id || i} className="flex items-start gap-2">
                        <span className="mt-1 h-1 w-1 rounded-full bg-white/20 shrink-0" />
                        <span className="text-[11px] text-white/25">{pt.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes episodeShimmer {
          0%, 100% { background-position: -200% 0; }
          50% { background-position: 200% 0; }
        }
      `}</style>
    </motion.div>
  )
}
