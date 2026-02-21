import { AnimatePresence, motion } from 'framer-motion'
import HabitCard from './HabitCard.jsx'
import CompletionScreen from './CompletionScreen.jsx'
import CreativeBlock from './CreativeBlock.jsx'
import WorkSessions from './WorkSessions.jsx'
import NightRoutine from './NightRoutine.jsx'

const slideVariants = {
  enter: { x: 60, opacity: 0, scale: 0.98 },
  center: { x: 0, opacity: 1, scale: 1 },
  exit: { x: -60, opacity: 0, scale: 0.98 }
}

export default function MorningRoutine({
  items,
  statuses,
  currentView,
  onStatusChange,
  onViewChange,
  creativeBlockStartTime,
  onStartCreativeBlock
}) {
  if (currentView === 'night-routine') {
    return <NightRoutine />
  }

  if (currentView === 'work-sessions') {
    return <WorkSessions onEnterNightMode={() => onViewChange('night-routine')} />
  }
  const nextIndex = items.findIndex((item) => !statuses[item.id])
  const allComplete = nextIndex === -1

  const doneCount = items.filter((item) => statuses[item.id] === 'done').length
  const skippedCount = items.filter((item) => statuses[item.id] === 'skipped').length

  if (currentView === 'creative-block') {
    return (
      <CreativeBlock
        startTime={creativeBlockStartTime}
        onStart={onStartCreativeBlock}
        onEnterWorkSessions={() => onViewChange('work-sessions')}
      />
    )
  }

  if (allComplete || currentView === 'completed') {
    return (
      <CompletionScreen
        doneCount={doneCount}
        skippedCount={skippedCount}
        onGoCreative={() => onViewChange('creative-block')}
      />
    )
  }

  const currentItem = items[nextIndex]

  return (
    <div className="flex-1 flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex-1 flex flex-col"
        >
          <HabitCard
            item={currentItem}
            index={nextIndex}
            total={items.length}
            onDone={() => onStatusChange(currentItem.id, 'done')}
            onSkip={() => onStatusChange(currentItem.id, 'skipped')}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
