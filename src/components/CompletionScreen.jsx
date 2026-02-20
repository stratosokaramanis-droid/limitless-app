export default function CompletionScreen({ doneCount, skippedCount, onGoCreative }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-card px-6 py-10 text-center">
      <h2 className="text-2xl font-semibold text-white">Morning block done.</h2>
      <div className="space-y-2 text-sm text-gray-400">
        <p>✅ {doneCount} completed</p>
        <p>⏭ {skippedCount} skipped</p>
      </div>
      <a
        className="w-full border border-white/20 bg-white/10 px-4 py-3 text-center text-sm uppercase tracking-wider text-white"
        href="https://t.me/limitless_dawn_bot"
        target="_blank"
        rel="noreferrer"
      >
        💬 Log Morning →
      </a>
      <button
        onClick={onGoCreative}
        className="text-xs uppercase tracking-[0.25em] text-gray-500"
      >
        Enter Creative Block
      </button>
    </div>
  )
}
