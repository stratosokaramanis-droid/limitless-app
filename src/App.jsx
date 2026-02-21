import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import BottomNav from './components/BottomNav.jsx'
import DashboardTab from './components/DashboardTab.jsx'
import MorningRoutine from './components/MorningRoutine.jsx'
import BadgesTab from './components/BadgesTab.jsx'
import StateTab from './components/StateTab.jsx'
import StatsTab from './components/StatsTab.jsx'
import morningRoutine from './data/morningRoutine.js'
import DevPanel from './components/DevPanel.jsx'

const STORAGE_KEYS = {
  statuses: 'limitless_morning_statuses',
  currentView: 'limitless_current_view',
  creativeBlockStart: 'limitless_creative_block_start',
  workSessions: 'limitless_work_sessions',
  nightRoutine: 'limitless_night_routine',
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
  const [activeTab, setActiveTab] = useState('home')
  const [statuses, setStatuses] = useState(() => loadJson(STORAGE_KEYS.statuses, {}))
  const [currentView, setCurrentView] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.currentView) || 'morning-routine'
  )
  const [creativeBlockStartTime, setCreativeBlockStartTime] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.creativeBlockStart)
    return stored ? Number(stored) : null
  })

  const items = useMemo(() => morningRoutine, [])

  // Daily reset + reconcile with server on mount
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
      localStorage.removeItem(STORAGE_KEYS.workSessions)
      localStorage.removeItem(STORAGE_KEYS.nightRoutine)
      setStatuses({})
      setCurrentView('morning-routine')
      setCreativeBlockStartTime(null)
      return
    }

    if (!lastReset) {
      localStorage.setItem(STORAGE_KEYS.lastReset, today)
    }

    // Reconcile: fetch server state and merge into localStorage
    fetch('/api/morning-block-log')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data || data.date !== today || !data.items?.length) return
        const serverStatuses = {}
        for (const item of data.items) {
          serverStatuses[item.id] = item.status
        }
        setStatuses((prev) => {
          const merged = { ...serverStatuses, ...prev }
          localStorage.setItem(STORAGE_KEYS.statuses, JSON.stringify(merged))
          return merged
        })
      })
      .catch(() => {})
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

  const renderFocus = () => (
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
    <div className="h-dvh overflow-hidden bg-black text-white">
      <div
        className="mx-auto flex h-dvh max-w-[430px] flex-col"
        style={{ paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}
      >
        <main className="flex-1 flex flex-col pt-safe">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex-1 flex flex-col"
            >
              {activeTab === 'home' && (
                <DashboardTab onNavigateToFocus={() => setActiveTab('focus')} />
              )}
              {activeTab === 'focus' && renderFocus()}
              {activeTab === 'state' && <StateTab />}
              {activeTab === 'badges' && <BadgesTab />}
              {activeTab === 'stats' && <StatsTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      <DevPanel />
    </div>
  )
}
