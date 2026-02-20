import { useEffect, useMemo, useState } from 'react'
import BottomNav from './components/BottomNav.jsx'
import MorningRoutine from './components/MorningRoutine.jsx'
import PlaceholderTab from './components/PlaceholderTab.jsx'
import StateTab from './components/StateTab.jsx'
import morningRoutine from './data/morningRoutine.js'

const STORAGE_KEYS = {
  statuses: 'limitless_morning_statuses',
  currentView: 'limitless_current_view',
  creativeBlockStart: 'limitless_creative_block_start',
  lastReset: 'limitless_last_reset'
}

const loadJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch (error) {
    console.log('Failed to load from storage', error)
    return fallback
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('today')
  const [statuses, setStatuses] = useState(() => loadJson(STORAGE_KEYS.statuses, {}))
  const [currentView, setCurrentView] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.currentView) || 'morning-routine'
  )
  const [creativeBlockStartTime, setCreativeBlockStartTime] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.creativeBlockStart)
    return stored ? Number(stored) : null
  })

  const items = useMemo(() => morningRoutine, [])

  useEffect(() => {
    const now = new Date()
    const hour = now.getHours()
    const today = now.toISOString().slice(0, 10)
    const lastReset = localStorage.getItem(STORAGE_KEYS.lastReset)

    if (hour >= 3 && lastReset !== today) {
      localStorage.setItem(STORAGE_KEYS.lastReset, today)
      localStorage.removeItem(STORAGE_KEYS.statuses)
      localStorage.removeItem(STORAGE_KEYS.currentView)
      localStorage.removeItem(STORAGE_KEYS.creativeBlockStart)
      setStatuses({})
      setCurrentView('morning-routine')
      setCreativeBlockStartTime(null)
      return
    }

    if (!lastReset) {
      localStorage.setItem(STORAGE_KEYS.lastReset, today)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.statuses, JSON.stringify(statuses))
  }, [statuses])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.currentView, currentView)
  }, [currentView])

  useEffect(() => {
    if (creativeBlockStartTime) {
      localStorage.setItem(STORAGE_KEYS.creativeBlockStart, String(creativeBlockStartTime))
    } else {
      localStorage.removeItem(STORAGE_KEYS.creativeBlockStart)
    }
  }, [creativeBlockStartTime])

  useEffect(() => {
    const allComplete = items.every((item) => statuses[item.id])
    if (allComplete && currentView === 'morning-routine') {
      setCurrentView('completed')
    }
  }, [items, statuses, currentView])

  const logInteraction = async (itemId, status) => {
    try {
      await fetch('/api/morning-block-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          status,
          timestamp: new Date().toISOString()
        })
      })
    } catch (error) {
      console.log('Morning block log failed', error)
    }
  }

  const handleStatusChange = (itemId, status) => {
    setStatuses((prev) => ({
      ...prev,
      [itemId]: status
    }))
    logInteraction(itemId, status)
  }

  const handleStartCreativeBlock = () => {
    if (!creativeBlockStartTime) {
      setCreativeBlockStartTime(Date.now())
    }
  }

  const renderToday = () => (
    <MorningRoutine
      items={items}
      statuses={statuses}
      currentView={currentView}
      onStatusChange={handleStatusChange}
      onViewChange={setCurrentView}
      creativeBlockStartTime={creativeBlockStartTime}
      onStartCreativeBlock={handleStartCreativeBlock}
    />
  )

  return (
    <div className="min-h-screen bg-bg text-white">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col pb-20">
        <main className="flex-1 p-4">
          <div className="h-full border border-white/10 bg-card shadow-glow">
            {activeTab === 'today' && renderToday()}
            {activeTab === 'state' && <StateTab />}
            {activeTab === 'badges' && <PlaceholderTab title="Badges" />}
            {activeTab === 'stats' && <PlaceholderTab title="Stats" />}
          </div>
        </main>
      </div>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}
