import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'

const DAY_MS = 24 * 60 * 60 * 1000

const slideVariants = {
  enter: { x: 80, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -80, opacity: 0 }
}

function formatCategoryLabel(category, categories) {
  const info = categories?.[category]
  if (info?.label) return `${info.emoji} ${info.label}`
  return category ? category.replace('-', ' ') : ''
}

function ScoreRow({ label, hint, value, onChange }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-white">{label}</p>
          <p className="mt-1 text-[12px] text-white/40">{hint}</p>
        </div>
        <div className="text-[22px] font-bold tabular-nums text-white">{value}</div>
      </div>
      <Slider.Root
        className="relative mt-4 flex h-10 w-full touch-none select-none items-center"
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={10}
        step={1}
      >
        <Slider.Track className="relative h-[6px] grow rounded-full bg-white/[0.08]">
          <Slider.Range className="absolute h-full rounded-full bg-white/60" />
        </Slider.Track>
        <Slider.Thumb className="block h-7 w-7 rounded-full bg-white shadow-lg shadow-white/20 focus:outline-none" />
      </Slider.Root>
      <div className="mt-2 flex justify-between text-[10px] text-white/20">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  )
}

export default function VFGame({ onBack }) {
  const [affirmations, setAffirmations] = useState([])
  const [categories, setCategories] = useState({})
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('intro')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [penalty, setPenalty] = useState(null)
  const [showSkippedNote, setShowSkippedNote] = useState(false)
  const penaltyPostedRef = useRef(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    fetch('/api/affirmations')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!isMounted || !data) return
        setAffirmations(data.affirmations || [])
        setCategories(data.categories || {})
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    if (affirmations.length === 0) return
    setScores((prev) => {
      const next = { ...prev }
      for (const affirmation of affirmations) {
        if (!next[affirmation.index]) {
          next[affirmation.index] = { resistanceScore: 0, convictionScore: 0 }
        }
      }
      return next
    })
  }, [affirmations])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const skippedFlag = localStorage.getItem('limitless_vf_skipped')
    if (skippedFlag && skippedFlag !== today) {
      setShowSkippedNote(true)
      localStorage.removeItem('limitless_vf_skipped')
      return
    }

    const completedDate = localStorage.getItem('limitless_vf_completed_date')
    // Don't block re-entry, just skip penalty checks if already completed today
    if (completedDate === today) return

    const storedStart = localStorage.getItem('limitless_day_start')
    const dayStartTimestamp = storedStart ? Number(storedStart) : null

    if (!dayStartTimestamp) {
      setPenalty('no-start')
      setStep('penalty')
      return
    }

    if (Date.now() - dayStartTimestamp > DAY_MS) {
      setPenalty('day-expired')
      setStep('penalty')
    }
  }, [])

  useEffect(() => {
    if (!penalty || penaltyPostedRef.current || affirmations.length === 0) return
    const today = new Date().toISOString().slice(0, 10)
    const postedDate = localStorage.getItem('limitless_vf_penalty_date')
    if (postedDate === today) {
      penaltyPostedRef.current = true
      return
    }

    penaltyPostedRef.current = true

    const affirmationPayload = affirmations.map((affirmation) => ({
      index: affirmation.index,
      convictionScore: 0,
      resistanceScore: 10,
      exploration: '',
      resistance: ''
    }))

    fetch('/api/vf-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presenceScore: null,
        affirmations: affirmationPayload
      })
    }).catch(() => {})

    const eventPayload = {
      type: 'penalty',
      reason: penalty === 'no-start' ? 'no-start-day' : 'day-expired',
      severity: penalty === 'no-start' ? 'critical' : 'high'
    }

    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [eventPayload] })
    }).catch(() => {})

    localStorage.setItem('limitless_vf_penalty_date', today)
    localStorage.setItem('limitless_vf_completed_date', today)
  }, [penalty, affirmations])

  const currentAffirmation = affirmations[currentIndex]
  const currentScores = currentAffirmation ? scores[currentAffirmation.index] : null

  const groupedAffirmations = useMemo(() => {
    const grouped = {}
    for (const affirmation of affirmations) {
      const category = affirmation.category || 'identity'
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(affirmation)
    }
    return grouped
  }, [affirmations])

  const totalCount = affirmations.length

  const updateScore = (index, field, value) => {
    setScores((prev) => ({
      ...prev,
      [index]: {
        ...(prev[index] || { resistanceScore: 0, convictionScore: 0 }),
        [field]: value
      }
    }))
  }

  const handleNext = () => {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setStep('summary')
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const payload = affirmations.map((affirmation) => ({
      index: affirmation.index,
      convictionScore: scores[affirmation.index]?.convictionScore ?? 0,
      resistanceScore: scores[affirmation.index]?.resistanceScore ?? 0,
      exploration: '',
      resistance: ''
    }))

    try {
      await fetch('/api/vf-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presenceScore: null, affirmations: payload })
      })
      const today = new Date().toISOString().slice(0, 10)
      localStorage.setItem('limitless_vf_completed_date', today)
      localStorage.removeItem('limitless_vf_skipped')
      setSaved(true)
      // Reset after 2s so they can do another session
      setTimeout(() => {
        setSaved(false)
        setStep('intro')
        setCurrentIndex(0)
        setScores({})
      }, 2000)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-[13px] text-white/30">Loading affirmations…</span>
      </div>
    )
  }

  if (step === 'penalty') {
    const title = penalty === 'no-start' ? 'No day started' : 'Day expired without closing'
    const detail = penalty === 'no-start'
      ? 'VF Game was not completed because no day was started.'
      : 'VF Game was not completed within 24 hours of starting the day.'

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center overflow-hidden">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-white/20">Penalty</p>
          <h1 className="mt-3 text-[26px] font-semibold text-white">{title}</h1>
          <p className="mt-3 text-[14px] text-white/35">{detail}</p>
        </div>
        <button
          type="button"
          onClick={() => onBack?.()}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[13px] font-medium text-white/40"
        >
          Back
        </button>
      </div>
    )
  }

  if (step === 'summary') {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-10">
        <div className="pt-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-white/25">VF Game</p>
          <h1 className="mt-2 text-[24px] font-semibold text-white">Summary</h1>
          <p className="mt-2 text-[13px] text-white/35">A snapshot of today’s inner landscape.</p>
        </div>

        <div className="mt-6 space-y-5">
          {Object.entries(groupedAffirmations).map(([category, list]) => {
            const label = formatCategoryLabel(category, categories)
            return (
              <div key={category} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[13px] font-semibold text-white/60">{label}</p>
                <div className="mt-3 space-y-3">
                  {list.map((affirmation) => {
                    const row = scores[affirmation.index] || { resistanceScore: 0, convictionScore: 0 }
                    return (
                      <div key={affirmation.index} className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                        <p className="text-[12px] text-white/70">{affirmation.text}</p>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-white/40">
                          <span className="rounded-full bg-white/5 px-2 py-1">R {row.resistanceScore}</span>
                          <span className="rounded-full bg-white/5 px-2 py-1">C {row.convictionScore}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-auto pt-8">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            className="w-full rounded-2xl bg-white/[0.08] px-5 py-[18px] text-[15px] font-semibold text-white"
            disabled={saving}
          >
            {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
          </motion.button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-10">
      <div className="pt-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-white/25">VF Game</p>
        {showSkippedNote && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[13px] text-white/45">You skipped the inner work yesterday.</p>
          </div>
        )}
      </div>

      {step === 'intro' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <div>
            <h1 className="text-[30px] font-semibold tracking-tight text-white">VF Game</h1>
            <p className="mt-3 text-[15px] text-white/35">
              A quiet check-in with the beliefs you are shaping. Move slowly and listen.
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setStep('affirmation')}
            className="w-full rounded-2xl bg-white/[0.08] px-5 py-[18px] text-[15px] font-semibold text-white"
          >
            Begin
          </motion.button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="mt-4 flex items-center justify-between text-[12px] text-white/30">
            <span>{formatCategoryLabel(currentAffirmation?.category, categories)}</span>
            <span className="tabular-nums">{currentIndex + 1}/{totalCount}</span>
          </div>

          <div className="mt-8 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentAffirmation?.index}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 240, damping: 28 }}
                className="flex flex-col gap-6"
              >
                <p className="text-[24px] font-semibold leading-tight text-white">
                  {currentAffirmation?.text}
                </p>
                <ScoreRow
                  label="Resistance"
                  hint="How much resistance do you feel toward this being true?"
                  value={currentScores?.resistanceScore ?? 0}
                  onChange={(value) => updateScore(currentAffirmation.index, 'resistanceScore', value)}
                />
                <ScoreRow
                  label="Conviction"
                  hint="How strongly do you believe this right now?"
                  value={currentScores?.convictionScore ?? 0}
                  onChange={(value) => updateScore(currentAffirmation.index, 'convictionScore', value)}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="pt-8">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleNext}
              className="w-full rounded-2xl bg-white/[0.08] px-5 py-[18px] text-[15px] font-semibold text-white"
            >
              {currentIndex === totalCount - 1 ? 'Finish' : 'Next'}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  )
}
