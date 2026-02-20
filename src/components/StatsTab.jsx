import { useEffect, useState } from 'react'

const CATEGORY_EMOJI = {
  nutrition: '🍽',
  work: '💼',
  'mental-power': '🧠',
  personality: '🔥',
  creativity: '🎨',
  physical: '💪',
  relationships: '🤝',
}

function VoteBar({ category, positive, negative }) {
  const total = positive + negative
  const posPct = total > 0 ? (positive / total) * 100 : 50

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {CATEGORY_EMOJI[category] || '•'} {category}
        </span>
        <span className="tabular-nums text-gray-600">
          +{positive} / -{negative}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="bg-green-500/60 transition-all duration-500"
          style={{ width: `${posPct}%` }}
        />
        <div
          className="bg-red-500/40 transition-all duration-500"
          style={{ width: `${100 - posPct}%` }}
        />
      </div>
    </div>
  )
}

function VoteItem({ vote }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className={`mt-0.5 text-xs ${vote.polarity === 'positive' ? 'text-green-400' : 'text-red-400'}`}>
        {vote.polarity === 'positive' ? '+' : '−'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-300 truncate">{vote.action}</p>
        <p className="text-xs text-gray-600">{vote.source} · {CATEGORY_EMOJI[vote.category]} {vote.category}</p>
      </div>
      {vote.weight !== 1 && (
        <span className="text-xs text-gray-600">×{vote.weight}</span>
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
      <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
        Could not load votes. Is the file server running?
      </div>
    )
  }

  if (!votes) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-gray-600">
        Loading...
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

  // Sort categories by total votes descending
  const sortedCategories = Object.entries(categories)
    .sort(([, a], [, b]) => (b.positive + b.negative) - (a.positive + a.negative))

  // Aggregate by source
  const sources = {}
  for (const v of allVotes) {
    if (!sources[v.source]) sources[v.source] = 0
    sources[v.source] += 1
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-lg font-semibold">Today's Votes</h2>
        <div className="mt-1 flex gap-4 text-xs text-gray-500">
          <span className="text-green-400">+{positive.length}</span>
          <span className="text-red-400">−{negative.length}</span>
          <span>{allVotes.length} total</span>
          {votes.date && <span>{votes.date}</span>}
        </div>
      </div>

      {allVotes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-gray-600">
          No votes yet today. They'll appear as you use the system.
        </div>
      ) : (
        <div className="space-y-4 px-4 pb-4">
          {/* Category breakdown */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">By Category</p>
            {sortedCategories.map(([cat, counts]) => (
              <VoteBar key={cat} category={cat} positive={counts.positive} negative={counts.negative} />
            ))}
          </div>

          {/* Source breakdown */}
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">By Source</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(sources).map(([src, count]) => (
                <span key={src} className="border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-gray-400">
                  {src} ({count})
                </span>
              ))}
            </div>
          </div>

          {/* Vote timeline */}
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">Timeline</p>
            <div className="mt-2 divide-y divide-white/5">
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
