const tabs = [
  { id: 'today', label: '🌅 Today' },
  { id: 'state', label: '📊 State' },
  { id: 'badges', label: '🏅 Badges' },
  { id: 'stats', label: '⚡ Stats' }
]

export default function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-white/10">
      <div className="mx-auto flex max-w-[430px] items-center justify-between px-4 py-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`text-xs tracking-wide transition ${
              activeTab === tab.id ? 'text-white' : 'text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
