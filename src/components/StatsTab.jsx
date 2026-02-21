import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const CATEGORY_COLORS = {
  nutrition: '#30D158',
  work: '#5E9EFF',
  'mental-power': '#BF5AF2',
  personality: '#FF9F0A',
  creativity: '#FF375F',
  physical: '#64D2FF',
  relationships: '#FFD60A',
}

const MAX_DOTS = 24

function VotePile({ category, positive, negative, delay = 0 }) {
  const color = CATEGORY_COLORS[category] || '#ffffff'
  const posDots = Math.min(positive, MAX_DOTS)
  const negDots = Math.min(negative, MAX_DOTS)
  const posOverflow = positive > MAX_DOTS ? positive - MAX_DOTS : 0
  const negOverflow = negative > MAX_DOTS ? negative - MAX_DOTS : 0

  return (
    <div className="space-y-2.5">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-medium text-white/40">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {category}
        </span>
        <span className="text-[11px] font-medium tabular-nums text-white/20">
          +{positive} / -{negative}
        </span>
      </div>

      {/* Piles */}
      <div className="flex items-end gap-0">
        {/* Positive pile — right-aligned, grows toward center */}
        <div className="flex flex-1 justify-end">
          <div className="flex flex-wrap-reverse justify-end gap-[3px]" style={{ maxWidth: '100%' }}>
            {Array.from({ length: posDots }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: delay + i * 0.025,
                  type: 'spring',
                  stiffness: 600,
                  damping: 28,
                }}
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: 'rgba(48, 209, 88, 0.55)' }}
              />
            ))}
            {posOverflow > 0 && (
              <span className="self-center text-[10px] text-white/20 mr-1">+{posOverflow}</span>
            )}
          </div>
        </div>

        {/* Center divider */}
        <div className="mx-2 w-px self-stretch min-h-[10px] bg-white/[0.08] flex-shrink-0" />

        {/* Negative pile — left-aligned, grows away from center */}
        <div className="flex flex-1 justify-start">
          <div className="flex flex-wrap-reverse justify-start gap-[3px]" style={{ maxWidth: '100%' }}>
            {Array.from({ length: negDots }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: delay + i * 0.025 + 0.08,
                  type: 'spring',
                  stiffness: 600,
                  damping: 28,
                }}
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: 'rgba(255, 69, 58, 0.5)' }}
              />
            ))}
            {negOverflow > 0 && (
              <span className="self-center text-[10px] text-white/20 ml-1">+{negOverflow}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function VoteItem({ vote }) {
  const color = CATEGORY_COLORS[vote.category] || '#ffffff'

  return (
    <div className="flex items-start gap-3 py-3">
      <span className={`mt-0.5 text-[14px] font-semibold ${
        vote.polarity === 'positive' ? 'text-positive/60' : 'text-negative/60'
      }`}>
        {vote.polarity === 'positive' ? '+' : '−'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] leading-snug text-white/60">{vote.action}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-white/15">
          {vote.source}
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {vote.category}
        </p>
      </div>
      {vote.weight !== 1 && (
        <span className="text-[12px] font-medium text-white/15">{vote.weight}x</span>
      )}
    </div>
  )
}

export default function StatsTab() {
  const [votes, setVotes] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/votes')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setVotes(data)
        else setError(true)
      })
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-[15px] text-white/25">
        Could not load votes.
      </div>
    )
  }

  if (!votes) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    )
  }

  const allVotes = votes.votes || []
  const positive = allVotes.filter((v) => v.polarity === 'positive')
  const negative = allVotes.filter((v) => v.polarity === 'negative')

  // Aggregate by category
  const categories = {}
  for (const v of allVotes) {
    if (!categories[v.category]) categories[v.category] = { positive: 0, negative: 0 }
    categories[v.category][v.polarity] += 1
  }

  const sortedCategories = Object.entries(categories)
    .sort(([, a], [, b]) => (b.positive + b.negative) - (a.positive + a.negative))

  // Aggregate by source
  const sources = {}
  for (const v of allVotes) {
    if (!sources[v.source]) sources[v.source] = 0
    sources[v.source] += 1
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-[28px] font-bold tracking-tight">Votes</h1>
        <div className="mt-2 flex items-center gap-3 text-[13px]">
          <span className="font-medium text-positive/60">+{positive.length}</span>
          <span className="font-medium text-negative/60">−{negative.length}</span>
          <span className="text-white/20">{allVotes.length} total</span>
        </div>
        <a
          href="https://t.me/limitless_luna_bot"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-white/40 active:bg-white/[0.1]"
        >
          💬 Review with Luna
        </a>
      </div>

      {allVotes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-center text-[15px] leading-relaxed text-white/25">
            No votes yet today. They'll appear as you use the system.
          </p>
        </div>
      ) : (
        <div className="space-y-8 px-6 pb-6">
          {/* Category breakdown — vote piles */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-widest text-white/15">
                By Category
              </p>
              <div className="flex items-center gap-3 text-[10px] font-medium text-white/15 uppercase tracking-widest">
                <span className="text-positive/40">pos</span>
                <span className="w-px h-3 bg-white/[0.08]" />
                <span className="text-negative/40">neg</span>
              </div>
            </div>
            {sortedCategories.map(([cat, counts], i) => (
              <VotePile
                key={cat}
                category={cat}
                positive={counts.positive}
                negative={counts.negative}
                delay={i * 0.05}
              />
            ))}
          </div>

          {/* Source breakdown */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-white/15">
              By Source
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(sources).map(([src, count]) => (
                <span
                  key={src}
                  className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/30"
                >
                  {src} ({count})
                </span>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-white/15">
              Timeline
            </p>
            <div className="mt-2 divide-y divide-white/[0.03]">
              {[...allVotes].reverse().map((vote) => (
                <VoteItem key={vote.id} vote={vote} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
