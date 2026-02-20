import { AnimatePresence, motion } from 'framer-motion'
import HabitCard from './HabitCard.jsx'
import CompletionScreen from './CompletionScreen.jsx'
import CreativeBlock from './CreativeBlock.jsx'
import WorkSessions from './WorkSessions.jsx'

const slideVariants = {
  enter: { x: 120, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -120, opacity: 0 }
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
  if (currentView === 'work-sessions') {
    return <WorkSessions />
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
    <div className="h-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="h-full"
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
