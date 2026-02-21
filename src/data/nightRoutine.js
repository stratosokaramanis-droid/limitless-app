// Night Routine (3 items) + Bed Routine (4 items)
// Each item maps to a field in night-routine.json via the file server

const nightRoutine = [
  // ─── Night Routine ──────────────────────────────────
  {
    id: 'letting-go',
    title: 'Letting Go',
    description: 'Meditation to release the day\'s tension.',
    phase: 'night',
    field: 'letGoCompleted',
    timestampField: 'letGoTimestamp',
    lunaLink: false,
  },
  {
    id: 'nervous-system',
    title: 'Regulate',
    description: 'Nervous system regulation exercise.',
    phase: 'night',
    field: 'nervousSystemCompleted',
    timestampField: 'nervousSystemTimestamp',
    lunaLink: false,
  },
  {
    id: 'plan-tomorrow',
    title: 'Plan Tomorrow',
    description: 'Write tomorrow\'s plan. Talk it through with Luna.',
    phase: 'night',
    field: 'planCompleted',
    timestampField: 'planTimestamp',
    lunaLink: true,
  },

  // ─── Bed Routine ────────────────────────────────────
  {
    id: 'finalize-plan',
    title: 'Finalize Plan',
    description: 'Send final plan to Luna — text or photo.',
    phase: 'bed',
    field: null, // no separate field, part of plan flow
    timestampField: null,
    lunaLink: true,
  },
  {
    id: 'read-prompts',
    title: 'Read Prompts',
    description: 'Review prompt questions. Discuss with Luna if you want.',
    phase: 'bed',
    field: 'promptsReviewed',
    timestampField: 'promptsTimestamp',
    lunaLink: true,
  },
  {
    id: 'affirmations',
    title: 'Affirmations',
    description: 'Read your affirmations.',
    phase: 'bed',
    field: 'affirmationsReviewed',
    timestampField: 'affirmationsTimestamp',
    lunaLink: false,
  },
  {
    id: 'alter-memories',
    title: 'Alter Memories',
    description: 'Luna gives you today\'s negative votes for the meditation.',
    phase: 'bed',
    field: 'alterMemoriesCompleted',
    timestampField: 'alterMemoriesTimestamp',
    lunaLink: true,
  },
]

export default nightRoutine
