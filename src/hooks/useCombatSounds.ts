/**
 * Combat Sound Effects — Web Audio API
 * No external assets needed, all sounds are synthesized.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  // Resume if suspended (browsers require user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * Player attack hit — quick percussive noise burst
 * Short white-noise envelope (50ms) with a low-pass filter for a "thud" feel
 */
export function playHitSound() {
  try {
    const ctx = getCtx()
    const duration = 0.06
    const now = ctx.currentTime

    // White noise source
    const bufferSize = Math.ceil(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    // Low-pass filter for a meatier "thud"
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(800, now)
    filter.frequency.exponentialRampToValueAtTime(200, now + duration)

    // Gain envelope
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    source.start(now)
    source.stop(now + duration)
  } catch {
    // Audio not available, fail silently
  }
}

/**
 * Critical hit — gunshot / burst / lightning crack
 * Layered: sharp noise crack (bandpass filtered) + low-frequency boom punch
 */
export function playCritSound() {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 1. Sharp crack — loud white noise through a bandpass filter, very fast decay
    const crackDuration = 0.08
    const crackBufSize = Math.ceil(ctx.sampleRate * crackDuration)
    const crackBuf = ctx.createBuffer(1, crackBufSize, ctx.sampleRate)
    const crackData = crackBuf.getChannelData(0)
    for (let i = 0; i < crackBufSize; i++) {
      // Exponential decay baked into the noise for extra sharpness
      const env = Math.exp(-i / (crackBufSize * 0.15))
      crackData[i] = (Math.random() * 2 - 1) * 0.6 * env
    }
    const crackSource = ctx.createBufferSource()
    crackSource.buffer = crackBuf

    // Bandpass filter — emphasizes the "crack" frequencies (1.5kHz-4kHz)
    const bandpass = ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.setValueAtTime(3000, now)
    bandpass.Q.setValueAtTime(0.8, now)

    const crackGain = ctx.createGain()
    crackGain.gain.setValueAtTime(0.3, now)
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDuration)

    crackSource.connect(bandpass)
    bandpass.connect(crackGain)
    crackGain.connect(ctx.destination)
    crackSource.start(now)
    crackSource.stop(now + crackDuration)

    // 2. Low-frequency boom — 60Hz sine punch for impact
    const boomDuration = 0.1
    const boomOsc = ctx.createOscillator()
    boomOsc.type = 'sine'
    boomOsc.frequency.setValueAtTime(60, now)
    boomOsc.frequency.exponentialRampToValueAtTime(30, now + boomDuration)

    const boomGain = ctx.createGain()
    boomGain.gain.setValueAtTime(0.2, now)
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + boomDuration)

    boomOsc.connect(boomGain)
    boomGain.connect(ctx.destination)
    boomOsc.start(now)
    boomOsc.stop(now + boomDuration)
  } catch {
    // Audio not available, fail silently
  }
}
