/**
 * Combat Sound Effects — Web Audio API
 * Synthesized gunshot-style audio for hit and critical attacks.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * Player attack hit — single gunshot
 * Short noise burst through a high-pass filter → fast decay → feels like a pistol/rifle crack
 */
export function playHitSound() {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime
    const duration = 0.12

    // Noise burst (the "bang")
    const bufSize = Math.ceil(ctx.sampleRate * duration)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      // Sharp exponential attack + fast decay
      const t = i / ctx.sampleRate
      const env = Math.exp(-t * 40)
      data[i] = (Math.random() * 2 - 1) * 0.5 * env
    }
    const src = ctx.createBufferSource()
    src.buffer = buf

    // High-pass filter — makes it feel like a sharp crack, not a thud
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(1200, now)
    hp.frequency.exponentialRampToValueAtTime(400, now + duration)

    // Slight resonant peak for "metallic" quality
    const peak = ctx.createBiquadFilter()
    peak.type = 'peaking'
    peak.frequency.setValueAtTime(2500, now)
    peak.Q.setValueAtTime(2, now)
    peak.gain.setValueAtTime(6, now)

    // Master gain envelope
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    src.connect(hp)
    hp.connect(peak)
    peak.connect(gain)
    gain.connect(ctx.destination)

    src.start(now)
    src.stop(now + duration)
  } catch {
    // Audio not available
  }
}

/**
 * Critical hit — heavy gunshot / sniper rifle crack
 * Layered: sharp high-freq crack + mid-range punch + low boom tail
 * Louder and longer than normal hit, with more bass
 */
export function playCritSound() {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime

    // ── Layer 1: Sharp crack (the initial snap) ──
    const crackDur = 0.06
    const crackBufSize = Math.ceil(ctx.sampleRate * crackDur)
    const crackBuf = ctx.createBuffer(1, crackBufSize, ctx.sampleRate)
    const crackData = crackBuf.getChannelData(0)
    for (let i = 0; i < crackBufSize; i++) {
      const env = Math.exp(-i / (crackBufSize * 0.08))
      crackData[i] = (Math.random() * 2 - 1) * 0.8 * env
    }
    const crackSrc = ctx.createBufferSource()
    crackSrc.buffer = crackBuf

    const crackHP = ctx.createBiquadFilter()
    crackHP.type = 'highpass'
    crackHP.frequency.setValueAtTime(2000, now)

    const crackGain = ctx.createGain()
    crackGain.gain.setValueAtTime(0.35, now)
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDur)

    crackSrc.connect(crackHP)
    crackHP.connect(crackGain)
    crackGain.connect(ctx.destination)
    crackSrc.start(now)
    crackSrc.stop(now + crackDur)

    // ── Layer 2: Mid-range punch (the body of the shot) ──
    const punchDur = 0.15
    const punchBufSize = Math.ceil(ctx.sampleRate * punchDur)
    const punchBuf = ctx.createBuffer(1, punchBufSize, ctx.sampleRate)
    const punchData = punchBuf.getChannelData(0)
    for (let i = 0; i < punchBufSize; i++) {
      const t = i / ctx.sampleRate
      const env = Math.exp(-t * 20)
      punchData[i] = (Math.random() * 2 - 1) * 0.45 * env
    }
    const punchSrc = ctx.createBufferSource()
    punchSrc.buffer = punchBuf

    const punchBP = ctx.createBiquadFilter()
    punchBP.type = 'bandpass'
    punchBP.frequency.setValueAtTime(800, now)
    punchBP.Q.setValueAtTime(1.5, now)

    const punchGain = ctx.createGain()
    punchGain.gain.setValueAtTime(0.25, now)
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + punchDur)

    punchSrc.connect(punchBP)
    punchBP.connect(punchGain)
    punchGain.connect(ctx.destination)
    punchSrc.start(now + 0.005)  // slight delay for layering
    punchSrc.stop(now + punchDur)

    // ── Layer 3: Low boom tail (heavy bass impact) ──
    const boomDur = 0.18
    const boomOsc = ctx.createOscillator()
    boomOsc.type = 'sine'
    boomOsc.frequency.setValueAtTime(80, now)
    boomOsc.frequency.exponentialRampToValueAtTime(25, now + boomDur)

    const boomGain = ctx.createGain()
    boomGain.gain.setValueAtTime(0.25, now)
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + boomDur)

    // Distortion for extra grittiness
    const distortion = ctx.createWaveShaper()
    const curve = new Float32Array(256)
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1
      curve[i] = (Math.PI + 4) * x / (Math.PI + 4 * Math.abs(x))
    }
    distortion.curve = curve

    boomOsc.connect(distortion)
    distortion.connect(boomGain)
    boomGain.connect(ctx.destination)
    boomOsc.start(now + 0.01)
    boomOsc.stop(now + boomDur)

    // ── Layer 4: High-freq "zing" ricochet tail ──
    const zingDur = 0.25
    const zingOsc = ctx.createOscillator()
    zingOsc.type = 'sine'
    zingOsc.frequency.setValueAtTime(4000, now + 0.03)
    zingOsc.frequency.exponentialRampToValueAtTime(1200, now + zingDur)

    const zingGain = ctx.createGain()
    zingGain.gain.setValueAtTime(0, now)
    zingGain.gain.linearRampToValueAtTime(0.06, now + 0.035)
    zingGain.gain.exponentialRampToValueAtTime(0.001, now + zingDur)

    zingOsc.connect(zingGain)
    zingGain.connect(ctx.destination)
    zingOsc.start(now + 0.03)
    zingOsc.stop(now + zingDur)
  } catch {
    // Audio not available
  }
}
