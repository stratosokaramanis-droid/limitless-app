let ctx = null

function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return null }
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, duration, gain = 0.08) {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(gain, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration / 1000)
  osc.connect(g)
  g.connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + duration / 1000)
}

export const sounds = {
  tap: () => tone(1200, 30, 0.06),

  complete: () => {
    tone(523.25, 80, 0.07) // C5
    setTimeout(() => tone(659.25, 80, 0.07), 90)  // E5
    setTimeout(() => tone(783.99, 120, 0.07), 180) // G5
  },

  success: () => {
    const c = getCtx()
    if (!c) return
    const freqs = [500, 630, 750]
    for (const f of freqs) {
      const osc = c.createOscillator()
      const g = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      g.gain.setValueAtTime(0.05, c.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2)
      osc.connect(g)
      g.connect(c.destination)
      osc.start()
      osc.stop(c.currentTime + 0.2)
    }
  },
}
